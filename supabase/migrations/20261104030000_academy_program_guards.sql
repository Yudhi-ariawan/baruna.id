-- ============================================================================
-- Program Academy: tutup jalur ubah lama dan aturan pendaftaran yang buntu
-- (lanjutan 20261104010000, audit 4 Nov 2026). Dibuktikan dengan
-- `npm run test:academy-guards` sebelum migrasi (7 cek gagal).
--
-- 1. Jalur lama. set_offering_classification, set_self_paced_access_model,
--    set_cohort_financial_model, set_cohort_payment_responsibility,
--    configure_completion_evaluation_requirement, dan
--    assign_completion_evaluation_template (Phase 1.4, Juli 2026) adalah
--    SECURITY DEFINER dan bisa dipanggil langsung oleh SATU admin/approver
--    (_require_admin_or_mgmt). Lewat itu offering yang tayang bisa diubah
--    (format, aturan pendaftaran, biaya, evaluasi) tanpa draf, tanpa persetujuan
--    orang lain, tanpa riwayat versi, walau sudah ada peserta; admin_version
--    tidak naik, sehingga draf yang sedang ditinjau akan menimpanya tanpa
--    peringatan. Aplikasi tidak memakai fungsi-fungsi ini (dicek di src/ dan
--    scripts/), jadi hak panggilnya dicabut dari anon/authenticated. service_role
--    (SQL Editor, skrip pemeliharaan) tetap bisa.
--
-- 2. Aturan pendaftaran. Peserta mendaftar ke offering lewat learning_enrol.
--    Untuk approval_required / entitlement_required, learning_enrol meminta
--    pengajuan yang sudah disetujui (course_enrollment_applications), tetapi
--    formulir pengajuan (/academy/apply/<slug>) hanya mengenal program lama di
--    kode. Offering dari layar admin dengan aturan itu tidak bisa diikuti siapa
--    pun. Sampai alur pengajuan untuk offering dibuat, layar admin hanya
--    menerima aturan open / registered, dan delivery mode approved_self_paced
--    (artinya "wajib disetujui") juga ditolak. Offering lama tidak terpengaruh
--    (hanya baca di layar admin).
--
-- Aman dijalankan ulang.
-- ============================================================================

BEGIN;

DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname IN (
       'set_offering_classification', 'set_self_paced_access_model', 'set_cohort_financial_model',
       'set_cohort_payment_responsibility', 'configure_completion_evaluation_requirement',
       'assign_completion_evaluation_template')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- Same as 20261104010000 plus the access-rule guard (after the access rule check).
CREATE OR REPLACE FUNCTION public._program_offering_problem(_p jsonb, _target uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := btrim(COALESCE(_p->>'offering_code', ''));
  v_course uuid; v_live jsonb; v_model text := _p->>'learning_model'; v_format text := _p->>'delivery_format';
  v_rule text := _p->>'enrolment_access_rule'; v_mode text := _p->>'delivery_mode_code';
  v_open date; v_close date; v_es date; v_ee date; v_year numeric;
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
       OR (_p->>'cohort_payment_responsibility') IS DISTINCT FROM (v_live->>'cohort_payment_responsibility')) THEN
    RETURN 'program_offering_locked_in_use';
  END IF;
  RETURN NULL;
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'program_date_invalid' THEN RETURN 'program_date_invalid'; END IF;
  RAISE;
END $$;
REVOKE ALL ON FUNCTION public._program_offering_problem(jsonb, uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
