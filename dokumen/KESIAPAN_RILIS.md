# Kesiapan Rilis BARUNA (diperbarui 21 Oktober 2026, setelah Nomor 4-10 selesai)

Ringkasan posisi proyek: apa yang sudah diperbaiki, apa yang belum, dan apa yang harus selesai sebelum dipakai banyak pengguna.
Rincian teknis per perbaikan: `dokumen/CATATAN_PERBAIKAN.md` (rencana sisa pekerjaan ada di bagian 2l).
Keputusan yang menunggu mentor: `dokumen/MENUNGGU_ARAHAN_MENTOR.md`.

## Kesimpulan

**Belum siap untuk rilis luas. Siap untuk uji terbatas (pilot) dengan syarat.**
Fondasinya jauh lebih kuat dari 17 Oktober: aturan penting kini dijaga di database, bukan hanya di tampilan.
"Vibe coding" bukan alasannya; alasannya adalah apa yang belum dibuktikan (bagian C).

Status pemeriksaan terakhir (20 Okt, PC): `supabase/check_migrations.sql` di intern-update = 37 baris OK; `tsc`, `build`, `test:lifecycle` 14/14, `test:kh-roles` 20/20 lulus; 0 akun uji tertinggal. Database `main` belum dicek.

## A. Sudah diperbaiki

- **Expert:** keputusan, publikasi, arsip, dan revisi dalam satu transaksi; kunci dua-admin-bersamaan; pemisahan wewenang; tulis langsung dari browser ditutup; satu aturan "pemilik profil" (`original_contributor_id`); direktori aman untuk data besar.
- **Trainer dan modul:** kunci jawaban kuis di tabel privat; simpan modul satu transaksi; kuota menghitung antrean; revisi modul tayang tidak menariknya dari publik.
- **Peserta:** pendaftaran, progres, dan penerbitan sertifikat lewat RPC database (nomor dari server, klik ganda aman); verifikasi sertifikat membaca data asli; biodata satu RPC dengan validasi (akun nonaktif tidak bisa hidup lagi); sinkron kursus mandiri lewat `self_paced_sync` yang tidak pernah menurunkan progres.
- **Ruang belajar:** isi modul dan penilaian kuis hanya untuk peserta disetujui, penulis, dan admin (`can_access_module_content`); Full Training lewat persetujuan admin; link materi 1 jam; draf modul belum tayang tidak bisa diambil publik.
- **Knowledge Hub:** keputusan publikasi dalam satu transaksi dengan aturan status dan peran.
- **Keamanan database (20 Okt):** audit RLS/view/grant (`supabase/audit_security.sql`); tulis lewat view `languages` dan fungsi internal yang terbuka ditutup; sistem peran lama dihentikan.
- **Sertifikat:** ditandai "CONTOH / BELUM RESMI" sampai template dan aturan resmi siap.
- **Kebersihan:** akun uji tidak lagi menumpuk; `academy.learn.$id.tsx` dipecah.

## B. Belum diperbaiki atau belum diputuskan

- ~~Keamanan, Nomor 4-7~~ **SELESAI 21 Okt:** metadata modul tidak lagi terbaca pengunjung (4); izin tulis pengunjung dicabut di semua tabel/view (6); pengajuan Knowledge Hub divalidasi di database, termasuk berkas wajib milik pengaju (7); catatan pelaku dikosongkan saat akun dihapus, kepemilikan tetap dilindungi (5). Rincian: `CATATAN_PERBAIKAN.md` bagian 2l.
- ~~Konsistensi, Nomor 8-9~~ **SELESAI 21 Okt:** halaman governance membaca sistem peran baru, nama peran resmi (8); Impact Analytics hanya angka dari data, sisanya "Belum tersedia" (9).
- **Kelulusan kursus mandiri** (video/PDF/PPT/kuis modul bawaan) tetap laporan dari browser, karena isinya ada di kode. Tidak ada hak di server yang bergantung padanya (sertifikatnya berlabel CONTOH). Status ini sengaja dibiarkan.
- **Modul bawaan** (Ocean Literacy, AZA, Africa Fisheries) isinya di kode aplikasi, jadi hanya digerbang di tampilan. 13 PDF Master masih aset publik Lovable.
- **Full Training dan AZA** progresnya hanya di `localStorage` (tidak ikut berpindah perangkat). Program African Countries juga dihapus otomatis dari browser oleh halaman My Learning.
- **Menunggu mentor:** template dan syarat sertifikat, format nomor resmi, syarat lulus, role participant (otomatis atau lewat admin), expert otomatis jadi trainer, publisher vs approver, Profile Claim (A1), nasib Full Training (P4), Penugasan Expert (disembunyikan), notifikasi email, kuota peserta.
- **Teknis:** `types.ts` disinkronkan manual; objek database tak tercatat di migrasi (`languages_taxonomy`); paginasi tampilan antrean admin.
- **Operasional:** database `main` belum diperiksa dan belum menerima migrasi (ranah mentor).

## C. Kenapa belum siap dirilis luas

1. **Lintas device:** kursus mandiri sudah ikut berpindah perangkat (disinkronkan ke server). Full Training dan AZA tidak.
2. **Banyak user bersamaan:** belum ada uji beban; pengaturan Supavisor (port 6543) belum diperiksa.
3. **Berbagai perangkat dan browser:** tampilan di HP dan browser lain belum diuji.
4. **Berbagai role:** diuji lewat skrip dan database, belum oleh orang lewat browser dengan akun nyata. Yang secara khusus belum diuji manual: P3 (modul dinamis), P5 (form biodata, halaman Akun, unggah foto), P6 (kursus mandiri di dua perangkat), keputusan Knowledge Hub.
5. **Sertifikat** masih contoh; belum ada template, nomor, dan aturan resmi.
6. **Operasional:** tidak terlihat pemantauan error, cadangan data, atau pipeline CI. Koneksi ke Supabase dari jaringan kantor sempat putus-putus.
7. **Database `main`:** belum dicek; migrasi berurutan harus dijalankan dengan hati-hati (lihat catatan `20261020070000` dan `20261020030000` di bagian 2l).

## D. Urutan kerja yang disarankan

1. ~~Kerjakan Nomor 4~~ (selesai 21 Okt).
2. Uji manual di browser dengan 3-4 akun nyata (admin, trainer, peserta, pengguna baru), termasuk di HP dan dua perangkat bergantian.
3. Kirim daftar pertanyaan ke mentor (`MENUNGGU_ARAHAN_MENTOR.md`).
4. Minta mentor memeriksa `main`: `check_migrations.sql` dan `audit_security.sql`, lalu menjalankan migrasi berurutan.
5. ~~Kerjakan Nomor 5-9~~ (selesai 21 Okt).
6. Setelah aturan sertifikat diputuskan: template resmi, nomor resmi, dan pencatatan kelulusan di server; tambahkan progres Full Training/AZA hanya jika programnya masih dipakai.
7. Uji beban sederhana; pastikan Supavisor dan cadangan data.
8. Pilot terbatas (20-50 pengguna) sebelum dibuka luas.

Pelajaran proses: sebelum bekerja di perangkat lain selalu `git pull`; setelah selesai commit + push.
