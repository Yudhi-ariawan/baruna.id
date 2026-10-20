-- ============================================================================
-- Isi belajar modul (dokumen, tautan unduhan, soal kuis): hanya untuk yang berhak
-- ============================================================================
-- getPublishedModuleDetail dipanggil tanpa login dan mengembalikan seluruh dokumen
-- (dengan tautan unduhan bertanda tangan) dan soal kuis. "Gerbang" ruang belajar
-- hanya ada di tampilan. Sekarang server menanyakan fungsi ini sebelum memberikan
-- isi belajar. Berhak bila salah satu:
--   * pendaftarannya untuk modul ini DISETUJUI admin (course_enrollment_applications,
--     course_id = id modul, sama dengan getMyCourseEnrollmentStatus);
--   * penulis modul (original_contributor_id modul, atau pemilik profil expert
--     penulisnya; aturan pemilik sama dengan migrasi 20261020030000);
--   * pemutus resmi (admin / super admin / approver / admin lama).
-- Hanya service_role yang boleh memanggilnya (dipanggil server function dengan id
-- pengguna dari sesi, bukan dari browser).

BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_module_content(_uid uuid, _module_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND _module_id IS NOT NULL AND (
    public._can_decide_review(_uid)
    OR EXISTS (
      SELECT 1 FROM public.course_enrollment_applications a
       WHERE a.user_id = _uid AND a.course_id = _module_id::text AND a.status = 'approved')
    OR EXISTS (
      -- Ownership follows the single rule of migration 20261020030000:
      -- original_contributor_id (created_by may be the admin who published it).
      SELECT 1 FROM public.module_registry m
       WHERE m.id = _module_id
         AND (m.original_contributor_id = _uid
              OR EXISTS (SELECT 1 FROM public.experts e
                          WHERE e.id = m.author_expert_id AND e.original_contributor_id = _uid)))
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_module_content(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_module_content(uuid, uuid) TO service_role;

COMMIT;
