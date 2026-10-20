-- ============================================================================
-- Katalog peran (rbac_roles) terbaca semua pengguna yang login
-- ============================================================================
-- Dibuktikan 21 Okt 2026 (intern-update) dengan akun uji ber-peran reviewer:
-- pengguna bisa membaca baris perannya sendiri di rbac_user_roles (policy
-- rbac_user_roles_self_read), tetapi TIDAK bisa membaca rbac_roles, karena satu-
-- satunya policy baca (rbac_roles_read) mensyaratkan izin `roles.read` yang hanya
-- dimiliki admin/super admin.
--
-- Akibatnya setiap pemeriksaan akses di aplikasi yang menggabungkan
-- rbac_user_roles dengan rbac_roles (`rbac_roles!inner(code)`) mendapat hasil
-- kosong untuk semua pengguna non-admin: Verifikasi Expert
-- (getExpertGovernanceAccess), Verifikasi Modul/Publikasi (assertAdminOrReviewer),
-- Persetujuan Peserta (assertAdminAccess). Reviewer, verifier, approver, dan
-- operator ditolak server walaupun peran dan izinnya benar di database; rantai
-- kurasi resmi hanya berjalan untuk admin/super admin (dokumen/AUDIT_PERAN.md).
--
-- Perbaikan: katalog peran (kode, nama, deskripsi) boleh dibaca pengguna login.
-- Data ini bukan rahasia dan tampil juga di halaman Users. Siapa memegang peran
-- apa (rbac_user_roles) TIDAK berubah: tetap hanya pemiliknya sendiri dan
-- pemegang `roles.read`. Pengunjung tanpa login tetap tidak bisa membaca katalog.

BEGIN;

DROP POLICY IF EXISTS rbac_roles_catalog_read ON public.rbac_roles;
CREATE POLICY rbac_roles_catalog_read ON public.rbac_roles
  FOR SELECT TO authenticated
  USING (true);

COMMIT;
