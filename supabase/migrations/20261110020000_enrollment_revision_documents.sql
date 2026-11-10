-- ============================================================================
-- Pendaftaran Course Offering: "Minta Perbaikan" dan dokumen persyaratan
-- (PB-ACA-03, Slide 22). CATATAN_PERBAIKAN 2at.
-- Dibuktikan dengan `npm run test:enrollment-revision`.
--
-- Slide 22: peserta "Isi Form Application" dan "Unggah Dokumen Persyaratan"; operator
-- "Cek Kelengkapan Dokumen" dan bila tidak lengkap "Minta Perbaikan / Klarifikasi ke
-- Pengguna"; reviewer menyetujui atau "Tolak & Beri Alasan".
--
-- Sebelum migrasi: keputusan hanya setuju atau tolak, dan tidak ada dokumen.
-- Sesudah migrasi:
-- * course_enrollment_applications.status menerima 'revision_requested'.
--   admin_course_enrollment_decide punya keputusan 'request_revision' (catatan wajib,
--   hanya dari pending); pengajuan yang menunggu perbaikan tidak bisa langsung
--   disetujui atau ditolak. Peserta mengirim ulang lewat course_enrollment_apply.
-- * course_offerings.required_documents: daftar nama dokumen per offering (maks 10),
--   lewat draf/persetujuan/versi Program Academy, hanya untuk "Wajib disetujui admin".
-- * Bucket privat 'enrollment-documents' (PDF, maks 10 MB). Unggah lewat URL bertanda
--   dari server; course_enrollment_apply memeriksa setiap berkas (milik peserta, PDF,
--   ukuran, ada di bucket) dan menolak bila ada dokumen wajib yang belum ada.
-- * course_enrollment_documents mencatat berkas per pengajuan; enrollment_document_path
--   memberi lokasi berkas hanya kepada pemiliknya dan pengelola pendaftaran.
-- Aman dijalankan ulang.
-- ============================================================================

BEGIN;

DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.course_enrollment_applications'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.course_enrollment_applications DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.course_enrollment_applications ADD CONSTRAINT course_enrollment_applications_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'revision_requested'));

ALTER TABLE public.course_offerings ADD COLUMN IF NOT EXISTS required_documents jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_offerings_required_documents_array') THEN
    ALTER TABLE public.course_offerings ADD CONSTRAINT course_offerings_required_documents_array
      CHECK (jsonb_typeof(required_documents) = 'array' AND jsonb_array_length(required_documents) <= 10);
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('enrollment-documents', 'enrollment-documents', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760, allowed_mime_types = ARRAY['application/pdf'];

CREATE TABLE IF NOT EXISTS public.course_enrollment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.course_enrollment_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requirement text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  size_bytes bigint,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, requirement)
);
ALTER TABLE public.course_enrollment_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_enrollment_documents FROM anon, authenticated;
GRANT SELECT ON public.course_enrollment_documents TO authenticated;
GRANT ALL ON public.course_enrollment_documents TO service_role;
DROP POLICY IF EXISTS course_enrollment_documents_own_read ON public.course_enrollment_documents;
CREATE POLICY course_enrollment_documents_own_read ON public.course_enrollment_documents FOR SELECT USING (auth.uid() = user_id);

-- Location of one document, for its owner and for whoever decides enrolments.
CREATE OR REPLACE FUNCTION public.enrollment_document_path(_document_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_doc public.course_enrollment_documents;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_doc FROM public.course_enrollment_documents WHERE id = _document_id;
  IF v_doc.id IS NULL OR NOT (v_doc.user_id = v_uid OR public._is_enrollment_admin(v_uid)) THEN
    RAISE EXCEPTION 'document_not_found';
  END IF;
  RETURN v_doc.storage_path;
END $$;
REVOKE ALL ON FUNCTION public.enrollment_document_path(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enrollment_document_path(uuid) TO authenticated;

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
    'completion_evaluation_template_id', o.completion_evaluation_template_id,
    'required_documents', o.required_documents)
  FROM public.course_offerings o WHERE o.id = _offering_id
$$;
REVOKE ALL ON FUNCTION public._program_offering_snapshot(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._program_offering_problem(_p jsonb, _target uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := btrim(COALESCE(_p->>'offering_code', ''));
  v_course uuid; v_live jsonb; v_model text := _p->>'learning_model'; v_format text := _p->>'delivery_format';
  v_rule text := _p->>'enrolment_access_rule'; v_mode text := _p->>'delivery_mode_code';
  v_open date; v_close date; v_es date; v_ee date; v_year numeric; v_tpl uuid; v_doc jsonb; v_docs text[] := '{}'; v_label text;
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
  -- Required documents (PB-ACA-03 "Unggah Dokumen Persyaratan"): only for offerings
  -- that ask for an application; blank lines are ignored.
  IF _p ? 'required_documents' AND jsonb_typeof(_p->'required_documents') <> 'null' THEN
    IF jsonb_typeof(_p->'required_documents') <> 'array' THEN RETURN 'program_documents_invalid'; END IF;
    FOR v_doc IN SELECT * FROM jsonb_array_elements(_p->'required_documents') LOOP
      IF jsonb_typeof(v_doc) <> 'string' THEN RETURN 'program_documents_invalid'; END IF;
      v_label := btrim(v_doc #>> '{}');
      CONTINUE WHEN v_label = '';
      IF NOT public._program_text_ok(v_label, 2, 120) THEN RETURN 'program_documents_invalid'; END IF;
      IF lower(v_label) = ANY (SELECT lower(x) FROM unnest(v_docs) x) THEN RETURN 'program_documents_duplicate'; END IF;
      v_docs := array_append(v_docs, v_label);
    END LOOP;
    IF COALESCE(array_length(v_docs, 1), 0) > 10 THEN RETURN 'program_documents_too_many'; END IF;
    IF COALESCE(array_length(v_docs, 1), 0) > 0 AND v_rule <> 'approval_required' THEN RETURN 'program_documents_not_applicable'; END IF;
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

CREATE OR REPLACE FUNCTION public._program_apply_offering(_d public.academy_program_drafts, _uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p jsonb := _d.payload; v_id uuid; v_version integer; v_mode uuid; v_prev public.course_offerings%ROWTYPE;
  v_model text := v_p->>'learning_model'; v_eval boolean := (v_p->>'completion_evaluation_required')::boolean;
  v_access text;
  v_docs jsonb := COALESCE((SELECT jsonb_agg(btrim(x)) FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(_d.payload->'required_documents') = 'array' THEN _d.payload->'required_documents' ELSE '[]'::jsonb END) x
    WHERE btrim(x) <> ''), '[]'::jsonb);
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
      completion_evaluation_updated_at, completion_evaluation_updated_by, completion_evaluation_template_id, required_documents, admin_version)
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
      v_eval, CASE WHEN v_eval THEN v_p->>'completion_evaluation_context' END, 'operator', now(), _uid, v_tpl, v_docs, 1)
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
      completion_evaluation_template_id = v_tpl, required_documents = v_docs,
      completion_evaluation_source = 'operator', completion_evaluation_updated_at = now(), completion_evaluation_updated_by = _uid,
      admin_version = admin_version + 1, updated_at = now()
    WHERE id = v_id RETURNING admin_version INTO v_version;
  END IF;
  INSERT INTO public.course_offering_versions (course_offering_id, version, snapshot, draft_id, approved_by)
  VALUES (v_id, v_version, public._program_offering_snapshot(v_id), _d.id, _uid);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public._program_apply_offering(public.academy_program_drafts, uuid) FROM PUBLIC, anon, authenticated;

-- The 3-argument version is replaced by one with documents (callers passing three
-- named arguments keep working through the default).
DROP FUNCTION IF EXISTS public.course_enrollment_apply(text, text, text);
CREATE OR REPLACE FUNCTION public.course_enrollment_apply(
  _course_id text, _course_title text, _notes text DEFAULT NULL, _documents jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_course text := btrim(COALESCE(_course_id, ''));
  v_title text := btrim(COALESCE(_course_title, ''));
  v_notes text := NULLIF(btrim(COALESCE(_notes, '')), '');
  v_row public.course_enrollment_applications;
  v_name text; v_email text; v_org text; v_off RECORD;
  v_doc jsonb; v_req text; v_path text; v_missing text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF char_length(v_course) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_course'; END IF;
  IF char_length(v_title) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_course_title'; END IF;
  IF char_length(COALESCE(v_notes, '')) > 1000 THEN RAISE EXCEPTION 'notes_too_long'; END IF;
  IF NOT public._enrollment_prerequisite_met(v_uid) THEN RAISE EXCEPTION 'biodata_required'; END IF;

  -- Course Offering (PB-ACA-03): only offerings that ask for an application, only while
  -- they are published and enrolment is open; the title comes from the database.
  SELECT o.id, o.status, o.enrolment_access_rule::text AS rule, o.enrolment_start_date, o.enrolment_end_date, o.required_documents,
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

  IF jsonb_typeof(COALESCE(_documents, '[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(_documents, '[]'::jsonb)) > 10 THEN
    RAISE EXCEPTION 'documents_invalid';
  END IF;
  IF v_off.id IS NULL AND jsonb_array_length(COALESCE(_documents, '[]'::jsonb)) > 0 THEN RAISE EXCEPTION 'documents_not_applicable'; END IF;

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
    -- Re-applying after a rejection or a request for revision (PB-ACA-03 "Minta Perbaikan").
    UPDATE public.course_enrollment_applications
       SET status = 'pending', course_title = v_title, applicant_name = v_name, applicant_email = v_email,
           applicant_organization = v_org, notes = v_notes, decision_by = NULL, decision_at = NULL,
           decision_notes = NULL, updated_at = now()
     WHERE id = v_row.id
     RETURNING * INTO v_row;
  END IF;

  -- Documents: the files must be this participant's uploads in the private bucket,
  -- PDF, at most 10 MB, one per required document. Earlier uploads count on a resubmission.
  IF v_off.id IS NOT NULL THEN
    FOR v_doc IN SELECT * FROM jsonb_array_elements(COALESCE(_documents, '[]'::jsonb)) LOOP
      v_req := btrim(COALESCE(v_doc->>'requirement', ''));
      v_path := btrim(COALESCE(v_doc->>'path', ''));
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(v_off.required_documents, '[]'::jsonb)) r WHERE r = v_req) THEN
        RAISE EXCEPTION 'document_requirement_unknown';
      END IF;
      IF v_path !~ ('^enrollment/' || v_uid::text || '/[0-9a-f]{32}\.pdf$') OR NOT EXISTS (
           SELECT 1 FROM storage.objects so WHERE so.bucket_id = 'enrollment-documents' AND so.name = v_path
              AND COALESCE(so.metadata->>'mimetype', '') = 'application/pdf'
              AND COALESCE((so.metadata->>'size')::bigint, 0) BETWEEN 1 AND 10485760) THEN
        RAISE EXCEPTION 'document_file_invalid';
      END IF;
      INSERT INTO public.course_enrollment_documents (application_id, user_id, requirement, storage_path, file_name, size_bytes)
      VALUES (v_row.id, v_uid, v_req, v_path, left(COALESCE(NULLIF(btrim(v_doc->>'file_name'), ''), 'dokumen.pdf'), 200),
              (SELECT (so.metadata->>'size')::bigint FROM storage.objects so WHERE so.bucket_id = 'enrollment-documents' AND so.name = v_path))
      ON CONFLICT (application_id, requirement) DO UPDATE
        SET storage_path = EXCLUDED.storage_path, file_name = EXCLUDED.file_name, size_bytes = EXCLUDED.size_bytes, uploaded_at = now();
    END LOOP;
    SELECT r INTO v_missing FROM jsonb_array_elements_text(COALESCE(v_off.required_documents, '[]'::jsonb)) r
     WHERE NOT EXISTS (SELECT 1 FROM public.course_enrollment_documents d WHERE d.application_id = v_row.id AND d.requirement = r)
     LIMIT 1;
    IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'documents_required:%', v_missing; END IF;
  END IF;

  INSERT INTO public.admin_audit_log (event_type, actor_id, target_user_id, entity_type, entity_id, after_data)
  VALUES ('course_enrollment_requested', v_uid, v_uid, 'course_enrollment', v_course,
          jsonb_build_object('status', 'pending', 'course_id', v_course, 'course_title', v_title,
                             'applicant_name', v_name, 'applicant_email', v_email,
                             'applicant_organization', v_org, 'notes', v_notes, 'application_id', v_row.id));

  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'changed', true);
END $$;
REVOKE ALL ON FUNCTION public.course_enrollment_apply(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.course_enrollment_apply(text, text, text, jsonb) TO authenticated;

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
  IF _decision NOT IN ('approve', 'reject', 'request_revision') OR _decision IS NULL THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF _decision = 'request_revision' AND (v_notes IS NULL OR char_length(v_notes) < 5) THEN RAISE EXCEPTION 'revision_note_required'; END IF;
  IF char_length(COALESCE(v_notes, '')) > 1000 THEN RAISE EXCEPTION 'notes_too_long'; END IF;
  IF _user_id = v_actor THEN RAISE EXCEPTION 'self_decision_forbidden'; END IF;
  v_target := CASE _decision WHEN 'approve' THEN 'approved' WHEN 'request_revision' THEN 'revision_requested' ELSE 'rejected' END;

  SELECT * INTO v_before FROM public.course_enrollment_applications
   WHERE user_id = _user_id AND course_id = _course_id FOR UPDATE;
  IF v_before.id IS NULL THEN RAISE EXCEPTION 'application_not_found'; END IF;

  -- Waiting for the participant: nothing to decide until it is sent again.
  IF v_before.status = 'revision_requested' AND v_target <> 'revision_requested' THEN RAISE EXCEPTION 'application_awaiting_revision'; END IF;
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
    VALUES (CASE _decision WHEN 'approve' THEN 'course_enrollment_approved' WHEN 'request_revision' THEN 'course_enrollment_revision_requested'
                 ELSE 'course_enrollment_rejected' END,
            v_actor, _user_id, 'course_enrollment', _course_id, to_jsonb(v_before),
            jsonb_build_object('status', v_row.status, 'course_id', _course_id, 'course_title', v_row.course_title,
                               'applicant_name', v_row.applicant_name, 'applicant_email', v_row.applicant_email,
                               'decision_by', v_actor, 'decision_at', v_row.decision_at,
                               'decision_notes', v_row.decision_notes, 'offering_id', v_offering));
  END IF;

  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status,
                            'changed', v_before.status = 'pending', 'offeringLinked', v_offering IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.admin_course_enrollment_decide(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_course_enrollment_decide(uuid, text, text, text) TO authenticated;

COMMIT;
