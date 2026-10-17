-- ============================================================================
-- review_subjects: pastikan status 'archived' diizinkan
-- ============================================================================
-- Migrasi 20261006110000 menambahkan 'archived' ke review_subjects_current_status_check,
-- tetapi uji langsung ke database intern-update menunjukkan batasan itu belum
-- berlaku di sana (arsip expert ditolak: violates check constraint). Kode lama
-- menutupinya dengan jatuh ke status 'withdrawn'. Aplikasi (arsip expert,
-- modul, publikasi) membutuhkan 'archived'. Migrasi ini mengulang batasan yang
-- sama (aman dijalankan berulang). Baris yang ada hanya berstatus pending /
-- approved / withdrawn, semuanya tetap valid.

BEGIN;

ALTER TABLE public.review_subjects
  DROP CONSTRAINT IF EXISTS review_subjects_current_status_check;

ALTER TABLE public.review_subjects
  ADD CONSTRAINT review_subjects_current_status_check
  CHECK (current_status IN ('pending', 'under_review', 'decision_pending', 'approved', 'rejected', 'withdrawn', 'archived'));

COMMENT ON CONSTRAINT review_subjects_current_status_check ON public.review_subjects IS
  'Allowed lifecycle statuses for review subjects, including archived state for decommissioned or hidden entities.';

COMMIT;
