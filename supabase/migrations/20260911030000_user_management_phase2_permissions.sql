-- Phase 2 user-management permissions.
-- The existing trigger automatically grants newly inserted permissions to
-- super_admin. Operational admins receive invite/suspend access explicitly.

INSERT INTO public.rbac_permissions(code, description) VALUES
  ('users.invite', 'Invite new users through Supabase Auth'),
  ('users.suspend', 'Suspend and reactivate user accounts')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.rbac_role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.rbac_roles r
JOIN public.rbac_permissions p ON p.code IN ('users.invite', 'users.suspend')
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_user_active(_target_user_id uuid, _is_active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_was_active boolean; v_is_super boolean; v_super_count integer;
BEGIN
  IF v_actor IS NULL OR NOT public.has_permission(v_actor, 'users.suspend') THEN RAISE EXCEPTION 'forbidden'; END IF;
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

REVOKE ALL ON FUNCTION public.set_user_active(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_active(uuid,boolean) TO authenticated;
