-- Guarded rollback for Step 2 workflow objects.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.rbac_role_change_requests) THEN
    RAISE EXCEPTION 'rollback_blocked: role change requests exist';
  END IF;
END $$;

DELETE FROM public.admin_audit_log
WHERE event_type = 'primary_role_backfilled'
  AND metadata ->> 'migration' = '20260911080000';

DROP FUNCTION public.decide_rbac_role_change(uuid,text,text);
DROP FUNCTION public.request_rbac_role_change(uuid,text,text,text,jsonb,timestamptz,timestamptz);
DROP TRIGGER rbac_user_roles_validate_primary ON public.rbac_user_roles;
DROP FUNCTION public.validate_rbac_user_primary_role();
DROP INDEX public.rbac_user_roles_primary_idx;
CREATE INDEX rbac_user_roles_primary_idx
  ON public.rbac_user_roles(user_id) WHERE is_primary AND status = 'active';

ALTER TABLE public.rbac_role_change_requests
  DROP CONSTRAINT rbac_role_change_requests_validity_check,
  DROP CONSTRAINT rbac_role_change_requests_scope_object_check,
  DROP COLUMN requested_valid_until,
  DROP COLUMN requested_valid_from;
ALTER TABLE public.rbac_user_roles
  DROP CONSTRAINT rbac_user_roles_scope_object_check;

CREATE POLICY rbac_change_requests_create_authorized
  ON public.rbac_role_change_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid()
              AND public.current_user_has_permission('roles.manage'));
CREATE POLICY rbac_change_requests_update_authorized
  ON public.rbac_role_change_requests FOR UPDATE TO authenticated
  USING (public.current_user_has_permission('roles.manage'))
  WITH CHECK (public.current_user_has_permission('roles.manage'));
GRANT INSERT, UPDATE ON public.rbac_role_change_requests TO authenticated;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260911080000';
