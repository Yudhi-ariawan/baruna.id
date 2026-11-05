-- ============================================================================
-- Sertifikat: syarat terbit memakai evaluasi akhir yang dipakai halaman course,
-- dan jalur evaluasi lama yang bisa diisi kosong ditutup (audit 5 Nov 2026,
-- CATATAN_PERBAIKAN 2an). Dibuktikan dengan `npm run test:certificate-path`.
--
-- Sebelum migrasi (dicek di intern-update dengan course uji):
-- * check_certificate_eligibility (20261020010000) mensyaratkan baris di tabel
--   lama `evaluations`. Halaman course (LearningDashboard) memakai evaluasi akhir
--   yang baru (completion_evaluation_*), yang tidak pernah mengisi tabel itu.
--   Peserta yang menyelesaikan semua modul lewat tampilan selalu ditolak
--   "evaluation_missing", untuk offering apa pun.
-- * learning_evaluation_submit (yang mengisi `evaluations`) bisa dipanggil
--   langsung oleh peserta dengan isian kosong `{}`; setelah itu sertifikat
--   langsung bisa diterbitkan. Aplikasi tidak memakai fungsi ini dari layar mana pun.
--
-- Sesudah migrasi, syarat sertifikat (urutan pemeriksaan):
--   1. pendaftaran ada dan tidak ditarik;
--   2. course punya modul, dan semua modul selesai;
--   3. bila offering mewajibkan evaluasi akhir:
--        - offering harus punya template evaluasi (bila tidak:
--          'completion_evaluation_not_configured', urusan admin, bukan peserta);
--        - peserta sudah MENGIRIM evaluasi akhirnya ('completion_evaluation_missing').
--   Offering yang tidak mewajibkan evaluasi akhir: cukup semua modul selesai.
-- Bentuk hasil sama dengan versi lama (eligible, reason, completed, required,
-- completion_evaluation_submitted), jadi aplikasi lama tetap bisa membacanya.
--
-- Belum diubah (menunggu mentor, Slide 24 "Penilaian"): modul ditandai selesai
-- oleh peserta sendiri (learning_progress_mark), belum wajib lulus kuis.
-- Sertifikat tetap berlabel "CONTOH / BELUM RESMI".
-- Aman dijalankan ulang.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.check_certificate_eligibility(_enrolment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_enrolment RECORD; v_module_count integer; v_completed_count integer; v_ce_submitted boolean;
BEGIN
  SELECT e.id, e.user_id, e.course_offering_id, e.enrolment_status, o.master_course_id,
         COALESCE(o.completion_evaluation_required, false) AS evaluation_required,
         o.completion_evaluation_template_id AS evaluation_template_id
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
    IF v_enrolment.evaluation_template_id IS NULL THEN
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
  RETURN jsonb_build_object('eligible', true, 'completed', v_completed_count, 'required', v_module_count,
                            'completion_evaluation_submitted', v_ce_submitted);
END $$;
REVOKE ALL ON FUNCTION public.check_certificate_eligibility(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_certificate_eligibility(uuid) TO authenticated, service_role;

-- The old evaluation path is no longer part of any certificate rule and is not
-- used by the app: nobody but the service role may write it any more.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'learning_evaluation_submit'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
