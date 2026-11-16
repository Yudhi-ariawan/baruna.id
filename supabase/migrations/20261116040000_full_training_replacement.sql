-- ============================================================================
-- Full Training -> Course Offering (keputusan pemilik proyek 16 Nov,
-- MENUNGGU_ARAHAN_MENTOR "Ruang belajar" / P4, opsi A; CATATAN_PERBAIKAN 2bb).
-- Proven by `npm run test:offering-attendance` (bagian pengalihan).
--
-- The African Countries program is made again through Program Academy as a Course
-- Offering ("Wajib disetujui admin", its five documents); its learning, attendance
-- (20261116030000), completion and certificate then live on the server.
-- Now:
-- * full_training_programs.replaced_by_offering_code: the offering that replaces the
--   old program, set by an Approver/Admin (full_training_set_replacement) and only to
--   a published offering that asks for an application.
-- * course_enrollment_apply: a NEW application to a replaced program is refused with
--   program_replaced:<code> (the app sends the applicant to that offering). An
--   application already in progress (pending, revision requested, rejected,
--   approved) keeps working on the old program. Otherwise identical to
--   20261111020000.
-- Run after 20261111020000. Re-runnable.
-- ============================================================================

BEGIN;

ALTER TABLE public.full_training_programs ADD COLUMN IF NOT EXISTS replaced_by_offering_code text;

CREATE OR REPLACE FUNCTION public.full_training_set_replacement(_course_id text, _offering_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text := NULLIF(btrim(COALESCE(_offering_code, '')), '');
  v_before text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF NOT public._can_decide_review(v_uid) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT replaced_by_offering_code INTO v_before FROM public.full_training_programs WHERE course_id = _course_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'full_training_not_found'; END IF;
  IF v_code IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.course_offerings
        WHERE offering_code = v_code AND status = 'published' AND enrolment_access_rule::text = 'approval_required') THEN
    RAISE EXCEPTION 'full_training_replacement_invalid';
  END IF;
  UPDATE public.full_training_programs SET replaced_by_offering_code = v_code, updated_at = now() WHERE course_id = _course_id;
  INSERT INTO public.admin_audit_log (event_type, actor_id, entity_type, entity_id, before_data, after_data)
  VALUES ('full_training_replacement_set', v_uid, 'full_training_program', _course_id,
          jsonb_build_object('replaced_by_offering_code', v_before), jsonb_build_object('replaced_by_offering_code', v_code));
  RETURN jsonb_build_object('courseId', _course_id, 'replacedBy', v_code);
END $$;
REVOKE ALL ON FUNCTION public.full_training_set_replacement(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.full_training_set_replacement(text, text) TO authenticated;

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
  v_required jsonb; v_images boolean := false; v_replaced text;
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
    SELECT p.title, p.required_documents, p.replaced_by_offering_code INTO v_ft FROM public.full_training_programs p WHERE p.course_id = v_course AND p.active;
    IF v_ft.title IS NOT NULL THEN
      v_title := left(v_ft.title, 300);
      v_required := v_ft.required_documents;
      v_images := true;
      v_replaced := v_ft.replaced_by_offering_code;
    END IF;
  END IF;

  -- Serialises double-clicks and parallel tabs for the same (user, course).
  PERFORM pg_advisory_xact_lock(hashtextextended('course_enrollment:' || v_uid::text || ':' || v_course, 0));

  SELECT * INTO v_row FROM public.course_enrollment_applications
   WHERE user_id = v_uid AND course_id = v_course FOR UPDATE;

  -- Full Training replaced by a Course Offering (2bb): new applicants go there;
  -- applications already in progress finish on the old program.
  IF v_replaced IS NOT NULL AND v_row.id IS NULL THEN
    RAISE EXCEPTION 'program_replaced:%', v_replaced;
  END IF;

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
