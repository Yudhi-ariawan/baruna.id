-- ============================================================================
-- Pengunjung tanpa login (role anon) tidak punya izin tulis tabel (Nomor 6, CATATAN 2l)
-- ============================================================================
-- Supabase memberi INSERT/UPDATE/DELETE/TRUNCATE ke `anon` pada setiap tabel dan
-- view baru. Selama RLS aktif izin itu tidak bisa dipakai (audit 20 Okt: UPDATE
-- pengunjung mengubah 0 baris), tetapi:
--   * `review_records` hanya terlindung oleh pemicu (`assignment_not_found`);
--   * view yang berjalan sebagai pemiliknya melewati RLS (kasus `languages`,
--     ditutup di 20261020050000);
--   * satu policy yang keliru di masa depan langsung membuka tulis untuk publik.
-- Pemeriksaan 21 Okt: tidak ada kode aplikasi yang menulis tabel sebagai
-- pengunjung (semua lewat server function/RPC dengan sesi pengguna atau service
-- role; unggahan berkas memakai skema storage, tidak terpengaruh), dan tidak ada
-- policy tulis untuk anon. Izin BACA tidak diubah (katalog publik memerlukannya).
--
-- Tidak mengubah default privileges (tabel baru di masa depan); periksa dengan
-- supabase/audit_security.sql kategori 3.

BEGIN;

DO $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT c.relname
      FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
       AND (has_table_privilege('anon', c.oid, 'INSERT') OR has_table_privilege('anon', c.oid, 'UPDATE')
            OR has_table_privilege('anon', c.oid, 'DELETE') OR has_table_privilege('anon', c.oid, 'TRUNCATE'))
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon', r.relname);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Izin tulis pengunjung dicabut dari % tabel/view', n;
END $$;

COMMIT;
