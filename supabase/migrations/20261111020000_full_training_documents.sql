-- ============================================================================
-- Full Training: application documents really reach the administrator, and can be
-- replaced after "Minta Perbaikan" (PB-ACA-03, Slide 22 "Unggah Dokumen
-- Persyaratan"; CATATAN_PERBAIKAN 2ax). Proven by `npm run test:full-training-documents`.
--
-- Before: the Full Training form (Passport, CV, Nomination Letter, Motivation Letter,
-- Photo) only kept file NAMES in the participant's browser. The administrator never
-- saw the files, and after a request for revision there was nothing to upload again.
-- Now:
-- * full_training_programs: the Full Training programs the server knows, with the
--   documents each one asks for. The program pages are still static in the app
--   (src/data/training.ts); this table is the server's copy of the document list.
-- * The private bucket 'enrollment-documents' also accepts JPG/PNG. Course Offering
--   documents stay PDF only; Full Training documents may be PDF (<= 10 MB) or JPG/PNG
--   (<= 2 MB), following ENGINEERING_STANDARDS.
-- * enrollment_document_register and course_enrollment_apply handle Full Training
--   like an offering: files must be the participant's own uploads, every listed
--   document is required, and on a resubmission earlier documents count, so after
--   "Minta Perbaikan" only the documents that need fixing are uploaded again.
-- * course_enrollment_document_uploads.offering_code is renamed course_id (it now
--   also holds a Full Training slug). The register function's first argument is
--   renamed accordingly (_course_id).
-- Run after 20261111010000. Re-runnable.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.full_training_programs (
  course_id text PRIMARY KEY CHECK (course_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(course_id) BETWEEN 3 AND 200),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 300),
  required_documents jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(required_documents) = 'array' AND jsonb_array_length(required_documents) <= 10),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.full_training_programs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.full_training_programs FROM anon, authenticated;
GRANT SELECT ON public.full_training_programs TO anon, authenticated;
GRANT ALL ON public.full_training_programs TO service_role;
DROP POLICY IF EXISTS full_training_programs_read ON public.full_training_programs;
CREATE POLICY full_training_programs_read ON public.full_training_programs FOR SELECT USING (true);

-- The one Full Training program of the app today. Labels match DOCUMENT_FIELDS in
-- src/lib/application.ts (checked by test:full-training-documents). Existing rows
-- are left as they are.
INSERT INTO public.full_training_programs (course_id, title, required_documents)
VALUES ('international-training-fisheries-african-countries', 'International Training on Fisheries for African Countries',
        '["Passport Copy", "Curriculum Vitae (CV)", "Nomination Letter", "Motivation Letter", "Recent Passport Photo"]'::jsonb)
ON CONFLICT (course_id) DO NOTHING;

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'], file_size_limit = 10485760
 WHERE id = 'enrollment-documents';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'course_enrollment_document_uploads' AND column_name = 'offering_code') THEN
    ALTER TABLE public.course_enrollment_document_uploads RENAME COLUMN offering_code TO course_id;
  END IF;
END $$;

-- Size of an uploaded file when it is a valid document of this participant, else NULL.
-- PDF up to 10 MB always; JPG/PNG up to 2 MB only when images are allowed.
CREATE OR REPLACE FUNCTION public._enrollment_document_file_size(_uid uuid, _path text, _allow_images boolean)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (so.metadata->>'size')::bigint
    FROM storage.objects so
   WHERE so.bucket_id = 'enrollment-documents' AND so.name = _path
     AND _path ~ ('^enrollment/' || _uid::text || '/[0-9a-f]{32}\.(pdf|jpg|png)$')
     AND ((right(_path, 4) = '.pdf' AND so.metadata->>'mimetype' = 'application/pdf'
           AND (so.metadata->>'size')::bigint BETWEEN 1 AND 10485760)
       OR (_allow_images AND right(_path, 4) = '.jpg' AND so.metadata->>'mimetype' = 'image/jpeg'
           AND (so.metadata->>'size')::bigint BETWEEN 1 AND 2097152)
       OR (_allow_images AND right(_path, 4) = '.png' AND so.metadata->>'mimetype' = 'image/png'
           AND (so.metadata->>'size')::bigint BETWEEN 1 AND 2097152))
$$;
REVOKE ALL ON FUNCTION public._enrollment_document_file_size(uuid, text, boolean) FROM PUBLIC, anon, authenticated;

-- What a course id asks for: an offering (wins when both exist) or a Full Training program.
CREATE OR REPLACE FUNCTION public._enrollment_document_target(_course text, OUT kind text, OUT required jsonb, OUT problem text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_off RECORD;
BEGIN
  SELECT o.id, o.status, o.enrolment_access_rule::text AS rule, o.required_documents INTO v_off
    FROM public.course_offerings o WHERE o.offering_code = _course;
  IF v_off.id IS NOT NULL THEN
    kind := 'offering';
    required := COALESCE(v_off.required_documents, '[]'::jsonb);
    IF COALESCE(v_off.rule, '') <> 'approval_required' THEN problem := 'offering_no_application';
    ELSIF COALESCE(v_off.status, '') <> 'published' THEN problem := 'offering_closed';
    END IF;
    RETURN;
  END IF;
  SELECT 'full_training', p.required_documents INTO kind, required
    FROM public.full_training_programs p WHERE p.course_id = _course AND p.active;
  IF kind IS NULL THEN problem := 'offering_no_application'; END IF;
END $$;
REVOKE ALL ON FUNCTION public._enrollment_document_target(text) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.enrollment_document_register(text, text, text, text);
CREATE FUNCTION public.enrollment_document_register(
  _course_id text, _requirement text, _path text, _file_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text := btrim(COALESCE(_course_id, ''));
  v_req text := btrim(COALESCE(_requirement, ''));
  v_path text := btrim(COALESCE(_path, ''));
  v_name text := left(COALESCE(NULLIF(btrim(_file_name), ''), 'dokumen'), 200);
  v_target RECORD;
  v_status text;
  v_size bigint;
  v_row public.course_enrollment_document_uploads;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_target FROM public._enrollment_document_target(v_code);
  IF v_target.problem IS NOT NULL THEN RAISE EXCEPTION '%', v_target.problem; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_target.required) r WHERE r = v_req) THEN
    RAISE EXCEPTION 'document_requirement_unknown';
  END IF;

  v_size := public._enrollment_document_file_size(v_uid, v_path, v_target.kind = 'full_training');
  IF v_size IS NULL THEN RAISE EXCEPTION 'document_file_invalid'; END IF;

  -- Same lock as course_enrollment_apply for this (participant, course).
  PERFORM pg_advisory_xact_lock(hashtextextended('course_enrollment:' || v_uid::text || ':' || v_code, 0));

  SELECT a.status INTO v_status FROM public.course_enrollment_applications a WHERE a.user_id = v_uid AND a.course_id = v_code;
  IF v_status IN ('pending', 'approved') THEN RAISE EXCEPTION 'application_not_editable: status %', v_status; END IF;

  -- The same file sent twice (double click, retry) is one record.
  SELECT * INTO v_row FROM public.course_enrollment_document_uploads WHERE storage_path = v_path;
  IF v_row.id IS NOT NULL THEN
    IF v_row.user_id <> v_uid OR v_row.course_id <> v_code OR v_row.requirement <> v_req THEN RAISE EXCEPTION 'document_file_invalid'; END IF;
    RETURN jsonb_build_object('requirement', v_row.requirement, 'file_name', v_row.file_name, 'changed', false);
  END IF;

  -- One file per document; a newer upload replaces the older one (from any device).
  INSERT INTO public.course_enrollment_document_uploads (user_id, course_id, requirement, storage_path, file_name, size_bytes)
  VALUES (v_uid, v_code, v_req, v_path, v_name, v_size)
  ON CONFLICT (user_id, course_id, requirement) DO UPDATE
    SET storage_path = EXCLUDED.storage_path, file_name = EXCLUDED.file_name, size_bytes = EXCLUDED.size_bytes, uploaded_at = now()
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('requirement', v_row.requirement, 'file_name', v_row.file_name, 'changed', true);
END $$;
REVOKE ALL ON FUNCTION public.enrollment_document_register(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enrollment_document_register(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.course_enrollment_apply(
  _course_id text, _course_title text, _notes text DEFAULT NULL, _documents jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_course text := btrim(COALESCE(_course_id, ''));
  v_title text := btrim(COALESCE(_course_title, ''));
  v_notes text := NULLIF(btrim(COALESCE(_notes, '')), '');
  v_row public.course_enrollment_applications;
  v_name text; v_email text; v_org text; v_off RECORD; v_ft RECORD;
  v_required jsonb; v_images boolean := false;
  v_doc jsonb; v_req text; v_path text; v_size bigint; v_missing text;
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
    v_required := COALESCE(v_off.required_documents, '[]'::jsonb);
  ELSE
    -- Full Training program (2ax): its documents are required like an offering's.
    SELECT p.title, p.required_documents INTO v_ft FROM public.full_training_programs p WHERE p.course_id = v_course AND p.active;
    IF v_ft.title IS NOT NULL THEN
      v_title := left(v_ft.title, 300);
      v_required := v_ft.required_documents;
      v_images := true;
    END IF;
  END IF;

  -- Serialises double-clicks and parallel tabs for the same (user, course).
  PERFORM pg_advisory_xact_lock(hashtextextended('course_enrollment:' || v_uid::text || ':' || v_course, 0));

  SELECT * INTO v_row FROM public.course_enrollment_applications
   WHERE user_id = v_uid AND course_id = v_course FOR UPDATE;

  IF jsonb_typeof(COALESCE(_documents, '[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(_documents, '[]'::jsonb)) > 10 THEN
    RAISE EXCEPTION 'documents_invalid';
  END IF;
  IF v_required IS NULL AND jsonb_array_length(COALESCE(_documents, '[]'::jsonb)) > 0 THEN RAISE EXCEPTION 'documents_not_applicable'; END IF;

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

  -- Documents: the files must be this participant's uploads in the private bucket, one
  -- per required document. Earlier documents count on a resubmission.
  IF v_required IS NOT NULL THEN
    FOR v_doc IN SELECT * FROM jsonb_array_elements(COALESCE(_documents, '[]'::jsonb)) LOOP
      v_req := btrim(COALESCE(v_doc->>'requirement', ''));
      v_path := btrim(COALESCE(v_doc->>'path', ''));
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_required) r WHERE r = v_req) THEN
        RAISE EXCEPTION 'document_requirement_unknown';
      END IF;
      v_size := public._enrollment_document_file_size(v_uid, v_path, v_images);
      IF v_size IS NULL THEN RAISE EXCEPTION 'document_file_invalid'; END IF;
      INSERT INTO public.course_enrollment_documents (application_id, user_id, requirement, storage_path, file_name, size_bytes)
      VALUES (v_row.id, v_uid, v_req, v_path, left(COALESCE(NULLIF(btrim(v_doc->>'file_name'), ''), 'dokumen'), 200), v_size)
      ON CONFLICT (application_id, requirement) DO UPDATE
        SET storage_path = EXCLUDED.storage_path, file_name = EXCLUDED.file_name, size_bytes = EXCLUDED.size_bytes, uploaded_at = now();
    END LOOP;
    SELECT r INTO v_missing FROM jsonb_array_elements_text(v_required) r
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

COMMIT;
