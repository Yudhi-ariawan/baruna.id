# Kesiapan Rilis BARUNA (dicatat 17 Oktober 2026)

Ringkasan posisi proyek: apa yang sudah diperbaiki, apa yang belum, dan apa yang harus selesai sebelum dipakai banyak pengguna.
Rincian teknis per perbaikan ada di `dokumen/CATATAN_PERBAIKAN.md`. Keputusan yang menunggu mentor ada di `dokumen/MENUNGGU_ARAHAN_MENTOR.md`.

## Kesimpulan

**Belum siap untuk rilis luas. Siap untuk uji terbatas (pilot) dengan syarat.**
"Vibe coding" bukan alasannya; alasannya adalah apa yang belum dibuktikan (lihat bagian C).

## A. Sudah diperbaiki

- **Expert:** keputusan, publikasi, arsip, dan kirim ulang revisi dalam satu transaksi; kunci dua-admin-bersamaan; pemisahan wewenang; jalur tulis langsung dari browser ditutup; direktori dan antrean aman untuk data besar.
- **Trainer dan modul:** kunci jawaban kuis di tabel privat; simpan modul satu transaksi; kuota menghitung antrean; revisi modul tayang tidak menariknya dari publik.
- **Peserta:** persetujuan admin tidak bisa dilewati lewat `user_metadata`; pendaftaran ulang tidak menghapus persetujuan; keputusan admin atomik dan final.
- **Ruang belajar (sesi 17 Okt):** akses hanya lewat persetujuan admin di server; isi modul dan soal kuis tidak dikirim ke yang tidak berhak; draf modul belum tayang tidak bisa diambil publik; Full Training lewat persetujuan admin; link materi 1 jam; `academy.learn.$id.tsx` dipecah (1.629 → 228 baris).
- **Kebersihan:** 58 akun tes dihapus; cleanup skrip tes diperbaiki.

## B. Belum diperbaiki atau belum diputuskan

- **Keamanan:** sertifikat dan status "selesai" masih dari `localStorage` (bisa dipalsukan); 13 PDF modul Master masih aset publik Lovable; audit keamanan menyeluruh (admin, RLS semua tabel, Knowledge Hub) belum dilakukan.
- **Menunggu mentor:** template dan syarat sertifikat, syarat lulus, role participant, expert otomatis jadi trainer, publisher vs approver, Profile Claim, Penugasan Expert, notifikasi email, kuota peserta.
- **Teknis:** `types.ts` disinkronkan manual; objek database tak tercatat di migrasi (`languages_taxonomy`); paginasi tampilan antrean admin.
- **Operasional:** migrasi di database `main` (ranah mentor).
- **Pengujian:** uji manual di browser dengan akun nyata untuk pendaftaran peserta, pengiriman modul trainer, keputusan approver, dan kuis peserta.

## C. Kenapa belum siap dirilis luas

1. **Banyak device:** progres belajar **Full Training** (`src/lib/application.ts`) dan data AZA hanya di `localStorage`; pindah laptop ke PC atau ganti browser berarti progres hilang. (Kursus self-paced, yaitu modul Master dan modul dinamis, sudah tersinkron ke server lewat `self_paced_enrollments`; lihat bagian E.)
2. **Banyak user bersamaan:** belum ada uji beban; pengaturan Supavisor (port 6543) belum diperiksa.
3. **Banyak perangkat:** tampilan di HP dan browser lain belum diuji.
4. **Banyak role:** sudah diuji lewat skrip, belum oleh orang lewat browser.
5. **Sertifikat** masih template sementara dan bisa dipalsukan.
6. **Operasional:** tidak terlihat pemantauan error, cadangan data, atau pipeline CI.
7. **Sebagian besar kode belum diaudit;** hanya jalur ruang belajar dan Expert yang disentuh.

## D. Urutan kerja yang disarankan

1. Commit dan push perubahan setelah ditinjau.
2. Jalankan migrasi di `intern-update` dengan `supabase/check_migrations.sql`; minta mentor menjalankan di `main`.
3. Uji manual di browser dengan 3-4 akun nyata (admin, trainer, peserta, pengguna baru), termasuk di HP.
4. Audit keamanan menyeluruh (`/security-review`).
5. Kirim daftar pertanyaan ke mentor (`MENUNGGU_ARAHAN_MENTOR.md`).
6. Uji beban sederhana; pastikan Supavisor dan cadangan data.
7. **Terakhir: pindahkan progres belajar, kelulusan kuis, dan sertifikat dari `localStorage` ke database** (lihat di bawah).
8. Pilot terbatas (20-50 pengguna) sebelum dibuka luas.

## E. Dikerjakan terakhir: progres lintas device

Ada dua masalah berbeda yang sebelumnya tercampur:

1. **Portabilitas (ikut berpindah perangkat).**
   - Kursus self-paced (modul Master dan dinamis): **sudah tersinkron** dua arah ke server (`src/lib/shortCourses.ts` → `syncWithCloud`, tabel `self_paced_enrollments` + `user_metadata`).
   - **Full Training** (`src/lib/application.ts`) dan **AZA** (`src/lib/aza.ts`): hanya `localStorage`, tidak tersinkron.
2. **Keandalan (tidak bisa dipalsukan).** Sinkronisasi self-paced menerima `completed`, `score`, dan `completedSteps` apa adanya dari browser (`syncMySelfPacedCourses`), jadi pemilik akun bisa menandai dirinya lulus. Penilaian kuis modul dinamis sudah di server, tetapi hasilnya belum dicatat dari sisi server.

Catatan: halaman My Learning menghapus otomatis aplikasi program African Countries dari browser. Jangan membangun penyimpanan server untuk Full Training sebelum mentor memastikan program itu masih dipakai.

Pekerjaan paling kecil yang aman lebih dulu (bila diminta): catat kelulusan kuis modul dinamis di server saat `gradePublishedModuleQuiz` berjalan, dan hentikan sinkronisasi menerima `completed`/`score` dari browser untuk modul itu.

Mengapa terakhir:
- Bentuk datanya bergantung pada aturan yang belum diputuskan mentor: syarat lulus, jumlah JP, jenis dan format sertifikat. Dikerjakan sekarang berisiko dikerjakan dua kali.
- Pekerjaan terbesar: tabel baru untuk progres dan hasil kuis, RPC dengan RLS, penerbitan sertifikat lewat `issueCertificate` yang sudah ada, nomor sertifikat dari server, halaman verifikasi QR yang membaca data asli, dan migrasi data lama dari browser. Setiap migrasi baru wajib ikut `check_migrations.sql` dan daftar di `CATATAN_PERBAIKAN.md`.
- Menyentuh database `main` milik mentor, jadi perlu koordinasi.

Kondisi saat ini yang bisa dipakai: penilaian kuis modul dinamis sudah di server, tabel `certificates` dan fungsi eligibility sudah ada, penerbitan sertifikat server (`issueCertificate`) sudah ada tetapi belum dipakai tampilan.
