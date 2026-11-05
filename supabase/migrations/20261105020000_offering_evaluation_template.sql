-- ============================================================================
-- Program Academy: template evaluasi akhir dipilih di draf Course Offering
-- (lanjutan 20261104010000 / 20261104030000; CATATAN_PERBAIKAN 2an).
--
-- Sebelum migrasi: formulir offering hanya punya "wajib evaluasi akhir" +
-- konteks, tanpa template. Offering baru yang mewajibkan evaluasi tidak punya
-- kuesioner: start_completion_evaluation gagal "no completion evaluation template
-- assigned", dan sejak 20261105010000 sertifikatnya tertahan
-- 'completion_evaluation_not_configured'. Template hanya bisa dipasang lewat SQL
-- (assign_completion_evaluation_template, service_role saja sejak 20261104030000).
--
-- Sesudah migrasi:
-- * payload offering punya completion_evaluation_template_id; wajib bila evaluasi
--   akhir diwajibkan (template aktif dengan konteks yang sama), dan harus kosong
--   bila tidak. Diperiksa saat dikirim dan saat disetujui.
-- * Template ikut snapshot/riwayat versi offering dan diterapkan saat disetujui.
-- * Setelah offering punya pendaftar, wajib/tidaknya evaluasi, konteks, dan
--   template ikut dikunci (syarat sertifikat tidak berubah di tengah jalan).
-- * program_overview mengirim daftar template aktif untuk formulir.
-- Butuh 20261104030000. Aman dijalankan ulang.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._program_offering_snapshot(_offering_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'master_course_id', o.master_course_id, 'offering_code', o.offering_code, 'offering_title', o.offering_title,
    'cohort_name', o.cohort_name, 'batch_number', o.batch_number, 'year', o.year,
    'delivery_mode_code', (SELECT d.code FROM public.delivery_modes d WHERE d.id = o.delivery_mode_id),
    'opening_date', o.opening_date, 'closing_date', o.closing_date,
    'enrolment_start_date', o.enrolment_start_date, 'enrolment_end_date', o.enrolment_end_date,
    'learning_model', o.learning_model, 'delivery_format', o.delivery_format,
    'enrolment_access_rule', o.enrolment_access_rule, 'self_paced_access_model', o.self_paced_access_model,
    'cohort_payment_responsibility', o.cohort_payment_responsibility,
    'completion_evaluation_required', o.completion_evaluation_required,
    'completion_evaluation_context', o.completion_evaluation_context,
    'completion_evaluation_template_id', o.completion_evaluation_template_id)
  FROM public.course_offerings o WHERE o.id = _offering_id
$$;
REVOKE ALL ON FUNCTION public._program_offering_snapshot(uuid) FROM PUBLIC, anon, authenticated;

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

CREATE OR REPLACE FUNCTION public._program_apply_offering(_d public.academy_program_drafts, _uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p jsonb := _d.payload; v_id uuid; v_version integer; v_mode uuid; v_prev public.course_offerings%ROWTYPE;
  v_model text := v_p->>'learning_model'; v_eval boolean := (v_p->>'completion_evaluation_required')::boolean;
  v_access text;
  v_tpl uuid := CASE WHEN (_d.payload->>'completion_evaluation_required')::boolean
                     THEN NULLIF(_d.payload->>'completion_evaluation_template_id', '')::uuid END;
BEGIN
  SELECT id INTO v_mode FROM public.delivery_modes WHERE code = v_p->>'delivery_mode_code';
  v_access := CASE WHEN v_p->>'enrolment_access_rule' IN ('open', 'registered') THEN 'open' ELSE 'application-required' END;
  IF _d.target_id IS NULL THEN
    INSERT INTO public.course_offerings (
      master_course_id, offering_code, offering_title, cohort_name, batch_number, year, delivery_mode_id, access_mode,
      opening_date, closing_date, enrolment_start_date, enrolment_end_date, status,
      learning_engine_version, shared_learn_path,
      learning_model, delivery_format, enrolment_access_rule, classification_source, classification_updated_at, classification_updated_by,
      self_paced_access_model, self_paced_access_model_source, self_paced_access_model_updated_at, self_paced_access_model_updated_by,
      cohort_financial_model, cohort_financial_model_source, cohort_financial_model_updated_at, cohort_financial_model_updated_by,
      cohort_payment_responsibility, cohort_payment_responsibility_source, cohort_payment_responsibility_updated_at, cohort_payment_responsibility_updated_by,
      completion_evaluation_required, completion_evaluation_context, completion_evaluation_source,
      completion_evaluation_updated_at, completion_evaluation_updated_by, completion_evaluation_template_id, admin_version)
    VALUES (
      (v_p->>'master_course_id')::uuid, lower(btrim(v_p->>'offering_code')), btrim(v_p->>'offering_title'),
      NULLIF(btrim(COALESCE(v_p->>'cohort_name', '')), ''), (v_p->>'batch_number')::integer, (v_p->>'year')::integer, v_mode, v_access,
      public._program_date(v_p->'opening_date'), public._program_date(v_p->'closing_date'),
      public._program_date(v_p->'enrolment_start_date'), public._program_date(v_p->'enrolment_end_date'), 'published',
      'shared_v1', '/academy/course/' || lower(btrim(v_p->>'offering_code')),
      v_model, v_p->>'delivery_format', v_p->>'enrolment_access_rule', 'operator', now(), _uid,
      CASE WHEN v_model = 'self_paced' THEN (v_p->>'self_paced_access_model')::public.self_paced_access_model_v1 END, 'operator', now(), _uid,
      CASE WHEN v_model = 'cohort_based' THEN 'fee_based' END, 'operator', now(), _uid,
      CASE WHEN v_model = 'cohort_based' THEN v_p->>'cohort_payment_responsibility' END, 'operator', now(), _uid,
      v_eval, CASE WHEN v_eval THEN v_p->>'completion_evaluation_context' END, 'operator', now(), _uid, v_tpl, 1)
    RETURNING id, admin_version INTO v_id, v_version;
    INSERT INTO public.learning_feature_flags (course_offering_id, engine_version, enabled, approved_by, approved_at)
    VALUES (v_id, 'shared_v1', true, _uid, now())
    ON CONFLICT (course_offering_id) DO UPDATE SET engine_version = 'shared_v1', enabled = true,
      approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at, updated_at = now();
  ELSE
    v_id := _d.target_id;
    SELECT * INTO v_prev FROM public.course_offerings WHERE id = v_id FOR UPDATE;
    UPDATE public.course_offerings SET
      offering_title = btrim(v_p->>'offering_title'), cohort_name = NULLIF(btrim(COALESCE(v_p->>'cohort_name', '')), ''),
      batch_number = (v_p->>'batch_number')::integer, year = (v_p->>'year')::integer, delivery_mode_id = v_mode, access_mode = v_access,
      opening_date = public._program_date(v_p->'opening_date'), closing_date = public._program_date(v_p->'closing_date'),
      enrolment_start_date = public._program_date(v_p->'enrolment_start_date'), enrolment_end_date = public._program_date(v_p->'enrolment_end_date'),
      learning_model = v_model, delivery_format = v_p->>'delivery_format', enrolment_access_rule = v_p->>'enrolment_access_rule',
      classification_version = classification_version
        + CASE WHEN (v_prev.learning_model::text, v_prev.delivery_format::text, v_prev.enrolment_access_rule::text)
                    IS DISTINCT FROM (v_model, v_p->>'delivery_format', v_p->>'enrolment_access_rule') THEN 1 ELSE 0 END,
      classification_source = 'operator', classification_updated_at = now(), classification_updated_by = _uid,
      self_paced_access_model = CASE WHEN v_model = 'self_paced' THEN (v_p->>'self_paced_access_model')::public.self_paced_access_model_v1 END,
      self_paced_access_model_version = self_paced_access_model_version
        + CASE WHEN v_prev.self_paced_access_model::text IS DISTINCT FROM (CASE WHEN v_model = 'self_paced' THEN v_p->>'self_paced_access_model' END) THEN 1 ELSE 0 END,
      self_paced_access_model_source = 'operator', self_paced_access_model_updated_at = now(), self_paced_access_model_updated_by = _uid,
      cohort_financial_model = CASE WHEN v_model = 'cohort_based' THEN 'fee_based' END,
      cohort_financial_model_source = 'operator', cohort_financial_model_updated_at = now(), cohort_financial_model_updated_by = _uid,
      cohort_payment_responsibility = CASE WHEN v_model = 'cohort_based' THEN v_p->>'cohort_payment_responsibility' END,
      cohort_payment_responsibility_version = cohort_payment_responsibility_version
        + CASE WHEN v_prev.cohort_payment_responsibility::text IS DISTINCT FROM (CASE WHEN v_model = 'cohort_based' THEN v_p->>'cohort_payment_responsibility' END) THEN 1 ELSE 0 END,
      cohort_payment_responsibility_source = 'operator', cohort_payment_responsibility_updated_at = now(), cohort_payment_responsibility_updated_by = _uid,
      completion_evaluation_required = v_eval, completion_evaluation_context = CASE WHEN v_eval THEN v_p->>'completion_evaluation_context' END,
      completion_evaluation_version = completion_evaluation_version
        + CASE WHEN (v_prev.completion_evaluation_required, v_prev.completion_evaluation_context::text, v_prev.completion_evaluation_template_id)
                    IS DISTINCT FROM (v_eval, CASE WHEN v_eval THEN v_p->>'completion_evaluation_context' END, v_tpl) THEN 1 ELSE 0 END,
      completion_evaluation_template_id = v_tpl,
      completion_evaluation_source = 'operator', completion_evaluation_updated_at = now(), completion_evaluation_updated_by = _uid,
      admin_version = admin_version + 1, updated_at = now()
    WHERE id = v_id RETURNING admin_version INTO v_version;
  END IF;
  INSERT INTO public.course_offering_versions (course_offering_id, version, snapshot, draft_id, approved_by)
  VALUES (v_id, v_version, public._program_offering_snapshot(v_id), _d.id, _uid);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public._program_apply_offering(public.academy_program_drafts, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.program_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._program_can_manage(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'canDecide', public._can_decide_review(v_uid),
    'courses', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'code', c.course_code, 'title', c.title, 'status', c.status, 'version', COALESCE(c.version, 1),
        'language', c.language, 'updatedAt', c.updated_at,
        'moduleCount', (SELECT count(*) FROM public.master_modules m WHERE m.master_course_id = c.id),
        'offeringCount', (SELECT count(*) FROM public.course_offerings o WHERE o.master_course_id = c.id),
        'inUse', public._program_course_in_use(c.id), 'legacy', public._program_course_is_legacy(c.id),
        'openDraftId', (SELECT d.id FROM public.academy_program_drafts d WHERE d.kind = 'master_course' AND d.target_id = c.id
                          AND d.status IN ('draft', 'submitted', 'revision_requested')))
        ORDER BY c.title) FROM public.master_courses c), '[]'::jsonb),
    'offerings', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'code', o.offering_code, 'title', o.offering_title, 'courseId', o.master_course_id,
        'courseTitle', (SELECT c.title FROM public.master_courses c WHERE c.id = o.master_course_id),
        'status', o.status, 'version', o.admin_version, 'year', o.year, 'cohortName', o.cohort_name,
        'deliveryMode', (SELECT d.name FROM public.delivery_modes d WHERE d.id = o.delivery_mode_id),
        'learningModel', o.learning_model, 'engine', o.learning_engine_version,
        'path', CASE WHEN o.learning_engine_version = 'shared_v1' THEN COALESCE(o.shared_learn_path, '/academy/course/' || o.offering_code)
                     ELSE o.legacy_learn_path END,
        'inUse', public._program_offering_in_use(o.id), 'legacy', o.learning_engine_version = 'legacy',
        'openDraftId', (SELECT d.id FROM public.academy_program_drafts d WHERE d.kind = 'course_offering' AND d.target_id = o.id
                          AND d.status IN ('draft', 'submitted', 'revision_requested')))
        ORDER BY o.year DESC NULLS LAST, o.offering_title) FROM public.course_offerings o), '[]'::jsonb),
    'drafts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'kind', d.kind, 'targetId', d.target_id, 'status', d.status,
        'title', COALESCE(NULLIF(btrim(d.payload->>'title'), ''), NULLIF(btrim(d.payload->>'offering_title'), ''), '(tanpa judul)'),
        'createdBy', (SELECT display_name FROM public.profiles WHERE id = d.created_by), 'mine', d.created_by = v_uid,
        'submittedAt', d.submitted_at, 'updatedAt', d.updated_at, 'decisionNote', d.decision_note)
        ORDER BY (d.status = 'submitted') DESC, d.updated_at DESC)
        FROM (SELECT * FROM public.academy_program_drafts
               WHERE status IN ('draft', 'submitted', 'revision_requested') OR updated_at > now() - interval '30 days'
               ORDER BY updated_at DESC LIMIT 200) d), '[]'::jsonb),
    'lookups', jsonb_build_object(
      'deliveryModes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('code', code, 'name', name) ORDER BY name), '[]') FROM public.delivery_modes),
      'templates', (SELECT COALESCE(jsonb_agg(jsonb_build_object('code', code, 'name', name) ORDER BY name), '[]') FROM public.learning_templates WHERE active IS NOT FALSE),
      'languages', (SELECT COALESCE(jsonb_agg(jsonb_build_object('code', code, 'name', name) ORDER BY display_order), '[]') FROM public.languages_taxonomy WHERE active),
      'evaluationTemplates', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'context', t.context) ORDER BY t.title), '[]')
                                FROM public.completion_evaluation_templates t WHERE t.status = 'active'),
      'activeCourses', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title) ORDER BY title), '[]')
                          FROM public.master_courses c WHERE status = 'active' AND NOT public._program_course_is_legacy(c.id))));
END $$;
REVOKE ALL ON FUNCTION public.program_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_overview() TO authenticated;

COMMIT;
