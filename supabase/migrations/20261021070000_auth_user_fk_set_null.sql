-- ============================================================================
-- Catatan pelaku dikosongkan saat akun dihapus (Nomor 5, CATATAN_PERBAIKAN 2l)
-- ============================================================================
-- Sembilan foreign key ke auth.users tidak punya aturan ON DELETE, sehingga akun
-- yang pernah tercatat di sana tidak bisa dihapus ("Database error deleting user").
-- Akun uji menumpuk karenanya, dan akun spam / permintaan hapus data tidak bisa
-- diproses dari dashboard Supabase.
--
-- Diubah (kolom jejak pelaku yang memang boleh NULL): ON DELETE SET NULL, baris
-- log/riwayatnya tetap ada, hanya pelakunya dikosongkan:
--   governance_audit_log.actor_id, review_template_versions.published_by,
--   user_roles.granted_by.
-- Sengaja TIDAK diubah (NOT NULL, bukti kepemilikan/keputusan; akun yang memilikinya
-- tetap tidak bisa dihapus diam-diam, cukup dinonaktifkan):
--   review_subjects.submitted_by, review_decisions.decided_by,
--   review_assignments.assigned_by, review_templates.created_by,
--   rbac_role_change_requests.requested_by (sengaja RESTRICT sejak awal),
--   module_withdrawal_requests.trainer_id (tabel dibuat di luar migrasi repo).
-- Setiap langkah dilewati bila tabel/constraint tidak ada atau sudah benar.

BEGIN;

DO $$
DECLARE
  v record; v_con text;
BEGIN
  FOR v IN SELECT * FROM (VALUES
      ('governance_audit_log', 'actor_id'),
      ('review_template_versions', 'published_by'),
      ('user_roles', 'granted_by')) AS t(tbl, col)
  LOOP
    IF to_regclass('public.' || v.tbl) IS NULL THEN CONTINUE; END IF;
    -- Only a nullable column can be set to NULL.
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = v.tbl AND column_name = v.col
                  AND is_nullable = 'NO') THEN
      RAISE NOTICE '%.% NOT NULL, dilewati', v.tbl, v.col;
      CONTINUE;
    END IF;
    FOR v_con IN
      SELECT c.conname FROM pg_constraint c
       WHERE c.contype = 'f' AND c.conrelid = ('public.' || v.tbl)::regclass
         AND c.confrelid = 'auth.users'::regclass AND c.confdeltype <> 'n'
         AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
                                WHERE attrelid = ('public.' || v.tbl)::regclass AND attname = v.col)]
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v.tbl, v_con);
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
                     v.tbl, v_con, v.col);
      RAISE NOTICE '%.% -> ON DELETE SET NULL', v.tbl, v.col;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
