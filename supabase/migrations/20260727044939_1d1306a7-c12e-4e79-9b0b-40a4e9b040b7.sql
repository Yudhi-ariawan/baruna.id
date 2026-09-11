
-- Bootstrap admin role for Phase 1.1 acceptance test user (disposable @baruna-test.dev account).
DO $$
DECLARE
  v_admin_id uuid := 'efc6743c-92e5-4932-a9a0-2acec2428c53';
BEGIN
  -- This disposable acceptance-test account only exists in the original
  -- project. Keep fresh-project migrations portable by skipping the seed when
  -- its auth user is absent.
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_admin_id)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_admin_id AND role = 'admin') THEN
    INSERT INTO public.user_roles(user_id, role, granted_by)
    VALUES (v_admin_id, 'admin', v_admin_id);
    PERFORM public.log_governance_event(
      'role_granted',
      v_admin_id,
      NULL,
      'user_roles',
      v_admin_id::text,
      NULL,
      jsonb_build_object('role','admin','bootstrap',true,'reason','phase_1_1_acceptance_test_admin_bootstrap')
    );
  END IF;
END $$;
