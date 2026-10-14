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

## 3. Migrasi yang harus dijalankan

Jalankan **berurutan** di Supabase SQL Editor pada database yang belum memilikinya:

1. `20261005160000_course_enrollment_applications.sql` *(tabel pendaftaran; belum ada di database sebelumnya)*
2. `20261007100000_participant_biodata.sql` *(tabel biodata; belum ada di database sebelumnya)*
3. `20261013020000_atomic_knowledge_resource_metrics.sql`
4. `20261014010000_expert_lifecycle_hardening.sql`
5. `20261014020000_trainer_status_latest_semantics.sql`
6. `20261014030000_expert_service_request_guards.sql`
7. `20261014040000_expert_service_assignment.sql`
8. `20261014050000_trainer_qualification_applications.sql`
9. `20261014060000_fix_admin_lists_email_source.sql`
10. `20261015010000_participant_enrollment_integrity.sql`

Tanpa nomor 1, 2, dan 10, pendaftaran peserta, keputusan admin, dan simpan biodata akan menampilkan pesan "migrasi belum dijalankan".

Peringatan: ada dua file dengan awalan `20261013010000`. Aman lewat SQL Editor, tetapi akan bentrok jika memakai `supabase db push`.

Setelah merge: jalankan `npm run build`, lalu uji alur pendaftaran peserta dengan **dua akun berbeda** (admin tidak bisa menyetujui pendaftarannya sendiri).

---

## 4. Pengujian

- `npx tsc --noEmit` dan `npm run build`: lulus.
- `npm run test:lifecycle` (Peserta 7/7, Trainer 7/7) dan `npm run test:kh-roles` (20/20): lulus, data uji dibersihkan otomatis.
- Alur Expert dan Peserta diuji pada Postgres lokal (PGlite) dengan migrasi asli: 59 dan 33 pengecekan lulus.
- Belum diuji manual di browser dengan akun nyata: alur penugasan Expert dan alur pendaftaran Peserta.

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
- Sekitar 28 akun sisa tes lama (`tdd…@example.test`) masih ada di database.
