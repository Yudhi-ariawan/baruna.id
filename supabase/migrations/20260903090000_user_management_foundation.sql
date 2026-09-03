-- BARUNA user-management foundation: profiles, normalized RBAC and audit.
-- The legacy public.user_roles table remains intact while callers migrate.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  phone text,
  job_title text,
  organization text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rbac_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rbac_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rbac_role_permissions (
  role_id uuid NOT NULL REFERENCES public.rbac_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.rbac_permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.rbac_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.rbac_roles(id) ON DELETE RESTRICT,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (length(trim(event_type)) > 0),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rbac_user_roles_user_id_idx ON public.rbac_user_roles(user_id);
CREATE INDEX admin_audit_log_actor_idx ON public.admin_audit_log(actor_id, created_at DESC);
CREATE INDEX admin_audit_log_target_idx ON public.admin_audit_log(target_user_id, created_at DESC);

CREATE TRIGGER profiles_touch_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER rbac_roles_touch_updated_at BEFORE UPDATE ON public.rbac_roles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

INSERT INTO public.profiles(id, display_name, avatar_url, created_at)
SELECT id,
       COALESCE(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'full_name'),
       raw_user_meta_data ->> 'avatar_url',
       created_at
FROM auth.users ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rbac_roles(code, name, description, is_system) VALUES
  ('super_admin', 'Super Administrator', 'Full platform access and RBAC ownership.', true),
  ('admin', 'Administrator', 'Operational administration.', true),
  ('management', 'Management', 'Governance and management access.', true),
  ('qa_reviewer', 'QA Reviewer', 'Quality assurance review access.', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.rbac_permissions(code, description) VALUES
  ('users.read', 'View users and profiles'),
  ('users.update', 'Update user profiles and status'),
  ('users.assign_role', 'Grant and revoke user roles'),
  ('roles.read', 'View roles and permissions'),
  ('roles.manage', 'Manage roles and permission mappings'),
  ('audit.read', 'View administrative audit history'),
  ('governance.read', 'View governance administration data'),
  ('governance.manage', 'Manage governance workflows')
ON CONFLICT (code) DO NOTHING;

-- Super administrators receive every permission, including permissions added later
-- when the companion trigger below runs.
INSERT INTO public.rbac_role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.rbac_roles r CROSS JOIN public.rbac_permissions p
WHERE r.code = 'super_admin' ON CONFLICT DO NOTHING;

INSERT INTO public.rbac_role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.rbac_roles r JOIN public.rbac_permissions p
  ON p.code = ANY (CASE r.code
    WHEN 'admin' THEN ARRAY['users.read','users.update','governance.read','governance.manage','audit.read']
    WHEN 'management' THEN ARRAY['users.read','governance.read','governance.manage','audit.read']
    WHEN 'qa_reviewer' THEN ARRAY['governance.read']
    ELSE ARRAY[]::text[] END)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_super_admin_permission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.rbac_role_permissions(role_id, permission_id)
  SELECT id, NEW.id FROM public.rbac_roles WHERE code = 'super_admin'
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER sync_super_admin_permission_after_insert
  AFTER INSERT ON public.rbac_permissions FOR EACH ROW
  EXECUTE FUNCTION public.sync_super_admin_permission();

-- Preserve existing governance assignments in the normalized model.
INSERT INTO public.rbac_user_roles(user_id, role_id, granted_by, created_at)
SELECT ur.user_id, rr.id, ur.granted_by, ur.created_at
FROM public.user_roles ur JOIN public.rbac_roles rr ON rr.code = ur.role::text
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Deterministic first super-admin: promote the oldest existing legacy admin.
-- If no legacy admin exists, bootstrap_first_super_admin(email) must be called
-- once by service_role with the exact account email.
WITH first_admin AS (
  SELECT ur.user_id, ur.granted_by
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  ORDER BY ur.created_at, ur.user_id
  LIMIT 1
)
INSERT INTO public.rbac_user_roles(user_id, role_id, granted_by)
SELECT fa.user_id, rr.id, fa.granted_by
FROM first_admin fa CROSS JOIN public.rbac_roles rr
WHERE rr.code = 'super_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.id = ur.role_id
    JOIN public.rbac_role_permissions rp ON rp.role_id = r.id
    JOIN public.rbac_permissions p ON p.id = rp.permission_id
    JOIN public.profiles pr ON pr.id = ur.user_id
    WHERE ur.user_id = _user_id AND p.code = _permission AND pr.is_active
  )
$$;

CREATE OR REPLACE FUNCTION public.has_rbac_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.id = ur.role_id
    JOIN public.profiles pr ON pr.id = ur.user_id
    WHERE ur.user_id = _user_id AND r.code = _role AND pr.is_active
  )
$$;

CREATE OR REPLACE FUNCTION public.log_admin_event(
  _event_type text, _actor_id uuid, _target_user_id uuid,
  _entity_type text, _entity_id text, _before jsonb, _after jsonb,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF length(trim(COALESCE(_event_type, ''))) = 0 THEN RAISE EXCEPTION 'event_type_required'; END IF;
  INSERT INTO public.admin_audit_log(event_type, actor_id, target_user_id, entity_type, entity_id, before_data, after_data, metadata)
  VALUES (_event_type, _actor_id, _target_user_id, _entity_type, _entity_id, _before, _after, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.assign_rbac_role(_target_user_id uuid, _role_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_role_id uuid; v_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.has_permission(v_actor, 'users.assign_role') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO v_role_id FROM public.rbac_roles WHERE code = _role_code;
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'role_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _target_user_id) THEN RAISE EXCEPTION 'user_not_found'; END IF;
  INSERT INTO public.rbac_user_roles(user_id, role_id, granted_by)
  VALUES (_target_user_id, v_role_id, v_actor)
  ON CONFLICT (user_id, role_id) DO UPDATE SET granted_by = EXCLUDED.granted_by
  RETURNING id INTO v_id;
  IF _role_code IN ('admin', 'management', 'qa_reviewer') THEN
    INSERT INTO public.user_roles(user_id, role, granted_by)
    VALUES (_target_user_id, _role_code::public.app_role, v_actor)
    ON CONFLICT (user_id, role) DO UPDATE SET granted_by = EXCLUDED.granted_by;
  END IF;
  PERFORM public.log_admin_event('role_assigned', v_actor, _target_user_id, 'rbac_user_role', v_id::text, NULL, jsonb_build_object('role', _role_code));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_rbac_role(_target_user_id uuid, _role_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_role_id uuid; v_assignment_id uuid; v_super_count integer;
BEGIN
  IF v_actor IS NULL OR NOT public.has_permission(v_actor, 'users.assign_role') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT id INTO v_role_id FROM public.rbac_roles WHERE code = _role_code;
  SELECT id INTO v_assignment_id FROM public.rbac_user_roles WHERE user_id = _target_user_id AND role_id = v_role_id FOR UPDATE;
  IF v_assignment_id IS NULL THEN RETURN false; END IF;
  IF _role_code = 'super_admin' THEN
    PERFORM pg_advisory_xact_lock(hashtext('baruna:last-super-admin'));
    SELECT count(*) INTO v_super_count FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.user_id WHERE r.code = 'super_admin' AND p.is_active;
    IF v_super_count <= 1 THEN RAISE EXCEPTION 'last_super_admin_protected'; END IF;
    IF _target_user_id = v_actor THEN RAISE EXCEPTION 'self_lockout_protected'; END IF;
  END IF;
  DELETE FROM public.rbac_user_roles WHERE id = v_assignment_id;
  IF _role_code IN ('admin', 'management', 'qa_reviewer') THEN
    DELETE FROM public.user_roles
    WHERE user_id = _target_user_id AND role = _role_code::public.app_role;
  END IF;
  PERFORM public.log_admin_event('role_revoked', v_actor, _target_user_id, 'rbac_user_role', v_assignment_id::text, jsonb_build_object('role', _role_code), NULL);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.set_user_active(_target_user_id uuid, _is_active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_was_active boolean; v_is_super boolean; v_super_count integer;
BEGIN
  IF v_actor IS NULL OR NOT public.has_permission(v_actor, 'users.update') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT is_active INTO v_was_active FROM public.profiles WHERE id = _target_user_id FOR UPDATE;
  IF v_was_active IS NULL THEN RAISE EXCEPTION 'profile_not_found'; END IF;
  IF NOT _is_active THEN
    IF _target_user_id = v_actor THEN RAISE EXCEPTION 'self_lockout_protected'; END IF;
    SELECT public.has_rbac_role(_target_user_id, 'super_admin') INTO v_is_super;
    IF v_is_super THEN
      PERFORM pg_advisory_xact_lock(hashtext('baruna:last-super-admin'));
      SELECT count(*) INTO v_super_count FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.id = ur.role_id
        JOIN public.profiles p ON p.id = ur.user_id WHERE r.code = 'super_admin' AND p.is_active;
      IF v_super_count <= 1 THEN RAISE EXCEPTION 'last_super_admin_protected'; END IF;
    END IF;
  END IF;
  UPDATE public.profiles SET is_active = _is_active WHERE id = _target_user_id;
  PERFORM public.log_admin_event('user_status_changed', v_actor, _target_user_id, 'profile', _target_user_id::text,
    jsonb_build_object('is_active', v_was_active), jsonb_build_object('is_active', _is_active));
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.bootstrap_first_super_admin(_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid; v_role_id uuid; v_id uuid;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN RAISE EXCEPTION 'service_role_required'; END IF;
  IF EXISTS (SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.id = ur.role_id WHERE r.code = 'super_admin') THEN
    RAISE EXCEPTION 'super_admin_already_exists';
  END IF;
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(_email));
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  SELECT id INTO v_role_id FROM public.rbac_roles WHERE code = 'super_admin';
  INSERT INTO public.rbac_user_roles(user_id, role_id, granted_by) VALUES (v_user_id, v_role_id, v_user_id) RETURNING id INTO v_id;
  INSERT INTO public.user_roles(user_id, role, granted_by)
  VALUES (v_user_id, 'admin', v_user_id)
  ON CONFLICT (user_id, role) DO NOTHING;
  PERFORM public.log_admin_event('first_super_admin_bootstrapped', v_user_id, v_user_id, 'rbac_user_role', v_id::text, NULL, jsonb_build_object('role', 'super_admin'));
  RETURN v_user_id;
END; $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_admin_read ON public.profiles FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'users.read'));
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY rbac_roles_read ON public.rbac_roles FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'roles.read'));
CREATE POLICY rbac_permissions_read ON public.rbac_permissions FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'roles.read'));
CREATE POLICY rbac_role_permissions_read ON public.rbac_role_permissions FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'roles.read'));
CREATE POLICY rbac_user_roles_self_read ON public.rbac_user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY rbac_user_roles_admin_read ON public.rbac_user_roles FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'roles.read'));
CREATE POLICY admin_audit_read ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'audit.read'));

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, phone, job_title, organization) ON public.profiles TO authenticated;
GRANT SELECT ON public.rbac_roles, public.rbac_permissions, public.rbac_role_permissions, public.rbac_user_roles, public.admin_audit_log TO authenticated;
GRANT ALL ON public.profiles, public.rbac_roles, public.rbac_permissions, public.rbac_role_permissions, public.rbac_user_roles, public.admin_audit_log TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_super_admin_permission() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_admin_event(text,uuid,uuid,text,text,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_permission(uuid,text), public.has_rbac_role(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_rbac_role(uuid,text), public.revoke_rbac_role(uuid,text), public.set_user_active(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bootstrap_first_super_admin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid,text), public.has_rbac_role(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_rbac_role(uuid,text), public.revoke_rbac_role(uuid,text), public.set_user_active(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin(text) TO service_role;
