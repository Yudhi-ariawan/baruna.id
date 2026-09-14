-- Public signup provisioning: require complete profile metadata, assign the
-- registered_user primary role, and audit the assignment atomically.

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text := NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), '');
  v_organization text := NULLIF(trim(NEW.raw_user_meta_data ->> 'organization'), '');
  v_job_title text := NULLIF(trim(NEW.raw_user_meta_data ->> 'job_title'), '');
  v_phone text := NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), '');
  v_role_id uuid;
  v_assignment_id uuid;
BEGIN
  -- Admin invitations have their own profile and role-assignment workflow.
  -- Preserve that path so requiring public-registration metadata does not
  -- break /admin/users invitations.
  IF NEW.invited_at IS NOT NULL THEN
    INSERT INTO public.profiles(id, display_name, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), '')
      ),
      NULLIF(trim(NEW.raw_user_meta_data ->> 'avatar_url'), '')
    ) ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  IF v_display_name IS NULL THEN RAISE EXCEPTION 'display_name_required'; END IF;
  IF v_organization IS NULL THEN RAISE EXCEPTION 'organization_required'; END IF;
  IF v_job_title IS NULL THEN RAISE EXCEPTION 'job_title_required'; END IF;
  IF v_phone IS NULL THEN RAISE EXCEPTION 'phone_required'; END IF;

  SELECT id INTO v_role_id
  FROM public.rbac_roles
  WHERE code = 'registered_user' AND is_system;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'registered_user_role_not_found';
  END IF;

  INSERT INTO public.profiles(
    id, display_name, avatar_url, phone, job_title, organization
  ) VALUES (
    NEW.id,
    v_display_name,
    NULLIF(trim(NEW.raw_user_meta_data ->> 'avatar_url'), ''),
    v_phone,
    v_job_title,
    v_organization
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    phone = EXCLUDED.phone,
    job_title = EXCLUDED.job_title,
    organization = EXCLUDED.organization;

  INSERT INTO public.rbac_user_roles(
    user_id, role_id, granted_by, is_primary, status, scope,
    valid_from, valid_until, approved_by, approved_at, reason
  ) VALUES (
    NEW.id, v_role_id, NULL, true, 'active', '{}'::jsonb,
    now(), NULL, NULL, now(), 'public_signup_default'
  )
  ON CONFLICT (user_id, role_id) DO UPDATE SET
    is_primary = true,
    status = 'active',
    scope = '{}'::jsonb,
    valid_from = now(),
    valid_until = NULL,
    reason = 'public_signup_default',
    revoked_at = NULL,
    revoked_by = NULL
  RETURNING id INTO v_assignment_id;

  PERFORM public.log_admin_event(
    'default_role_assigned',
    NULL,
    NEW.id,
    'rbac_user_role',
    v_assignment_id::text,
    NULL,
    jsonb_build_object(
      'role', 'registered_user',
      'is_primary', true,
      'status', 'active'
    ),
    jsonb_build_object('reason', 'public_signup_default', 'source', 'auth_signup')
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO service_role;
