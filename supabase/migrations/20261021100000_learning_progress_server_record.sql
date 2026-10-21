-- ============================================================================
-- Kelulusan modul dicatat server; ringkasan pembelajaran untuk trainer
-- ============================================================================
-- Dicek 21 Okt 2026 (database intern-update, kode branch ini):
--
-- 1. Status "selesai" kursus mandiri adalah laporan browser: kuis modul database
--    dinilai server (gradePublishedModuleQuiz) tetapi hasilnya TIDAK dicatat;
--    browser lalu menandai selesai di localStorage dan self_paced_sync menerima
--    completed/score apa adanya. Kuis modul bawaan dinilai sepenuhnya di browser
--    (kunci jawaban ikut terkirim). Keempat modul tayang tidak punya kuis trainer;
--    "lulus" diperoleh dari kuis otomatis yang jawabannya selalu pilihan pertama.
--    Keputusan pemilik proyek (21 Okt): kelulusan HANYA dari kuis resmi
--    (kuis trainer, atau bank soal modul bawaan) yang dinilai server.
-- 2. Trainer tidak bisa melihat perkembangan peserta modulnya (Completion Rate
--    "Not available"). PB-ACA-04: pemantauan per peserta = Admin/Operator; trainer
--    cukup ringkasan tanpa data pribadi.
--
-- Perubahan:
-- * module_quiz_attempts: setiap percobaan kuis yang dinilai server (baca milik sendiri).
-- * learning_record_quiz_attempt (HANYA service_role, dipanggil server setelah
--   menilai): satu transaksi, batas percobaan, hanya peserta yang disetujui.
-- * self_paced_enrollments.completion_source: 'server_quiz' atau 'legacy_browser'
--   (baris selesai lama TIDAK dihapus, hanya ditandai belum terverifikasi).
-- * self_paced_sync tidak lagi menerima completed/score/langkah kuis dari browser.
-- * Baris yang sudah lulus tidak bisa dihapus peserta (jejak pembelajaran).
-- * trainer_module_learning_summary(): angka agregat modul milik trainer aktif.

BEGIN;

-- ------------------------------------------------------- 1. asal status selesai
ALTER TABLE public.self_paced_enrollments ADD COLUMN IF NOT EXISTS completion_source text;
UPDATE public.self_paced_enrollments SET completion_source = 'legacy_browser'
 WHERE completed AND completion_source IS NULL;
UPDATE public.self_paced_enrollments SET completion_source = NULL
 WHERE NOT completed AND completion_source IS NOT NULL;
ALTER TABLE public.self_paced_enrollments DROP CONSTRAINT IF EXISTS self_paced_enrollments_completion_source_check;
ALTER TABLE public.self_paced_enrollments ADD CONSTRAINT self_paced_enrollments_completion_source_check
  CHECK ((completed AND completion_source IN ('server_quiz', 'legacy_browser'))
      OR (NOT completed AND completion_source IS NULL));

-- ------------------------------------------------------- 2. percobaan kuis
CREATE TABLE IF NOT EXISTS public.module_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_code text NOT NULL CHECK (module_code ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$'),
  module_kind text NOT NULL CHECK (module_kind IN ('published', 'master')),
  correct integer NOT NULL CHECK (correct >= 0),
  total integer NOT NULL CHECK (total BETWEEN 1 AND 500 AND correct <= total),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  pass_mark integer NOT NULL CHECK (pass_mark BETWEEN 0 AND 100),
  passed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS module_quiz_attempts_user_code_idx ON public.module_quiz_attempts (user_id, module_code, created_at DESC);
CREATE INDEX IF NOT EXISTS module_quiz_attempts_code_idx ON public.module_quiz_attempts (module_code);
ALTER TABLE public.module_quiz_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.module_quiz_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.module_quiz_attempts TO authenticated;
GRANT ALL ON public.module_quiz_attempts TO service_role;
DROP POLICY IF EXISTS module_quiz_attempts_own_read ON public.module_quiz_attempts;
CREATE POLICY module_quiz_attempts_own_read ON public.module_quiz_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ------------------------------------------------------- 3. pencatatan (server saja)
CREATE OR REPLACE FUNCTION public.learning_record_quiz_attempt(
  _uid uuid, _code text, _kind text, _correct integer, _total integer,
  _pass_mark integer, _max_attempts integer,
  _title text DEFAULT NULL, _hours text DEFAULT NULL, _instructor text DEFAULT NULL, _category text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.self_paced_enrollments%ROWTYPE;
  v_used integer; v_score integer; v_passed boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF _kind IS NULL OR _kind NOT IN ('published', 'master') THEN RAISE EXCEPTION 'invalid_module_kind'; END IF;
  IF _code IS NULL OR _code !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$' THEN RAISE EXCEPTION 'invalid_module_code'; END IF;
  IF _total IS NULL OR _total NOT BETWEEN 1 AND 500 OR _correct IS NULL OR _correct NOT BETWEEN 0 AND _total THEN
    RAISE EXCEPTION 'invalid_quiz_result';
  END IF;
  IF _pass_mark IS NULL OR _pass_mark NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'invalid_pass_mark'; END IF;
  IF _max_attempts IS NOT NULL AND _max_attempts < 1 THEN RAISE EXCEPTION 'invalid_max_attempts'; END IF;

  -- Klik ganda / dua perangkat: satu pencatatan per peserta per modul pada satu waktu.
  PERFORM pg_advisory_xact_lock(hashtextextended('learning_quiz:' || _uid::text || ':' || _code, 0));

  -- Hanya peserta yang pendaftarannya disetujui (PB-ACA-03). Admin/penulis boleh
  -- mencoba kuis, tetapi tidak menjadi catatan pembelajaran.
  IF NOT EXISTS (SELECT 1 FROM public.course_enrollment_applications a
                  WHERE a.user_id = _uid AND a.course_id = _code AND a.status = 'approved') THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'not_enrolled');
  END IF;

  SELECT * INTO v_row FROM public.self_paced_enrollments WHERE user_id = _uid AND code = _code FOR UPDATE;
  IF v_row.id IS NOT NULL AND v_row.completed AND v_row.completion_source = 'server_quiz' THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'already_passed', 'score', v_row.score);
  END IF;

  SELECT count(*) INTO v_used FROM public.module_quiz_attempts WHERE user_id = _uid AND module_code = _code;
  IF _max_attempts IS NOT NULL AND v_used >= _max_attempts THEN RAISE EXCEPTION 'quiz_attempts_exhausted'; END IF;

  v_score := round(_correct * 100.0 / _total);
  v_passed := v_score >= _pass_mark;

  INSERT INTO public.module_quiz_attempts (user_id, module_code, module_kind, correct, total, score, pass_mark, passed)
  VALUES (_uid, _code, _kind, _correct, _total, v_score, _pass_mark, v_passed);

  INSERT INTO public.self_paced_enrollments AS t (
    user_id, code, title, hours, instructor, category, score, source, completed, completed_at,
    completion_source, completed_steps, enrolled_at, updated_at)
  VALUES (
    _uid, _code, NULLIF(left(btrim(COALESCE(_title, '')), 300), ''), NULLIF(left(btrim(COALESCE(_hours, '')), 40), ''),
    NULLIF(left(btrim(COALESCE(_instructor, '')), 200), ''), NULLIF(left(btrim(COALESCE(_category, '')), 120), ''),
    CASE WHEN v_passed THEN v_score END, 'self-paced', v_passed, CASE WHEN v_passed THEN now() END,
    CASE WHEN v_passed THEN 'server_quiz' END,
    CASE WHEN v_passed THEN '{"quiz": true}'::jsonb ELSE '{}'::jsonb END, now(), now())
  ON CONFLICT (user_id, code) DO UPDATE SET
    -- Gagal tidak menghapus apa pun; lulus menimpa status lama yang belum terverifikasi.
    completed = CASE WHEN v_passed THEN true ELSE t.completed END,
    completion_source = CASE WHEN v_passed THEN 'server_quiz' ELSE t.completion_source END,
    completed_at = CASE WHEN v_passed THEN now() ELSE t.completed_at END,
    score = CASE WHEN v_passed THEN v_score ELSE t.score END,
    completed_steps = CASE WHEN v_passed THEN t.completed_steps || '{"quiz": true}'::jsonb ELSE t.completed_steps END,
    title = COALESCE(t.title, EXCLUDED.title),
    hours = COALESCE(t.hours, EXCLUDED.hours),
    instructor = COALESCE(t.instructor, EXCLUDED.instructor),
    category = COALESCE(t.category, EXCLUDED.category),
    updated_at = now();

  RETURN jsonb_build_object(
    'recorded', true, 'score', v_score, 'passed', v_passed, 'attemptsUsed', v_used + 1,
    'attemptsLeft', CASE WHEN _max_attempts IS NULL THEN NULL ELSE GREATEST(_max_attempts - v_used - 1, 0) END);
END $$;
REVOKE ALL ON FUNCTION public.learning_record_quiz_attempt(uuid, text, text, integer, integer, integer, integer, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_record_quiz_attempt(uuid, text, text, integer, integer, integer, integer, text, text, text, text)
  TO service_role;

-- ------------------------------------------------------- 4. sinkron browser tanpa kelulusan
-- Sama dengan 20261020040000, kecuali: completed, completedAt, score, dan langkah
-- 'quiz' dari browser diabaikan. Hanya pendaftaran dan langkah video/pdf/ppt
-- (laporan aktivitas peserta sendiri) yang disimpan.
CREATE OR REPLACE FUNCTION public.self_paced_sync(_courses jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text; v_c jsonb; v_code text; v_steps jsonb; v_source text;
  v_skipped integer := 0; v_saved integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF _courses IS NULL OR jsonb_typeof(_courses) <> 'object' THEN RAISE EXCEPTION 'invalid_payload'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(_courses)) > 200 THEN RAISE EXCEPTION 'too_many_courses'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('self_paced:' || v_uid::text, 0));

  FOR v_key, v_c IN SELECT key, value FROM jsonb_each(_courses) LOOP
    v_code := btrim(COALESCE(v_c->>'code', v_key));
    IF jsonb_typeof(v_c) <> 'object'
       OR v_code !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$'
       OR (v_c ? 'explicitlyEnrolled' AND (v_c->'explicitlyEnrolled') IS DISTINCT FROM 'true'::jsonb)
       OR char_length(COALESCE(v_c->>'title', '')) > 300
       OR char_length(COALESCE(v_c->>'hours', '')) > 40
       OR char_length(COALESCE(v_c->>'instructor', '')) > 200
       OR char_length(COALESCE(v_c->>'category', '')) > 120 THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    v_source := CASE WHEN v_c->>'source' IN ('self-paced', 'full-training-program') THEN v_c->>'source' ELSE 'self-paced' END;
    SELECT COALESCE(jsonb_object_agg(k, true), '{}'::jsonb) INTO v_steps
      FROM unnest(ARRAY['video', 'pdf', 'ppt']) k
     WHERE (v_c->'completedSteps'->k) = 'true'::jsonb;

    INSERT INTO public.self_paced_enrollments AS t (
      user_id, code, title, hours, instructor, category, score, source, completed, completed_at,
      completion_source, completed_steps, enrolled_at, updated_at)
    VALUES (
      v_uid, v_code, NULLIF(v_c->>'title', ''), NULLIF(v_c->>'hours', ''), NULLIF(v_c->>'instructor', ''),
      NULLIF(v_c->>'category', ''), NULL, v_source, false, NULL, NULL,
      v_steps, COALESCE(public._epoch_ms_to_ts(v_c->'enrolledAt'), now()), now())
    ON CONFLICT (user_id, code) DO UPDATE SET
      -- Kelulusan hanya dari learning_record_quiz_attempt; di sini tidak pernah berubah.
      completed_steps = t.completed_steps || EXCLUDED.completed_steps,
      enrolled_at = LEAST(t.enrolled_at, EXCLUDED.enrolled_at),
      title = COALESCE(EXCLUDED.title, t.title),
      hours = COALESCE(EXCLUDED.hours, t.hours),
      instructor = COALESCE(EXCLUDED.instructor, t.instructor),
      category = COALESCE(EXCLUDED.category, t.category),
      source = COALESCE(t.source, EXCLUDED.source),
      updated_at = now();
    v_saved := v_saved + 1;
  END LOOP;

  RETURN jsonb_build_object('saved', v_saved, 'skipped', v_skipped);
END $$;
REVOKE ALL ON FUNCTION public.self_paced_sync(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_paced_sync(jsonb) TO authenticated;

-- ------------------------------------------------------- 5. jejak kelulusan tidak bisa dihapus
DROP POLICY IF EXISTS self_paced_enrollments_own_delete ON public.self_paced_enrollments;
CREATE POLICY self_paced_enrollments_own_delete ON public.self_paced_enrollments
  FOR DELETE TO authenticated USING (auth.uid() = user_id AND NOT completed);

-- ------------------------------------------------------- 6. ringkasan untuk trainer
-- Agregat modul tayang milik trainer aktif yang memanggil. Tanpa nama, email,
-- atau ID peserta (pemantauan per peserta adalah tugas Admin/Operator, PB-ACA-04).
CREATE OR REPLACE FUNCTION public.trainer_module_learning_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_expert uuid; v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  v_expert := public._active_trainer_expert_id(v_uid);
  IF v_expert IS NULL THEN RAISE EXCEPTION 'trainer_access_required' USING ERRCODE = '42501'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'moduleId', m.id,
      'title', m.title,
      'hasOfficialQuiz', EXISTS (SELECT 1 FROM public.module_quiz_answer_keys k
                                  WHERE k.module_id = m.id AND jsonb_typeof(k.questions) = 'array'
                                    AND jsonb_array_length(k.questions) > 0),
      'applicationsPending', (SELECT count(*) FROM public.course_enrollment_applications a
                               WHERE a.course_id = m.id::text AND a.status = 'pending'),
      'participantsApproved', (SELECT count(*) FROM public.course_enrollment_applications a
                                WHERE a.course_id = m.id::text AND a.status = 'approved'),
      'participantsStarted', (SELECT count(*) FROM public.self_paced_enrollments s
                               JOIN public.course_enrollment_applications a
                                 ON a.user_id = s.user_id AND a.course_id = s.code AND a.status = 'approved'
                              WHERE s.code = m.id::text),
      'participantsPassed', (SELECT count(*) FROM public.self_paced_enrollments s
                              WHERE s.code = m.id::text AND s.completed AND s.completion_source = 'server_quiz'),
      'quizAttempts', (SELECT count(*) FROM public.module_quiz_attempts q WHERE q.module_code = m.id::text),
      'averageBestScore', (SELECT round(avg(b.best)) FROM (
                             SELECT max(q.score) AS best FROM public.module_quiz_attempts q
                              WHERE q.module_code = m.id::text GROUP BY q.user_id) b)
    ) ORDER BY m.updated_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM public.module_registry m
   WHERE m.author_expert_id = v_expert AND m.current_status = 'published';

  RETURN jsonb_build_object('modules', v_rows);
END $$;
REVOKE ALL ON FUNCTION public.trainer_module_learning_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trainer_module_learning_summary() TO authenticated;

COMMIT;
