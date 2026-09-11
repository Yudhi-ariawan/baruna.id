-- Restore the pre-metadata compatibility checker definitions.
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

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260911074000';
