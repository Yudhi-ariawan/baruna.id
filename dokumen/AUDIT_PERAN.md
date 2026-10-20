# Audit Peran terhadap Dokumen Panduan (21 Oktober 2026)

Acuan: slide 3 (aktor proses), slide 16 (**Role dan Hak Akses BARUNA**, matriks 10 peran), slide 42 (LS-01 role & hak akses), slide 37 (PB-EXP-02).
Diperiksa di database intern-update dan kode branch `intern-update`. Semua pengujian sebelumnya memakai **super admin**, yang melewati semua pemeriksaan; karena itu temuan di bawah tidak terlihat saat pengujian manual.

## Status (21 Okt, setelah perbaikan)

Temuan reviewer/verifier/approver/operator **sudah diperbaiki**: Konsol Kurasi `/governance` per peran, dan akar masalahnya (katalog `rbac_roles` tidak terbaca non-admin, migrasi `20261021040000`). Diuji dengan akun per peran: `npm run test:console-roles` (63) dan `npm run test:console-decisions` (16) lulus. Rincian: `CATATAN_PERBAIKAN.md` bagian 2o. Masih terbuka: Publisher (tahap belum ada), catatan reviewer/rekam verifikasi, ruang kerja operator untuk cek kelengkapan, peran admin vs super admin.

## Ringkasan

Tabel izin di database sudah sesuai matriks slide 16 (`npm run test:rbac`, 820 pengecekan). Masalahnya ada di **penegakan**: aplikasi memakai campuran izin (`users.read`, `academy.approve`) dan daftar peran yang ditulis langsung di kode, dan keduanya tidak sejalan. Akibatnya **rantai kurasi resmi (reviewer → verifier → approver → publisher) hanya bisa dijalankan oleh admin/super admin**.

## Temuan per peran

| Peran (slide 16) | Seharusnya | Kenyataan di aplikasi | Status |
|---|---|---|---|
| Public | Baca informasi publik | Halaman publik terbuka; materi modul tidak (Nomor 4) | Sesuai |
| Registered User | Fitur dasar, mengajukan permintaan | Diuji `test:lifecycle` | Sesuai |
| Participant | Belajar, aktivitas | Diuji `test:lifecycle`, `test:participant-rpc` | Sesuai (sertifikat masih CONTOH) |
| Expert | Profil, berbagi keahlian, ditugaskan | Diuji `test:expert-rpc`; Penugasan Expert disembunyikan | Sebagian |
| Operator | Kelola data harian, input, cek kelengkapan, siapkan untuk review | Tidak punya `users.read` -> **tidak bisa masuk portal `/admin`**; diarahkan ke `/governance/queue` yang juga menolaknya | **Tidak berjalan** |
| Reviewer | Meninjau substansi, memberi catatan | Tidak bisa masuk `/admin` (antrean Expert/Modul/Publikasi ada di sana); di alur Expert/Modul/KH hanya bisa membaca, tidak ada tempat mencatat hasil review | **Tidak berjalan** |
| Verifier | Memverifikasi kebenaran, kepatuhan | Tidak bisa masuk `/admin` maupun `/governance`; tidak ada aksi "verifikasi" yang tercatat (slide 37 meminta *verification record*) | **Tidak berjalan** |
| Approver | Persetujuan akhir | Di database berhak memutuskan (`experts.approve`, `academy.approve`), tetapi **tidak bisa masuk `/admin`** tempat tombol keputusan berada. Hanya approver yang juga admin yang bisa | **Tidak berjalan** (kecuali juga admin) |
| Publisher | Menayangkan konten | Tidak ada pekerjaan: persetujuan langsung menayangkan (pertanyaan mentor "publisher vs approver") | **Belum ada** |
| Admin | Kelola sistem, user, role (slide: akses penuh) | Dua peran berbeda: `super_admin` (82 izin, sesuai slide) dan `admin` (47 izin, tanpa `users.assign_role` dan izin keputusan domain). Aplikasi menganggap `admin` penuh, database tidak: admin biasa melihat tombol "Simpan Perubahan Peran" tetapi RPC menolaknya. `test:rbac` tidak menguji `admin` | **Tidak konsisten** |

Bukti (has_permission di database, 21 Okt):
- `rev***` (reviewer + approver): portal `/admin` TIDAK; `experts.approve` = true.
- `col***` (publisher): portal `/admin` TIDAK.
- admin kedua (admin + approver): portal `/admin` YA; `users.assign_role` = false.

## Penyebab

1. Gerbang portal `/admin` (`src/routes/admin.tsx`) memakai izin `users.read`, yang hanya dimiliki admin/super admin. Halaman di dalamnya (Verifikasi Expert/Modul/Publikasi, Persetujuan Peserta) punya pemeriksaan server sendiri yang **mengizinkan** reviewer/verifier/approver/operator, tetapi tidak pernah terjangkau.
2. Area `/governance` hanya untuk `admin`/`management`/`qa_reviewer` (kini reviewer dan approver lewat pemetaan 20261021020000); verifier, publisher, operator tidak punya tempat.
3. Daftar peran di kode tidak seragam: tautan portal (Navbar), halaman awal setelah login (`home.functions.ts`), dan izin "admin penuh" (`permissions.server.ts`) masing-masing punya daftar sendiri.
4. Peran `admin` vs `super_admin`: slide hanya punya satu "Admin".

## Rencana perbaikan (urut)

1. **Pintu portal admin per izin, bukan per `users.read`.** Masuk bila punya izin kerja di salah satu menu (review/verify/approve/publish domain, atau tugas operator); menu dan tombol tampil sesuai izin (Users & Access hanya `users.read`). Navbar dan halaman awal memakai aturan yang sama. Tanpa migrasi.
2. **Keputusan: peran `admin`.** (a) admin = penuh seperti super admin (beri semua izin, `test:rbac` ikut menguji admin), atau (b) admin = pengelola sistem tanpa mengatur peran (sembunyikan tombol peran untuk admin agar tidak menyesatkan).
3. **Catatan reviewer dan rekam verifikasi** di alur Expert/Modul/Knowledge Hub (slide 37: *verification record*, *recommendation record*). Fitur baru; perlu kesepakatan bentuknya.
4. **Tahap publisher** terpisah dari approver (pertanyaan mentor yang sudah tercatat).
5. **Ruang kerja operator** (cek kelengkapan, minta perbaikan, siapkan untuk review) di Admin Console.
6. Uji per peran dengan akun terpisah, satu pengajuan dari awal sampai tayang (lihat daftar uji di bawah).

## Daftar uji per peran (akun terpisah, bukan super admin)

1. Pengaju (trainer/peserta): ajukan modul / publikasi Knowledge Hub / pendaftaran expert.
2. Operator: lihat antrean, cek kelengkapan, minta perbaikan.
3. Reviewer: buka antrean, baca isi, beri catatan; pastikan tidak ada tombol "Setujui".
4. Verifier: verifikasi dokumen/lisensi; pastikan tidak ada tombol "Setujui".
5. Approver: setujui/tolak; pastikan tidak bisa memutuskan pengajuannya sendiri.
6. Publisher: tayangkan (setelah tahap ini ada).
7. Admin: kelola user dan peran; pastikan setiap perubahan tercatat di audit log.
8. Pengunjung tanpa login: pastikan materi modul tidak terbuka.
