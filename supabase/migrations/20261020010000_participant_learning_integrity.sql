-- ============================================================================
-- Peserta: pendaftaran kursus, progres, evaluasi, dan sertifikat lewat RPC
-- ============================================================================
-- Celah sebelumnya (bisa dipicu akun biasa lewat SDK browser maupun server fn):
--  * enrolments / progress_records / evaluations / learning_audit_log boleh
--    ditulis langsung oleh pemiliknya (GRANT INSERT/UPDATE + kebijakan own_*).
--  * enrolInOffering tidak memeriksa enrolment_access_rule: kursus yang
--    "approval_required" bisa didaftari sendiri tanpa persetujuan admin.
--  * progres menerima learning_activity_id sembarang, dan
--    check_certificate_eligibility hanya menghitung jumlah baris "completed",
--    sehingga 4 ID asal-asalan cukup untuk "menyelesaikan" kursus 4 modul.
--  * issueCertificate menerbitkan sertifikat berdasarkan data yang ditulis
--    pengguna sendiri; dua klik bersamaan bisa saling bentrok.
--  * halaman verifikasi menyatakan "Terverifikasi Resmi" untuk ID apa pun.
--
-- Sekarang:
--  * learning_enrol: kursus 'open'/'registered' boleh didaftari sendiri (sesuai
--    aturan penawaran), selain itu hanya bila ada pendaftaran yang DISETUJUI admin
--    (admin_course_enrollment_decide juga membuat enrolment saat menyetujui).
--  * learning_progress_mark: hanya aktivitas "module:<kode>" milik kursus itu.
--  * learning_evaluation_submit, learning_enrolment_withdraw, issue_my_certificate:
--    pemilik saja, enrolment aktif, satu transaksi, terkunci per enrolment.
--  * check_certificate_eligibility hanya menghitung modul yang benar-benar ada.
--  * Nomor sertifikat dibuat server (urut + acak, tidak bisa ditebak) dan
--    verify_certificate mencari nomor persis ke tabel certificates.
--  * Tulis langsung dari browser ke keempat tabel dicabut (baca tetap boleh).
-- Format nomor masih sementara (template resmi STTP belum ada).

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.certificate_serial_seq;
GRANT USAGE ON SEQUENCE public.certificate_serial_seq TO service_role;

-- Pendaftaran yang disetujui untuk penawaran ini (pencocokan sama persis dengan
-- admin_course_enrollment_decide: id, offering_code, atau judul penawaran).
CREATE OR REPLACE FUNCTION public._learning_has_approved_application(_uid uuid, _offering_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollment_applications a
      JOIN public.course_offerings o ON o.id = _offering_id
     WHERE a.user_id = _uid AND a.status = 'approved'
       AND (a.course_id = o.id::text OR a.course_id = o.offering_code OR a.course_id = o.offering_title))
$$;

-- Modul resmi kursus: aktivitas yang sah adalah "module:<module_code>".
CREATE OR REPLACE FUNCTION public._learning_enrolment_activities(_enrolment_id uuid)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'module:' || mm.module_code
    FROM public.enrolments e
    JOIN public.course_offerings o ON o.id = e.course_offering_id
    JOIN public.master_modules mm ON mm.master_course_id = o.master_course_id
   WHERE e.id = _enrolment_id
$$;

CREATE OR REPLACE FUNCTION public._learning_audit(_event text, _actor uuid, _entity text, _entity_id text, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.learning_audit_log (event_type, actor_id, entity_type, entity_id, details)
  VALUES (_event, _actor, _entity, _entity_id, COALESCE(_details, '{}'::jsonb))
$$;

-- Enrolment milik pemanggil yang masih aktif, dikunci untuk transaksi ini.
CREATE OR REPLACE FUNCTION public._learning_own_active_enrolment(_enrolment_id uuid)
RETURNS public.enrolments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.enrolments;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.enrolments WHERE id = _enrolment_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.user_id <> v_uid THEN RAISE EXCEPTION 'enrolment_not_found' USING ERRCODE = '42501'; END IF;
  IF v_row.enrolment_status = 'withdrawn' THEN RAISE EXCEPTION 'enrolment_not_active'; END IF;
  RETURN v_row;
END $$;

-- ------------------------------------------------------------ daftar kursus
CREATE OR REPLACE FUNCTION public.learning_enrol(_offering_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_off public.course_offerings; v_row public.enrolments; v_rule text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_off FROM public.course_offerings WHERE offering_code = btrim(COALESCE(_offering_code, ''));
  IF v_off.id IS NULL THEN RAISE EXCEPTION 'offering_not_found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('learning_enrol:' || v_uid::text || ':' || v_off.id::text, 0));
  SELECT * INTO v_row FROM public.enrolments WHERE user_id = v_uid AND course_offering_id = v_off.id FOR UPDATE;
  IF v_row.id IS NOT NULL AND v_row.enrolment_status <> 'withdrawn' THEN
    RETURN jsonb_build_object('id', v_row.id, 'enrolment_status', v_row.enrolment_status,
                              'completion_status', v_row.completion_status, 'created', false);
  END IF;

  -- Aturan akses penawaran; penawaran yang belum diklasifikasi diperlakukan tertutup.
  v_rule := COALESCE(v_off.enrolment_access_rule::text, 'approval_required');
  IF v_rule IN ('open', 'registered') THEN
    IF COALESCE(v_off.status, 'published') <> 'published' THEN RAISE EXCEPTION 'offering_closed'; END IF;
    IF (v_off.enrolment_start_date IS NOT NULL AND current_date < v_off.enrolment_start_date)
       OR (v_off.enrolment_end_date IS NOT NULL AND current_date > v_off.enrolment_end_date) THEN
      RAISE EXCEPTION 'enrolment_window_closed';
    END IF;
  ELSIF NOT public._learning_has_approved_application(v_uid, v_off.id) THEN
    RAISE EXCEPTION 'approval_required';
  END IF;

  IF v_row.id IS NULL THEN
    INSERT INTO public.enrolments (user_id, course_offering_id, enrolment_status, completion_status)
    VALUES (v_uid, v_off.id, 'enrolled', 'in-progress') RETURNING * INTO v_row;
    PERFORM public._learning_audit('enrolment_created', v_uid, 'enrolment', v_row.id::text,
      jsonb_build_object('offering_code', v_off.offering_code, 'access_rule', v_rule));
  ELSE
    UPDATE public.enrolments SET enrolment_status = 'enrolled' WHERE id = v_row.id RETURNING * INTO v_row;
    PERFORM public._learning_audit('enrolment_reactivated', v_uid, 'enrolment', v_row.id::text,
      jsonb_build_object('offering_code', v_off.offering_code, 'access_rule', v_rule));
  END IF;
  RETURN jsonb_build_object('id', v_row.id, 'enrolment_status', v_row.enrolment_status,
                            'completion_status', v_row.completion_status, 'created', true);
END $$;

-- ------------------------------------------------------------ progres
CREATE OR REPLACE FUNCTION public.learning_progress_mark(
  _enrolment_id uuid, _activity_id text, _status text DEFAULT 'completed', _progress numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_enr public.enrolments; v_row public.progress_records; v_value numeric;
BEGIN
  v_enr := public._learning_own_active_enrolment(_enrolment_id);
  IF _status NOT IN ('in-progress', 'completed') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF _progress IS NOT NULL AND (_progress < 0 OR _progress > 100) THEN RAISE EXCEPTION 'invalid_progress'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public._learning_enrolment_activities(_enrolment_id) a WHERE a = _activity_id) THEN
    RAISE EXCEPTION 'activity_not_in_course';
  END IF;
  v_value := COALESCE(_progress, CASE WHEN _status = 'completed' THEN 100 ELSE 0 END);

  INSERT INTO public.progress_records (enrolment_id, learning_activity_id, status, progress_value, completed_at)
  VALUES (_enrolment_id, _activity_id, _status, v_value, CASE WHEN _status = 'completed' THEN now() END)
  ON CONFLICT (enrolment_id, learning_activity_id) DO UPDATE
    -- An activity that is already completed never falls back to in-progress.
    SET status = CASE WHEN public.progress_records.status = 'completed' THEN 'completed' ELSE EXCLUDED.status END,
        progress_value = GREATEST(public.progress_records.progress_value, EXCLUDED.progress_value),
        completed_at = COALESCE(public.progress_records.completed_at, EXCLUDED.completed_at),
        updated_at = now()
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status);
END $$;

-- ------------------------------------------------------------ evaluasi
CREATE OR REPLACE FUNCTION public.learning_evaluation_submit(_enrolment_id uuid, _evaluation_type text, _response jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_enr public.enrolments; v_row public.evaluations;
BEGIN
  v_enr := public._learning_own_active_enrolment(_enrolment_id);
  IF COALESCE(_evaluation_type, '') !~ '^[a-z0-9_-]{1,60}$' THEN RAISE EXCEPTION 'invalid_evaluation_type'; END IF;
  IF jsonb_typeof(COALESCE(_response, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'invalid_response'; END IF;
  IF octet_length(COALESCE(_response, '{}'::jsonb)::text) > 50000 THEN RAISE EXCEPTION 'response_too_large'; END IF;
  INSERT INTO public.evaluations (enrolment_id, evaluation_type, response_data, completion_status, submitted_at)
  VALUES (_enrolment_id, _evaluation_type, COALESCE(_response, '{}'::jsonb), 'submitted', now())
  ON CONFLICT (enrolment_id, evaluation_type) DO UPDATE
    SET response_data = EXCLUDED.response_data, completion_status = 'submitted', submitted_at = now()
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('id', v_row.id, 'evaluation_type', v_row.evaluation_type);
END $$;

-- ------------------------------------------------------------ mundur
CREATE OR REPLACE FUNCTION public.learning_enrolment_withdraw(_enrolment_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.enrolments;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_row FROM public.enrolments WHERE id = _enrolment_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.user_id <> v_uid THEN RAISE EXCEPTION 'enrolment_not_found' USING ERRCODE = '42501'; END IF;
  IF v_row.enrolment_status = 'withdrawn' THEN RETURN jsonb_build_object('ok', true, 'changed', false); END IF;
  UPDATE public.enrolments SET enrolment_status = 'withdrawn' WHERE id = v_row.id;
  PERFORM public._learning_audit('rollback_executed', v_uid, 'enrolment', v_row.id::text,
    jsonb_build_object('reason', left(COALESCE(NULLIF(btrim(_reason), ''), 'user_requested'), 500)));
  RETURN jsonb_build_object('ok', true, 'changed', true);
END $$;

-- ------------------------------------------------------------ kelayakan
-- Bentuk hasil sama seperti sebelumnya; hanya aktivitas modul yang benar-benar
-- ada di kursus yang dihitung, dan enrolment yang ditarik tidak layak.
CREATE OR REPLACE FUNCTION public.check_certificate_eligibility(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_enrolment RECORD; v_module_count integer; v_completed_count integer;
  v_evaluation_exists boolean; v_ce_submitted boolean;
BEGIN
  SELECT e.id, e.user_id, e.course_offering_id, e.enrolment_status, o.master_course_id
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
  SELECT EXISTS (SELECT 1 FROM public.evaluations WHERE enrolment_id = _enrolment_id) INTO v_evaluation_exists;

  IF v_module_count = 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'no_modules_configured',
                              'completion_evaluation_submitted', v_ce_submitted);
  END IF;
  IF v_completed_count < v_module_count THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'modules_incomplete',
      'completed', v_completed_count, 'required', v_module_count,
      'completion_evaluation_submitted', v_ce_submitted);
  END IF;
  IF NOT v_evaluation_exists THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'evaluation_missing',
                              'completion_evaluation_submitted', v_ce_submitted);
  END IF;
  RETURN jsonb_build_object('eligible', true, 'completed', v_completed_count, 'required', v_module_count,
                            'completion_evaluation_submitted', v_ce_submitted);
END $$;

-- ------------------------------------------------------------ terbit sertifikat
CREATE OR REPLACE FUNCTION public.issue_my_certificate(_enrolment_id uuid, _certificate_type text DEFAULT 'completion')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_enr public.enrolments; v_elig jsonb; v_cert public.certificates; v_serial text;
BEGIN
  IF _certificate_type NOT IN ('completion', 'participation', 'program', 'applied-achievement', 'competency', 'statement-of-result') THEN
    RAISE EXCEPTION 'invalid_certificate_type';
  END IF;
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

-- ------------------------------------------------------------ verifikasi publik
-- Satu nomor persis -> satu hasil. Nama pemegang disamarkan (huruf pertama per kata).
CREATE OR REPLACE FUNCTION public.verify_certificate(_number text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_num text := btrim(COALESCE(_number, '')); v jsonb;
BEGIN
  IF v_num = '' OR char_length(v_num) > 120 THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT jsonb_build_object(
           'found', true,
           'certificate_number', c.certificate_number,
           'status', c.certificate_status,
           'certificate_type', c.certificate_type,
           'issue_date', c.issue_date,
           'program', o.offering_title,
           'holder', COALESCE((SELECT string_agg(left(w, 1) || repeat('*', GREATEST(char_length(w) - 1, 1)), ' ')
                                 FROM regexp_split_to_table(btrim(p.display_name), '\s+') w), 'Peserta'))
    INTO v
    FROM public.certificates c
    JOIN public.course_offerings o ON o.id = c.course_offering_id
    LEFT JOIN public.profiles p ON p.id = c.learner_id
   WHERE c.certificate_number = v_num;
  RETURN COALESCE(v, jsonb_build_object('found', false));
END $$;

-- ------------------------------------------------------------ hak akses
DROP POLICY IF EXISTS "enrolments_own_insert" ON public.enrolments;
DROP POLICY IF EXISTS "enrolments_own_update" ON public.enrolments;
DROP POLICY IF EXISTS "progress_own_insert" ON public.progress_records;
DROP POLICY IF EXISTS "progress_own_update" ON public.progress_records;
DROP POLICY IF EXISTS "eval_own_insert" ON public.evaluations;
DROP POLICY IF EXISTS "eval_own_update" ON public.evaluations;
DROP POLICY IF EXISTS "audit_own_insert" ON public.learning_audit_log;
REVOKE INSERT, UPDATE, DELETE ON public.enrolments FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.progress_records FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.evaluations FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.learning_audit_log FROM authenticated, anon;

REVOKE ALL ON FUNCTION public._learning_has_approved_application(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._learning_enrolment_activities(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._learning_audit(text, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._learning_own_active_enrolment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.learning_enrol(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.learning_progress_mark(uuid, text, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.learning_evaluation_submit(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.learning_enrolment_withdraw(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.issue_my_certificate(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.learning_enrol(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.learning_progress_mark(uuid, text, text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.learning_evaluation_submit(uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.learning_enrolment_withdraw(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.issue_my_certificate(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_certificate_eligibility(uuid) TO authenticated, service_role;

COMMIT;
