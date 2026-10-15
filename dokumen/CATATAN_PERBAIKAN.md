# Catatan Perbaikan Branch `intern-update`

Ringkasan perbaikan alur **Expert** dan **Peserta**, daftar migrasi yang harus dijalankan, dan sisa pekerjaan.
Acuan proses bisnis: 51 slide di `dokumen/` (Expert: Slide 35–41, PB-EXP-01/02/03; Peserta: PB-ACA-03).
Standar teknis: `dokumen/ENGINEERING_STANDARDS.md` (bagian 7, 8).

---

## 1. Role Expert

### Siklus pengajuan Expert (PB-EXP-01/02)
- Status pengajuan hanya dihitung di satu tempat (`deriveExpertEffectiveStatus()`), sehingga tidak berbeda antar halaman.
- Keputusan admin dijaga: keputusan yang sama tidak bisa diulang, dan expert yang diarsipkan harus dipulihkan dulu.
- Pemisahan wewenang: reviewer dan verifier hanya membaca; keputusan, arsip, dan pemulihan hanya untuk approver, admin, dan super admin. Pemohon tidak bisa memutuskan pengajuannya sendiri.
- Kunci optimistik (`updated_at`): klik ganda atau dua admin bersamaan tidak saling menimpa.
- Satu akun hanya punya satu pengajuan aktif dan satu profil expert.

### Upload dan status trainer
- Tidak ada lagi lampiran "hantu". Kalau upload gagal, proses berhenti dengan pesan jelas, tidak ada metadata file tanpa isi, dan tidak ada pindah bucket diam-diam.
- Status trainer disimpan sebagai riwayat ber-versi. Membuka halaman tidak lagi mengaktifkan ulang trainer yang dinonaktifkan admin. Arsip dan pulihkan expert menambah versi baru, tidak menimpa riwayat.

### Penugasan Expert (PB-EXP-03) dan kualifikasi trainer
- Halaman admin **Penugasan Expert** (`/admin/service-requests`): tinjau, cocokkan, tugaskan expert, minta info, jadwalkan, selesaikan, tolak, atau batalkan.
- Alur **Request info** dua arah: expert bertanya, pemohon membalas, semuanya tercatat di riwayat aktivitas.
- Penyelesaian menulis tepat satu baris riwayat fasilitasi ke profil expert.
- Expert non-trainer tidak lagi buntu: ajukan kualifikasi di `/experts/trainer-application`, admin memutuskan di `/admin/trainer-applications`.
- Perbaikan: email pemohon dibaca dari `auth.users` (tabel `profiles` tidak punya kolom email).

### Modularisasi
- `experts.portal.submit-module.tsx` dipecah dari 1.518 menjadi 516 baris. Langkah form, stepper, bar tombol, banner revisi, dan layar sukses menjadi komponen di `src/components/baruna/experts/submit-module/`; logika upload dan pembacaan draf pindah ke `src/lib/experts/`. Perilaku tidak berubah.

> Catatan: fitur Penugasan Expert saat ini disembunyikan sementara karena alurnya masih dibahas.

---

## 2. Role Peserta (PB-ACA-03)

Masalah yang ditemukan dan sudah diperbaiki:

| # | Masalah | Perbaikan |
|---|---|---|
| 1 | **Persetujuan admin bisa dilewati.** Server mempercayai `user_metadata` (role, approved_courses) yang bisa diubah pengguna sendiri lewat SDK browser. | Status pendaftaran dan syarat peserta hanya dibaca dari tabel dan role RBAC. Metadata hanya untuk data tampilan. Pengguna tidak bisa menulis tabel pendaftaran langsung. |
| 2 | **Mendaftar ulang menghapus persetujuan.** Upsert selalu mengembalikan status ke `pending`. | RPC `course_enrollment_apply` idempoten: status `approved` dan `pending` tidak pernah di-reset. Klik ganda aman. |
| 3 | **Sukses palsu.** Kegagalan simpan hanya `console.warn`, layar tetap menampilkan berhasil. | RPC `admin_course_enrollment_decide` menyimpan keputusan, role participant, dan tautan kelas dalam satu transaksi. Kegagalan membatalkan semuanya dan tampil ke admin. Pendaftaran dan simpan biodata juga berhenti dengan pesan jelas. |

Tambahan:
- Role primer: database mewajibkan tepat satu role primer aktif per pengguna. Pemberian role participant kini menjaga aturan ini; role `expert` tetap primer.
- Keputusan bersifat final (disetujui tidak bisa dibalik jadi ditolak, begitu pula sebaliknya), dan admin tidak bisa memutuskan pendaftarannya sendiri.
- Data lama: pendaftaran yang selama ini hanya ada di log audit dipindahkan ke tabel (backfill). Persetujuan yang hanya ada di metadata sengaja tidak dipindahkan.

---

## 2b. Role Trainer: pipeline modul (kunci jawaban, keputusan, simpan modul)

| # | Masalah | Perbaikan |
|---|---|---|
| 1 | Gerbang "harus trainer aktif", kuota, dan kepemilikan lampiran hanya ada di server function. RPC `module_draft_*` dapat dipanggil langsung dari SDK browser oleh akun mana pun. | Pemeriksaan dipindah ke dalam RPC database. |
| 2 | Keputusan admin atas modul tanpa guard status dan tanpa kunci; reviewer/verifier bisa memutuskan final; `restore` bisa menayangkan modul yang belum pernah disetujui. | RPC `admin_module_decide`: satu transaksi, kunci baris, `expectedUpdatedAt`, hanya approver/admin/super admin, pengaju tidak boleh memutuskan modulnya sendiri. |
| 3 | Penulisan banyak tabel tanpa transaksi, error diabaikan, "rollback" menghapus baris keputusan (jejak audit). | Semua dalam satu transaksi; baris keputusan tidak pernah dihapus. |
| 4 | Kunci jawaban kuis tersalin ke `module_registry` yang dapat dibaca publik. | Dipindah ke tabel privat `module_quiz_answer_keys`; penilaian di server (`gradePublishedModuleQuiz`). |
| 5 | Revisi modul yang sedang tayang menariknya dari publik. | Versi yang disetujui tetap tayang selama revisi dikerjakan. |
| 6 | Simpan/kirim modul 4 langkah terpisah; kuota tidak menghitung antrean; portal menulis data setiap dibuka; data portal tidak dibatasi. | `trainer_module_save` (satu transaksi, terkunci per trainer); kuota menghitung antrean; portal hanya membaca dan dibatasi; indeks unik versi status trainer. |
| 7 | Tombol "buka revisi modul tayang" punya jalur cadangan 4 langkah dan mengizinkan reviewer. | Hanya lewat RPC atomik `request_published_module_revision`, peran pemutus resmi. |

Pengujian: tes Postgres lokal (PGlite) 89 pengecekan lulus, termasuk simulasi kegagalan di tengah transaksi.

---

## 3. Migrasi yang harus dijalankan

**Database main dan intern-update adalah dua database Supabase berbeda.** Migrasi yang ditempel manual di SQL Editor tidak meninggalkan catatan, jadi gunakan pengecek:

1. Buka `supabase/check_migrations.sql`, tempel di SQL Editor database yang ingin diperiksa, lalu Run. (Hanya membaca, tidak mengubah apa pun.)
2. Hasilnya satu baris per migrasi (24 baris): `OK` atau `BELUM DIJALANKAN`.
3. Jalankan file migrasi yang berstatus BELUM DIJALANKAN, **berurutan sesuai nomor**, dari folder `supabase/migrations/`. Jika satu migrasi error, hentikan dan perbaiki sebelum lanjut.
4. Jalankan pengecek lagi sampai semuanya OK.

Migrasi terbaru yang dibutuhkan kode di branch ini (selain yang lebih lama, sesuai hasil pengecek):

- `20261005160000_course_enrollment_applications.sql` dan `20261007100000_participant_biodata.sql` (tabel peserta)
- `20261013020000_atomic_knowledge_resource_metrics.sql`
- `20261014010000` sampai `20261014060000` (Expert, penugasan, kualifikasi trainer, perbaikan email)
- `20261015010000_participant_enrollment_integrity.sql` (pendaftaran peserta aman; butuh dua tabel peserta di atas lebih dulu)
- `20261015020000_trainer_module_integrity.sql` (gerbang modul, keputusan atomik, kunci jawaban privat)
- `20261015030000_trainer_pipeline_hardening.sql` (simpan modul satu transaksi, kuota, portal dibatasi)
- `20261015040000_published_module_revision_roles.sql` (revisi modul tayang atomik)

Tanpa migrasi yang sesuai, fitur terkait menampilkan pesan error yang jelas (bukan data rusak). Migrasi sebaiknya dijalankan **sebelum atau bersamaan** dengan merge. `20261015020000` memindahkan kunci jawaban kuis; kode lama belum bisa menilai kuis modul yang baru ditayangkan setelah migrasi itu.

Peringatan: ada dua file dengan awalan `20261013010000`. Aman lewat SQL Editor, tetapi akan bentrok jika memakai `supabase db push`.

Setelah merge: jalankan `npm run build`, lalu uji dengan **dua akun berbeda** (admin tidak bisa memutuskan pengajuannya sendiri).

---

## 4. Pengujian

- `npx tsc --noEmit` dan `npm run build`: lulus.
- `npm run test:lifecycle` (Peserta 7/7, Trainer 7/7) dan `npm run test:kh-roles` (20/20): lulus, data uji dibersihkan otomatis.
- Alur Expert, Peserta, dan Trainer diuji pada Postgres lokal (PGlite) dengan migrasi asli: 59, 33, dan 89 pengecekan lulus.
- Belum diuji manual di browser dengan akun nyata: alur penugasan Expert (fitur disembunyikan sementara), pendaftaran Peserta, dan pipeline modul Trainer.

---

## 5. Sisa pekerjaan dan keputusan untuk mentor

- **Ruang belajar masih bisa dibuka lewat `localStorage`.** Halaman `academy.learn.$id` juga menganggap kursus disetujui bila ada catatan di penyimpanan browser. Perlu ditutup dan perlu pemeriksaan RLS data materi.
- **Role participant tanpa persetujuan admin.** Menyimpan biodata langsung memberi role participant, sedangkan flowchart PB-ACA-03 menyebut role diberikan saat admin menyetujui. Perlu keputusan.
- **Expert yang disetujui otomatis menjadi trainer aktif.** Slide 39 menyiratkan persetujuan trainer terpisah. Perlu keputusan.
- **Expert tidak bisa mundur setelah Accept** pada permintaan layanan; hanya admin yang bisa membatalkan.
- Tidak ada notifikasi otomatis (email atau chat) untuk perubahan status.
- Kuota peserta yang disebut di flowchart belum dicek di kode.
- Antrean Verifikasi Expert belum memakai paginasi.
- `academy.learn.$id.tsx` masih sekitar 1.629 baris; perlu dipecah.
- `src/integrations/supabase/types.ts` disinkronkan manual; sebaiknya dibuat ulang lewat Supabase CLI.
- Sekitar 46 akun sisa tes lama (`@example.test`) masih ada di database intern-update.
- Batas kuota level modul (2/5/10/999) masih ditulis langsung di kode (SQL dan TypeScript); idealnya disimpan di tabel konfigurasi (Slide 15/39: data tidak hard-coded).
- Kelulusan kuis dan sertifikat peserta masih dicatat di `localStorage` browser (Slide 15: tidak boleh penyimpanan lokal di frontend). Penilaian kuisnya sudah di server.
- Pertanyaan untuk mentor: apakah "publisher" harus terpisah dari "approver"? Saat ini approve langsung menayangkan modul.
- Belum diuji manual di browser: pengiriman modul trainer, keputusan modul oleh approver, dan kuis peserta setelah kunci jawaban dipindah.
