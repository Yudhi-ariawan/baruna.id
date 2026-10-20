-- ============================================================================
-- Pengerasan: view yang bisa ditulis dan fungsi internal yang terbuka untuk publik
-- ============================================================================
-- Ditemukan oleh supabase/audit_security.sql dan dibuktikan dengan uji langsung
-- sebagai pengunjung tanpa login (20 Okt 2026, database intern-update):
--
-- 1. View `public.languages` (di atas languages_taxonomy; dibuat di luar migrasi
--    repo) berjalan sebagai pemiliknya, sehingga RLS languages_taxonomy terlewati:
--    pengunjung tanpa login BERHASIL melakukan UPDATE lewat view ini. View
--    `experts_directory_v` juga punya izin tulis (view-nya sendiri tidak bisa
--    ditulis, tetapi izinnya tidak perlu ada). Aplikasi hanya membaca keduanya.
--
-- 2. Banyak migrasi menutup fungsi internal dengan `REVOKE ... FROM PUBLIC`, tetapi
--    Supabase memberi EXECUTE langsung ke role anon dan authenticated, jadi REVOKE
--    itu tidak berpengaruh. Terbukti sebagai pengunjung tanpa login:
--      * _service_request_log      menulis riwayat permintaan layanan dengan pelaku bebas
--                                  (riwayat bisa dipalsukan bila ID permintaan diketahui);
--      * _latest_trainer_status    membocorkan baris status trainer (pemberi, alasan);
--      * _service_request_events_json membocorkan riwayat dan pesan permintaan layanan.
--    Fungsi di bawah hanya dipanggil dari dalam fungsi SECURITY DEFINER (berjalan
--    sebagai pemilik), tidak dari policy RLS, view, pemicu, indeks, atau kode
--    aplikasi, sehingga aman ditutup untuk anon dan authenticated. Fungsi pembantu
--    yang dipakai policy RLS (_expert_is_owner, _expert_child_read/_write,
--    _can_decide_review, _active_trainer_expert_id, _is_service_admin, ...) SENGAJA
--    tidak disentuh: policy dijalankan dengan hak pengguna yang sedang mengakses.
--
-- Setiap langkah dilewati bila objeknya tidak ada (database main bisa berbeda).

BEGIN;

DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['languages', 'experts_directory_v'] LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated', v);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public._service_request_log(uuid, uuid, text, text, text, text, text)',
    'public._service_request_events_json(uuid)',
    'public._latest_trainer_status(uuid)',
    'public._my_verified_expert_id(uuid)',
    'public._enrollment_prerequisite_met(uuid)',
    'public._can_approve_academy(uuid)',
    'public._expert_has_active_portal(uuid)',
    'public._module_level_limit(text)',
    'public._is_enrollment_admin(uuid)',
    'public.module_registry_owner_matches(uuid, uuid)'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END IF;
  END LOOP;
END $$;

COMMIT;
