-- ============================================================================
-- Tutup tulis langsung ke review_subjects dan review_assignments
-- ============================================================================
-- Dicek 21 Okt 2026 (database intern-update, akun uji @example.test yang dihapus):
--
-- 1. Policy lama 20260727042857 `review_subjects_admin_write/_admin_update` dan
--    `review_assignments_admin_write/_admin_update` (has_role admin|management)
--    masih aktif. Sejak 20261021020000 approver = management, sehingga dari
--    browser (PostgREST) seorang approver BERHASIL:
--      - mengubah status pengajuannya SENDIRI menjadi 'approved' untuk keempat
--        jenis (expert, module, knowledge_resource, training_need);
--      - menugaskan dirinya sendiri sebagai reviewer pengajuannya sendiri.
--    Ini melewati semua pengaman RPC (larangan memutuskan milik sendiri, alur
--    publikasi per jenis, _assert_reviewer_assignable). Admin sama.
-- 2. `review_assignments_reviewer_coi_update` (reviewer_id = auth.uid()) dimaksudkan
--    untuk menyatakan konflik kepentingan, tetapi mengizinkan reviewer mengubah
--    SEMUA kolom: reviewer BERHASIL memindahkan penugasannya ke pengajuan lain
--    (subject_id), lalu bisa membaca & memberi rekomendasi pada pengajuan yang
--    tidak ditugaskan kepadanya (untuk pengajuan sendiri tetap ditolak pemicu
--    review_records: self_review_forbidden).
--
-- Semua penulisan sah sudah lewat fungsi SECURITY DEFINER (assign_reviewer,
-- reassign_reviewer, cancel_assignment, finalize_decision, return_for_revision,
-- submit_draft_for_review, submit_review_recommendation, admin_expert_*,
-- admin_module_decide, admin_kr_decide, trainer_module_save,
-- request_published_module_revision, set_required_recommendations,
-- expert_revision_resubmit) dan supabaseAdmin di server. Satu-satunya penulisan
-- dari aplikasi lewat hak pengguna adalah "nyatakan konflik" -> diganti RPC
-- review_assignment_declare_conflict di bawah. Fungsi baca tidak berubah.

BEGIN;

DROP POLICY IF EXISTS review_subjects_admin_write ON public.review_subjects;
DROP POLICY IF EXISTS review_subjects_admin_update ON public.review_subjects;
DROP POLICY IF EXISTS review_assignments_admin_write ON public.review_assignments;
DROP POLICY IF EXISTS review_assignments_admin_update ON public.review_assignments;
DROP POLICY IF EXISTS review_assignments_reviewer_coi_update ON public.review_assignments;

-- Lapis kedua: tanpa izin tulis tabel, policy yang dibuat ulang tanpa sengaja pun tidak membuka jalur ini.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.review_subjects, public.review_assignments FROM anon, authenticated;

-- Reviewer menyatakan konflik kepentingan atas penugasan AKTIF miliknya sendiri.
-- Hanya kolom konflik dan status 'recused' yang berubah.
CREATE OR REPLACE FUNCTION public.review_assignment_declare_conflict(_assignment_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reason text := btrim(COALESCE(_reason, ''));
  v_a public.review_assignments%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF char_length(v_reason) = 0 OR char_length(v_reason) > 1000 THEN RAISE EXCEPTION 'conflict_reason_required'; END IF;
  SELECT * INTO v_a FROM public.review_assignments WHERE id = _assignment_id FOR UPDATE;
  IF v_a.id IS NULL OR v_a.reviewer_id <> v_uid THEN RAISE EXCEPTION 'assignment_not_found'; END IF;
  IF v_a.status <> 'active' THEN RAISE EXCEPTION 'assignment_not_active: %', v_a.status; END IF;
  UPDATE public.review_assignments
     SET conflict_of_interest_declared = true, conflict_of_interest_reason = v_reason,
         conflict_declared_at = now(), status = 'recused'
   WHERE id = v_a.id;
  PERFORM public.log_governance_event('conflict_declared', v_uid, v_a.subject_id, 'review_assignment',
    v_a.id::text, NULL, jsonb_build_object('reason', v_reason));
  RETURN jsonb_build_object('id', v_a.id, 'subject_id', v_a.subject_id, 'status', 'recused');
END $$;

REVOKE ALL ON FUNCTION public.review_assignment_declare_conflict(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_assignment_declare_conflict(uuid, text) TO authenticated;

COMMIT;
