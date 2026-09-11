-- BARUNA business RBAC catalog and assignment lifecycle metadata.
-- This migration is additive: legacy roles, functions, and feature RLS remain intact.

INSERT INTO public.rbac_roles(code, name, description, is_system) VALUES
  ('registered_user', 'Registered User', 'Authenticated BARUNA user with baseline access.', true),
  ('participant', 'Participant', 'Active participant in BARUNA programmes and learning.', true),
  ('expert', 'Expert', 'Verified domain expert who may contribute to programmes.', true),
  ('operator', 'Operator', 'Operational data and workflow manager.', true),
  ('reviewer', 'Reviewer', 'Reviews content and records and provides findings.', true),
  ('verifier', 'Verifier', 'Verifies correctness, compliance, and evidence.', true),
  ('approver', 'Approver', 'Approves records for use in services.', true),
  ('publisher', 'Publisher', 'Publishes approved information for its audience.', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = true;

WITH domains(code, label) AS (
  VALUES
    ('academy', 'Academy'), ('knowledge', 'Knowledge Hub'),
    ('experts', 'Experts'), ('events', 'Events'),
    ('partnership', 'Partnership'), ('community', 'Community'),
    ('fellowship', 'Fellowship & Exchange'), ('about', 'About BARUNA')
), actions(code, label) AS (
  VALUES
    ('read', 'read'), ('create', 'create'), ('update', 'update'),
    ('delete', 'delete'), ('review', 'review'), ('verify', 'verify'),
    ('approve', 'approve'), ('publish', 'publish'), ('archive', 'archive')
)
INSERT INTO public.rbac_permissions(code, description)
SELECT domains.code || '.' || actions.code,
       actions.label || ' ' || domains.label || ' data'
FROM domains CROSS JOIN actions
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

-- Conservative initial mappings. Ownership and resource scope will be enforced
-- when each feature migrates from its legacy RLS in a later phase.
WITH mapping(role_code, action_codes) AS (
  VALUES
    ('registered_user', ARRAY['read']::text[]),
    ('participant', ARRAY['read']::text[]),
    ('expert', ARRAY['read']::text[]),
    ('operator', ARRAY['read','create','update','delete','archive']::text[]),
    ('reviewer', ARRAY['read','review']::text[]),
    ('verifier', ARRAY['read','verify']::text[]),
    ('approver', ARRAY['read','approve']::text[]),
    ('publisher', ARRAY['read','publish','archive']::text[]),
    ('admin', ARRAY['read','create','update','delete','archive']::text[]),
    ('management', ARRAY['read','approve']::text[]),
    ('qa_reviewer', ARRAY['read','review']::text[])
), domains(code) AS (
  VALUES ('academy'), ('knowledge'), ('experts'), ('events'),
         ('partnership'), ('community'), ('fellowship'), ('about')
)
INSERT INTO public.rbac_role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM mapping m
JOIN public.rbac_roles r ON r.code = m.role_code
CROSS JOIN domains d
CROSS JOIN unnest(m.action_codes) AS a(code)
JOIN public.rbac_permissions p ON p.code = d.code || '.' || a.code
ON CONFLICT DO NOTHING;

ALTER TABLE public.rbac_user_roles
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN valid_from timestamptz,
  ADD COLUMN valid_until timestamptz,
  ADD COLUMN approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN reason text,
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.rbac_user_roles
SET valid_from = created_at,
    approved_by = granted_by,
    approved_at = created_at,
    reason = COALESCE(reason, 'legacy_assignment_backfill');

ALTER TABLE public.rbac_user_roles
  ALTER COLUMN valid_from SET DEFAULT now(),
  ALTER COLUMN valid_from SET NOT NULL,
  ADD CONSTRAINT rbac_user_roles_status_check
    CHECK (status IN ('active', 'suspended', 'revoked')),
  ADD CONSTRAINT rbac_user_roles_validity_check
    CHECK (valid_until IS NULL OR valid_until > valid_from),
  ADD CONSTRAINT rbac_user_roles_revocation_check
    CHECK ((status = 'revoked' AND revoked_at IS NOT NULL) OR status <> 'revoked');

CREATE INDEX rbac_user_roles_active_lookup_idx
  ON public.rbac_user_roles(user_id, role_id, valid_from, valid_until)
  WHERE status = 'active';
CREATE INDEX rbac_user_roles_primary_idx
  ON public.rbac_user_roles(user_id) WHERE is_primary AND status = 'active';

CREATE TABLE public.rbac_role_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.rbac_roles(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('grant', 'revoke')),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'applied')),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_note text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((reviewed_at IS NULL AND reviewed_by IS NULL) OR
         (reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL))
);

CREATE INDEX rbac_role_change_requests_target_idx
  ON public.rbac_role_change_requests(target_user_id, created_at DESC);
CREATE INDEX rbac_role_change_requests_pending_idx
  ON public.rbac_role_change_requests(created_at) WHERE status = 'pending';
CREATE TRIGGER rbac_role_change_requests_touch_updated_at
  BEFORE UPDATE ON public.rbac_role_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.current_user_has_permission(_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rbac_user_roles ur
    JOIN public.rbac_role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.rbac_permissions p ON p.id = rp.permission_id
    JOIN public.profiles pr ON pr.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND p.code = _permission
      AND pr.is_active
      AND ur.status = 'active'
      AND ur.valid_from <= now()
      AND (ur.valid_until IS NULL OR ur.valid_until > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_any_permission(_permissions text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM unnest(COALESCE(_permissions, ARRAY[]::text[])) AS permission(code)
    WHERE public.current_user_has_permission(permission.code)
  )
$$;

REVOKE ALL ON FUNCTION public.current_user_has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_has_any_permission(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_has_any_permission(text[]) TO authenticated, service_role;

ALTER TABLE public.rbac_role_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY rbac_change_requests_read_authorized
  ON public.rbac_role_change_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR target_user_id = auth.uid()
         OR public.current_user_has_permission('roles.manage'));
CREATE POLICY rbac_change_requests_create_authorized
  ON public.rbac_role_change_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid()
              AND public.current_user_has_permission('roles.manage'));
CREATE POLICY rbac_change_requests_update_authorized
  ON public.rbac_role_change_requests FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('roles.manage'))
  WITH CHECK (public.current_user_has_permission('roles.manage'));

GRANT SELECT, INSERT, UPDATE ON public.rbac_role_change_requests TO authenticated;
GRANT ALL ON public.rbac_role_change_requests TO service_role;
