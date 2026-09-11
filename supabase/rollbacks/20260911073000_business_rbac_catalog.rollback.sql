-- Guarded rollback for 20260911073000_business_rbac_catalog.sql.
-- Abort once new business roles or change requests are in use to avoid data loss.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.rbac_role_change_requests) THEN
    RAISE EXCEPTION 'rollback_blocked: role change requests exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.id = ur.role_id
    WHERE r.code IN ('registered_user','participant','expert','operator',
                     'reviewer','verifier','approver','publisher')
  ) THEN
    RAISE EXCEPTION 'rollback_blocked: business role assignments exist';
  END IF;
END $$;

DROP TABLE public.rbac_role_change_requests;
DROP FUNCTION public.current_user_has_any_permission(text[]);
DROP FUNCTION public.current_user_has_permission(text);
DROP INDEX public.rbac_user_roles_primary_idx;
DROP INDEX public.rbac_user_roles_active_lookup_idx;
ALTER TABLE public.rbac_user_roles
  DROP CONSTRAINT rbac_user_roles_revocation_check,
  DROP CONSTRAINT rbac_user_roles_validity_check,
  DROP CONSTRAINT rbac_user_roles_status_check,
  DROP COLUMN revoked_by,
  DROP COLUMN revoked_at,
  DROP COLUMN reason,
  DROP COLUMN approved_at,
  DROP COLUMN approved_by,
  DROP COLUMN valid_until,
  DROP COLUMN valid_from,
  DROP COLUMN scope,
  DROP COLUMN status,
  DROP COLUMN is_primary;

DELETE FROM public.rbac_permissions
WHERE split_part(code, '.', 1) IN
  ('academy','knowledge','experts','events','partnership','community','fellowship','about');
DELETE FROM public.rbac_roles
WHERE code IN ('registered_user','participant','expert','operator',
               'reviewer','verifier','approver','publisher');
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260911073000';
