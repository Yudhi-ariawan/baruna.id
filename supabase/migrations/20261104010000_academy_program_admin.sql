-- ============================================================================
-- Academy: layar admin Master Course, Master Module, dan Course Offering
-- ============================================================================
-- Acuan: PB-ACA-01 (Slide 20) dan PB-ACA-02 (Slide 21): draf dibuat Admin/Operator,
-- divalidasi, direview, disetujui, baru aktif; wajib versioning; data tidak
-- hard-coded; dikelola lewat Admin Console; audit trail. Keputusan pemilik proyek
-- 4 Nov 2026: cakupan Course + Modul + Offering; aktivasi wajib disetujui orang lain.
--
-- Dicek 4 Nov 2026 (database intern-update):
-- * master_courses (3), master_modules (4), course_offerings (4) hanya bisa dibaca
--   aplikasi; tidak ada jalur tulis selain migrasi.
-- * Izin academy.create/academy.update dimiliki hampir semua peran (termasuk
--   participant dan registered_user), jadi TIDAK dipakai di sini. Pembuat draf:
--   super_admin, admin, operator, approver (Slide 16, 20). Pemutus: super_admin,
--   admin, approver (_can_decide_review), dan bukan pembuat/pengaju draf itu.
-- * Kelulusan peserta (_learning_enrolment_activities, check_certificate_eligibility)
--   menghitung SEMUA modul course, dan kemajuan disimpan sebagai "module:<kode>".
--   Karena itu susunan modul (tambah/hapus/ganti kode) hanya boleh berubah selama
--   course belum dipakai (belum ada pendaftaran/peserta di offering mana pun).
-- * Offering lama dengan learning_engine_version 'legacy' (AZA, Africa Fisheries)
--   isi belajarnya ada di kode; course dan offering itu hanya dibaca di sini.
--
-- Perubahan:
-- * academy_program_drafts: satu draf per perubahan (course baru, offering baru,
--   atau perubahan course/offering yang ada). Data tayang tidak berubah sampai
--   draf disetujui. Satu draf terbuka per course/offering.
-- * master_course_versions / course_offering_versions: snapshot setiap versi yang
--   disetujui (Version Record).
-- * course_offerings.admin_version: nomor versi untuk cek "data sudah berubah".
-- * Tulis langsung ke master_courses, master_modules, course_offerings,
--   learning_feature_flags dicabut dari anon/authenticated.
-- * RPC: program_overview, program_draft_get, program_draft_open/_save/_submit/
--   _withdraw, program_draft_decide, program_set_status. Semua tercatat di audit.
-- * Offering baru memakai mesin belajar bersama (shared_v1): /academy/course/<kode>,
--   dengan learning_feature_flags yang sesuai.

BEGIN;

-- ------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public._program_can_manage(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_rbac_role(_uid, 'super_admin') OR public.has_rbac_role(_uid, 'admin')
    OR public.has_rbac_role(_uid, 'operator') OR public.has_rbac_role(_uid, 'approver'))
$$;
REVOKE ALL ON FUNCTION public._program_can_manage(uuid) FROM PUBLIC, anon, authenticated;

-- An offering is in use once anyone applied to it or is enrolled in it.
CREATE OR REPLACE FUNCTION public._program_offering_in_use(_offering_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrolments e WHERE e.course_offering_id = _offering_id)
      OR EXISTS (SELECT 1 FROM public.course_enrollment_applications a
                   JOIN public.course_offerings o ON o.id = _offering_id
                  WHERE a.course_id IN (o.id::text, o.offering_code, o.offering_title))
$$;
REVOKE ALL ON FUNCTION public._program_offering_in_use(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._program_course_in_use(_course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.course_offerings o
                  WHERE o.master_course_id = _course_id AND public._program_offering_in_use(o.id))
$$;
REVOKE ALL ON FUNCTION public._program_course_in_use(uuid) FROM PUBLIC, anon, authenticated;

-- Content of legacy offerings lives in the app code; they are read-only here.
CREATE OR REPLACE FUNCTION public._program_course_is_legacy(_course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.course_offerings o
                  WHERE o.master_course_id = _course_id AND o.learning_engine_version = 'legacy')
$$;
REVOKE ALL ON FUNCTION public._program_course_is_legacy(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- tables
ALTER TABLE public.course_offerings ADD COLUMN IF NOT EXISTS admin_version integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.academy_program_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('master_course', 'course_offering')),
  target_id uuid,
  base_version integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'revision_requested', 'approved', 'rejected', 'withdrawn')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  result_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS academy_program_drafts_one_open_uidx
  ON public.academy_program_drafts (kind, target_id)
  WHERE target_id IS NOT NULL AND status IN ('draft', 'submitted', 'revision_requested');
CREATE INDEX IF NOT EXISTS academy_program_drafts_status_idx ON public.academy_program_drafts (status, updated_at DESC);
ALTER TABLE public.academy_program_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_program_drafts FROM anon, authenticated;
GRANT ALL ON public.academy_program_drafts TO service_role;

CREATE TABLE IF NOT EXISTS public.master_course_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_course_id uuid NOT NULL REFERENCES public.master_courses(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  draft_id uuid REFERENCES public.academy_program_drafts(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (master_course_id, version)
);
ALTER TABLE public.master_course_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.master_course_versions FROM anon, authenticated;
GRANT ALL ON public.master_course_versions TO service_role;

CREATE TABLE IF NOT EXISTS public.course_offering_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  draft_id uuid REFERENCES public.academy_program_drafts(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_offering_id, version)
);
ALTER TABLE public.course_offering_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_offering_versions FROM anon, authenticated;
GRANT ALL ON public.course_offering_versions TO service_role;

-- Live tables: read stays open (catalog, learning), writes only through the RPCs below.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.master_courses FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.master_modules FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.course_offerings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.learning_feature_flags FROM anon, authenticated;

-- ------------------------------------------------------------- live snapshots
CREATE OR REPLACE FUNCTION public._program_course_snapshot(_course_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'course_code', c.course_code, 'title', c.title, 'description', c.description,
    'language', c.language, 'learning_template_code', (SELECT t.code FROM public.learning_templates t WHERE t.id = c.learning_template_id),
    'modules', COALESCE((SELECT jsonb_agg(jsonb_build_object('module_code', m.module_code, 'title', m.title,
                 'learning_hours', m.learning_hours) ORDER BY m.sequence, m.module_code)
               FROM public.master_modules m WHERE m.master_course_id = c.id), '[]'::jsonb))
  FROM public.master_courses c WHERE c.id = _course_id
$$;
REVOKE ALL ON FUNCTION public._program_course_snapshot(uuid) FROM PUBLIC, anon, authenticated;

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
    'completion_evaluation_context', o.completion_evaluation_context)
  FROM public.course_offerings o WHERE o.id = _offering_id
$$;
REVOKE ALL ON FUNCTION public._program_offering_snapshot(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- validation
CREATE OR REPLACE FUNCTION public._program_text_ok(_v text, _min integer, _max integer)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _v IS NOT NULL AND char_length(btrim(_v)) BETWEEN _min AND _max AND _v !~ '[[:cntrl:]]'
$$;
REVOKE ALL ON FUNCTION public._program_text_ok(text, integer, integer) FROM PUBLIC, anon, authenticated;

-- NULL = valid. Otherwise the first problem found (error code).
CREATE OR REPLACE FUNCTION public._program_course_problem(_p jsonb, _target uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := btrim(COALESCE(_p->>'course_code', ''));
  v_item jsonb; v_codes text[] := '{}'; v_mcode text; v_hours numeric; v_live text[];
BEGIN
  IF jsonb_typeof(_p) IS DISTINCT FROM 'object' THEN RETURN 'program_payload_invalid'; END IF;
  IF _target IS NULL THEN
    IF v_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR char_length(v_code) NOT BETWEEN 3 AND 80 THEN RETURN 'program_course_code_invalid'; END IF;
    IF EXISTS (SELECT 1 FROM public.master_courses WHERE lower(course_code) = lower(v_code)) THEN RETURN 'program_course_code_exists'; END IF;
  ELSIF v_code IS DISTINCT FROM (SELECT course_code FROM public.master_courses WHERE id = _target) THEN
    RETURN 'program_course_code_immutable';
  END IF;
  IF NOT public._program_text_ok(_p->>'title', 3, 200) THEN RETURN 'program_title_invalid'; END IF;
  IF char_length(COALESCE(_p->>'description', '')) > 4000 THEN RETURN 'program_description_too_long'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.languages_taxonomy WHERE lower(code) = lower(btrim(COALESCE(_p->>'language', '')))) THEN
    RETURN 'program_language_unknown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.learning_templates WHERE code = btrim(COALESCE(_p->>'learning_template_code', ''))) THEN
    RETURN 'program_template_unknown';
  END IF;

  IF jsonb_typeof(_p->'modules') IS DISTINCT FROM 'array' OR jsonb_array_length(_p->'modules') = 0 THEN RETURN 'program_modules_required'; END IF;
  IF jsonb_array_length(_p->'modules') > 60 THEN RETURN 'program_modules_too_many'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_p->'modules') LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN RETURN 'program_payload_invalid'; END IF;
    v_mcode := upper(btrim(COALESCE(v_item->>'module_code', '')));
    IF v_mcode !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' OR char_length(v_mcode) NOT BETWEEN 2 AND 30 THEN RETURN 'program_module_code_invalid'; END IF;
    IF v_mcode = ANY (v_codes) THEN RETURN 'program_module_code_duplicate'; END IF;
    v_codes := array_append(v_codes, v_mcode);
    IF NOT public._program_text_ok(v_item->>'title', 2, 200) THEN RETURN 'program_module_title_invalid'; END IF;
    IF jsonb_typeof(v_item->'learning_hours') IS DISTINCT FROM 'number' THEN RETURN 'program_module_hours_invalid'; END IF;
    v_hours := (v_item->>'learning_hours')::numeric;
    IF v_hours <= 0 OR v_hours > 500 THEN RETURN 'program_module_hours_invalid'; END IF;
  END LOOP;

  -- Completion counts every module and progress is stored per module code: once
  -- anyone applied/enrolled, the set of module codes cannot change.
  IF _target IS NOT NULL AND public._program_course_in_use(_target) THEN
    SELECT COALESCE(array_agg(upper(module_code) ORDER BY upper(module_code)), '{}') INTO v_live
      FROM public.master_modules WHERE master_course_id = _target;
    IF (SELECT COALESCE(array_agg(x ORDER BY x), '{}') FROM unnest(v_codes) x) IS DISTINCT FROM v_live THEN
      RETURN 'program_modules_locked_in_use';
    END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._program_course_problem(jsonb, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._program_date(_v jsonb)
RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF _v IS NULL OR jsonb_typeof(_v) = 'null' THEN RETURN NULL; END IF;
  IF jsonb_typeof(_v) <> 'string' OR (_v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'program_date_invalid'; END IF;
  RETURN (_v #>> '{}')::date;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'program_date_invalid';
END $$;
REVOKE ALL ON FUNCTION public._program_date(jsonb) FROM PUBLIC, anon, authenticated;

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

-- ------------------------------------------------------------- read
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
      'activeCourses', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title) ORDER BY title), '[]')
                          FROM public.master_courses c WHERE status = 'active' AND NOT public._program_course_is_legacy(c.id))));
END $$;
REVOKE ALL ON FUNCTION public.program_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.program_draft_get(_draft_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_d public.academy_program_drafts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._program_can_manage(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_d FROM public.academy_program_drafts WHERE id = _draft_id;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'program_draft_not_found'; END IF;
  RETURN jsonb_build_object(
    'id', v_d.id, 'kind', v_d.kind, 'targetId', v_d.target_id, 'status', v_d.status, 'payload', v_d.payload,
    'baseVersion', v_d.base_version, 'updatedAt', v_d.updated_at, 'submittedAt', v_d.submitted_at,
    'decisionNote', v_d.decision_note, 'decidedAt', v_d.decided_at,
    'createdBy', (SELECT display_name FROM public.profiles WHERE id = v_d.created_by),
    'mine', v_d.created_by = v_uid,
    'canDecide', public._can_decide_review(v_uid) AND v_uid <> v_d.created_by AND v_uid IS DISTINCT FROM v_d.submitted_by,
    'problem', CASE v_d.kind WHEN 'master_course' THEN public._program_course_problem(v_d.payload, v_d.target_id)
                             ELSE public._program_offering_problem(v_d.payload, v_d.target_id) END,
    'live', CASE WHEN v_d.target_id IS NULL THEN NULL
                 WHEN v_d.kind = 'master_course' THEN public._program_course_snapshot(v_d.target_id)
                 ELSE public._program_offering_snapshot(v_d.target_id) END,
    'inUse', CASE WHEN v_d.target_id IS NULL THEN false
                  WHEN v_d.kind = 'master_course' THEN public._program_course_in_use(v_d.target_id)
                  ELSE public._program_offering_in_use(v_d.target_id) END,
    'versions', CASE WHEN v_d.target_id IS NULL THEN '[]'::jsonb
                     WHEN v_d.kind = 'master_course' THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('version', v.version,
                         'approvedAt', v.approved_at, 'approvedBy', (SELECT display_name FROM public.profiles WHERE id = v.approved_by))
                         ORDER BY v.version DESC) FROM public.master_course_versions v WHERE v.master_course_id = v_d.target_id), '[]')
                     ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('version', v.version, 'approvedAt', v.approved_at,
                         'approvedBy', (SELECT display_name FROM public.profiles WHERE id = v.approved_by)) ORDER BY v.version DESC)
                         FROM public.course_offering_versions v WHERE v.course_offering_id = v_d.target_id), '[]') END);
END $$;
REVOKE ALL ON FUNCTION public.program_draft_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_draft_get(uuid) TO authenticated;

-- ------------------------------------------------------------- drafts
CREATE OR REPLACE FUNCTION public.program_draft_open(_kind text, _target_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_payload jsonb; v_version integer; v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._program_can_manage(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _kind NOT IN ('master_course', 'course_offering') OR _kind IS NULL THEN RAISE EXCEPTION 'program_kind_invalid'; END IF;

  IF _target_id IS NULL THEN
    v_payload := CASE _kind WHEN 'master_course'
      THEN jsonb_build_object('language', 'en', 'learning_template_code', 'knowledge_course', 'modules', '[]'::jsonb)
      ELSE jsonb_build_object('completion_evaluation_required', false, 'year', extract(year FROM now())::integer) END;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtextextended('program_draft:' || _target_id::text, 0));
    IF _kind = 'master_course' THEN
      SELECT status, COALESCE(version, 1) INTO v_status, v_version FROM public.master_courses WHERE id = _target_id;
      IF v_status IS NULL THEN RAISE EXCEPTION 'program_target_not_found'; END IF;
      IF public._program_course_is_legacy(_target_id) THEN RAISE EXCEPTION 'program_legacy_readonly'; END IF;
      v_payload := public._program_course_snapshot(_target_id);
    ELSE
      SELECT o.status, o.admin_version INTO v_status, v_version FROM public.course_offerings o WHERE o.id = _target_id;
      IF v_status IS NULL THEN RAISE EXCEPTION 'program_target_not_found'; END IF;
      IF (SELECT learning_engine_version FROM public.course_offerings WHERE id = _target_id) = 'legacy' THEN
        RAISE EXCEPTION 'program_legacy_readonly';
      END IF;
      v_payload := public._program_offering_snapshot(_target_id);
    END IF;
    IF v_status = 'archived' THEN RAISE EXCEPTION 'program_archived'; END IF;
    IF EXISTS (SELECT 1 FROM public.academy_program_drafts WHERE kind = _kind AND target_id = _target_id
                AND status IN ('draft', 'submitted', 'revision_requested')) THEN
      RAISE EXCEPTION 'program_draft_exists';
    END IF;
  END IF;

  INSERT INTO public.academy_program_drafts (kind, target_id, base_version, payload, created_by)
  VALUES (_kind, _target_id, v_version, v_payload, v_uid) RETURNING id INTO v_id;
  PERFORM public.log_governance_event('program_draft_opened', v_uid, NULL, 'academy_program_draft', v_id::text,
    NULL, jsonb_build_object('kind', _kind, 'target_id', _target_id, 'base_version', v_version));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.program_draft_open(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_draft_open(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.program_draft_save(_draft_id uuid, _payload jsonb, _expected_updated_at timestamptz)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_d public.academy_program_drafts%ROWTYPE; v_now timestamptz := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_d FROM public.academy_program_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'program_draft_not_found'; END IF;
  IF v_d.created_by <> v_uid OR NOT public._program_can_manage(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_d.status NOT IN ('draft', 'revision_requested') THEN RAISE EXCEPTION 'program_draft_not_editable'; END IF;
  IF _expected_updated_at IS NULL OR _expected_updated_at <> v_d.updated_at THEN RAISE EXCEPTION 'program_draft_stale'; END IF;
  IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' OR octet_length(_payload::text) > 200000 THEN RAISE EXCEPTION 'program_payload_invalid'; END IF;
  UPDATE public.academy_program_drafts SET payload = _payload, updated_at = v_now WHERE id = _draft_id;
  RETURN v_now;
END $$;
REVOKE ALL ON FUNCTION public.program_draft_save(uuid, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_draft_save(uuid, jsonb, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.program_draft_submit(_draft_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_d public.academy_program_drafts%ROWTYPE; v_problem text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_d FROM public.academy_program_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'program_draft_not_found'; END IF;
  IF v_d.created_by <> v_uid OR NOT public._program_can_manage(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF v_d.status NOT IN ('draft', 'revision_requested') THEN RAISE EXCEPTION 'program_draft_not_editable'; END IF;
  v_problem := CASE v_d.kind WHEN 'master_course' THEN public._program_course_problem(v_d.payload, v_d.target_id)
                             ELSE public._program_offering_problem(v_d.payload, v_d.target_id) END;
  IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;
  -- Parenthesised: PL/pgSQL would otherwise end the IF condition at the CASE's THEN.
  IF v_d.target_id IS NOT NULL AND v_d.payload = (CASE v_d.kind WHEN 'master_course' THEN public._program_course_snapshot(v_d.target_id)
                                                      ELSE public._program_offering_snapshot(v_d.target_id) END) THEN
    RAISE EXCEPTION 'program_draft_unchanged';
  END IF;
  UPDATE public.academy_program_drafts
     SET status = 'submitted', submitted_by = v_uid, submitted_at = clock_timestamp(), updated_at = clock_timestamp()
   WHERE id = _draft_id;
  PERFORM public.log_governance_event('program_draft_submitted', v_uid, NULL, 'academy_program_draft', _draft_id::text,
    NULL, jsonb_build_object('kind', v_d.kind, 'target_id', v_d.target_id));
END $$;
REVOKE ALL ON FUNCTION public.program_draft_submit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_draft_submit(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.program_draft_withdraw(_draft_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_d public.academy_program_drafts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_d FROM public.academy_program_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'program_draft_not_found'; END IF;
  -- The author withdraws their own draft; a decider may clear an abandoned one.
  IF NOT ((v_d.created_by = v_uid AND public._program_can_manage(v_uid)) OR public._can_decide_review(v_uid)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_d.status NOT IN ('draft', 'submitted', 'revision_requested') THEN RAISE EXCEPTION 'program_draft_not_editable'; END IF;
  UPDATE public.academy_program_drafts SET status = 'withdrawn', updated_at = clock_timestamp() WHERE id = _draft_id;
  PERFORM public.log_governance_event('program_draft_withdrawn', v_uid, NULL, 'academy_program_draft', _draft_id::text,
    jsonb_build_object('status', v_d.status), jsonb_build_object('status', 'withdrawn'));
END $$;
REVOKE ALL ON FUNCTION public.program_draft_withdraw(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_draft_withdraw(uuid) TO authenticated;

-- ------------------------------------------------------------- apply (internal)
CREATE OR REPLACE FUNCTION public._program_apply_course(_d public.academy_program_drafts, _uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p jsonb := _d.payload; v_id uuid; v_version integer; v_tpl uuid; v_item jsonb; v_seq integer := 0; v_codes text[] := '{}';
BEGIN
  SELECT id INTO v_tpl FROM public.learning_templates WHERE code = btrim(v_p->>'learning_template_code');
  IF _d.target_id IS NULL THEN
    INSERT INTO public.master_courses (course_code, title, description, language, learning_template_id, status, version)
    VALUES (lower(btrim(v_p->>'course_code')), btrim(v_p->>'title'), NULLIF(btrim(COALESCE(v_p->>'description', '')), ''),
            lower(btrim(v_p->>'language')), v_tpl, 'active', 1)
    RETURNING id, version INTO v_id, v_version;
  ELSE
    v_id := _d.target_id;
    UPDATE public.master_courses
       SET title = btrim(v_p->>'title'), description = NULLIF(btrim(COALESCE(v_p->>'description', '')), ''),
           language = lower(btrim(v_p->>'language')), learning_template_id = v_tpl,
           version = COALESCE(version, 1) + 1, updated_at = now()
     WHERE id = v_id RETURNING version INTO v_version;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_p->'modules') LOOP
    v_seq := v_seq + 1;
    v_codes := array_append(v_codes, upper(btrim(v_item->>'module_code')));
    INSERT INTO public.master_modules (master_course_id, module_code, title, sequence, learning_hours, status, version)
    VALUES (v_id, upper(btrim(v_item->>'module_code')), btrim(v_item->>'title'), v_seq, (v_item->>'learning_hours')::numeric, 'active', 1)
    ON CONFLICT (master_course_id, module_code) DO UPDATE
      SET title = EXCLUDED.title, sequence = EXCLUDED.sequence, learning_hours = EXCLUDED.learning_hours,
          version = CASE WHEN (public.master_modules.title, public.master_modules.learning_hours)
                              IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.learning_hours)
                         THEN COALESCE(public.master_modules.version, 1) + 1 ELSE public.master_modules.version END,
          updated_at = now();
  END LOOP;
  -- Removing modules was only allowed while nobody used the course (validated above).
  DELETE FROM public.master_modules WHERE master_course_id = v_id AND NOT (upper(module_code) = ANY (v_codes));

  INSERT INTO public.master_course_versions (master_course_id, version, snapshot, draft_id, approved_by)
  VALUES (v_id, v_version, public._program_course_snapshot(v_id), _d.id, _uid);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public._program_apply_course(public.academy_program_drafts, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._program_apply_offering(_d public.academy_program_drafts, _uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p jsonb := _d.payload; v_id uuid; v_version integer; v_mode uuid; v_prev public.course_offerings%ROWTYPE;
  v_model text := v_p->>'learning_model'; v_eval boolean := (v_p->>'completion_evaluation_required')::boolean;
  v_access text;
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
      completion_evaluation_updated_at, completion_evaluation_updated_by, admin_version)
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
      v_eval, CASE WHEN v_eval THEN v_p->>'completion_evaluation_context' END, 'operator', now(), _uid, 1)
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
        + CASE WHEN (v_prev.completion_evaluation_required, v_prev.completion_evaluation_context::text)
                    IS DISTINCT FROM (v_eval, CASE WHEN v_eval THEN v_p->>'completion_evaluation_context' END) THEN 1 ELSE 0 END,
      completion_evaluation_source = 'operator', completion_evaluation_updated_at = now(), completion_evaluation_updated_by = _uid,
      admin_version = admin_version + 1, updated_at = now()
    WHERE id = v_id RETURNING admin_version INTO v_version;
  END IF;
  INSERT INTO public.course_offering_versions (course_offering_id, version, snapshot, draft_id, approved_by)
  VALUES (v_id, v_version, public._program_offering_snapshot(v_id), _d.id, _uid);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public._program_apply_offering(public.academy_program_drafts, uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------- decide
CREATE OR REPLACE FUNCTION public.program_draft_decide(_draft_id uuid, _decision text, _note text, _expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_d public.academy_program_drafts%ROWTYPE; v_note text := NULLIF(btrim(COALESCE(_note, '')), '');
  v_problem text; v_live_version integer; v_result uuid; v_before jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _decision NOT IN ('approve', 'request_revision', 'reject') OR _decision IS NULL THEN RAISE EXCEPTION 'program_decision_invalid'; END IF;
  IF _decision <> 'approve' AND (v_note IS NULL OR char_length(v_note) < 5) THEN RAISE EXCEPTION 'program_note_required'; END IF;
  IF char_length(COALESCE(v_note, '')) > 2000 THEN RAISE EXCEPTION 'program_note_too_long'; END IF;

  SELECT * INTO v_d FROM public.academy_program_drafts WHERE id = _draft_id FOR UPDATE;
  IF v_d.id IS NULL THEN RAISE EXCEPTION 'program_draft_not_found'; END IF;
  IF v_d.created_by = v_uid OR v_d.submitted_by = v_uid THEN RAISE EXCEPTION 'program_self_decision_forbidden'; END IF;
  IF v_d.status <> 'submitted' THEN RAISE EXCEPTION 'program_not_submitted'; END IF;
  IF _expected_updated_at IS NULL OR _expected_updated_at <> v_d.updated_at THEN RAISE EXCEPTION 'program_draft_stale'; END IF;

  IF _decision = 'approve' THEN
    IF v_d.target_id IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('program_draft:' || v_d.target_id::text, 0));
      IF v_d.kind = 'master_course' THEN
        SELECT COALESCE(version, 1) INTO v_live_version FROM public.master_courses WHERE id = v_d.target_id FOR UPDATE;
        v_before := public._program_course_snapshot(v_d.target_id);
      ELSE
        SELECT admin_version INTO v_live_version FROM public.course_offerings WHERE id = v_d.target_id FOR UPDATE;
        v_before := public._program_offering_snapshot(v_d.target_id);
      END IF;
      IF v_live_version IS NULL THEN RAISE EXCEPTION 'program_target_not_found'; END IF;
      IF v_live_version IS DISTINCT FROM v_d.base_version THEN RAISE EXCEPTION 'program_stale'; END IF;
    ELSE
      PERFORM pg_advisory_xact_lock(hashtext('program_new:' || v_d.kind));
    END IF;
    -- Re-checked here: someone may have applied/enrolled since the draft was sent.
    v_problem := CASE v_d.kind WHEN 'master_course' THEN public._program_course_problem(v_d.payload, v_d.target_id)
                               ELSE public._program_offering_problem(v_d.payload, v_d.target_id) END;
    IF v_problem IS NOT NULL THEN RAISE EXCEPTION '%', v_problem; END IF;
    v_result := CASE v_d.kind WHEN 'master_course' THEN public._program_apply_course(v_d, v_uid)
                              ELSE public._program_apply_offering(v_d, v_uid) END;
  END IF;

  UPDATE public.academy_program_drafts
     SET status = CASE _decision WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'revision_requested' END,
         decided_by = v_uid, decided_at = clock_timestamp(), decision_note = v_note, result_id = v_result,
         updated_at = clock_timestamp()
   WHERE id = _draft_id;
  PERFORM public.log_governance_event('program_draft_' || CASE _decision WHEN 'approve' THEN 'approved'
                                        WHEN 'reject' THEN 'rejected' ELSE 'revision_requested' END,
    v_uid, NULL, v_d.kind, COALESCE(v_result, v_d.target_id, v_d.id)::text,
    v_before, jsonb_build_object('draft_id', v_d.id, 'note', v_note, 'payload', v_d.payload));
  RETURN jsonb_build_object('status', _decision, 'resultId', v_result);
END $$;
REVOKE ALL ON FUNCTION public.program_draft_decide(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_draft_decide(uuid, text, text, timestamptz) TO authenticated;

-- ------------------------------------------------------------- status
-- Course: active <-> archived (not while it has a published offering).
-- Offering: published <-> completed / closed (operational; no content change).
CREATE OR REPLACE FUNCTION public.program_set_status(_kind text, _id uuid, _status text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_old text; v_note text := btrim(COALESCE(_note, ''));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF char_length(v_note) < 5 OR char_length(v_note) > 500 THEN RAISE EXCEPTION 'program_note_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('program_draft:' || COALESCE(_id::text, ''), 0));
  IF _kind = 'master_course' THEN
    IF _status NOT IN ('active', 'archived') OR _status IS NULL THEN RAISE EXCEPTION 'program_status_invalid'; END IF;
    SELECT status INTO v_old FROM public.master_courses WHERE id = _id FOR UPDATE;
    IF v_old IS NULL THEN RAISE EXCEPTION 'program_target_not_found'; END IF;
    IF public._program_course_is_legacy(_id) THEN RAISE EXCEPTION 'program_legacy_readonly'; END IF;
    IF v_old = _status THEN RAISE EXCEPTION 'program_status_unchanged'; END IF;
    IF _status = 'archived' AND EXISTS (SELECT 1 FROM public.course_offerings WHERE master_course_id = _id AND status = 'published') THEN
      RAISE EXCEPTION 'program_course_has_published_offerings';
    END IF;
    IF _status = 'archived' AND EXISTS (SELECT 1 FROM public.academy_program_drafts
                                         WHERE status IN ('draft', 'submitted', 'revision_requested')
                                           AND (target_id = _id OR (kind = 'course_offering' AND payload->>'master_course_id' = _id::text))) THEN
      RAISE EXCEPTION 'program_open_drafts_exist';
    END IF;
    UPDATE public.master_courses SET status = _status, updated_at = now() WHERE id = _id;
  ELSIF _kind = 'course_offering' THEN
    IF _status NOT IN ('published', 'completed', 'closed') OR _status IS NULL THEN RAISE EXCEPTION 'program_status_invalid'; END IF;
    SELECT status INTO v_old FROM public.course_offerings WHERE id = _id FOR UPDATE;
    IF v_old IS NULL THEN RAISE EXCEPTION 'program_target_not_found'; END IF;
    IF (SELECT learning_engine_version FROM public.course_offerings WHERE id = _id) = 'legacy' THEN RAISE EXCEPTION 'program_legacy_readonly'; END IF;
    IF v_old = _status THEN RAISE EXCEPTION 'program_status_unchanged'; END IF;
    IF _status = 'published' AND NOT EXISTS (SELECT 1 FROM public.course_offerings o JOIN public.master_courses c ON c.id = o.master_course_id
                                              WHERE o.id = _id AND c.status = 'active') THEN
      RAISE EXCEPTION 'program_course_not_active';
    END IF;
    UPDATE public.course_offerings SET status = _status, updated_at = now() WHERE id = _id;
  ELSE
    RAISE EXCEPTION 'program_kind_invalid';
  END IF;
  PERFORM public.log_governance_event('program_status_changed', v_uid, NULL, _kind, _id::text,
    jsonb_build_object('status', v_old), jsonb_build_object('status', _status, 'note', v_note));
END $$;
REVOKE ALL ON FUNCTION public.program_set_status(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.program_set_status(text, uuid, text, text) TO authenticated;

COMMIT;
