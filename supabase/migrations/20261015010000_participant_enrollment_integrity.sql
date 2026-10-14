-- Participant enrollment integrity (PB-ACA-03).
-- Requires 20261005160000_course_enrollment_applications.sql and
-- 20261007100000_participant_biodata.sql to have been applied first.
--
-- 1. course_enrollment_applications becomes the single source of truth. Status
--    is never derived from auth.users.user_metadata (users can edit their own
--    metadata from the browser SDK).
-- 2. Applying is idempotent: an approved application is never reset to pending.
-- 3. The admin decision, the participant role grant and the enrolment row are
--    written in one transaction; any failure aborts the whole decision.

-- ------------------------------------------------------------- backfill
-- While the table did not exist, the app recorded applications only in
-- admin_audit_log (server-written, so trustworthy). Rebuild one row per
-- (user, course) from the latest event. user_metadata is deliberately ignored.

-- Not every event carries every field (decisions often omit the title), so take
-- each field from the newest event that has it.
CREATE OR REPLACE FUNCTION public._enrollment_audit_field(_uid uuid, _course text, _key text)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT NULLIF(f.after_data->>_key, '') FROM public.admin_audit_log f
   WHERE f.entity_type = 'course_enrollment' AND f.target_user_id = _uid AND f.entity_id = _course
     AND NULLIF(f.after_data->>_key, '') IS NOT NULL
   ORDER BY f.created_at DESC LIMIT 1
$$;

INSERT INTO public.course_enrollment_applications (
  user_id, course_id, course_title, applicant_name, applicant_email, applicant_organization,
  status, notes, decision_by, decision_at, decision_notes, created_at, updated_at
)
SELECT DISTINCT ON (l.target_user_id, l.entity_id)
  l.target_user_id,
  l.entity_id,
  COALESCE(public._enrollment_audit_field(l.target_user_id, l.entity_id, 'course_title'), l.entity_id),
  public._enrollment_audit_field(l.target_user_id, l.entity_id, 'applicant_name'),
  COALESCE(public._enrollment_audit_field(l.target_user_id, l.entity_id, 'applicant_email'), u.email),
  public._enrollment_audit_field(l.target_user_id, l.entity_id, 'applicant_organization'),
  CASE l.event_type
    WHEN 'course_enrollment_approved' THEN 'approved'
    WHEN 'course_enrollment_rejected' THEN 'rejected'
    ELSE 'pending'
  END,
  NULLIF(l.after_data->>'notes', ''),
  CASE WHEN l.event_type <> 'course_enrollment_requested' THEN l.actor_id END,
  CASE WHEN l.event_type <> 'course_enrollment_requested' THEN l.created_at END,
  CASE WHEN l.event_type <> 'course_enrollment_requested' THEN NULLIF(l.after_data->>'decision_notes', '') END,
  (SELECT min(f.created_at) FROM public.admin_audit_log f
    WHERE f.entity_type = 'course_enrollment' AND f.target_user_id = l.target_user_id
      AND f.entity_id = l.entity_id),
  l.created_at
FROM public.admin_audit_log l
JOIN auth.users u ON u.id = l.target_user_id
WHERE l.entity_type = 'course_enrollment'
  AND l.entity_id IS NOT NULL
  AND l.event_type IN ('course_enrollment_requested', 'course_enrollment_approved', 'course_enrollment_rejected')
ORDER BY l.target_user_id, l.entity_id, l.created_at DESC
ON CONFLICT (user_id, course_id) DO NOTHING;

DROP FUNCTION public._enrollment_audit_field(uuid, text, text);

-- ------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public._is_enrollment_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_rbac_role(_uid, 'super_admin') OR public.has_rbac_role(_uid, 'admin')
    OR public.has_rbac_role(_uid, 'operator') OR public.has_rbac_role(_uid, 'approver'))
$$;

-- Prerequisite for applying: biodata submitted, or already holds a learner-capable role.
CREATE OR REPLACE FUNCTION public._enrollment_prerequisite_met(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.participant_biodata b WHERE b.user_id = _uid)
    OR public.has_rbac_role(_uid, 'participant') OR public.has_rbac_role(_uid, 'trainer')
    OR public.has_rbac_role(_uid, 'expert') OR public.has_rbac_role(_uid, 'admin')
    OR public.has_rbac_role(_uid, 'super_admin')
$$;

-- Grants (or re-activates) the participant role while keeping exactly one active
-- primary role, which the deferred rbac_user_roles_validate_primary trigger enforces.
CREATE OR REPLACE FUNCTION public._grant_participant_role(_uid uuid, _actor uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role_id uuid;
  v_row public.rbac_user_roles;
  v_other_primary boolean;
BEGIN
  SELECT id INTO v_role_id FROM public.rbac_roles WHERE code = 'participant';
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'participant_role_missing'; END IF;

  SELECT * INTO v_row FROM public.rbac_user_roles
   WHERE user_id = _uid AND role_id = v_role_id FOR UPDATE;
  SELECT EXISTS (SELECT 1 FROM public.rbac_user_roles
                  WHERE user_id = _uid AND status = 'active' AND is_primary
                    AND role_id <> v_role_id) INTO v_other_primary;

  IF v_row.id IS NULL THEN
    INSERT INTO public.rbac_user_roles (user_id, role_id, status, is_primary, scope, valid_from,
                                        granted_by, approved_by, approved_at, reason)
    VALUES (_uid, v_role_id, 'active', NOT v_other_primary, '{}'::jsonb, now(),
            _actor, _actor, now(), _reason);
  ELSIF v_row.status <> 'active' OR v_row.valid_from > now()
        OR (v_row.valid_until IS NOT NULL AND v_row.valid_until <= now()) THEN
    UPDATE public.rbac_user_roles
       SET status = 'active', valid_from = LEAST(valid_from, now()), valid_until = NULL,
           revoked_at = NULL, revoked_by = NULL, is_primary = NOT v_other_primary,
           approved_by = _actor, approved_at = now(), reason = _reason
     WHERE id = v_row.id;
  END IF;
END $$;

-- ------------------------------------------------------------- apply
CREATE OR REPLACE FUNCTION public.course_enrollment_apply(
  _course_id text, _course_title text, _notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_course text := btrim(COALESCE(_course_id, ''));
  v_title text := btrim(COALESCE(_course_title, ''));
  v_notes text := NULLIF(btrim(COALESCE(_notes, '')), '');
  v_row public.course_enrollment_applications;
  v_name text; v_email text; v_org text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF char_length(v_course) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_course'; END IF;
  IF char_length(v_title) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_course_title'; END IF;
  IF char_length(COALESCE(v_notes, '')) > 1000 THEN RAISE EXCEPTION 'notes_too_long'; END IF;
  IF NOT public._enrollment_prerequisite_met(v_uid) THEN RAISE EXCEPTION 'biodata_required'; END IF;

  -- Serialises double-clicks and parallel tabs for the same (user, course).
  PERFORM pg_advisory_xact_lock(hashtextextended('course_enrollment:' || v_uid::text || ':' || v_course, 0));

  SELECT * INTO v_row FROM public.course_enrollment_applications
   WHERE user_id = v_uid AND course_id = v_course FOR UPDATE;

  IF v_row.id IS NOT NULL AND v_row.status IN ('approved', 'pending') THEN
    -- Approved stays approved; pending stays pending. Nothing is reset.
    RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'changed', false);
  END IF;

  SELECT p.display_name, p.organization INTO v_name, v_org FROM public.profiles p WHERE p.id = v_uid;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  v_name := COALESCE(NULLIF(btrim(v_name), ''), NULLIF(split_part(COALESCE(v_email, ''), '@', 1), ''), 'Peserta Baru');

  IF v_row.id IS NULL THEN
    INSERT INTO public.course_enrollment_applications (
      user_id, course_id, course_title, applicant_name, applicant_email, applicant_organization, status, notes)
    VALUES (v_uid, v_course, v_title, v_name, v_email, v_org, 'pending', v_notes)
    RETURNING * INTO v_row;
  ELSE
    -- Re-applying after a rejection.
    UPDATE public.course_enrollment_applications
       SET status = 'pending', course_title = v_title, applicant_name = v_name, applicant_email = v_email,
           applicant_organization = v_org, notes = v_notes, decision_by = NULL, decision_at = NULL,
           decision_notes = NULL, updated_at = now()
     WHERE id = v_row.id
     RETURNING * INTO v_row;
  END IF;

  INSERT INTO public.admin_audit_log (event_type, actor_id, target_user_id, entity_type, entity_id, after_data)
  VALUES ('course_enrollment_requested', v_uid, v_uid, 'course_enrollment', v_course,
          jsonb_build_object('status', 'pending', 'course_id', v_course, 'course_title', v_title,
                             'applicant_name', v_name, 'applicant_email', v_email,
                             'applicant_organization', v_org, 'notes', v_notes, 'application_id', v_row.id));

  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'changed', true);
END $$;

-- ------------------------------------------------------------- decide
CREATE OR REPLACE FUNCTION public.admin_course_enrollment_decide(
  _user_id uuid, _course_id text, _decision text, _notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target text;
  v_notes text := NULLIF(btrim(COALESCE(_notes, '')), '');
  v_before public.course_enrollment_applications;
  v_row public.course_enrollment_applications;
  v_offering uuid;
BEGIN
  IF NOT public._is_enrollment_admin(v_actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _decision NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF char_length(COALESCE(v_notes, '')) > 1000 THEN RAISE EXCEPTION 'notes_too_long'; END IF;
  IF _user_id = v_actor THEN RAISE EXCEPTION 'self_decision_forbidden'; END IF;
  v_target := CASE _decision WHEN 'approve' THEN 'approved' ELSE 'rejected' END;

  SELECT * INTO v_before FROM public.course_enrollment_applications
   WHERE user_id = _user_id AND course_id = _course_id FOR UPDATE;
  IF v_before.id IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;

  IF v_before.status <> 'pending' AND v_before.status <> v_target THEN
    RAISE EXCEPTION 'decision_already_final: status %', v_before.status;
  END IF;

  v_notes := COALESCE(v_notes, CASE _decision
    WHEN 'approve' THEN 'Pendaftaran disetujui. Akun peserta telah diberikan akses ke ruang belajar.'
    ELSE 'Pendaftaran belum dapat disetujui pada periode ini.' END);

  IF v_before.status = 'pending' THEN
    UPDATE public.course_enrollment_applications
       SET status = v_target, decision_by = v_actor, decision_at = now(), decision_notes = v_notes, updated_at = now()
     WHERE id = v_before.id
     RETURNING * INTO v_row;
  ELSE
    v_row := v_before; -- repeated identical decision: no new decision, but re-ensure grants below
  END IF;

  IF _decision = 'approve' THEN
    PERFORM public._grant_participant_role(_user_id, v_actor, 'course_enrollment_approved:' || left(_course_id, 150));

    -- Exact matches only (no pattern/filter interpolation). Prefer the id match.
    SELECT o.id INTO v_offering FROM public.course_offerings o
     WHERE o.id::text = _course_id OR o.offering_code = _course_id OR o.offering_title = _course_id
     ORDER BY (o.id::text = _course_id) DESC, (o.offering_code = _course_id) DESC, o.created_at DESC
     LIMIT 1;
    IF v_offering IS NOT NULL THEN
      -- Never touches completion_status, so re-approving cannot undo a completed course.
      INSERT INTO public.enrolments (user_id, course_offering_id, enrolment_status)
      VALUES (_user_id, v_offering, 'enrolled')
      ON CONFLICT (user_id, course_offering_id) DO UPDATE SET enrolment_status = 'enrolled';
    END IF;
  END IF;

  IF v_before.status = 'pending' THEN
    INSERT INTO public.admin_audit_log (event_type, actor_id, target_user_id, entity_type, entity_id, before_data, after_data)
    VALUES (CASE _decision WHEN 'approve' THEN 'course_enrollment_approved' ELSE 'course_enrollment_rejected' END,
            v_actor, _user_id, 'course_enrollment', _course_id, to_jsonb(v_before),
            jsonb_build_object('status', v_row.status, 'course_id', _course_id, 'course_title', v_row.course_title,
                               'applicant_name', v_row.applicant_name, 'applicant_email', v_row.applicant_email,
                               'decision_by', v_actor, 'decision_at', v_row.decision_at,
                               'decision_notes', v_row.decision_notes, 'offering_id', v_offering));
  END IF;

  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status,
                            'changed', v_before.status = 'pending', 'offeringLinked', v_offering IS NOT NULL);
END $$;

REVOKE ALL ON FUNCTION public._is_enrollment_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._enrollment_prerequisite_met(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._grant_participant_role(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.course_enrollment_apply(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_course_enrollment_decide(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.course_enrollment_apply(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_course_enrollment_decide(uuid, text, text, text) TO authenticated;

-- Status changes now go only through the RPCs above. The old applicant UPDATE
-- policy let a rejected applicant flip their own row back to pending directly.
DROP POLICY IF EXISTS "enrollment_apps_own_update" ON public.course_enrollment_applications;
DROP POLICY IF EXISTS "enrollment_apps_own_insert" ON public.course_enrollment_applications;
DROP POLICY IF EXISTS "enrollment_apps_admin_update" ON public.course_enrollment_applications;
REVOKE INSERT, UPDATE ON public.course_enrollment_applications FROM authenticated;
