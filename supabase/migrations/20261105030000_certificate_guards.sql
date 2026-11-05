-- ============================================================================
-- Sertifikat: penjagaan tambahan dari audit 5 Nov 2026 (CATATAN_PERBAIKAN 2ao).
-- Lanjutan 20261105010000 + 20261105020000. Dibuktikan dengan
-- `npm run test:certificate-path` sebelum migrasi (8 cek gagal).
--
-- Setelah 20261105010000 sertifikat benar-benar bisa terbit, dan tiga celah yang
-- sebelumnya tertutup karena jalur itu buntu menjadi terjangkau:
-- 1. Jenis sertifikat dipilih peserta. issue_my_certificate menerima enam jenis
--    dengan syarat yang sama, dan satu sertifikat per jenis: peserta bisa
--    menerbitkan sendiri "competency" (sertifikat kompetensi) tanpa asesmen, dan
--    sampai enam sertifikat untuk satu course. Kini hanya 'completion' yang bisa
--    terbit ('certificate_type_not_available' untuk yang lain) sampai aturan
--    jenis lain diputuskan.
-- 2. Offering mandiri "paid" dan "free_to_learn" (sertifikat berbayar) menerbitkan
--    sertifikat gratis karena pembayaran belum ada. Syarat sertifikat kini menolak
--    'certificate_payment_required', dan layar admin tidak lagi menerima kedua model
--    akses itu ('program_access_model_unsupported'). Offering berbasis angkatan
--    tidak diubah (selalu fee_based; penanggung biaya dicatat, menunggu mentor).
-- 3. Template evaluasi bisa dinonaktifkan atau ditambah pertanyaan oleh satu
--    admin/approver langsung (set_completion_evaluation_template_status,
--    add_completion_evaluation_question, create_completion_evaluation_template;
--    tidak dipakai aplikasi), termasuk template yang sedang dipakai offering
--    tayang: peserta tidak bisa memulai evaluasi dan sertifikatnya tertahan.
--    Hak panggilnya dicabut dari anon/authenticated (service_role tetap). Template
--    yang tidak aktif kini dibaca sebagai 'completion_evaluation_not_configured'.
-- Aman dijalankan ulang.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.issue_my_certificate(_enrolment_id uuid, _certificate_type text DEFAULT 'completion')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_enr public.enrolments; v_elig jsonb; v_cert public.certificates; v_serial text;
BEGIN
  IF _certificate_type NOT IN ('completion', 'participation', 'program', 'applied-achievement', 'competency', 'statement-of-result') THEN
    RAISE EXCEPTION 'invalid_certificate_type';
  END IF;
  -- Only the certificate of completion has a rule (all modules + completion evaluation).
  -- Competency, participation, etc. need their own rules (assessment, attendance) first.
  IF _certificate_type <> 'completion' THEN RAISE EXCEPTION 'certificate_type_not_available'; END IF;
  -- Locks the enrolment row: a double click waits here and then returns the same certificate.
  v_enr := public._learning_own_active_enrolment(_enrolment_id);

  SELECT * INTO v_cert FROM public.certificates
   WHERE learner_id = v_uid AND course_offering_id = v_enr.course_offering_id AND certificate_type = _certificate_type;
  IF v_cert.id IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_cert.id, 'certificate_number', v_cert.certificate_number,
      'verification_reference', v_cert.verification_reference, 'certificate_type', v_cert.certificate_type,
      'issue_date', v_cert.issue_date, 'created', false);
  END IF;

  v_elig := public.check_certificate_eligibility(_enrolment_id);
  IF NOT COALESCE((v_elig->>'eligible')::boolean, false) THEN
    RAISE EXCEPTION 'not_eligible:%', COALESCE(v_elig->>'reason', 'unknown');
  END IF;

  -- Temporary number format (official STTP numbering not decided yet). The random
  -- suffix makes numbers impossible to enumerate on the public verification page.
  v_serial := 'BARUNA-' || upper(replace(_certificate_type, '-', '')) || '-' || to_char(now(), 'YYYY') || '-'
              || lpad(nextval('public.certificate_serial_seq')::text, 6, '0') || '-'
              || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  INSERT INTO public.certificates (learner_id, enrolment_id, course_offering_id, certificate_type,
                                   certificate_number, verification_reference, certificate_status, source_system)
  VALUES (v_uid, v_enr.id, v_enr.course_offering_id, _certificate_type, v_serial,
          '/academy/certification?verify=' || v_serial, 'issued', 'shared_v1')
  RETURNING * INTO v_cert;
  UPDATE public.enrolments SET completion_status = 'completed', completion_date = COALESCE(completion_date, now())
   WHERE id = v_enr.id AND completion_status <> 'completed';
  PERFORM public._learning_audit('certificate_issued', v_uid, 'certificate', v_cert.id::text,
    jsonb_build_object('serial', v_serial));
  RETURN jsonb_build_object('id', v_cert.id, 'certificate_number', v_cert.certificate_number,
    'verification_reference', v_cert.verification_reference, 'certificate_type', v_cert.certificate_type,
    'issue_date', v_cert.issue_date, 'created', true);
END $$;
REVOKE ALL ON FUNCTION public.issue_my_certificate(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_my_certificate(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_certificate_eligibility(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_enrolment RECORD; v_module_count integer; v_completed_count integer; v_ce_submitted boolean;
BEGIN
  SELECT e.id, e.user_id, e.course_offering_id, e.enrolment_status, o.master_course_id,
         COALESCE(o.completion_evaluation_required, false) AS evaluation_required,
         o.completion_evaluation_template_id AS evaluation_template_id,
         o.self_paced_access_model::text AS access_model,
         (SELECT t.status FROM public.completion_evaluation_templates t WHERE t.id = o.completion_evaluation_template_id) AS template_status
    INTO v_enrolment
    FROM public.enrolments e JOIN public.course_offerings o ON o.id = e.course_offering_id
   WHERE e.id = _enrolment_id;
  IF v_enrolment.id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'enrolment_not_found');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.completion_evaluation_submissions s
                  WHERE s.enrolment_id = _enrolment_id AND s.status = 'submitted') INTO v_ce_submitted;

  IF v_enrolment.enrolment_status = 'withdrawn' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'enrolment_not_active',
                              'completion_evaluation_submitted', v_ce_submitted);
  END IF;

  SELECT COUNT(*) INTO v_module_count FROM public.master_modules WHERE master_course_id = v_enrolment.master_course_id;
  SELECT COUNT(DISTINCT p.learning_activity_id) INTO v_completed_count
    FROM public.progress_records p
    JOIN public.master_modules mm ON mm.master_course_id = v_enrolment.master_course_id
                                 AND p.learning_activity_id = 'module:' || mm.module_code
   WHERE p.enrolment_id = _enrolment_id AND p.status = 'completed';

  IF v_module_count = 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_modules_configured',
                              'completion_evaluation_submitted', v_ce_submitted);
  END IF;
  IF v_completed_count < v_module_count THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'modules_incomplete',
      'completed', v_completed_count, 'required', v_module_count,
      'completion_evaluation_submitted', v_ce_submitted);
  END IF;
  IF v_enrolment.evaluation_required THEN
    -- A retired template cannot be started any more: that is for the admin to fix, not the participant.
    IF v_enrolment.evaluation_template_id IS NULL OR v_enrolment.template_status IS DISTINCT FROM 'active' THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'completion_evaluation_not_configured',
        'completed', v_completed_count, 'required', v_module_count,
        'completion_evaluation_submitted', v_ce_submitted);
    END IF;
    IF NOT v_ce_submitted THEN
      RETURN jsonb_build_object('eligible', false, 'reason', 'completion_evaluation_missing',
        'completed', v_completed_count, 'required', v_module_count,
        'completion_evaluation_submitted', v_ce_submitted);
    END IF;
  END IF;
  -- "Paid" and "free to learn, certificate for a fee" need a payment that does not exist yet.
  IF v_enrolment.access_model IN ('paid', 'free_to_learn') THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'certificate_payment_required',
      'completed', v_completed_count, 'required', v_module_count,
      'completion_evaluation_submitted', v_ce_submitted);
  END IF;
  RETURN jsonb_build_object('eligible', true, 'completed', v_completed_count, 'required', v_module_count,
                            'completion_evaluation_submitted', v_ce_submitted);
END $$;
REVOKE ALL ON FUNCTION public.check_certificate_eligibility(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_certificate_eligibility(uuid) TO authenticated, service_role;

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
  -- No application path exists yet for offerings managed here (see header).
  IF v_rule IN ('approval_required', 'entitlement_required') OR v_mode = 'approved_self_paced' THEN
    RETURN 'program_access_rule_unsupported';
  END IF;
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

DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN (
              'set_completion_evaluation_template_status', 'add_completion_evaluation_question',
              'create_completion_evaluation_template')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
