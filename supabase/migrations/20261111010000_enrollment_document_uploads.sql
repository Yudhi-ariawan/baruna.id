-- Enrolment documents uploaded but not sent yet (PB-ACA-03, Slide 22; KESIAPAN_RILIS
-- bagian E, temuan 10 Nov; CATATAN_PERBAIKAN 2aw).
--
-- Before: a PDF uploaded on the course page was only remembered by that browser tab
-- until "Ajukan" was pressed. On another device the participant had to upload again,
-- and the first file stayed in storage with nothing pointing at it.
-- Now: every upload is recorded here right after it lands in the private bucket, per
-- (participant, offering, document). Any device of the same account sees it and can
-- send it. Sending the application copies it into course_enrollment_documents and a
-- trigger removes the record in the same transaction. Replaced or abandoned files are
-- removed by scripts/cleanup-enrollment-documents.mjs.
--
-- Rules live in the database: only the owner's own files in the bucket, PDF, 1 byte to
-- 10 MB, only documents the offering asks for, only while the application can still be
-- changed (not sent yet, rejected, or awaiting revision). Registering takes the same
-- lock as course_enrollment_apply, so it cannot interleave with sending.
-- Re-runnable.

CREATE TABLE IF NOT EXISTS public.course_enrollment_document_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offering_code text NOT NULL,
  requirement text NOT NULL CHECK (char_length(requirement) BETWEEN 1 AND 120),
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 200),
  size_bytes bigint,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, offering_code, requirement)
);
ALTER TABLE public.course_enrollment_document_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_enrollment_document_uploads FROM anon, authenticated;
GRANT SELECT ON public.course_enrollment_document_uploads TO authenticated;
GRANT ALL ON public.course_enrollment_document_uploads TO service_role;
DROP POLICY IF EXISTS course_enrollment_document_uploads_own_read ON public.course_enrollment_document_uploads;
CREATE POLICY course_enrollment_document_uploads_own_read ON public.course_enrollment_document_uploads
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enrollment_document_register(
  _offering_code text, _requirement text, _path text, _file_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text := btrim(COALESCE(_offering_code, ''));
  v_req text := btrim(COALESCE(_requirement, ''));
  v_path text := btrim(COALESCE(_path, ''));
  v_name text := left(COALESCE(NULLIF(btrim(_file_name), ''), 'dokumen.pdf'), 200);
  v_off RECORD;
  v_status text;
  v_size bigint;
  v_row public.course_enrollment_document_uploads;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;

  SELECT o.id, o.status, o.enrolment_access_rule::text AS rule, o.required_documents INTO v_off
    FROM public.course_offerings o WHERE o.offering_code = v_code;
  IF v_off.id IS NULL OR COALESCE(v_off.rule, '') <> 'approval_required' THEN RAISE EXCEPTION 'offering_no_application'; END IF;
  IF COALESCE(v_off.status, '') <> 'published' THEN RAISE EXCEPTION 'offering_closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(v_off.required_documents, '[]'::jsonb)) r WHERE r = v_req) THEN
    RAISE EXCEPTION 'document_requirement_unknown';
  END IF;

  SELECT (so.metadata->>'size')::bigint INTO v_size FROM storage.objects so
   WHERE so.bucket_id = 'enrollment-documents' AND so.name = v_path
     AND COALESCE(so.metadata->>'mimetype', '') = 'application/pdf';
  IF v_path !~ ('^enrollment/' || v_uid::text || '/[0-9a-f]{32}\.pdf$') OR v_size IS NULL OR v_size NOT BETWEEN 1 AND 10485760 THEN
    RAISE EXCEPTION 'document_file_invalid';
  END IF;

  -- Same lock as course_enrollment_apply for this (participant, offering).
  PERFORM pg_advisory_xact_lock(hashtextextended('course_enrollment:' || v_uid::text || ':' || v_code, 0));

  SELECT a.status INTO v_status FROM public.course_enrollment_applications a WHERE a.user_id = v_uid AND a.course_id = v_code;
  IF v_status IN ('pending', 'approved') THEN RAISE EXCEPTION 'application_not_editable: status %', v_status; END IF;

  -- The same file sent twice (double click, retry) is one record.
  SELECT * INTO v_row FROM public.course_enrollment_document_uploads WHERE storage_path = v_path;
  IF v_row.id IS NOT NULL THEN
    IF v_row.user_id <> v_uid OR v_row.offering_code <> v_code OR v_row.requirement <> v_req THEN RAISE EXCEPTION 'document_file_invalid'; END IF;
    RETURN jsonb_build_object('requirement', v_row.requirement, 'file_name', v_row.file_name, 'changed', false);
  END IF;

  -- One file per document; a newer upload replaces the older one (from any device).
  INSERT INTO public.course_enrollment_document_uploads (user_id, offering_code, requirement, storage_path, file_name, size_bytes)
  VALUES (v_uid, v_code, v_req, v_path, v_name, v_size)
  ON CONFLICT (user_id, offering_code, requirement) DO UPDATE
    SET storage_path = EXCLUDED.storage_path, file_name = EXCLUDED.file_name, size_bytes = EXCLUDED.size_bytes, uploaded_at = now()
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('requirement', v_row.requirement, 'file_name', v_row.file_name, 'changed', true);
END $$;
REVOKE ALL ON FUNCTION public.enrollment_document_register(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enrollment_document_register(text, text, text, text) TO authenticated;

-- A file that has been sent with the application is no longer a pending upload.
-- Runs inside course_enrollment_apply's transaction.
CREATE OR REPLACE FUNCTION public._enrollment_document_upload_consumed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.course_enrollment_document_uploads WHERE storage_path = NEW.storage_path AND user_id = NEW.user_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._enrollment_document_upload_consumed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS course_enrollment_documents_consume_upload ON public.course_enrollment_documents;
CREATE TRIGGER course_enrollment_documents_consume_upload
  AFTER INSERT OR UPDATE OF storage_path ON public.course_enrollment_documents
  FOR EACH ROW EXECUTE FUNCTION public._enrollment_document_upload_consumed();
