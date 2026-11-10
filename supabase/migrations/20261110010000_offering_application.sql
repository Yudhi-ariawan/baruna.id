-- ============================================================================
-- Academy: pengajuan pendaftaran untuk Course Offering "Wajib disetujui admin"
-- (PB-ACA-03, Slide 22). CATATAN_PERBAIKAN 2as. Dibuktikan dengan
-- `npm run test:offering-application`.
--
-- Koreksi atas 20261104030000: jalur pengajuan SUDAH ada sejak 15 Okt
-- (course_enrollment_apply -> antrean Persetujuan Peserta -> admin_course_enrollment_decide,
-- yang memberi peran Participant dan langsung mendaftarkan peserta ke offering bila
-- kode offering cocok). Yang belum ada hanya tombol pengajuan di halaman course
-- (dibuat di aplikasi). Karena itu:
-- * _program_offering_problem kembali menerima "Wajib disetujui admin" (dan delivery
--   mode Approved Self-Paced, hanya bersama aturan itu). "Wajib hak akses khusus"
--   tetap ditolak karena belum ada aturan siapa yang memberi hak akses.
-- * course_enrollment_apply: untuk kode Course Offering, pengajuan hanya diterima bila
--   offering memang meminta pengajuan, masih tayang, dan masa pendaftarannya buka;
--   judul diambil dari database, bukan dari browser. Pengajuan modul dan program
--   lama (course_id lain) tidak berubah.
-- Aman dijalankan ulang.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._program_offering_problem(_p jsonb, _target uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := btrim(COALESCE(_p->>'offering_code', ''));
  v_course uuid; v_live jsonb; v_model text := _p->>'learning_model'; v_format text := _p->>'delivery_format';
  v_rule text := _p->>'enrolment_access_rule'; v_mode text := _p->>'delivery_mode_code';
  v_open date; v_close date; v_es date; v_ee date; v_year numeric; v_tpl uuid;
BEGIN
  IF jsonb_typeof(_p) IS DISTINCT FROM 'object' THEN RETURN 'program_payload_invalid'; END IF;
  IF _target IS NULL THEN
    IF v_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR char_length(v_code) NOT BETWEEN 3 AND 80 THEN RETURN 'program_offering_code_invalid'; END IF;
    IF EXISTS (SELECT 1 FROM public.course_offerings WHERE lower(offering_code) = lower(v_code)) THEN RETURN 'program_offering_code_exists'; END IF;
    BEGIN v_course := (_p->>'master_course_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN 'program_course_not_active'; END;
    IF NOT EXISTS (SELECT 1 FROM public.master_courses WHERE id = v_course AND status = 'active') THEN RETURN 'program_course_not_active'; END IF;
    IF public._program_course_is_legacy(v_course) THEN RETURN 'program_legacy_readonly'; END IF;
  ELSE
    v_live := public._program_offering_snapshot(_target);
    IF v_code IS DISTINCT FROM v_live->>'offering_code' THEN RETURN 'program_offering_code_immutable'; END IF;
    IF (_p->>'master_course_id') IS DISTINCT FROM (v_live->>'master_course_id') THEN RETURN 'program_offering_course_immutable'; END IF;
  END IF;
  IF NOT public._program_text_ok(_p->>'offering_title', 3, 200) THEN RETURN 'program_title_invalid'; END IF;
  IF _p ? 'cohort_name' AND jsonb_typeof(_p->'cohort_name') <> 'null'
     AND NOT public._program_text_ok(_p->>'cohort_name', 1, 120) THEN RETURN 'program_cohort_invalid'; END IF;
  IF jsonb_typeof(_p->'year') IS DISTINCT FROM 'number' THEN RETURN 'program_year_invalid'; END IF;
  v_year := (_p->>'year')::numeric;
  IF v_year <> trunc(v_year) OR v_year NOT BETWEEN 2020 AND 2100 THEN RETURN 'program_year_invalid'; END IF;
  IF _p ? 'batch_number' AND jsonb_typeof(_p->'batch_number') <> 'null' AND (
       jsonb_typeof(_p->'batch_number') <> 'number' OR (_p->>'batch_number') !~ '^\d{1,4}$'
       OR (_p->>'batch_number')::integer NOT BETWEEN 1 AND 1000) THEN RETURN 'program_batch_invalid'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.delivery_modes WHERE code = v_mode) THEN RETURN 'program_delivery_mode_unknown'; END IF;
  IF v_model NOT IN ('self_paced', 'cohort_based') OR v_model IS NULL THEN RETURN 'program_learning_model_invalid'; END IF;
  IF v_format NOT IN ('fully_online', 'blended', 'in_person') OR v_format IS NULL THEN RETURN 'program_delivery_format_invalid'; END IF;
  IF v_rule NOT IN ('open', 'registered', 'approval_required', 'entitlement_required') OR v_rule IS NULL THEN RETURN 'program_access_rule_invalid'; END IF;
  -- Participants apply through course_enrollment_apply and the Persetujuan Peserta queue
  -- (20261110010000). Who grants an "entitlement" is not decided yet.
  IF v_rule = 'entitlement_required' THEN RETURN 'program_access_rule_unsupported'; END IF;
  -- "Approved Self-Paced" means approval is required: it only goes with that rule.
  IF v_mode = 'approved_self_paced' AND v_rule <> 'approval_required' THEN RETURN 'program_access_rule_mode_mismatch'; END IF;
  IF v_model = 'self_paced' AND v_format <> 'fully_online' THEN RETURN 'program_self_paced_online_only'; END IF;
  -- Delivery mode must match the learning model.
  IF (v_model = 'self_paced') <> (v_mode IN ('open_self_paced', 'approved_self_paced')) THEN RETURN 'program_delivery_mode_mismatch'; END IF;
  IF v_model = 'self_paced' THEN
    IF COALESCE(_p->>'self_paced_access_model', '') NOT IN ('free', 'paid', 'free_to_learn') THEN RETURN 'program_self_paced_access_required'; END IF;
    -- No payment exists yet: "paid" and "certificate for a fee" would hand out certificates for free.
    IF _p->>'self_paced_access_model' IN ('paid', 'free_to_learn') THEN RETURN 'program_access_model_unsupported'; END IF;
    IF jsonb_typeof(_p->'cohort_payment_responsibility') NOT IN ('null') AND _p ? 'cohort_payment_responsibility' THEN RETURN 'program_payment_not_applicable'; END IF;
  ELSE
    IF COALESCE(_p->>'cohort_payment_responsibility', '') NOT IN
       ('participant', 'institution', 'sponsor_or_partner', 'government_or_public_funding', 'cost_sharing', 'to_be_determined') THEN
      RETURN 'program_payment_required';
    END IF;
    IF jsonb_typeof(_p->'self_paced_access_model') NOT IN ('null') AND _p ? 'self_paced_access_model' THEN RETURN 'program_self_paced_access_not_applicable'; END IF;
  END IF;
  IF jsonb_typeof(_p->'completion_evaluation_required') IS DISTINCT FROM 'boolean' THEN RETURN 'program_evaluation_invalid'; END IF;
  IF (_p->>'completion_evaluation_required')::boolean
     AND COALESCE(_p->>'completion_evaluation_context', '') NOT IN ('course', 'training', 'webinar', 'workshop', 'programme') THEN
    RETURN 'program_evaluation_context_required';
  END IF;
  -- Completion evaluation template: required with the evaluation, absent without it.
  IF (_p->>'completion_evaluation_required')::boolean THEN
    IF COALESCE(_p->>'completion_evaluation_template_id', '') = '' THEN RETURN 'program_evaluation_template_required'; END IF;
    BEGIN v_tpl := (_p->>'completion_evaluation_template_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN RETURN 'program_evaluation_template_invalid'; END;
    IF NOT EXISTS (SELECT 1 FROM public.completion_evaluation_templates t
                    WHERE t.id = v_tpl AND t.status = 'active' AND t.context::text = _p->>'completion_evaluation_context') THEN
      RETURN 'program_evaluation_template_invalid';
    END IF;
  ELSIF COALESCE(_p->>'completion_evaluation_template_id', '') <> '' THEN
    RETURN 'program_evaluation_template_not_applicable';
  END IF;

  v_open := public._program_date(_p->'opening_date'); v_close := public._program_date(_p->'closing_date');
  v_es := public._program_date(_p->'enrolment_start_date'); v_ee := public._program_date(_p->'enrolment_end_date');
  IF v_open IS NOT NULL AND v_close IS NOT NULL AND v_close < v_open THEN RETURN 'program_dates_order'; END IF;
  IF v_es IS NOT NULL AND v_ee IS NOT NULL AND v_ee < v_es THEN RETURN 'program_dates_order'; END IF;
  IF v_ee IS NOT NULL AND v_close IS NOT NULL AND v_ee > v_close THEN RETURN 'program_dates_order'; END IF;

  -- Once anyone applied/enrolled, the learning setup of the offering is fixed.
  IF _target IS NOT NULL AND public._program_offering_in_use(_target) AND (
       v_mode IS DISTINCT FROM v_live->>'delivery_mode_code' OR v_model IS DISTINCT FROM v_live->>'learning_model'
       OR v_format IS DISTINCT FROM v_live->>'delivery_format' OR v_rule IS DISTINCT FROM v_live->>'enrolment_access_rule'
       OR (_p->>'self_paced_access_model') IS DISTINCT FROM (v_live->>'self_paced_access_model')
       OR (_p->>'cohort_payment_responsibility') IS DISTINCT FROM (v_live->>'cohort_payment_responsibility')
       -- The certificate rule depends on the completion evaluation: fixed once in use too.
       OR (_p->>'completion_evaluation_required') IS DISTINCT FROM (v_live->>'completion_evaluation_required')
       OR (_p->>'completion_evaluation_context') IS DISTINCT FROM (v_live->>'completion_evaluation_context')
       OR NULLIF(_p->>'completion_evaluation_template_id', '') IS DISTINCT FROM (v_live->>'completion_evaluation_template_id')) THEN
    RETURN 'program_offering_locked_in_use';
  END IF;
  RETURN NULL;
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'program_date_invalid' THEN RETURN 'program_date_invalid'; END IF;
  RAISE;
END $$;
REVOKE ALL ON FUNCTION public._program_offering_problem(jsonb, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.course_enrollment_apply(
  _course_id text, _course_title text, _notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_course text := btrim(COALESCE(_course_id, ''));
  v_title text := btrim(COALESCE(_course_title, ''));
  v_notes text := NULLIF(btrim(COALESCE(_notes, '')), '');
  v_row public.course_enrollment_applications;
  v_name text; v_email text; v_org text; v_off RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF char_length(v_course) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_course'; END IF;
  IF char_length(v_title) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_course_title'; END IF;
  IF char_length(COALESCE(v_notes, '')) > 1000 THEN RAISE EXCEPTION 'notes_too_long'; END IF;
  IF NOT public._enrollment_prerequisite_met(v_uid) THEN RAISE EXCEPTION 'biodata_required'; END IF;

  -- Course Offering (PB-ACA-03): only offerings that ask for an application, only while
  -- they are published and enrolment is open; the title comes from the database.
  SELECT o.id, o.status, o.enrolment_access_rule::text AS rule, o.enrolment_start_date, o.enrolment_end_date,
         COALESCE(m.title || ' — ' || o.offering_title, o.offering_title) AS title
    INTO v_off
    FROM public.course_offerings o LEFT JOIN public.master_courses m ON m.id = o.master_course_id
   WHERE o.offering_code = v_course;
  IF v_off.id IS NOT NULL THEN
    IF COALESCE(v_off.rule, '') <> 'approval_required' THEN RAISE EXCEPTION 'offering_no_application'; END IF;
    IF COALESCE(v_off.status, '') <> 'published' THEN RAISE EXCEPTION 'offering_closed'; END IF;
    IF (v_off.enrolment_start_date IS NOT NULL AND current_date < v_off.enrolment_start_date)
       OR (v_off.enrolment_end_date IS NOT NULL AND current_date > v_off.enrolment_end_date) THEN
      RAISE EXCEPTION 'enrolment_window_closed';
    END IF;
    v_title := left(v_off.title, 300);
  END IF;

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
REVOKE ALL ON FUNCTION public.course_enrollment_apply(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.course_enrollment_apply(text, text, text) TO authenticated;

COMMIT;
