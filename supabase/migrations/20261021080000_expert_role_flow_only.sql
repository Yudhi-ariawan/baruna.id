-- ============================================================================
-- Peran `expert` hanya dari alur pendaftaran expert (keputusan 21 Okt 2026)
-- ============================================================================
-- Dicek 21 Okt 2026 (database intern-update):
--
-- Menjadi expert = dua bagian: peran `expert` di akun DAN profil di tabel
-- experts (direktori, portal, status trainer). Persetujuan pendaftaran
-- (admin_expert_decide) dan arsip (admin_expert_archive) mengubah keduanya
-- bersamaan lewat _expert_set_role.
--
-- Empat jalan lain hanya mengubah perannya:
--   assign_rbac_role / revoke_rbac_role  (centang di Users & Access, Tambah User)
--   request_rbac_role_change / decide_rbac_role_change (alur permintaan peran;
--     siapa pun boleh meminta peran untuk dirinya sendiri)
-- Akibatnya: peran tanpa profil -> diarahkan ke Portal Expert tetapi diperlakukan
-- pengguna biasa, formulir Become an Expert menganggapnya sudah expert, tidak ada
-- di direktori. Sebaliknya, mencabut peran tanpa arsip -> profil tetap tayang di
-- direktori sementara portalnya tertutup.
-- Saat dicek: 11 dari 15 pemegang peran expert tidak punya profil (10 akun
-- @kkp.go.id dibuat 1 Okt di luar repo + admin99 untuk uji). Data itu TIDAK
-- diubah migrasi ini; 0 permintaan peran tercatat.
--
-- Migrasi ini menolak peran `expert` di keempat jalan itu (pesan
-- expert_role_managed_by_flow). Isi fungsi lainnya sama persis dengan
-- 20260911080000; persetujuan dan arsip expert tidak memakai fungsi-fungsi ini.

BEGIN;

CREATE OR REPLACE FUNCTION public.assign_rbac_role(_target_user_id uuid, _role_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_role_id uuid; v_id uuid; v_make_primary boolean;
BEGIN
  IF v_actor IS NULL OR NOT public.has_permission(v_actor, 'users.assign_role') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _role_code = 'expert' THEN RAISE EXCEPTION 'expert_role_managed_by_flow'; END IF;
  SELECT id INTO v_role_id FROM public.rbac_roles WHERE code = _role_code;
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'role_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _target_user_id) THEN RAISE EXCEPTION 'user_not_found'; END IF;
  SELECT NOT EXISTS (SELECT 1 FROM public.rbac_user_roles WHERE user_id = _target_user_id AND status = 'active' AND is_primary)
  INTO v_make_primary;
  INSERT INTO public.rbac_user_roles(user_id, role_id, granted_by, is_primary, status, valid_from, approved_by, approved_at, reason)
  VALUES (_target_user_id, v_role_id, v_actor, v_make_primary, 'active', now(), v_actor, now(), 'direct_admin_assignment')
  ON CONFLICT (user_id, role_id) DO UPDATE SET
    granted_by = EXCLUDED.granted_by,
    is_primary = CASE WHEN EXISTS (
      SELECT 1 FROM public.rbac_user_roles other
      WHERE other.user_id = EXCLUDED.user_id AND other.id <> public.rbac_user_roles.id
        AND other.status = 'active' AND other.is_primary
    ) THEN false ELSE true END,
    status = 'active', valid_from = now(), valid_until = NULL,
    approved_by = v_actor, approved_at = now(), reason = 'direct_admin_assignment',
    revoked_at = NULL, revoked_by = NULL
  RETURNING id INTO v_id;
  IF _role_code IN ('admin', 'management', 'qa_reviewer') THEN
    INSERT INTO public.user_roles(user_id, role, granted_by)
    VALUES (_target_user_id, _role_code::public.app_role, v_actor)
    ON CONFLICT (user_id, role) DO UPDATE SET granted_by = EXCLUDED.granted_by;
  END IF;
  PERFORM public.log_admin_event('role_assigned', v_actor, _target_user_id, 'rbac_user_role', v_id::text, NULL,
    jsonb_build_object('role', _role_code, 'path', 'direct_compatibility'));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_rbac_role(_target_user_id uuid, _role_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_role_id uuid; v_assignment public.rbac_user_roles%ROWTYPE; v_super_count integer; v_replacement_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.has_permission(v_actor, 'users.assign_role') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _role_code = 'expert' THEN RAISE EXCEPTION 'expert_role_managed_by_flow'; END IF;
  IF _target_user_id = v_actor THEN RAISE EXCEPTION 'self_lockout_protected'; END IF;
  SELECT id INTO v_role_id FROM public.rbac_roles WHERE code = _role_code;
  SELECT * INTO v_assignment FROM public.rbac_user_roles
  WHERE user_id = _target_user_id AND role_id = v_role_id AND status = 'active' FOR UPDATE;
  IF v_assignment.id IS NULL THEN RETURN false; END IF;
  IF _role_code = 'super_admin' THEN
    PERFORM pg_advisory_xact_lock(hashtext('baruna:last-super-admin'));
    SELECT count(*) INTO v_super_count FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.id = ur.role_id JOIN public.profiles p ON p.id = ur.user_id
    WHERE r.code = 'super_admin' AND p.is_active AND ur.status = 'active'
      AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now());
    IF v_super_count <= 1 THEN RAISE EXCEPTION 'last_super_admin_protected'; END IF;
  END IF;
  IF v_assignment.is_primary THEN
    SELECT id INTO v_replacement_id FROM public.rbac_user_roles
    WHERE user_id = _target_user_id AND status = 'active' AND id <> v_assignment.id
    ORDER BY created_at, id LIMIT 1 FOR UPDATE;
  END IF;
  UPDATE public.rbac_user_roles SET status = 'revoked', is_primary = false,
    revoked_at = now(), revoked_by = v_actor, reason = 'direct_admin_revocation'
  WHERE id = v_assignment.id;
  IF v_replacement_id IS NOT NULL THEN UPDATE public.rbac_user_roles SET is_primary = true WHERE id = v_replacement_id; END IF;
  IF _role_code IN ('admin', 'management', 'qa_reviewer') THEN
    DELETE FROM public.user_roles WHERE user_id = _target_user_id AND role = _role_code::public.app_role;
  END IF;
  PERFORM public.log_admin_event('role_revoked', v_actor, _target_user_id, 'rbac_user_role', v_assignment.id::text,
    jsonb_build_object('role', _role_code), NULL, jsonb_build_object('path', 'direct_compatibility'));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.request_rbac_role_change(
  _target_user_id uuid,
  _role_code text,
  _action text,
  _reason text,
  _scope jsonb DEFAULT '{}'::jsonb,
  _valid_from timestamptz DEFAULT now(),
  _valid_until timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role_id uuid;
  v_request_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_actor AND is_active
  ) THEN RAISE EXCEPTION 'unauthorized_or_inactive'; END IF;
  IF _target_user_id <> v_actor
     AND NOT public.has_permission(v_actor, 'users.assign_role') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _role_code = 'expert' THEN RAISE EXCEPTION 'expert_role_managed_by_flow'; END IF;
  IF COALESCE(_action, '') NOT IN ('grant', 'revoke') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  IF length(trim(COALESCE(_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;
  IF COALESCE(jsonb_typeof(_scope), '') <> 'object' THEN
    RAISE EXCEPTION 'scope_must_be_object';
  END IF;
  IF _valid_from IS NULL OR (_valid_until IS NOT NULL AND _valid_until <= _valid_from) THEN
    RAISE EXCEPTION 'invalid_validity_window';
  END IF;
  SELECT id INTO v_role_id FROM public.rbac_roles WHERE code = _role_code;
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'role_not_found'; END IF;
  IF _role_code = 'super_admin'
     AND NOT public.has_permission(v_actor, 'roles.manage') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  INSERT INTO public.rbac_role_change_requests(
    target_user_id, role_id, action, requested_by, reason, scope,
    requested_valid_from, requested_valid_until
  ) VALUES (
    _target_user_id, v_role_id, _action, v_actor, trim(_reason),
    COALESCE(_scope, '{}'::jsonb), _valid_from, _valid_until
  ) RETURNING id INTO v_request_id;

  PERFORM public.log_admin_event(
    'role_change_requested', v_actor, _target_user_id, 'rbac_role_change_request',
    v_request_id::text, NULL,
    jsonb_build_object('role', _role_code, 'action', _action, 'status', 'pending'),
    jsonb_build_object('scope', _scope, 'valid_from', _valid_from,
                       'valid_until', _valid_until, 'reason', trim(_reason))
  );
  RETURN v_request_id;
END $$;

-- Permintaan lama untuk peran expert masih boleh DITOLAK, tidak boleh diterapkan.
CREATE OR REPLACE FUNCTION public.decide_rbac_role_change(
  _request_id uuid,
  _decision text,
  _decision_note text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_request public.rbac_role_change_requests%ROWTYPE;
  v_role_code text;
  v_assignment public.rbac_user_roles%ROWTYPE;
  v_assignment_id uuid;
  v_make_primary boolean;
  v_super_count integer;
  v_replacement_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.has_permission(v_actor, 'roles.manage') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF COALESCE(_decision, '') NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;

  SELECT * INTO v_request FROM public.rbac_role_change_requests
  WHERE id = _request_id FOR UPDATE;
  IF v_request.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_request.status <> 'pending' THEN RAISE EXCEPTION 'request_not_pending'; END IF;
  SELECT code INTO v_role_code FROM public.rbac_roles WHERE id = v_request.role_id;

  IF _decision = 'approve' AND v_role_code = 'expert' THEN
    RAISE EXCEPTION 'expert_role_managed_by_flow';
  END IF;

  IF _decision = 'approve'
     AND (v_request.requested_by = v_actor OR v_request.target_user_id = v_actor) THEN
    RAISE EXCEPTION 'separation_of_duties_required';
  END IF;

  IF _decision = 'reject' THEN
    UPDATE public.rbac_role_change_requests
    SET status = 'rejected', reviewed_by = v_actor, reviewed_at = now(),
        decision_note = _decision_note
    WHERE id = _request_id;
    PERFORM public.log_admin_event(
      'role_change_rejected', v_actor, v_request.target_user_id,
      'rbac_role_change_request', _request_id::text,
      jsonb_build_object('status', 'pending'),
      jsonb_build_object('status', 'rejected', 'role', v_role_code,
                         'action', v_request.action),
      jsonb_build_object('decision_note', _decision_note)
    );
    RETURN 'rejected';
  END IF;

  IF v_request.action = 'grant' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.rbac_user_roles
      WHERE user_id = v_request.target_user_id
        AND status = 'active' AND is_primary
    ) INTO v_make_primary;

    INSERT INTO public.rbac_user_roles(
      user_id, role_id, granted_by, is_primary, status, scope,
      valid_from, valid_until, approved_by, approved_at, reason,
      revoked_at, revoked_by
    ) VALUES (
      v_request.target_user_id, v_request.role_id, v_request.requested_by,
      v_make_primary, 'active', v_request.scope, v_request.requested_valid_from,
      v_request.requested_valid_until, v_actor, now(), v_request.reason, NULL, NULL
    ) ON CONFLICT (user_id, role_id) DO UPDATE SET
      granted_by = EXCLUDED.granted_by,
      is_primary = CASE
        WHEN EXISTS (
          SELECT 1 FROM public.rbac_user_roles other
          WHERE other.user_id = EXCLUDED.user_id
            AND other.id <> public.rbac_user_roles.id
            AND other.status = 'active' AND other.is_primary
        ) THEN false ELSE true END,
      status = 'active', scope = EXCLUDED.scope,
      valid_from = EXCLUDED.valid_from, valid_until = EXCLUDED.valid_until,
      approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at,
      reason = EXCLUDED.reason, revoked_at = NULL, revoked_by = NULL
    RETURNING id INTO v_assignment_id;
  ELSE
    IF v_request.target_user_id = v_actor THEN
      RAISE EXCEPTION 'self_lockout_protected';
    END IF;
    SELECT * INTO v_assignment FROM public.rbac_user_roles
    WHERE user_id = v_request.target_user_id AND role_id = v_request.role_id
      AND status = 'active' FOR UPDATE;
    IF v_assignment.id IS NULL THEN RAISE EXCEPTION 'active_assignment_not_found'; END IF;

    IF v_role_code = 'super_admin' THEN
      PERFORM pg_advisory_xact_lock(hashtext('baruna:last-super-admin'));
      SELECT count(*) INTO v_super_count
      FROM public.rbac_user_roles ur
      JOIN public.rbac_roles r ON r.id = ur.role_id
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE r.code = 'super_admin' AND p.is_active
        AND ur.status = 'active' AND ur.valid_from <= now()
        AND (ur.valid_until IS NULL OR ur.valid_until > now());
      IF v_super_count <= 1 THEN RAISE EXCEPTION 'last_super_admin_protected'; END IF;
    END IF;

    IF v_assignment.is_primary THEN
      SELECT id INTO v_replacement_id FROM public.rbac_user_roles
      WHERE user_id = v_request.target_user_id AND status = 'active'
        AND id <> v_assignment.id ORDER BY created_at, id LIMIT 1 FOR UPDATE;
    END IF;
    UPDATE public.rbac_user_roles
    SET status = 'revoked', is_primary = false, revoked_at = now(),
        revoked_by = v_actor, reason = v_request.reason
    WHERE id = v_assignment.id;
    IF v_replacement_id IS NOT NULL THEN
      UPDATE public.rbac_user_roles SET is_primary = true WHERE id = v_replacement_id;
    END IF;
    v_assignment_id := v_assignment.id;
  END IF;

  UPDATE public.rbac_role_change_requests
  SET status = 'applied', reviewed_by = v_actor, reviewed_at = now(),
      decision_note = _decision_note, applied_at = now()
  WHERE id = _request_id;
  PERFORM public.log_admin_event(
    'role_change_applied', v_actor, v_request.target_user_id,
    'rbac_user_role', v_assignment_id::text, NULL,
    jsonb_build_object('request_id', _request_id, 'role', v_role_code,
                       'action', v_request.action, 'status', 'applied'),
    jsonb_build_object('scope', v_request.scope,
                       'valid_from', v_request.requested_valid_from,
                       'valid_until', v_request.requested_valid_until,
                       'reason', v_request.reason, 'decision_note', _decision_note)
  );
  RETURN 'applied';
END $$;

-- CREATE OR REPLACE mempertahankan izin lama; ditegaskan ulang di sini.
REVOKE ALL ON FUNCTION public.assign_rbac_role(uuid, text), public.revoke_rbac_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_rbac_role(uuid, text), public.revoke_rbac_role(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.request_rbac_role_change(uuid,text,text,text,jsonb,timestamptz,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_rbac_role_change(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_rbac_role_change(uuid,text,text,text,jsonb,timestamptz,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_rbac_role_change(uuid,text,text) TO authenticated;

COMMIT;
