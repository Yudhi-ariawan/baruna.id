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

## 2c. Expert/Trainer: kuota di konfigurasi, notifikasi, cek duplikat

| # | Masalah (acuan slide) | Perbaikan |
|---|---|---|
| A9 | Batas modul per level (2/5/10/999) ditulis langsung di kode (Slide 15/36-38: data tidak hard-coded). | Disimpan di tabel `trainer_level_module_limits`. Admin cukup mengubah angka di tabel tanpa migrasi atau deploy ulang. Level yang tidak dikenal tetap 0. |
| A5 | Tidak ada notifikasi untuk permintaan layanan dan pengajuan kualifikasi trainer. | Halaman Notifikasi kini menampilkan: pemohon (ditinjau, expert ditugaskan, diterima, diminta info, dijadwalkan, selesai, ditolak/dibatalkan); expert (penugasan baru, balasan pemohon, pembatalan, jadwal, selesai); pengaju trainer (disetujui/ditolak). |
| A5 | Penanda "sudah dibaca" disimpan di metadata satu pengajuan: dua perangkat bisa saling menimpa, dan pengguna tanpa pengajuan tidak bisa menandai. | Tabel `notification_reads`, satu baris per notifikasi (idempoten). Penanda lama tetap dibaca. |
| A2 | Tidak ada cek profil ganda di direktori (Slide 37 Duplicate/Match). | Detail pengajuan di admin menampilkan peringatan bila ada profil lain dengan nama (huruf besar/kecil dan spasi diabaikan) atau email yang sama. Hanya peringatan, keputusan tetap di approver. |

Pengujian: tes Postgres lokal 103 pengecekan lulus (89 lama + 14 baru), termasuk menjalankan migrasi dua kali dan hak akses.

Sengaja **ditunda** (dicatat agar dikerjakan bersama fitur terkait): Profile Claim (Slide 37, menunggu keputusan mentor), validasi ketersediaan, rekomendasi kandidat, dan konversi ke draf expert (terikat fitur Penugasan Expert yang disembunyikan), rating expert (butuh data ulasan peserta), serta Network & Engagement.

---

## 2d. Expert: keputusan, publikasi, arsip, dan revisi atomik

| # | Masalah | Perbaikan |
|---|---|---|
| 1 | Keputusan admin atas expert dijalankan 5-12 query terpisah. Gagal di tengah meninggalkan data setengah jadi, dan "rollback" menghapus baris keputusan (jejak audit). | RPC `admin_expert_decide`: satu transaksi, kunci baris, `expectedUpdatedAt` dari tampilan admin, hanya approver/admin/super admin, pemohon tidak boleh memutuskan pengajuannya sendiri. |
| 2 | Tolak/minta revisi meng-UPDATE semua versi status trainer (riwayat level tertimpa). | Hanya menambah versi baru dengan penanda; persetujuan ulang mengembalikan status sebelumnya. |
| 3 | Publikasi menghapus lalu mengisi ulang bahasa/proyek/publikasi tanpa cek error; status trainer gagal hanya dicatat log; sinkron ulang mengaktifkan lagi trainer yang sengaja dinonaktifkan admin. | Semua di dalam transaksi yang sama; sinkron ulang tidak mengubah status trainer. |
| 4 | Pencabutan role expert selalu gagal (`revoked_at` tidak diisi) dan bisa melanggar aturan satu role primer. | `revoked_at`/`revoked_by` diisi; bila role expert adalah role primer, status primer dipindah ke role aktif lain. |
| 5 | Admin bisa menyetujui saat pemohon masih mengedit revisi, sehingga draf setengah jadi ikut tayang. | Ditolak dengan pesan "tunggu sampai revisi dikirim ulang". |
| 6 | Draf milik akun lain yang ditautkan ke pengajuan bisa ikut dipublikasikan. | Publikasi hanya memakai draf milik pemohon sendiri. |
| 7 | Kirim ulang revisi 3 langkah terpisah; snapshot gagal hanya dicatat log. | RPC `expert_revision_resubmit` (satu transaksi) dengan pemeriksaan kelengkapan dan kepemilikan dokumen di database. |
| 8 | Arsip/pulihkan tanpa kunci; RPC lama `expert_archive` dan `expert_publish_from_decision` bisa dipanggil dari browser. | `admin_expert_archive` / `admin_expert_restore` dengan kunci; RPC lama ditutup untuk browser. |

Kontak privat (email/telepon) kini disimpan saat publikasi, sehingga cek duplikat email (A2) bekerja untuk expert yang disetujui setelah migrasi ini.

Pengujian: tes Postgres lokal 74 pengecekan lulus, termasuk kegagalan di tengah transaksi, dua admin bersamaan, draf susupan, perpindahan role primer, dan kesamaan status efektif SQL dengan TypeScript pada 1.512 kombinasi.

---

## 2e. Tutup jalur tulis langsung dari browser (SDK Supabase)

Akun biasa bisa memanggil tabel dan RPC langsung dari browser. Celah yang ditutup:

| # | Celah | Perbaikan |
|---|---|---|
| 1 | Draf bisa ditautkan ke pengajuan **orang lain**, diubah statusnya menjadi "submitted", atau diganti jenisnya; draf expert/modul bisa dibuat tanpa RPC bergerbang. | RLS baru dan pemicu `review_drafts_guard_client_update`: draf langsung hanya untuk jenis Knowledge Hub/kebutuhan pelatihan, tanpa tautan; kolom tautan/jenis/status terkunci. |
| 2 | `submit_draft_for_review` bisa dipanggil langsung untuk melewati cek kelengkapan, duplikat, dan dokumen (expert) serta gerbang trainer dan lampiran (modul). | Aturan per jenis dipasang di fungsi inti itu sendiri, jadi berlaku untuk semua jalur. Revisi expert yang dikirim ulang juga mengubah status antrean di transaksi yang sama. |
| 3 | `expert_draft_update` menerima path dokumen milik akun lain (admin lalu membuat tautan CV orang lain). | Ditolak (`document_not_owned`). |
| 4 | Expert bisa mengubah langsung bahasa, proyek, publikasi, pekerjaan, dan data lain pada profil yang **sudah tayang** tanpa review; kontak privat juga bisa diubah. | Hanya tata kelola yang boleh menulis langsung; pemilik hanya membaca. |
| 5 | Admin lama bisa INSERT `review_decisions` langsung tanpa mengubah status pengajuan. | Keputusan hanya lewat RPC. |
| 6 | Halaman `/my-submissions` bisa membuat pengajuan expert dan modul melewati alurnya. | Pilihan expert/modul dihapus; diarahkan ke `/experts/join` dan portal trainer. |

Data lama: draf yang tertaut ke pengajuan akun lain dilepas otomatis (di database intern-update: 0 baris).

Pengujian: 34 pengecekan lulus dengan RLS dijalankan sebagai role `authenticated` sungguhan, ditambah 103 tes trainer lama yang tetap lulus dengan migrasi ini.

---

## 2f. Expert: siap data besar dan pengaman duplikat

| # | Masalah | Perbaikan |
|---|---|---|
| 1 | Direktori publik dan antrean Verifikasi Expert mengambil data dengan satu `select`. Supabase memotong hasil di 1.000 baris tanpa error, dan daftar ID dikirim dalam satu URL yang gagal pada ratusan data. Error direktori ditelan menjadi daftar kosong. | Helper `src/lib/supabase/batch.server.ts`: baca per halaman dan per potongan 100 ID, error selalu dilempar. Direktori di-cache 60 detik dengan satu muatan untuk banyak permintaan bersamaan, dan saat database bermasalah menampilkan data terakhir, bukan daftar kosong. Cache dibersihkan setiap ada keputusan expert. |
| 2 | Indeks "satu profil aktif per akun" dan "satu draf baru per akun" dilewati diam-diam oleh migrasi lama bila ada data ganda. | Migrasi `20261015080000` mencoba lagi dan menyebut akun yang perlu dirapikan. Baris 28 pengecek tetap BELUM sampai indeksnya aktif. |
| 3 | Cek duplikat email (A2) tidak mengenali expert lama karena kontak privatnya kosong. | Kontak privat expert lama diisi dari pengajuannya (yang sudah ada tidak diubah). |

Catatan: ORCID tidak dipakai untuk cek duplikat karena aplikasi belum pernah menyimpan ORCID ke profil.

---

## 2g. Temuan dari uji langsung ke database asli

Uji `npm run test:expert-rpc` (menulis data uji lalu membersihkannya sendiri) menemukan sesuatu yang tidak terlihat di tes lokal:

- `expert_languages.language_code` punya foreign key ke tabel `languages_taxonomy` (17 bahasa dengan kode ISO: `id`, `en`, `es`, ...). **Tabel ini ada di database tetapi tidak ada di file migrasi repo** (dibuat di luar migrasi).
- Kode lama membuat kode bahasa dari nama ("Bahasa Indonesia" menjadi "bahasaindone"), sehingga hampir semua insert ditolak dan kegagalannya diabaikan. Bahasa expert hampir tidak pernah tersimpan di `expert_languages`.
- Perbaikan (`20261015090000`): nama bahasa dipetakan ke kode taksonomi (kode, nama, nama asli, atau alias seperti "Indonesia", "Inggris", "Mandarin"). Bahasa yang tidak ada di taksonomi tetap tampil di direktori (`experts.languages`) tetapi tidak dimasukkan ke `expert_languages`. Bila tidak ada yang bisa dipetakan, data lama tidak dihapus. Setelah migrasi, tombol "Sinkronkan" mengisi bahasa expert yang sudah tayang.
- Uji yang sama menemukan batasan `review_subjects_current_status_check` di database belum mengizinkan `archived` (migrasi lama `20261006110000` belum berlaku di sana; kode lama menutupinya dengan status `withdrawn`). Diperbaiki oleh `20261015100000`.
- Catatan untuk mentor: ada objek database yang tidak tercatat di repo (`languages_taxonomy`, dan tabel `languages`). Sebaiknya didokumentasikan lewat migrasi agar database baru sama dengan yang sekarang.

---

## 2h. Peserta: pendaftaran kursus, progres, dan sertifikat (P1, P2)

| # | Celah | Perbaikan |
|---|---|---|
| P1 | Sertifikat bisa didapat tanpa belajar: pengguna boleh menulis langsung `enrolments`, `progress_records`, `evaluations`; progres menerima ID aktivitas sembarang (4 ID asal sudah dianggap 4 modul selesai); kursus "wajib persetujuan" bisa didaftari sendiri. | Migrasi `20261020010000`: semua tulis lewat RPC (`learning_enrol`, `learning_progress_mark`, `learning_evaluation_submit`, `learning_enrolment_withdraw`, `issue_my_certificate`). Pendaftaran mengikuti `enrolment_access_rule` penawaran (terbuka = boleh daftar sendiri; wajib persetujuan = hanya setelah admin menyetujui). Progres hanya untuk modul asli kursus. Sertifikat diterbitkan dalam satu transaksi terkunci (klik ganda = sertifikat yang sama) dengan nomor dari server. Tulis langsung dicabut. |
| P2 | Halaman verifikasi menampilkan "Terverifikasi Resmi" untuk nomor apa pun. | `verify_certificate`: mencari nomor persis di tabel `certificates`, nama pemegang disamarkan. Nomor yang tidak terdaftar ditampilkan "tidak ditemukan". |
| - | Sertifikat cetak dari browser bisa dikira resmi. | Tanda "CONTOH / BELUM RESMI" (saklar `CERTIFICATE_IS_OFFICIAL` di `src/lib/certificate.ts`). |

Catatan: format nomor sertifikat masih sementara sampai ada aturan resmi STTP. Sertifikat dari pelatihan mandiri (dibuat di browser) belum tercatat di server, jadi verifikasinya menampilkan "tidak ditemukan" sampai sistem sertifikat resmi dibangun.

Pengujian: tes Postgres lokal 43 pengecekan lulus; uji langsung `npm run test:participant-rpc` (memakai kursus uji sendiri, lalu dibersihkan).

---

## 2i. Expert: satu aturan "pemilik profil" (Slide 37, Link/Match)

Sebelumnya "akun mana pemilik profil expert" ditentukan dengan tiga aturan berbeda: RLS memakai `created_by`, portal trainer/kualifikasi/penulis modul memakai `original_contributor_id OR created_by`, dan `admin_expert_decide` memakai `AND`. `created_by` hanya mencatat siapa yang membuat baris; untuk profil terbitan langsung admin atau hasil skrip provisioning nilainya = admin.

| # | Akibat | Perbaikan |
|---|---|---|
| 1 | Admin yang mengganti foto akunnya menimpa foto **semua** profil expert yang pernah ia buat (`setAccountAvatar`). Direktori publik juga memakai foto akun admin untuk profil-profil itu. | Hanya profil yang tertaut ke akun (`original_contributor_id`). |
| 2 | Portal trainer admin bisa memuat profil orang lain; modul yang diajukan admin bisa tercatat atas nama expert lain. | `trainer_portal_bootstrap`, `_active_trainer_expert_id`, `_my_verified_expert_id`, `trainer_status_backfill_self`, `_publish_module_from_subject` memakai satu aturan. |
| 3 | Expert hasil provisioning tidak bisa membaca permintaan layanan, kontak privat, dan sertifikat miliknya lewat RLS (karena `created_by` = admin), padahal halaman TS menganggapnya pemilik. | `_expert_is_owner` dan kebijakan `experts_owner_read` memakai `original_contributor_id`. Notifikasi permintaan layanan untuk expert juga (sebelumnya `created_by` saja). |
| 4 | `expert_publish_direct` selalu gagal sejak `20260916010000` (kolom `slug` wajib tetapi tidak diisi). | Slug dibuat dengan pembuat slug yang sama dengan persetujuan expert. Profil terbitan admin tidak lagi tertaut ke akun admin (menunggu penautan/klaim). |

Migrasi `20261020030000` juga merapikan data lama: profil pendaftaran mandiri yang belum tertaut ditautkan ke pembuatnya (tanpa melanggar "satu profil aktif per akun"), dan profil terbitan admin dilepas dari admin pembuatnya kecuali admin itu sendiri expert. Di database intern-update saat dicek (20 Okt): 4 expert, semuanya sudah tertaut benar, jadi tidak ada data yang berubah. Database main belum dicek.

Sengaja dibiarkan lebih ketat: cek konflik kepentingan saat penugasan expert tetap memblokir pembuat baris juga.

Di kode: konstanta `EXPERT_OWNER_COLUMN` (`src/lib/experts/ownership.ts`) dipakai di semua pencarian profil milik pengguna.

Terkait keputusan mentor A1 (Profile Claim): profil tanpa akun tertaut adalah kandidat yang nantinya bisa diklaim.

Pengujian: tes Postgres lokal 27 pengecekan lulus (termasuk RLS sebagai role `authenticated`).

---

## 2i-2. Peserta: isi belajar modul hanya untuk yang berhak (P3)

| Celah | Perbaikan |
|---|---|
| `getPublishedModuleDetail` bisa dipanggil tanpa login dan mengembalikan semua dokumen modul (dengan tautan unduhan) dan soal kuis. Gerbang ruang belajar hanya di tampilan dan bisa dibuka lewat localStorage atau "demo mode". | Fungsi dipecah: **ringkasan publik** (judul, ringkasan, trainer, sampul; dokumen tanpa tautan; tanpa kuis) untuk katalog, halaman kursus, dan Knowledge Hub; **isi belajar** `getPublishedModuleContent` hanya bila `can_access_module_content` (migrasi `20261020020000`) mengizinkan: pendaftaran modul **disetujui**, penulis modul, atau admin/approver. Ruang belajar modul dinamis tidak lagi memakai localStorage/demo mode. |
| Penilaian kuis bisa dipanggil siapa pun yang login. | `gradePublishedModuleQuiz` memakai pemeriksaan akses yang sama. |
| Katalog publik ikut mengirim metadata mentah (daftar lampiran dengan path, soal kuis). | Kunci sensitif dibuang dari metadata katalog. |
| Modul yang masih draf/di-review bisa dibuka lewat jalur cadangan `expert_module_submissions`. | Jalur cadangan dihapus: hanya modul tayang yang pernah dikembalikan. |

Batasan yang disengaja: modul bawaan (Ocean Literacy, AZA, Africa Fisheries) isinya ada di kode aplikasi (`src/data/lms`), jadi tetap hanya digerbang di tampilan sampai isinya dipindah ke database (keputusan terpisah).

Pengujian: tes Postgres lokal 14 pengecekan (termasuk pendaftaran untuk modul lain tidak berlaku, dan `created_by` saja tidak memberi akses); uji langsung `npm run test:participant-rpc` bagian 7.

---

## 2j. Peserta: biodata (P5) dan progres pelatihan mandiri (P6)

| # | Celah | Perbaikan (migrasi `20261020040000`) |
|---|---|---|
| P5 | Simpan biodata (form biodata **dan** halaman Akun) menyetel `profiles.is_active = true` dan meng-upsert role participant menjadi aktif: akun yang **dinonaktifkan** admin aktif lagi, role yang **dicabut** hidup lagi. 4-5 langkah terpisah; kegagalan hanya `console.warn`. | Satu RPC `participant_biodata_save` untuk kedua jalur, satu transaksi dengan kunci per akun. Akun nonaktif ditolak. Role participant hanya dibuat bila belum pernah ada; role yang dicabut/ditangguhkan/kedaluwarsa tidak disentuh (pengguna diberi tahu untuk menghubungi admin). |
| P5 | Tanpa batas panjang, tanggal/telepon tidak divalidasi; bila unggah foto gagal, foto **base64 (~2,7 MB)** disimpan ke `user_metadata` yang ikut di setiap token login (akun bisa gagal login). Browser juga bisa menulis tabel biodata langsung. | Validasi di database (panjang, NIP, nomor HP, tanggal nyata dan tidak di masa depan, jenis kelamin, foto hanya dari folder avatar milik sendiri). Form tidak lagi memakai base64. Biodata dan role tidak lagi ditulis ke `user_metadata`. Tulis langsung ke `participant_biodata` dicabut. |
| P6 | Sinkron pelatihan mandiri membaca-ubah-tulis `user_metadata` tanpa kunci: dua perangkat saling menimpa. Payload tanpa batas, error ditelan, browser bisa menulis tabel langsung. | RPC `self_paced_sync` menggabungkan per kursus di database dan tidak pernah menurunkan progres (selesai tetap selesai, nilai tertinggi, langkah digabung, tanggal daftar paling awal). Maksimal 200 kursus; entri rusak dilewati; waktu masa depan dipotong. Data lama di `user_metadata` dipindah ke tabel saat sinkron lalu dihapus dari token. Tulis langsung dicabut (reset kursus tetap bisa). |
| - | Label role di beranda bisa diubah sendiri lewat `user_metadata`; statistik Academy terpotong di 1000 baris. | Role hanya dari RBAC; statistik dibaca bertahap. |

Batasan yang disengaja: status "selesai" dan nilai kursus mandiri tetap **laporan dari browser**, karena isi dan kuisnya ada di kode aplikasi. Tidak ada hak di server yang bergantung padanya (sertifikatnya berlabel CONTOH). Keputusan mentor yang tetap terbuka: role participant otomatis atau lewat persetujuan admin.

Data lama (intern-update, 20 Okt): 0 baris biodata, 0 baris progres, 3 akun dengan data lama di `user_metadata` (terbaca untuk mengisi form; progres dipindah saat sinkron berikutnya).

Pengujian: tes Postgres lokal 43 pengecekan lulus (termasuk RLS sebagai role `authenticated`).

---

## 2k. Audit keamanan database (20 Okt) dan pengerasan pertama

Alat baru: `supabase/audit_security.sql` (hanya membaca). Jalankan di SQL Editor tiap database; setiap baris = satu temuan. Hasil di intern-update: semua tabel sudah memakai RLS; izin tulis bawaan Supabase untuk pengunjung tidak bisa dipakai selama RLS aktif (terbukti, UPDATE pengunjung mengubah 0 baris).

Celah yang terbukti dan ditutup oleh migrasi `20261020050000`:

| Celah | Bukti | Perbaikan |
|---|---|---|
| View `languages` (di atas `languages_taxonomy`, dibuat di luar migrasi repo) berjalan sebagai pemiliknya sehingga RLS terlewati. | Pengunjung tanpa login berhasil UPDATE lewat view ini. | Izin tulis view `languages` dan `experts_directory_v` dicabut (aplikasi hanya membaca). |
| Banyak migrasi menutup fungsi internal dengan `REVOKE ... FROM PUBLIC` saja, padahal Supabase memberi EXECUTE langsung ke `anon` dan `authenticated`. | Pengunjung tanpa login bisa menjalankan `_service_request_log` (menulis riwayat permintaan layanan dengan pelaku bebas), membaca `_latest_trainer_status` dan `_service_request_events_json`. | 10 fungsi internal yang hanya dipanggil dari fungsi `SECURITY DEFINER` ditutup untuk `anon` dan `authenticated`. Fungsi yang dipakai policy RLS sengaja tidak disentuh. Aturan ditambahkan ke `ENGINEERING_STANDARDS.md`. |

Pengujian: tes Postgres lokal 16 pengecekan (termasuk: membaca `languages` tetap bisa, RPC publik yang memakai fungsi internal tetap berjalan, migrasi aman dijalankan di database yang tidak punya objek tersebut).

### Keputusan publikasi Knowledge Hub (migrasi `20261020060000`)

| Masalah | Perbaikan |
|---|---|
| `recordAdminPublicationDecision` menulis 5 tabel dalam langkah terpisah dengan service role; error sebagian langkah tidak diperiksa. | Satu RPC `admin_kr_decide`: keputusan, katalog, penulis, draf, dan log dalam satu transaksi. Gagal di tengah = tidak ada yang berubah. |
| Tanpa kunci/versi: klik ganda atau dua admin (data: satu publikasi punya 3 keputusan approve berturut-turut). | Baris pengajuan dikunci; tampilan mengirim versi yang dilihat (`stale_subject` bila sudah berubah); approve ulang ditolak (`already_approved`). |
| "Pulihkan" menayangkan apa pun, termasuk yang diarsipkan saat belum pernah disetujui. | Hanya yang sebelumnya tayang dan disetujui yang tayang kembali; lainnya kembali ke antrean. Aturan transisi lain: tidak bisa memutuskan yang terarsip, menyetujui saat kontributor merevisi, menolak dua kali, atau mengembalikan yang sudah ditolak. |
| Admin bisa memutuskan pengajuannya sendiri; `qa_reviewer`/`verifier` bisa arsip/pulihkan. | Ditolak (`self_decision_forbidden`); hanya approver/admin/super admin (sama dengan Expert). Kurator lain tetap bisa melihat antrean. |
| Draf yang dipakai tidak difilter ke milik pengaju. | Hanya draf milik pengaju. |

Bentuk data yang ditulis sama dengan sebelumnya, jadi daftar admin dan Knowledge Hub tidak berubah. Sampul unggahan disalin ke bucket publik setelah transaksi berhasil. Pengujian: tes Postgres lokal 35 pengecekan.

### Sistem peran lama dihentikan (migrasi `20261020070000`)

Ada dua sistem peran: lama `user_roles` (dibaca lewat `has_role`) dan baru `rbac_user_roles` (dikelola di halaman admin). Sistem lama tidak terlihat di halaman admin tetapi masih dibaca 12 policy tulis, policy baca, dan pemeriksa pemutus. Di intern-update dua akun tercatat admin **hanya** di sistem lama (satu akun expert biasa, satu akun tanpa peran aktif): admin tersembunyi yang bisa memutuskan pengajuan, mengubah status pengajuan langsung dari browser, dan membaca kontak privat expert. Keputusan pemilik proyek: keduanya bukan admin.

| Perbaikan | Keterangan |
|---|---|
| `has_role()` membaca sistem baru (nama peran sama: admin, management, qa_reviewer; super_admin = admin). | Satu perubahan berlaku untuk semua policy dan fungsi lama sekaligus. Peran `management`/`qa_reviewer` di sistem baru di intern-update hanya dipegang super admin, jadi tidak ada orang yang mendapat hak baru. |
| Baris `user_roles` yang tidak didukung sistem baru dihapus dan dicatat di `admin_audit_log`. | Migrasi menampilkan NOTICE nama akun yang dicabut. |
| Pengaman anti-terkunci. | Bila database tidak punya admin aktif di sistem baru, migrasi dibatalkan. **Untuk main: periksa dulu bahwa admin main ada di `rbac_user_roles`.** |
| `finalize_decision` dan `return_for_revision` (jalur keputusan generik) menolak expert, modul, dan Knowledge Hub. | Jenis itu mengubah status tanpa menayangkan/menurunkan profil, modul, atau katalog; sekarang wajib lewat RPC khususnya. Tidak dipanggil kode aplikasi. |

Pengujian: tes Postgres lokal 21 pengecekan (termasuk migrasi dibatalkan bila tidak ada admin, dan policy lama tetap berfungsi untuk admin resmi).

Verifikasi setelah dijalankan di intern-update (20 Okt): `has_role(admin)` = false untuk kedua akun, true untuk `admin@gmail.com` dan `admin99@gmail.com`; pencabutan tercatat. Uji langsung lulus: `test:expert-rpc` 64, `test:kr-rpc` 24, `test:participant-rpc` 27, `test:kh-roles` 20, `test:lifecycle` 14. Dua skrip tes (`kh-roles`, `lifecycle`) ternyata membuat admin uji dengan cara yang selalu gagal tanpa diperiksa (peran utama ganda) dan hanya lolos karena tabel peran lama; sudah diperbaiki.

---

## 2l. SISA PEKERJAAN (rencana untuk sesi berikutnya)

Status 20 Okt 2026 malam. Semua di bawah BELUM dikerjakan. Pola kerja yang terbukti: migrasi + tes Postgres lokal (PGlite) + baris `check_migrations.sql` + bagian catatan ini + `npm run build`; setelah migrasi dijalankan di intern-update, uji langsung (`npm run test:*`) dan bersihkan akun `@example.test` yang tertinggal.

### Nomor 4 (sedang → ternyata BERAT): metadata modul tayang terbaca pengunjung lewat API langsung

**Status 21 Okt (PC): kode + migrasi `20261021010000` SELESAI; migrasi sudah dijalankan di intern-update (21 Okt, pengecek OK) dan semua `npm run test:*` lulus sesudahnya.**

Temuan tambahan saat dikerjakan (lebih berat dari rencana semula):
- Proyeksi modul ke Knowledge Hub (`module-projection.server.ts`) menyalin **seluruh** metadata modul ke `knowledge_resources.metadata` (publik): 4 modul tayang terbaca pengunjung lengkap dengan path lampiran dan tautan YouTube.
- `getKnowledgeResourceDownload` (tanpa login, tanpa cek jenis) menandatangani lampiran pertama resource. Untuk resource modul itu **berkas materinya**: 3 modul tayang (PDF/PPTX di bucket `expert-applications`) bisa diunduh siapa saja. Halaman Knowledge Hub tidak memanggilnya untuk modul, tetapi fungsi bisa dipanggil langsung dengan ID resource (ID tampil publik).
- Policy `krv_read` memberi semua pengguna login salinan versi resource tayang; salinan versi modul berisi metadata lengkap (saat dicek 0 salinan, belum bocor).

Perbaikan:
- Migrasi `20261021010000`: hak kolom `module_registry` (semua kecuali `metadata` untuk anon/authenticated; tulis langsung dicabut); pemicu `kr_module_metadata_guard` membersihkan metadata resource modul di setiap tulis + data lama dibersihkan (ringkasan nama/jenis/ukuran berkas tetap untuk label); `krv_read` tidak membuka versi resource modul. Pengaman: migrasi batal tanpa perubahan bila ada policy/view `security_invoker`/fungsi INVOKER yang membaca `module_registry.metadata`.
- Kode: `publicModuleMetadata()` di proyeksi (salinan publik tanpa materi; `module_registry` tetap menyimpan metadata lengkap); `getKnowledgeResourceDownload` menolak `resource_type = 'module'`.
- Diperiksa sebelum migrasi: semua pembacaan `module_registry` di kode dan skrip tes memakai service role; policy `mrv_select_scoped` hanya membaca `id/created_by/source_submission_id`; view publik tidak memuat `metadata`; kolom lain (`assessment_approach`, `learning_activities`, `content_outline`) tidak berisi tautan berkas atau soal kuis (diuji sebagai pengunjung); `knowledge_resource_files` tidak punya baris modul.
- Diuji di PGlite (26 pengecekan): pengunjung/pengguna login ditolak membaca `metadata` (termasuk `select *`), judul dan view publik tetap terbaca, pemilik tetap membaca versi modulnya, metadata Knowledge Hub modul bersih sementara publikasi tidak tersentuh, pemicu berlaku untuk insert/update, migrasi aman dijalankan dua kali, dan pengaman membatalkan migrasi bila ada fungsi INVOKER yang membaca `metadata`.
- Setelah migrasi dijalankan: uji ulang sebagai pengunjung (`metadata` → permission denied; resource Knowledge Hub modul tanpa path/video), katalog Academy dan halaman modul tetap tampil, `test:participant-rpc`, `test:lifecycle`, `test:kh-roles`.

Catatan rencana semula:
- Bukti (20 Okt, sebagai pengunjung tanpa login): `select metadata from module_registry` mengembalikan `attached_resources` (4 modul), `documents` (1 modul), `video_url` (2 modul). Berkas aman (bucket `module-attachments` privat), tetapi **tautan video bisa dibuka tanpa terdaftar** (gerbang P3 terlewati). Soal/kunci kuis tidak ada.
- Penyebab: policy baca publik `module_registry` berlaku untuk semua kolom. View `module_registry_public_v` sudah aman (tanpa `metadata`).
- Rencana: hak kolom. `REVOKE SELECT ON public.module_registry FROM anon, authenticated;` lalu `GRANT SELECT (<semua kolom kecuali metadata>) ... TO anon, authenticated;`. RLS tetap berlaku untuk baris.
- Sudah dicek: 7 pembacaan `module_registry` di kode (learning.functions.ts 510/724/813, curriculum-modules.functions.ts 139, knowledge-hub.functions.ts 206, admin/modules.functions.ts 198/499) semuanya memakai `supabaseAdmin`; halaman browser tidak membaca tabel ini langsung.
- WAJIB dicek sebelum menulis migrasi: tidak ada policy RLS (termasuk `storage.objects` bucket `module-attachments`), view `security_invoker`, atau fungsi INVOKER yang membaca `module_registry.metadata` dengan hak pengguna. Kalau ada, kolomnya harus tetap terbaca untuk konteks itu atau fungsinya dijadikan SECURITY DEFINER.
- Uji: pengunjung `select metadata` -> permission denied; pengunjung `select title` tetap bisa; katalog Academy dan halaman modul tetap tampil; `test:participant-rpc`, `test:lifecycle`.

### Nomor 5: SELESAI (21 Okt, laptop) - catatan pelaku dikosongkan saat akun dihapus (migrasi `20261021070000`)
- `ON DELETE SET NULL` untuk kolom jejak pelaku yang memang boleh NULL: `governance_audit_log.actor_id`, `review_template_versions.published_by`, `user_roles.granted_by`. Baris log/riwayat tetap ada.
- Sengaja tidak diubah (NOT NULL, bukti kepemilikan/keputusan): `review_subjects.submitted_by`, `review_decisions.decided_by`, `review_assignments.assigned_by`, `review_templates.created_by`, `rbac_role_change_requests.requested_by` (RESTRICT sejak awal), `module_withdrawal_requests.trainer_id` (tabel dibuat di luar migrasi repo). Akun yang memilikinya tetap tidak bisa dihapus; nonaktifkan saja. Aplikasi memang tidak punya fitur hapus akun (penghapusan hanya lewat dashboard/skrip).
- Setelah migrasi, `audit_security.sql` kategori 8 masih menampilkan 6 baris di atas: itu disengaja.
- Pembersihan akun uji di skrip tes sudah diperbaiki di PC (0 akun tertinggal sejak 20 Okt).
- Diuji: tes Postgres lokal 9 pengecekan.

### (arsip) Nomor 5 semula: 9 foreign key ke `auth.users` tanpa `ON DELETE`
- Daftar (hasil `supabase/audit_security.sql` kategori 8): `governance_audit_log.actor_id`, `module_withdrawal_requests.trainer_id`, `rbac_role_change_requests.requested_by`, `review_assignments.assigned_by`, `review_decisions.decided_by`, `review_subjects.submitted_by`, `review_template_versions.published_by`, `review_templates.created_by`, `user_roles.granted_by`.
- Rencana: kolom jejak pelaku yang boleh NULL (`governance_audit_log.actor_id`, `*_by` di templat/penugasan, `user_roles.granted_by`) -> `ON DELETE SET NULL`. Kolom NOT NULL yang merupakan kepemilikan (`review_subjects.submitted_by`, `review_decisions.decided_by`) sebaiknya TETAP menahan penghapusan akun (akun yang punya pengajuan/keputusan tidak boleh hilang diam-diam); cek dulu nullability tiap kolom di migrasi aslinya.
- Juga perbaiki pembersihan `scripts/test-tdd-knowledge-hub-roles.mjs`: lepaskan `governance_audit_log.actor_id` sebelum menghapus akun (sekarang meninggalkan 3 akun tiap kali jalan).

### Nomor 6: SELESAI (21 Okt, laptop) - izin tulis pengunjung dicabut (migrasi `20261021060000`)
- Semua izin INSERT/UPDATE/DELETE/TRUNCATE role `anon` pada tabel dan view `public` dicabut (termasuk `review_records`). Izin baca tidak diubah.
- Dicek dulu: tidak ada kode aplikasi yang menulis tabel sebagai pengunjung (semua lewat server function/RPC; unggahan berkas memakai skema storage) dan tidak ada policy tulis untuk anon.
- Default privileges tidak diubah: tabel baru yang dibuat sesudahnya mendapat izin bawaan lagi; terlihat di `audit_security.sql` kategori 3 dan baris 43 pengecek (jalankan ulang migrasi ini).
- Diuji: tes Postgres lokal 21 pengecekan. Setelah migrasi: `audit_security.sql` kategori 3 harus kosong; semua `npm run test:*`.

### (arsip) Nomor 6 semula: izin tulis pengunjung
- `review_records` punya GRANT INSERT ke `anon` (saat ini diblok pemicu `assignment_not_found`). Cabut INSERT/UPDATE/DELETE dari `anon`.
- Opsional (pengerasan): kategori 3 audit -> hampir semua tabel memberi INSERT/UPDATE/DELETE ke `anon` (bawaan Supabase). Tidak bisa dipakai selama RLS aktif (terbukti), tetapi bisa dicabut massal untuk tabel yang memang tidak pernah ditulis pengunjung. Uji ulang semua alur publik setelahnya.

### Nomor 7: SELESAI (21 Okt, laptop) - aturan pengajuan Knowledge Hub di database (migrasi `20261021050000`)
- Temuan saat dikerjakan (lebih serius dari perkiraan): server function pun TIDAK memeriksa lokasi berkas. `file.storagePath`/`coverFile.storagePath` diambil apa adanya dari browser, sehingga pengaju bisa menunjuk berkas pengguna lain di bucket privat `knowledge-resource-submissions`; bila disetujui, sampulnya disalin ke bucket publik dan berkasnya bisa diunduh dari katalog.
- Perbaikan: `public._kr_payload_problem` dipanggil `submit_draft_for_review` untuk jenis `knowledge_resource` (berlaku untuk `kr_draft_submit` dan `/my-submissions`): judul wajib maks 300; jenis valid dan bukan `module`; setiap lokasi berkas (utama, sampul, semua kunci lama) wajib di `users/<id-pengaju>/` tanpa `..`; PDF <= 10 MB, PPT/PPTX <= 25 MB, lainnya <= 50 MB, sampul <= 2 MB; tautan hanya http/https; wajib berkas atau tautan; Best Practice lengkap. Kirim ulang hanya bila pengajuan berstatus menunggu revisi; status `resubmitted` + judul ditulis di transaksi yang sama (perintah terpisah di `contribution.functions.ts` dihapus). Pesan error diterjemahkan di server function.
- Diuji: tes Postgres lokal 31 pengecekan; 5 draf Knowledge Hub asli dari intern-update diuji terhadap aturan baru dan semuanya lolos.
- Setelah migrasi dijalankan: `npm run test:kh-roles`, `test:kr-rpc`, `test:lifecycle`, lalu uji manual kirim publikasi + kirim ulang revisi di browser.

### (arsip) Nomor 7 semula: pengajuan Knowledge Hub tanpa validasi di database
- `kr_draft_submit` hanya memanggil `submit_draft_for_review`, yang punya aturan khusus untuk expert dan modul saja. Validasi Knowledge Hub (judul, jenis, ukuran berkas, kepemilikan path berkas di bucket `knowledge-resource-submissions`, URL eksternal aman) hanya di `src/lib/knowledge-hub/contribution.functions.ts`.
- Rencana: tambahkan cabang `knowledge_resource` di `submit_draft_for_review` (definisi terbaru di `20261015070000`) yang meniru validasi server function, terutama kepemilikan path berkas (berkas harus di folder milik pengaju).

### Nomor 8 (baru, konsistensi): halaman governance masih membaca tabel peran lama

**Status 21 Okt (PC): kode + migrasi `20261021020000` (dan `20261021030000`, `20261021040000`) SELESAI; sudah dijalankan di intern-update (21 Okt, pengecek OK) dan semua `npm run test:*` lulus sesudahnya.**

- 8a (kode, tanpa migrasi): halaman governance membaca peran lewat `has_role` (aturan yang sama dengan semua policy dan RPC), helper bersama `src/lib/governance/governance-roles.ts`. `getMyRoles`, `getGovernanceDashboard`, `listReviewers` tidak lagi membaca `user_roles`; `listReviewers` memakai service role (baris peran orang lain tidak terbaca lewat RLS) dan hanya mendaftar akun yang lolos `has_role(_, 'qa_reviewer')`. Label peran pengaju di daftar publikasi admin hanya dari `rbac_user_roles` (dalam masa berlaku). Uji langsung: super admin sebelumnya **tidak terlihat sebagai admin** di halaman governance, kini terlihat.
- 8b (temuan + keputusan pemilik proyek 21 Okt): database punya dua nama peran untuk tugas yang sama. Kode lama `qa_reviewer`/`management` masih ada (hanya dipegang super admin), sedangkan peran resmi `reviewer`/`approver` tidak dikenali lapisan review governance. Migrasi: `has_role(_, 'qa_reviewer')` juga menerima `reviewer`, `has_role(_, 'management')` juga menerima `approver`. Approver kini mendapat hak management lama (data review governance, baca semua baris modul tanpa `metadata` dan versinya, lampiran modul untuk tinjauan, evaluasi penyelesaian); di intern-update yang benar-benar mendapat hak baru 1 akun. Reviewer tetap hanya membaca pengajuan yang ditugaskan kepadanya.
- 8c (temuan): `assign_reviewer`/`reassign_reviewer` hanya memeriksa penugas. Kini menolak akun yang bukan reviewer aktif, pengaju pengajuan itu sendiri, subjek tidak ada, dan jenis expert/modul/Knowledge Hub (punya alur keputusan sendiri; penugasan dulu mengubah statusnya menjadi `under_review`). `reassign` hanya untuk penugasan aktif (dulu bisa menghasilkan dua penugasan aktif). Saat dicek: 0 penugasan, 0 rekomendasi.
- Diuji di PGlite (37 pengecekan, termasuk peran kedaluwarsa, profil nonaktif, super admin, approver bukan admin, reviewer bukan management, penolakan tidak membatalkan penugasan lama, migrasi dua kali). `test:rbac` (820), `test:kh-roles`, `test:lifecycle`, `test:kr-rpc` lulus setelah 8a.
- Setelah migrasi dijalankan: uji ulang peran per akun (akun reviewer resmi terlihat sebagai qa_reviewer, approver sebagai management) dan semua `npm run test:*`.
- 8d (keputusan pemilik proyek 21 Okt): kode lama dihapus lewat migrasi `20261021030000` (pengaman: batal bila 20261021020000 belum jalan atau ada pemegang `management` yang bukan admin; qa_reviewer -> reviewer otomatis, status primer ikut, permintaan perubahan peran dipetakan, setiap penugasan dicatat di audit log). Kode aplikasi: `management` tidak lagi admin penuh (`permissions.server.ts`) dan tidak lagi berlabel Admin Level; `qa_reviewer` -> `reviewer` di antrean admin modul/publikasi; halaman `/governance/roles` hanya memberi `reviewer`/`approver`/`admin`; enum peran yang boleh diberikan tanpa kode lama. Diuji di PGlite (19 pengecekan). URUTAN: jalankan migrasi sebelum kode ini dipakai (menyimpan peran akun yang masih memegang kode lama akan ditolak validasi).

Catatan rencana semula:
- `src/lib/governance/governance.functions.ts` (`getMyRoles`) dan `src/lib/governance/governance-ops.functions.ts` (`listReviewers`, `getGovernanceDashboard`) membaca `user_roles` langsung. Sejak `20261020070000` tabel itu tidak dipakai lagi, jadi admin yang hanya ada di sistem baru (mis. `admin99@gmail.com`) tidak terlihat sebagai admin di halaman governance, dan daftar reviewer kosong.
- Rencana: ganti ketiganya ke `rbac_user_roles` (pola seperti `getExpertGovernanceAccess` di `src/lib/admin/experts.functions.ts`). `src/lib/admin/publications.functions.ts` (~baris 311) juga masih menggabungkan `user_roles` untuk label peran pengaju (hanya tampilan).

### Nomor 9: SELESAI (21 Okt, laptop) - Impact Analytics hanya angka dari data (keputusan pemilik proyek: pilihan A)
- `src/lib/analytics/analytics.functions.ts` ditulis ulang: setiap angka dihitung dari tabel; yang belum dicatat platform bernilai `null` dan tampil **Belum tersedia** (tidak diperkirakan). Sumber: Registered Participants = pemegang peran `participant` aktif; Active Learners = pengguna unik di `enrolments` (bukan withdrawn), `self_paced_enrollments`, `course_enrollment_applications` disetujui; Unique Successful Participants dan Alumni = pemegang sertifikat terbit; Verified Experts / Approved Trainers = `experts_directory_v` terverifikasi / status trainer aktif; Approved Modules = `module_registry_public_v`; Self-Paced vs Full Training = penawaran menurut mode penyampaian (aturan `_is_self_paced_delivery_mode`: tanpa trainer = mandiri); Certificates Issued; Knowledge Resources; Active Partners = `partners` aktif; Training Archive = penawaran selesai; level trainer dari status trainer resmi; modul dan jam pembelajaran per kategori.
- Belum tersedia (tidak ada datanya di database): Countries Reached, Participant Learning Hours Generated, Events Conducted, Community Members, Fellowship Participants.
- Semua daftar dibaca bertahap (`fetchAllPages`), cache 60 detik, bila database gagal tampil angka terakhir yang diketahui (bukan angka karangan). Label "Live / Real-time" diganti "Data Platform BARUNA" + waktu pembaruan.
- Diuji: build lalu buka `/analytics` dari server lokal ke database intern-update; angka cocok dengan pemeriksaan langsung (mis. participant 4, expert 4, modul 4, kursus mandiri 2, Full Training 2, Knowledge Hub 7, arsip 1, sertifikat 0).

### (arsip) Nomor 9 semula: halaman Impact Analytics menampilkan angka perkiraan sebagai "Live Database Metrics"
- `src/lib/analytics/analytics.functions.ts` + `src/routes/analytics.tsx` (perubahan lama yang disimpan 20 Okt). Halaman publik menyatakan "Real-time Supabase Data / dihitung langsung dari data terverifikasi", tetapi beberapa angka dikarang: active learners = 40% akun, fellowship = 15% akun, active partners = 6 tetap, events = acara mendatang + 4, approved trainers = jumlah expert, level trainer ditebak dari banyaknya bidang keahlian (level asli ada di `expert_trainer_status`), negara selalu ditambah "Indonesia". `profiles` dibaca tanpa batas (terpotong 1000).
- Rencana: hanya tampilkan angka yang benar-benar dihitung dari data (sisanya "belum tersedia"), atau kembalikan label "Demo/Perkiraan". Keputusan pemilik proyek.

### Nomor 10: SELESAI (20 Okt) - penggabungan dengan pekerjaan PC 17 Okt
- Hasil merge: struktur kode PC dipakai (`published-module.server.ts`, `DynamicModuleRoom`, `full-training/*`, link materi 1 jam). Pemeriksa akses isi modul dan penilaian kuis memakai aturan database `can_access_module_content` (peserta disetujui + penulis modul + admin/approver), bukan `course-access.server.ts` (yang hanya peserta disetujui), supaya penulis dan admin tidak terkunci dan aturannya satu sumber. Gerbang tingkat halaman: modul dinamis diserahkan ke server; jenis lain tetap butuh pendaftaran disetujui (termasuk pengaman `courseId` dari PC). Penyaring metadata katalog memakai versi laptop (lebih ketat). `DynamicModuleLmsGate` (laptop) dihapus. `assertApprovedCourseAccess`/`hasApprovedCourseAccess` di `course-access.server.ts` tidak dipakai lagi (dibiarkan; hapus bila tidak dibutuhkan Full Training).
- Diuji setelah merge: `tsc`, `build`, `test:expert-rpc` 64, `test:kr-rpc` 24, `test:participant-rpc` 27, `test:kh-roles` 20, `test:lifecycle` 14; 0 akun uji tertinggal (perbaikan pembersihan dari PC bekerja, jadi bagian tes di nomor 5 sudah beres; FK-nya sendiri belum).
- Catatan: Full Training (P4) sebagian sudah dipindah ke persetujuan admin di PC, lihat bagian 2n.
- Pelajaran: sebelum bekerja di perangkat lain selalu `git pull`; setelah selesai commit + push.

### (arsip) Nomor 10 semula: gabungkan dengan 3 commit Yudhi-ariawan
- `origin/intern-update` berisi 3 commit (17 Okt: ruang belajar lewat persetujuan admin di server, pembersihan `test:kh-roles`, catatan) yang belum ada di cabang kerja ini. Pekerjaan 20 Okt di-push ke cabang `intern-update-audit-20okt`.
- Bentrok di `dokumen/CATATAN_PERBAIKAN.md`, `src/lib/learning/learning.functions.ts` (4 blok), `src/routes/academy.learn.$id.tsx` (2 blok). Fitur yang sama (gerbang isi modul) dikerjakan dua kali: versi audit memakai fungsi database `can_access_module_content` (peserta disetujui + penulis modul + admin/approver; juga dipakai `gradePublishedModuleQuiz`), versi Yudhi memakai `src/lib/learning/course-access.server.ts` (hanya peserta disetujui) dan memecah kode ke `published-module.server.ts`, `DynamicModuleRoom`, `components/baruna/academy/full-training/*`.
- Rencana: ambil struktur berkas Yudhi, tetapi pemeriksaan aksesnya memanggil `can_access_module_content` (aturan di database, berlaku semua jalur, tidak mengunci penulis/admin). Pastikan metadata katalog publik tetap dibersihkan (`publicCatalogMetadata`). Setelah merge: `tsc`, `build`, semua `npm run test:*`, uji manual ruang belajar. Jangan force push.

### Di luar celah keamanan (tetap terbuka)
- Database main belum dicek: jalankan `supabase/check_migrations.sql` dan `supabase/audit_security.sql`, pastikan admin main ada di `rbac_user_roles` sebelum `20261020070000`, dan periksa akun expert yang dibuat manual lewat SQL (kolom `experts.original_contributor_id` harus berisi akun expert-nya) sebelum `20261020030000`.
- Uji manual di browser: P3 (modul dinamis), P5 (form biodata, halaman Akun, unggah foto), P6 (kursus mandiri di dua perangkat), keputusan Knowledge Hub (setujui, kembalikan, arsip, pulihkan).
- Keputusan mentor: P4 Full Training Program (sungguhan atau label contoh), A1 klaim profil, role participant otomatis atau lewat persetujuan, expert otomatis jadi trainer, approver dipisah dari publisher.
- Koneksi ke Supabase dari jaringan kantor sempat putus-putus (`UND_ERR_CONNECT_TIMEOUT`); bila uji langsung gagal dengan "fetch failed", ulangi dan bersihkan akun `@example.test` yang tertinggal.

---

## 2m. (PC, 17 Okt) Ruang belajar: akses hanya lewat persetujuan di server

Pemeriksaan akses ruang belajar sebelumnya hanya berjalan di browser, padahal isinya sudah terkirim lebih dulu.

| # | Celah | Perbaikan |
|---|---|---|
| 1 | Ruang belajar terbuka bila ada catatan pendaftaran di `localStorage`, data aplikasi lokal "Accepted", atau Demo Mode menyala (tombol yang bisa dinyalakan siapa saja). | Modul Master dan modul dinamis hanya terbuka bila server mencatat pendaftaran `approved` dan peran peserta. Demo Mode tidak lagi membuka ruang belajar mana pun. |
| 2 | `getPublishedModuleDetail` (tanpa login) mengirim semua link dokumen bertanda tangan 24 jam dan soal kuis, sehingga isi modul bisa diambil tanpa mendaftar. | Fungsi publik kini hanya mengirim metadata dan gambar sampul. Isi lengkap lewat `getEnrolledModuleContent`, yang memeriksa ulang persetujuan di server. |
| 3 | Fungsi yang sama mengirim **modul trainer yang belum tayang** (dari `expert_module_submissions`) kepada siapa pun yang tahu ID-nya. | Jalur itu dihapus; hanya modul `published` + `public` yang dikembalikan. |
| 4 | `gradePublishedModuleQuiz` membuka kunci jawaban ke akun login mana pun. | Penilaian kuis memakai aturan akses yang sama. |
| 5 | Katalog modul publik mengirim `metadata` mentah (daftar lampiran dan soal kuis). | Lampiran dan soal kuis dibuang dari metadata katalog. |
| 6 | Tombol pendaftaran menampilkan "Terdaftar Resmi" dari `localStorage`. | Status hanya dibaca dari server. |

Modularisasi: `academy.learn.$id.tsx` dipecah dari 1.629 menjadi 228 baris. Dashboard Full Training pindah ke `src/components/baruna/academy/full-training/` tanpa perubahan perilaku. Logika server ada di `src/lib/learning/published-module.server.ts` dan `src/lib/learning/course-access.server.ts`.

Tidak ada migrasi baru.

Pengujian: uji langsung ke database intern-update. Pratinjau publik hanya membawa 1 dokumen (sampul), sedangkan isi lengkap 7-8 dokumen. Modul belum tayang dan ID acak menghasilkan `null`. Akses: `approved` diizinkan; `pending`, kursus lain, dan akun lain ditolak.

Skrip tes `test:kh-roles` ternyata meninggalkan akun tes di setiap run, karena `cleanup()` mengabaikan error lalu tetap mencetak "bersih 100%". Penyebabnya baris `review_subject_revisions`, `platform_events`, dan `governance_audit_log` yang tidak ikut dihapus. Sekarang semuanya dihapus, dan setiap kegagalan pembersihan membuat tes gagal. Sisa akun lama dapat dibersihkan dengan `node --env-file=.env scripts/purge-test-accounts.mjs` (dry run), lalu `--apply`.

---

## 2n. (PC, 17 Okt) Full Training lewat persetujuan admin, PDF kurikulum, masa berlaku link

| # | Celah | Perbaikan |
|---|---|---|
| 1 | Full Training (mis. African Countries) sepenuhnya di browser: tombol "Simulate next status (demo)" membuat pemohon menyetujui dirinya sendiri sampai "Accepted", lalu ruang belajar terbuka. ID `demo` / `africa-fisheries-2026` juga selalu terbuka. | Form apply mengirim pendaftaran ke server (`course_enrollment_apply`, `course_id` = slug program; wajib login + biodata) sebelum menyimpan salinan di browser. Admin memutuskan di `/admin/enrollments` seperti kursus lain. Ruang belajar, halaman status, dan daftar aplikasi membaca keputusan server; status browser tidak pernah lagi menjadi "Accepted". Tombol simulasi dihapus; aplikasi lama yang belum tercatat di server punya tombol "Send to selection committee". Demo Mode tidak lagi membuka tahapan di dalam dashboard. Tanpa migrasi. |
| 2 | `getCurriculumPdfMap` (tanpa login) menandatangani PDF **semua** modul tayang di database dan memasangnya ke slot kurikulum 1-13 berdasarkan urutan unggah, sehingga materi modul trainer bisa diambil siapa saja dan modul yang tidak berhubungan bisa tampil sebagai "Modul 1". | Fungsi publik itu kini hanya mengembalikan judul 13 modul, tanpa link. Halaman program publik tidak lagi menampilkan link unduh PDF. |
| 3 | Link materi bertanda tangan berlaku 24 jam dan bisa dibagikan. | Link materi untuk peserta berlaku 1 jam dan selalu dibuat baru setiap ruang belajar dibuka; tidak diganti saat ruang belajar terbuka (agar video/PDF yang sedang dibaca tidak dimuat ulang). Gambar sampul publik tetap 24 jam. |

Belum tuntas: **PDF 13 modul Master** adalah aset publik Lovable (`src/assets/modules/*.pdf.asset.json`, alamat `/__l5e/assets-v1/...`) yang tertanam di kode, sehingga tetap bisa dibuka tanpa login oleh siapa pun yang tahu alamatnya. Menutupnya perlu memindahkan file ke bucket privat Supabase dan memberikan link lewat server setelah pemeriksaan persetujuan; menunggu file PDF aslinya.

Temuan terpisah (belum diubah): halaman My Learning (`academy.learn.index.tsx`) menghapus otomatis semua aplikasi program African Countries dari browser setiap kali dibuka, termasuk progres belajarnya.

Pengujian: 25 kombinasi status lokal × status server (status "Accepted" hanya muncul bila server menyetujui); audit penuh lulus. Pembersihan `test:kh-roles` kini mencoba ulang gangguan jaringan sesaat saat menghapus akun.

---

## 2o. Konsol Kurasi `/governance` per peran (21 Okt, PC)

Rancangan: `dokumen/RANCANGAN_KONSOL_GOVERNANCE.md`. Audit awal: `dokumen/AUDIT_PERAN.md`.

**Akar masalah (ditemukan saat uji per peran dengan akun sungguhan):** pengguna non-admin tidak bisa membaca katalog peran `rbac_roles` (policy `rbac_roles_read` mensyaratkan `roles.read`). Semua pemeriksaan akses yang menggabungkan `rbac_user_roles` dengan `rbac_roles!inner(code)` (getExpertGovernanceAccess, assertAdminOrReviewer modul/publikasi, assertAdminAccess peserta) mendapat hasil kosong, sehingga reviewer, verifier, approver, dan operator **ditolak server** walau peran dan izinnya benar. Inilah sebab rantai kurasi hanya jalan untuk admin. Diperbaiki migrasi `20261021040000` (katalog terbaca pengguna login; siapa memegang peran apa tetap privat; pengunjung tetap ditolak).

Perubahan kode:
- `/governance` menjadi Konsol Kurasi (tampilan seperti `/admin`, komponen bersama `src/components/baruna/console/`). Menu per peran dari `getGovernanceConsoleAccess` (`src/lib/governance/console-access.*`), yang memakai pemeriksaan server yang sudah ada, bukan aturan baru.
- Halaman Verifikasi Expert/Modul/Publikasi dan Persetujuan Peserta dipindah ke `/governance/*`; alamat lama `/admin/*` dialihkan. `/admin` khusus administrasi sistem (Users & Access, Kualifikasi Trainer).
- Tombol keputusan Modul dan Publikasi disembunyikan untuk reviewer/verifier (keterangan "Akses baca"). Server memeriksa hak keputusan lebih dulu sebelum mencari pengajuan (Publikasi: `_can_decide_review`; Permintaan Pelatihan: admin/management).
- Permintaan Pelatihan (Request a Training): menu baru; keputusan akhir dihidupkan kembali khusus jenis ini (`recordFinalDecision` sebelumnya dimatikan untuk semua jenis) lewat `finalize_decision`/`return_for_revision`.
- Navbar, halaman awal, dan dasbor memakai semua peran aktif (`canUseAdminPortal`, `canUseCurationConsole`), bukan hanya peran primer.
- Dihapus: halaman lama All Subjects, Role Admin, Decisions; antrean publikasi lama dan `publishApprovedModule` (menulis langsung ke `module_registry`); `grantRole`/`revokeRole`; `getGovernanceDashboard`.

Uji (intern-update, akun `@example.test` dibuat lalu dihapus):
- `npm run test:console-roles` (perlu aplikasi berjalan): 63 pengecekan menu, gerbang antrean, dan portal admin untuk peserta, reviewer, verifier, approver, operator, publisher, admin. Sebelum migrasi 20261021040000: 16 gagal (persis akar masalah di atas); sesudah: lulus semua.
- `npm run test:console-decisions`: 16 pengecekan; reviewer, verifier, operator ditolak di cek hak untuk keputusan modul, publikasi, expert, permintaan pelatihan walau memanggil fungsi langsung; approver lolos.
- `audit:bom-waktu`, `test:rbac` 820, `test:expert-rpc` 64, `test:kr-rpc` 24, `test:participant-rpc` 27: lulus.

Masih untuk mentor: catatan reviewer dan rekam verifikasi, tahap publisher terpisah, ruang kerja operator (cek kelengkapan), langkah TNA/konversi permintaan pelatihan, peran admin vs super admin.

---

## 2p. Peran expert hanya lewat alur pendaftaran (21 Okt, laptop)

**Masalah.** Menjadi expert = dua bagian: peran `expert` di akun dan profil di tabel `experts` (direktori, Portal Expert, status trainer). Persetujuan pendaftaran dan Arsip mengubah keduanya bersamaan (`_expert_set_role`). Centang "expert" di Users & Access, Tambah User, dan alur permintaan peran (`request_rbac_role_change`, yang boleh dipakai siapa pun untuk dirinya sendiri) hanya mengubah perannya. Akibatnya akun "expert setengah jadi": login diarahkan ke Portal Expert tetapi diperlakukan pengguna biasa, formulir Become an Expert menganggapnya sudah expert, dan namanya tidak ada di direktori. Sebaliknya, mencabut centang membuat profil tetap tayang sementara portal tertutup.

**Data intern-update saat dicek:** 15 akun berperan expert, 11 tanpa profil (10 akun `@kkp.go.id` dibuat 1 Okt dengan keterangan `instructor_expert_provisioned` di luar repo, ditambah admin99 untuk uji). Menurut pemilik proyek, akun-akun itu hanya salinan percobaan; yang asli ada di database main. Migrasi ini **tidak mengubah** data tersebut.

**Perbaikan:**
- Migrasi `20261021080000`: `assign_rbac_role`, `revoke_rbac_role`, `request_rbac_role_change` menolak peran `expert` (`expert_role_managed_by_flow`); `decide_rbac_role_change` tidak menerapkan permintaan expert lama (masih bisa ditolak). Isi fungsi lainnya identik dengan `20260911080000` (dibandingkan otomatis baris per baris).
- `users.functions.ts`: `FLOW_MANAGED_ROLES`; Tambah User dan Simpan Perubahan Peran menolak perubahan expert **sebelum** ada perubahan apa pun (tidak ada akun atau peran yang setengah jadi).
- `admin.users.tsx`: kotak expert terkunci dengan label "Lewat pendaftaran" dan keterangan; expert tidak ada di pilihan Tambah User; pesan error dalam bahasa Indonesia.
- `audit_security.sql` kategori 9 `expert_tanpa_profil`: daftar akun berperan expert tanpa profil tayang, beserta asal perannya. **Untuk main:** jalankan ini untuk melihat apakah akun instruktur asli mengalami kebuntuan yang sama.

**Uji:** PGlite 22 pengecekan lulus (centang/cabut expert ditolak, juga untuk akun admin; peran staf tetap bisa; permintaan expert ditolak; persetujuan dan arsip expert tetap memberi/mencabut peran; izin anon tertutup; migrasi bisa diulang). `tsc` dan `build` lulus.

**Uji langsung (intern-update, 21 Okt, setelah migrasi dijalankan):** `npm run test:expert-role-lock` 10/10 (akun super_admin uji: centang expert ditolak, cabut expert ditolak, publisher tetap bisa dicentang/dicabut; pengguna meminta expert untuk dirinya ditolak dan tidak tersimpan; pengunjung ditolak). Catatan: izin `users.assign_role` hanya dimiliki `super_admin`. Uji lain tetap lulus: rbac 820, expert-rpc 64, kr-rpc 24, participant-rpc 27, kh-roles 20, lifecycle 14, console-decisions 16. Akun `@example.test` tersisa: 0.

---

## 2q. Audit lintas peran (21 Okt) dan penutupan tulis langsung ke pengajuan

**Cara audit (uji langsung intern-update, akun `@example.test` sementara, dihapus sesudahnya):** 9 peran (pengunjung, registered_user, participant, reviewer, verifier, approver, operator, publisher, admin) × 89 tabel/view: berapa baris yang terlihat dan apakah bisa menambah baris langsung.

**Aman (terbukti):** tidak ada peran yang berhasil menambah baris ke tabel mana pun; akun biasa hanya melihat profil dan perannya sendiri; kontak pribadi expert, biodata, pendaftaran kursus, dan log audit tidak terlihat oleh registered_user/participant/reviewer/verifier/publisher; operator hanya pendaftaran kursus.

**Celah yang ditemukan dan diperbaiki (migrasi `20261021090000`):**
1. Policy lama Juli `review_subjects_admin_write/_admin_update` dan `review_assignments_admin_write/_admin_update` (admin|management; sejak `20261021020000` termasuk approver). Terbukti dari browser: approver **menyetujui pengajuannya sendiri** (expert, modul, Knowledge Hub, permintaan pelatihan) dan **menugaskan dirinya sendiri** sebagai reviewer, melewati semua pengaman RPC. Admin sama.
2. `review_assignments_reviewer_coi_update` mengizinkan reviewer mengubah semua kolom penugasannya. Terbukti: reviewer memindahkan penugasan ke pengajuan lain (rekomendasi untuk pengajuan sendiri tetap ditolak pemicu `self_review_forbidden`).

Perbaikan: kelima policy dihapus dan izin tulis tabel dicabut dari `authenticated`/`anon` (baca tidak berubah). Semua penulisan sah sudah lewat fungsi SECURITY DEFINER (diperiksa otomatis: 16 fungsi penulis, semuanya DEFINER; satu fungsi INVOKER hanya membaca). "Nyatakan konflik" diganti RPC `review_assignment_declare_conflict` (hanya penugasan aktif milik sendiri, hanya kolom konflik + status `recused`, tercatat di log audit). Dua fungsi server lama yang tidak dipakai (`createReviewSubject`, `assignReviewer` di `governance.functions.ts`, menulis langsung) dihapus.

**Uji:** PGlite 24/24 (celah direproduksi sebelum migrasi; sesudahnya ditolak untuk keempat jenis, admin juga; baca tetap; `assign_reviewer` dan pengamannya tetap jalan; RPC konflik). `npm run test:review-lockdown` (uji langsung, 13 pengecekan): sebelum migrasi dijalankan **0 lulus, 13 gagal** (celah terbukti di database asli); **sesudah migrasi dijalankan (21 Okt): 13/13**. Uji lain tetap lulus: rbac 820, expert-rpc 64, kr-rpc 24, participant-rpc 27, kh-roles 20, lifecycle 14, console-decisions 16, expert-role-lock 10. Akun `@example.test` dan pengajuan uji tersisa: 0.

**Temuan lain, belum dikerjakan:**
- Approver ikut bisa menulis daftar keahlian/peran expert/bahasa dan aturan level trainer (policy lama admin|management). Usul: khusus admin; menunggu keputusan.
- ~~"My Training Requests" (`academy.training-requests.*`) membaca salinan di browser + contoh palsu; keputusan approver tidak terlihat peminta.~~ Diperbaiki di bagian 2s.
- `createUser` (Tambah User) mengabaikan peran yang gagal diberikan tanpa pesan.
- Approver/admin bisa menyunting rincian profil expert langsung: sengaja (`20261015070000`).

---

## 2r. Kelulusan dicatat server, dashboard peserta, pemantauan Admin/Operator, ringkasan trainer (21 Okt)

**Acuan:** PB-ACA-03/04/05 (Slide 22–24), Slide 15 (tidak ada data di luar sistem resmi), Slide 40.

**Temuan (dicek di kode dan database intern-update):**
- Kuis modul database dinilai server tetapi hasilnya tidak dicatat; browser menandai "selesai" dan `self_paced_sync` menerimanya. Kuis modul bawaan dinilai di browser dan kunci jawabannya ikut terkirim ke browser.
- Keempat modul tayang **tidak punya kuis dari trainer**; "lulus" didapat dari kuis otomatis 5 soal yang jawabannya selalu pilihan pertama.
- Dashboard peserta menghitung "sertifikat resmi" dan "pendaftaran" dari data browser (database: sertifikat 0).
- Admin/Operator tidak punya halaman pemantauan (PB-ACA-04 "Monitor Progress Peserta"); trainer melihat "Completion Rate: Not available".

**Keputusan pemilik proyek (21 Okt):** kelulusan hanya dari **kuis resmi** (kuis trainer, atau bank soal modul bawaan) yang dinilai server. Modul tanpa kuis tetap bisa dipelajari tetapi belum bisa lulus; trainer menambahkan kuis lewat revisi modul.

**Perbaikan:**
- Migrasi `20261021100000`: tabel `module_quiz_attempts`; `learning_record_quiz_attempt` (hanya service_role, satu transaksi, hanya peserta disetujui, batas percobaan, tidak bisa dicatat ulang setelah lulus); kolom `completion_source` (`server_quiz` / `legacy_browser`; baris selesai lama tidak dihapus, hanya ditandai); `self_paced_sync` tidak lagi menerima selesai/nilai/langkah kuis dari browser; baris yang sudah lulus tidak bisa dihapus peserta; `trainer_module_learning_summary()` (agregat, tanpa data pribadi).
- Kuis modul database: kuis otomatis dihapus; hasil kuis trainer dicatat; kunci jawaban hanya dibuka setelah lulus.
- Kuis modul bawaan: bank soal (200 soal + kunci) dipindah ke `src/data/quiz-banks.server.ts`; soal diambil dan dinilai lewat `module-quiz.functions.ts`. Diperiksa di hasil build: teks bank soal 0 kali di file browser, 1 di server. Full Training (mode uji) memakai penilaian server yang sama tetapi tidak dicatat sebagai kelulusan.
- Dashboard peserta (`MyLearningOverview`): status pendaftaran, lanjutkan belajar (progres + status kuis), kelulusan tercatat, sertifikat dari tabel `certificates`; semua dari database milik peserta sendiri (RLS). Kontribusi Knowledge Hub dipindah ke bawah; kartu yang menghitung data browser dihapus.
- Konsol Kurasi → **Pemantauan Progres** (`/governance/learning-progress`, peran sama dengan Persetujuan Peserta): ringkasan per kursus + daftar peserta (progres, kuis, status, aktivitas terakhir) dengan penanda tindak lanjut (belum mulai > 7 hari, tidak aktif > 14 hari, 3x kuis belum lulus, kuis resmi belum ada).
- Portal Trainer → Analytics: Completion Rate dari data nyata + tabel per modul (menunggu, disetujui, mulai, lulus, rata-rata nilai terbaik). Average Rating tetap "Not available" (belum ada data rating).

**Uji:** PGlite 32/32 (sinkron browser tidak bisa meluluskan; pencatatan lulus/gagal/batas/sudah lulus; validasi; izin; hapus; ringkasan trainer tanpa data pribadi, trainer ditangguhkan ditolak; migrasi bisa diulang). `tsc` dan `build` lulus. **Uji langsung (intern-update, 21 Okt, setelah migrasi dijalankan):** `npm run test:learning-progress` 12/12; uji lain tetap lulus (rbac 820, expert-rpc 64, kr-rpc 24, participant-rpc 27, kh-roles 20, lifecycle 14, console-decisions 16, expert-role-lock 10, review-lockdown 13). Satu baris selesai lama (Lorem Ipsum, nilai 100 dari kuis otomatis) kini bertanda `legacy_browser`. Data uji tersisa: 0.

**Masih terbuka:** template dan penerbitan sertifikat resmi (mentor); tabel kehadiran (PB-ACA-04, untuk Full Training); rating trainer; Full Training dan AZA tetap mode uji di browser.

---

## 2s. My Training Requests dari server; riwayat status, SLA, dan notifikasi alur kerja (21 Okt)

**Acuan:** Slide 13 (setiap langkah dapat memiliki SLA; notifikasi otomatis di setiap perubahan status; riwayat dapat dilihat pada halaman status proses), PB-ACA-06 (Slide 25: minta perbaikan/klarifikasi ke pengguna, notifikasi ke pengguna).

**Temuan (dicek di kode dan database intern-update):**
- Pengajuan Request a Training sudah masuk server (`training_need_draft_*`), tetapi "My Training Requests" membaca salinan localStorage plus tiga contoh palsu. Di device lain daftar kosong; keputusan approver (setuju/tolak/minta revisi) tidak pernah terlihat; tombol "Withdraw" hanya menghapus salinan browser.
- Permintaan revisi (`return_for_revision`) membuka draf untuk pemohon, tetapi tidak ada halaman untuk mengubah dan mengirim ulang; pengajuan berhenti di situ.
- Perubahan status `review_subjects` tidak tercatat lengkap (audit log hanya sebagian event dan hanya terbaca admin/approver). Tidak ada SLA. Notifikasi hanya untuk keputusan akhir; untuk permintaan pelatihan judul dan tautannya salah (ke Knowledge Hub). Reviewer tidak diberi tahu saat ditugaskan.
- Halaman sukses menjanjikan pembaruan lewat email (tidak ada pengiriman email).

**Perbaikan:**
- Migrasi `20261021110000`:
  - `review_subject_status_history` diisi trigger di setiap perubahan `current_status`, untuk semua jenis pengajuan dan semua RPC. Pengajuan lama diisi perkiraan bertanda `is_backfill`. Dibaca lewat `can_read_review_subject` (pemohon, reviewer aktif, admin/approver); kolom `changed_by` tidak dibuka untuk pengguna.
  - `workflow_sla_policies` (jam per jenis + langkah) hanya bisa diubah lewat `set_workflow_sla_policy` (khusus admin, tercatat di audit trail). Isi awal untuk permintaan pelatihan bersifat **sementara**: penugasan 72 jam, review 120 jam, keputusan 72 jam.
  - `training_need_withdraw`: pemohon menarik pengajuannya sendiri sebelum diputuskan. Penugasan aktif dibatalkan, draf revisi yang belum dikirim dihapus, dan penarikan tercatat di audit trail.
- "My Training Requests" (daftar dan detail) membaca server lewat klien pengguna (RLS). Detail menampilkan tahap saat ini, target SLA, riwayat lengkap (diajukan, mulai direview, review selesai, minta revisi + catatan, disetujui/ditolak + alasan, ditarik), isi pengajuan, dan tombol tarik. Mode Presentasi tetap memakai data demo browser.
- Revisi: tombol "Revise & Resubmit" membuka wizard berisi draf revisi (`?revise=<id>`). Kiriman ulang memakai draf yang sama, jadi id, riwayat, dan reviewer tetap. Kiriman tanpa perubahan ditolak (`revision_unchanged`). Bila draf revisi gagal dimuat, wizard tidak akan membuat pengajuan baru.
- Notifikasi (dihitung dari data server, penanda baca tetap di `notification_reads`):
  - Pemohon (semua jenis): mulai direview, review selesai.
  - Permintaan pelatihan: judul dan tautan keputusan diperbaiki; minta revisi mengarah ke wizard revisi.
  - Reviewer: ditugaskan (dengan batas waktu dari `due_at` atau SLA), dan saat batas waktu terlewati.
  - Admin/approver: permintaan baru atau revisi masuk, menunggu keputusan, dan langkah yang melewati SLA.
- Konsol Kurasi: tahap + status SLA di daftar Permintaan Pelatihan, riwayat status di halaman pengajuan, dan menu baru **SLA Alur Kerja** (`/governance/sla`: semua peran kurasi bisa melihat, hanya admin yang bisa mengubah).
- Teks email di halaman sukses diganti menjadi notifikasi BARUNA.

**Uji:** PGlite 36/36 (trigger: insert, ganti status, tanpa ganti status; backfill dan migrasi bisa diulang; RLS: pemohon, orang lain, approver, reviewer sebelum/sesudah ditugaskan; `changed_by` tertutup; tulis langsung ditolak; SLA: baca, anon ditolak, update langsung ditolak, approver ditolak, validasi, admin berhasil + audit; withdraw: orang lain/admin/jenis lain/alasan terlalu panjang ditolak, berhasil + efeknya, tidak bisa dua kali, anon ditolak; cascade). PGlite juga menguji `return_for_revision` baru (48/48 total). `tsc` dan `build` lulus. **Uji langsung (intern-update, 21 Okt, setelah migrasi dijalankan):** `npm run test:training-requests` 33/33. Alurnya: ajukan → riwayat & RLS → SLA (baca, tolak, ubah via RPC + audit) → tugaskan → rekomendasi → kembalikan untuk revisi (penugasan ditutup, catatan terlihat pemohon, tidak dua kali) → kirim ulang (tanpa perubahan ditolak, revisi ke-2) → tugaskan lagi → tarik (orang lain/admin ditolak) → jalur disetujui dengan riwayat lengkap. Nilai SLA dikembalikan ke semula; data uji tersisa 0. Backfill mengisi riwayat untuk 17 pengajuan lama. Uji lain tetap lulus: rbac 820, lifecycle 14, kh-roles 20, expert-rpc 64, kr-rpc 24, participant-rpc 27, expert-role-lock 10, review-lockdown 13, learning-progress 12.

**Masih terbuka:** nilai SLA resmi dan apakah dihitung hari kerja (mentor); notifikasi email (belum ada layanan email); langkah TNA/rekomendasi/konversi ke course (PB-ACA-06) tetap menunggu arahan.

---

## 2t. Trainer memperbarui modul tayangnya sendiri (21 Okt)

**Acuan:** PB-ACA-01 (Slide 20, Master Course/Module dengan versioning dan approval), Slide 38 (versioning), Slide 13 (tidak ada konten tayang tanpa approval).

**Temuan:** modul tayang hanya bisa direvisi lewat "Buka revisi modul tayang" milik approver/admin (`request_published_module_revision`). Trainer yang ingin memperbarui materi secara berkala harus meminta admin dulu. Pondasinya sudah benar: versi lama tetap tayang selama revisi, persetujuan menaikkan versi (`module_registry_versions`), dan penolakan mempertahankan versi lama.

**Perbaikan:**
- Migrasi `20261021120000`:
  - `trainer_open_module_update(subject, catatan)`. Hanya trainer aktif, untuk modulnya sendiri yang sedang tayang, dan wajib dengan ringkasan perubahan (5–2.000 karakter). Membuka satu draf pembaruan: isi deskriptif dari versi tayang, sedangkan kuis lengkap dan lampiran dari **revisi yang menghasilkan versi tayang** (lewat `module_registry.audit_ref`), bukan dari draf terakhir yang bisa saja pembaruan yang ditolak. Ini bukan keputusan, dan status tetap `approved` sampai dikirim. Ditolak bila modul diarsipkan, tidak tayang, sedang diverifikasi, atau pembaruan sudah terbuka. Tercatat di audit trail.
  - `trainer_cancel_module_update(subject)`: membatalkan pembaruan yang belum dikirim dan memulihkan draf sebelumnya. Tidak bisa bila verifikator sudah membuat keputusan sesudahnya, dan tidak berlaku untuk revisi yang diminta verifikator.
- Kiriman, verifikasi, dan keputusan memakai jalur yang sudah ada (`trainer_module_save`, `admin_module_decide`). Kuota level tidak bertambah karena revisi modul yang sudah di registry tidak dihitung.
- Portal Trainer → Status Review:
  - Kartu modul tayang punya tombol **Ajukan Pembaruan** (isi ringkasan perubahan, lalu langsung ke editor).
  - Status "Pembaruan Sedang Disiapkan" dengan tombol **Lanjutkan Pembaruan** / **Batalkan Pembaruan**.
  - Editor modul menjelaskan bahwa versi saat ini tetap tayang. Label di beranda portal ikut disesuaikan.

**Uji:** PGlite 28/28 (izin: bukan trainer, trainer lain, anon; validasi catatan; modul tidak tayang/diarsipkan/sedang diverifikasi; isi draf dari versi tayang + revisi yang disetujui, bukan pembaruan yang ditolak; draf lama withdrawn; status tetap approved; versi tayang tidak berubah; tidak ada keputusan; tidak dua kali; batal: orang lain ditolak, draf dipulihkan, metadata bersih, tidak dua kali, tidak setelah keputusan, tidak untuk revisi dari verifikator; migrasi bisa diulang). `tsc` dan `build` lulus. **Uji langsung (intern-update, 21 Okt, setelah migrasi dijalankan):** `npm run test:module-update` 24/24. Isinya: modul tayang → buka pembaruan (validasi dan izin) → versi tayang tetap → kuota tetap → admin tidak bisa membuka revisi kedua → batal → kirim → disetujui naik ke v2 dan tersimpan di riwayat versi → pembaruan ditolak, v2 tetap tayang → diminta revisi, trainer tidak bisa membatalkan → kirim ulang dan disetujui jadi v3 → kuota tetap. Data uji tersisa 0 (akun, profil expert, modul). Uji lain tetap lulus: lifecycle 14, kh-roles 20, expert-rpc 64, learning-progress 12, review-lockdown 13, training-requests 33, rbac 820.

**Masih terbuka:** peserta yang sudah lulus versi lama tetap lulus dan belum diberi tahu saat ada versi baru (kebijakan, tanya mentor); halaman riwayat versi (v1, v2, …) untuk trainer/admin belum ada.

---

## 2u. "Buka revisi modul tayang" (admin) mulai dari versi yang tayang (22 Okt)

**Acuan:** PB-ACA-01 (Slide 20, versioning dan approval), Slide 13 (tidak ada konten tayang tanpa approval). Butir 4 antrean di MENUNGGU_ARAHAN_MENTOR.md.

**Temuan (dibuktikan di PGlite dengan fungsi lama `20261015040000`):**
- `request_published_module_revision` (jalur Approver/Admin) mengambil kuis lengkap dan lampiran dari **draf terbaru**. Setelah pembaruan trainer ditolak, draf terbaru adalah isi yang ditolak. Akibatnya revisi yang dibuka admin membawa lagi kuis dan lampiran yang ditolak, bukan yang sedang tayang.
- Fungsi itu juga tidak memeriksa status pengajuan. Bila trainer sudah **mengirim** pembaruan yang menunggu keputusan, membuka revisi menarik kiriman itu (`withdrawn`) tanpa keputusan atas isinya. Kasus ini ada di intern-update: modul "Ministry Professional English Program" berstatus pending/resubmitted (revisi ke-2 menunggu keputusan).

**Perbaikan (migrasi `20261022010000`):**
- Isi awal revisi diambil dari revisi yang disetujui oleh keputusan yang menayangkan modul (`module_registry.audit_ref`), sama dengan `trainer_open_module_update` (2t). Bila tidak ada, cadangannya draf aktif terakhir (perilaku lama). Semua modul tayang di intern-update punya `audit_ref` ke keputusan approve.
- Ditolak dengan `module_review_in_progress` bila status pengajuan bukan `approved`. Kiriman yang menunggu diputuskan lewat Setujui / Tolak / Minta Revisi. Pesan ramah di Konsol Kurasi.
- Peran, larangan memutuskan milik sendiri, kunci baris, dan bentuk hasil tidak berubah. Tombol di Konsol sudah hanya tampil untuk modul berstatus approved; penjaga di server menutup layar yang belum dimuat ulang atau klik bersamaan.

**Uji:** PGlite 28/28. Bagian A (fungsi lama) membuktikan 3 bug: kuis ditolak terbawa, lampiran ditolak terbawa, kiriman menunggu ditarik diam-diam. Bagian B (fungsi baru): izin (bukan approver, pengaju sendiri, tanpa login, anon tanpa EXECUTE), validasi catatan, kuis dan lampiran dari revisi yang disetujui, isi deskriptif dari modul tayang, draf milik trainer, draf lama withdrawn, status menunggu revisi, keputusan dan audit trail tercatat, versi tayang tetap, tidak dua kali, status pending/under_review/decision_pending ditolak dan kiriman tetap utuh, cadangan tanpa `audit_ref`, modul tidak tayang ditolak, migrasi bisa diulang. `tsc` dan `build` lulus. Uji langsung baru `npm run test:admin-module-revision` (18 cek). **Sebelum migrasi (intern-update, 22 Okt): 13/18.** Yang gagal tepat di bug ini: kuis dan lampiran revisi berasal dari versi yang ditolak, revisi tetap dibuka saat kiriman menunggu keputusan, dan dua langkah sesudahnya ikut gagal. Data uji tersisa 0. **Sesudah migrasi dijalankan (intern-update, 22 Okt): 18/18.** Uji lain tetap lulus: module-update 24, training-requests 33, lifecycle 14, kh-roles 20, expert-rpc 64, kr-rpc 24, participant-rpc 27, expert-role-lock 10, review-lockdown 13, learning-progress 12, rbac 820. Akun uji tersisa 0.

---

## 2v. Knowledge Hub: versi tayang tetap tayang selama revisi; kontributor bisa memperbarui publikasinya (22 Okt)

**Acuan:** Slide 26-34 (Knowledge Hub: kontribusi → kurasi → publikasi), Slide 13 (tidak ada konten tayang tanpa approval), pola versioning modul (2t, 2u). Butir 1 antrean di MENUNGGU_ARAHAN_MENTOR.md.

**Temuan (dibuktikan di PGlite dan di database intern-update):**
- `admin_kr_decide` (`20261020060000`) dengan **Minta Revisi** atau **Tolak** pada publikasi yang sudah tayang mengubahnya menjadi archived + private. Akibatnya publikasi **hilang dari katalog** selama revisi, dan revisi yang ditolak menghapus versi yang sebelumnya sudah disetujui. Terjadi di intern-update: "Teknologi Pemantauan Rumpon & Penangkapan…" (disetujui, lalu diminta revisi) sedang tersembunyi.
- Kontributor tidak bisa memperbarui publikasinya sendiri. `submit_draft_for_review` hanya menerima draf tertaut bila kurator meminta revisi.
- Konsol Kurasi mengecek "Disetujui & Tayang" sebelum "Revisi Diajukan Ulang". Bila versi lama tetap tayang, kiriman revisi akan terlihat seperti sudah tayang, dan admin tidak tahu ada yang perlu diputuskan.

**Perbaikan (migrasi `20261022020000`):**
- **Versi tayang tetap tayang** selama revisi dan pembaruan. **Disetujui**: isi katalog diganti dan versi naik (tercatat di `knowledge_resource_versions`). **Ditolak**: versi lama tetap tayang dan status kembali "disetujui". **Tolak** tanpa pengajuan yang menunggu ditolak (`nothing_to_decide`); untuk menarik tayang gunakan **Arsipkan**.
- **Minta Revisi pada publikasi tayang:** draf baru berisi versi yang **tayang** (revisi yang disetujui keputusan `knowledge_resources.audit_ref`), bukan draf terakhir yang bisa saja isi yang ditolak.
- **Kontributor memperbarui sendiri:** `contributor_open_resource_update` (hanya pemilik, wajib ringkasan perubahan 5–2.000 karakter, hanya untuk publikasi yang tayang) dan `contributor_cancel_resource_update` (sebelum dikirim). Status tetap "disetujui" sampai dikirim. Pengiriman lewat jalur biasa (`kr_draft_submit`), sehingga semua aturan berkas/tautan/jenis tetap berlaku. Selama pembaruan disiapkan, approver tidak bisa memutuskan atau meminta revisi atasnya.
- **Arsip dan pulihkan:** arsip saat pembaruan masih disiapkan membatalkan pembaruan itu. Pulihkan dari arsip menayangkan kembali versi yang disetujui walau pengajuan kembali ke antrean.
- **Perbaikan data:** publikasi yang tersembunyi karena permintaan revisi (bukan karena diarsipkan admin) ditayangkan kembali. Di intern-update ini 1 publikasi; tautannya sudah dicek tidak bentrok dengan publikasi aktif lain.
- **Aplikasi:**
  - My Contributions: tombol **Ajukan Pembaruan**, status "Pembaruan Sedang Disiapkan", **Lanjutkan / Batalkan Pembaruan**, tautan "Lihat Versi yang Tayang", serta pemberitahuan bila pembaruan ditolak.
  - Kartu publikasi di portal trainer.
  - Konsol Kurasi: status antrean didahulukan, dengan label "Pembaruan Menunggu Keputusan (Versi Lama Tetap Tayang)". Selama pembaruan belum dikirim, admin melihat versi yang sedang tayang. Tombol Tolak disembunyikan untuk publikasi yang sudah disetujui.
  - Notifikasi "Pembaruan Publikasi Ditolak (Versi Sebelumnya Tetap Tayang)".
- `test:kr-rpc` langkah 3 disesuaikan: dulu mengecek "salinan tayang diturunkan", sekarang mengecek "versi yang disetujui tetap tayang selama revisi".

**Uji:** PGlite 48/48:
- **Sebelum:** 2 bug terbukti.
- **Kurator:** tetap tayang selama revisi; draf dari versi tayang; ditolak tetap tayang; Tolak tanpa antrean ditolak; disetujui naik ke v2 dan tercatat di riwayat versi.
- **Kontributor:** izin, validasi catatan, draf dari versi tayang, status tetap disetujui, tidak dua kali, approver tidak bisa memutuskan saat disiapkan, batal memulihkan draf, kirim tanpa perubahan ditolak, setelah dikirim tidak bisa dibatalkan atau dibuka lagi, disetujui jadi v3.
- **Arsip/pulihkan:** dua skenario.
- **Pengajuan baru:** perilaku lama tetap.
- **Lainnya:** anon tanpa EXECUTE, fungsi internal tertutup, migrasi bisa diulang. Perbaikan data hanya menayangkan publikasi yang disembunyikan oleh permintaan revisi.

`tsc` dan `build` lulus. Uji langsung baru `npm run test:knowledge-update` (19 cek). **Sebelum migrasi (intern-update, 22 Okt): 5/19**: v1 hilang dari katalog saat diminta revisi, revisi ditolak menghapus versi tayang, dan fungsi kontributor belum ada. Data uji tersisa 0. **Sesudah migrasi dijalankan (intern-update, 22 Okt): 19/19.** Perbaikan data terbukti: "Teknologi Pemantauan Rumpon & Penangkapan…" kini published/public (v1) sambil tetap menunggu revisi kontributor; "lorelipsum" (diarsipkan admin) tetap tersembunyi. Uji lain tetap lulus: kr-rpc 24 (versi baru), kh-roles 20, admin-module-revision 18, module-update 24, training-requests 33, lifecycle 14, expert-rpc 64, participant-rpc 27, expert-role-lock 10, review-lockdown 13, learning-progress 12, rbac 820. Akun uji tersisa 0.

---

## 2w. Expert memperbarui profilnya sendiri lewat review; profil, role, dan trainer tidak dicabut selama revisi (22 Okt)

**Acuan:** PB-EXP-01 (Slide 36: perbarui draf → review → versioning), Slide 13. Butir 2 antrean di MENUNGGU_ARAHAN_MENTOR.md.

**Temuan (dibuktikan di PGlite dan di database intern-update):**
- Setelah disetujui, expert tidak bisa mengajukan pembaruan profil. Pengajuan baru ditolak (`expert_profile_exists`), dan revisi hanya bisa dikirim bila verifikator memintanya. Yang ada hanya sunting langsung oleh admin/approver tanpa review (`20261015070000`, disengaja).
- **Lebih serius:** `admin_expert_decide` dengan **Minta Revisi** atau **Tolak** pada expert yang sudah tayang menjalankan `_expert_deactivate_outputs`. Akibatnya **profil disembunyikan dari direktori, status trainer dinonaktifkan, dan role expert dicabut**, jadi expert kehilangan akses Portal Trainer hanya karena diminta melengkapi data. Terbukti langsung di intern-update: profil menjadi private sesaat setelah diminta revisi.

**Perbaikan (migrasi `20261022030000`):**
- `expert_open_profile_update` / `expert_cancel_profile_update`:
  - Hanya pemilik, dengan ringkasan perubahan 5–2.000 karakter, dan hanya untuk profil yang tayang.
  - Draf diambil dari versi yang **tayang** (revisi yang disetujui keputusan `experts.audit_ref`; cadangan: draf aktif terakhir. Satu profil di intern-update, "barry", tidak punya `audit_ref`).
  - Status tetap "disetujui" sampai dikirim.
  - Pengiriman lewat jalur revisi yang sudah ada (`expert_revision_resubmit`), dengan pemeriksaan kelengkapan dan kepemilikan dokumen yang sama.
- **Selama pembaruan atau revisi profil yang tayang**, profil, role expert, dan status trainer **tetap**:
  - **Disetujui:** profil diperbarui, versi naik (`expert_versions`), slug tetap.
  - **Ditolak:** profil lama tetap, status kembali "disetujui", dan draf yang tayang dipulihkan, sehingga **Sinkronkan** tidak pernah menayangkan isi yang ditolak.
- **Tolak** tanpa pengajuan yang menunggu ditolak (`nothing_to_decide`); untuk menarik profil gunakan **Arsipkan**. Selama pembaruan disiapkan, approver tidak bisa memutuskan atau menyinkronkan (`expert_update_open`), supaya draf yang belum dikirim tidak ikut tayang.
- **Arsip dan pulihkan:** arsip saat pembaruan disiapkan membatalkan pembaruan itu. Pulihkan saat pembaruan menunggu menayangkan lagi profil yang disetujui (dengan role dan trainer), sementara pembaruan kembali ke antrean.
- Pengajuan pertama (belum pernah tayang) tidak berubah.
- **Aplikasi:**
  - `/experts/join` untuk expert terdaftar menampilkan **Ajukan Pembaruan Profil** dan memakai form yang sama, dengan banner "profil tetap tayang" dan tombol **Batalkan Pembaruan**. Pemberitahuan juga muncul bila pembaruan sedang diverifikasi atau ditolak.
  - `/experts/profile` mendapat tombol **Perbarui Profil**.
  - Konsol: banner pembaruan, data profil yang tayang selama pembaruan belum dikirim, dan tombol yang dinonaktifkan sesuai aturan (Tolak pada profil disetujui, semua keputusan saat pembaruan disiapkan).
  - Notifikasi "Pembaruan Profil Expert Ditolak (Profil Sebelumnya Tetap Tayang)".
- `test:expert-rpc` langkah 7 disesuaikan. Dulu langkah itu mengecek "profil disembunyikan, trainer nonaktif, role dicabut" saat diminta revisi; sekarang mengecek bahwa ketiganya tetap.

**Uji:** PGlite 47/47:
- **Sebelum:** 2 bug terbukti.
- **Membuka pembaruan:** izin, validasi, draf dari versi tayang, status tetap, tidak dua kali, approver tidak bisa memutuskan atau menyinkronkan, batal memulihkan draf.
- **Kirim, tolak, setujui:** selama ditinjau profil/role/trainer tetap; ditolak tetap dan draf aktif kembali ke versi tayang; sinkron sesudah penolakan tetap menayangkan versi lama; Tolak tanpa antrean ditolak; disetujui naik versi.
- **Verifikator minta revisi:** profil/role/trainer tetap; pemilik tidak bisa membatalkan; minta revisi atas kiriman membuka draf kiriman.
- **Lainnya:** arsip/pulihkan (2 skenario), pengajuan pertama tidak berubah, migrasi bisa diulang.

`tsc` dan `build` lulus. Uji langsung baru `npm run test:expert-profile-update` (19 cek). **Sebelum migrasi (intern-update, 22 Okt): 5/19**: profil menjadi private dan role/trainer dicabut saat diminta revisi, profil ditolak tetap hilang, dan fungsi pembaruan belum ada. Data uji tersisa 0. **Sesudah migrasi dijalankan (intern-update, 22 Okt): 19/19.** Percobaan pertama migrasi ini tidak masuk ke database (fungsi baru tidak ditemukan); setelah dijalankan ulang, berhasil.

---

## 2x. Riwayat versi yang bisa dilihat; peserta yang sedang belajar diberi tahu saat modul diperbarui (22 Okt)

**Acuan:** Slide 20/36/38 (versioning), Slide 13 (notifikasi otomatis di setiap perubahan status). Butir 3 antrean di MENUNGGU_ARAHAN_MENTOR.md.

**Temuan:**
- `module_registry_versions`, `knowledge_resource_versions`, dan `expert_versions` sudah terisi otomatis setiap kali konten naik versi, tetapi tidak ditampilkan di mana pun. Pemilik dan Konsol Kurasi tidak bisa melihat v1, v2, … beserta tanggal dan penyetujunya. Versi 1 sering tidak punya baris, karena trigger hanya berjalan saat UPDATE.
- Peserta yang sedang belajar tidak diberi tahu saat modulnya naik versi.

**Perbaikan:**
- **Migrasi `20261022040000`, `content_version_history(subject)`:** daftar versi satu pengajuan (modul, publikasi, atau profil expert). Isinya hanya metadata: nomor versi, tanggal tayang, penyetuju, alasan keputusan, dan asal (disetujui / disinkronkan ulang admin / versi awal).
  - Snapshot isi **tidak dibuka**, karena profil expert memuat kontak pribadi dan modul memuat kunci kuis.
  - Akses sama dengan riwayat revisi: pemilik, reviewer yang ditugaskan, admin/approver. Orang lain mendapat "tidak ditemukan".
  - Versi 1 tanpa baris riwayat diisi dari keputusan approve pertama.
- **Komponen "Riwayat Versi"** di Konsol Kurasi (halaman pengajuan), Portal Trainer → Status Review (modul tayang), My Contributions (publikasi tayang), dan `/experts/join` (expert terdaftar).
- **Notifikasi peserta** (`learning-notifications.server.ts`, tanpa migrasi): "Modul diperbarui ke versi N" ke peserta yang pendaftarannya disetujui sebelum versi itu tayang dan **belum lulus**. Tautannya menuju ruang belajar modul. Peserta yang sudah lulus sengaja tidak diberi tahu sampai mentor memutuskan apakah mereka wajib mengulang (butir 9).

**Uji:**
- PGlite 17/17: akses (pemilik, orang lain, approver, admin, reviewer sebelum/sesudah ditugaskan, tanpa login, anon tanpa EXECUTE), urutan versi, alasan dan penyetuju, v1 dari approve pertama, snapshot tidak terbuka (termasuk kontak expert), versi hasil sinkron ulang, belum tayang, jenis tanpa versi, migrasi bisa diulang. Satu bug saya sendiri ketemu di sini: `published` bernilai null untuk konten yang belum tayang; sudah diperbaiki.
- `tsc` dan `build` lulus.
- Uji langsung baru `npm run test:version-history` (16 cek; bagian notifikasi memanggil aplikasi yang berjalan, `npm run dev`). **Sebelum migrasi (intern-update, 22 Okt): 10/16.** Semua cek notifikasi lulus: peserta aktif diberi tahu v2 dengan tautan yang benar; yang sudah lulus, yang mendaftar setelah v2, dan orang luar tidak. Cek riwayat versi gagal karena fungsinya belum ada. Data uji tersisa 0. **Sesudah migrasi dijalankan (intern-update, 22 Okt): 16/16.**

**Masih terbuka:** perlakuan bagi peserta yang sudah lulus saat modul naik versi (mentor, butir 9).

---

## 2y. Expert menjadi trainer otomatis hanya bila memilih peran "Trainer" (22 Okt)

**Acuan:** keputusan pemilik proyek 22 Okt (MENUNGGU_ARAHAN_MENTOR butir 4, menunggu konfirmasi mentor), Slide 39 (Kualifikasi Trainer), formulir Become an Expert (peran: Speaker, Trainer, Reviewer, Mentor, Technical Expert).

**Temuan (dibuktikan di PGlite dan di database intern-update):**
- `_expert_publish_from_subject` membuat **semua** expert yang disetujui menjadi trainer aktif, apa pun peran yang dipilih. Expert yang hanya memilih "Reviewer" pun bisa mengajukan modul pelatihan.
- `trainer_status_backfill_self` (dipanggil saat Portal Trainer dibuka) memberi status trainer aktif kepada expert mana pun yang belum punya status. Akibatnya jalur Kualifikasi Trainer (Slide 39) tidak pernah terpakai: 0 pengajuan di intern-update.

**Perbaikan (migrasi `20261022050000`):**
- `_expert_chose_trainer(payload)`: peran "Trainer" ada di `roles`, tanpa membedakan huruf besar/kecil.
- `_expert_publish_from_subject`: status trainer pertama dibuat **hanya bila expert memilih Trainer**. Selebihnya sama persis dengan versi `20261015090000` (dicek baris per baris; hanya blok status trainer yang berbeda).
- `trainer_status_backfill_self`: aturan yang sama.
- Expert yang tidak memilih Trainer tetap tayang dengan role expert, melihat "Trainer qualification required" di portal, lalu mengajukan lewat `/experts/trainer-application` (alur yang sudah ada).
- Status trainer yang sudah ada **tidak dicabut**. Pembaruan profil yang menambah peran Trainer dan disetujui verifikator membuat expert itu menjadi trainer.
- 4 expert di intern-update semuanya memilih Trainer, jadi datanya tidak berubah.

**Uji:**
- PGlite 11/11: bug terbukti di fungsi lama; tidak memilih Trainer berarti tetap expert tanpa status trainer; memilih Trainer berarti aktif; huruf kecil/spasi dikenali; portal tidak memberi status ke non-Trainer; Trainer tanpa baris status dipulihkan; pembaruan menambah Trainer; status lama tidak dicabut; publikasi profil tetap; migrasi bisa diulang.
- PGlite pembaruan profil expert (2w) tetap 47/47.
- `tsc` dan `build` lulus.
- Uji langsung baru `npm run test:trainer-choice` (5 cek). **Sebelum migrasi (intern-update, 22 Okt): 2/5**: expert yang memilih Reviewer dan Speaker menjadi trainer aktif dan tidak bisa mengajukan Kualifikasi Trainer. Data uji tersisa 0. **Sesudah migrasi dijalankan (intern-update, 22 Okt): 5/5**, dan 4 expert asli tetap trainer aktif.

**Uji gabungan setelah migrasi 2w, 2x, 2y (intern-update, 22 Okt):** expert-profile-update 19, trainer-choice 5, version-history 16, expert-rpc 64 (versi baru), knowledge-update 19, kr-rpc 24, kh-roles 20, admin-module-revision 18, module-update 24, training-requests 33, lifecycle 14, participant-rpc 27, expert-role-lock 10, review-lockdown 13, learning-progress 12, console-roles dan console-decisions lulus, rbac 820. Akun uji tersisa 0, total akun 27.

---

## 3. Migrasi yang harus dijalankan

**Database main dan intern-update adalah dua database Supabase berbeda.** Migrasi yang ditempel manual di SQL Editor tidak meninggalkan catatan, jadi gunakan pengecek:

1. Buka `supabase/check_migrations.sql`, tempel di SQL Editor database yang ingin diperiksa, lalu Run. (Hanya membaca, tidak mengubah apa pun.)
2. Hasilnya satu baris per migrasi (54 baris): `OK` atau `BELUM DIJALANKAN`.
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
- `20261015050000_expert_config_notifications_duplicates.sql` (kuota level di tabel, penanda baca notifikasi, cek duplikat expert)
- `20261015060000_expert_decision_atomic.sql` (keputusan/arsip/revisi expert atomik)
- `20261015070000_expert_direct_write_lockdown.sql` (tutup tulis langsung dari browser)
- `20261015080000_expert_uniqueness_guards.sql` (indeks unik expert, isi kontak privat lama)
- `20261015090000_expert_language_taxonomy.sql` (bahasa expert dipetakan ke taksonomi bahasa)
- `20261015100000_review_subjects_archived_status.sql` (status `archived` pada review_subjects; mengulang 20261006110000 yang ternyata belum berlaku di database intern-update)
- `20261020010000_participant_learning_integrity.sql` (pendaftaran, progres, sertifikat peserta lewat RPC; verifikasi sertifikat)
- `20261020020000_module_content_access.sql` (isi belajar modul hanya untuk peserta disetujui, penulis, admin; boleh dijalankan sebelum atau sesudah 030000)
- `20261020030000_expert_profile_ownership.sql` (satu aturan pemilik profil expert; perbaikan terbit langsung admin)
- `20261020040000_participant_biodata_selfpaced_integrity.sql` (biodata dan progres pelatihan mandiri lewat RPC tervalidasi)
- `20261020050000_security_hardening_views_internal_functions.sql` (tutup tulis lewat view `languages` dan fungsi internal yang terbuka untuk publik)
- `20261020060000_knowledge_resource_decision_atomic.sql` (keputusan publikasi Knowledge Hub dalam satu transaksi)
- `20261020070000_retire_legacy_role_system.sql` (peran hanya dari sistem baru; jalur keputusan generik menolak expert/modul/Knowledge Hub). Untuk main: pastikan admin main ada di `rbac_user_roles` dulu.
- `20261021010000_module_material_metadata_privacy.sql` (pengunjung tidak bisa membaca `module_registry.metadata`; salinan Knowledge Hub modul tanpa materi; versi Knowledge Hub modul tidak publik). Batal sendiri tanpa perubahan bila masih ada policy/view/fungsi yang membaca kolom itu dengan hak pengguna.
- `20261021020000_governance_role_alignment.sql` (peran resmi `reviewer`/`approver` dikenali sebagai `qa_reviewer`/`management`; pengaman penugasan reviewer). Approver mendapat hak management lama; lihat Nomor 8 di bagian 2l.
- `20261021030000_retire_legacy_governance_role_codes.sql` (hapus kode peran lama `qa_reviewer`/`management`; pemegang qa_reviewer dipindah ke reviewer). Jalankan SETELAH `20261021020000`. Batal tanpa perubahan bila ada pemegang `management` yang bukan admin: di database main periksa dulu siapa pemegangnya.
- `20261021040000_rbac_role_catalog_readable.sql` (katalog peran `rbac_roles` terbaca pengguna login; tanpa ini semua pemeriksaan akses non-admin di Verifikasi Expert/Modul/Publikasi/Persetujuan Peserta selalu menolak). Lihat bagian 2o.
- `20261021050000_knowledge_resource_submission_rules.sql` (aturan pengajuan Knowledge Hub di database: lokasi berkas milik pengaju, batas ukuran, isian per jenis). Lihat Nomor 7 di bagian 2l.
- `20261021060000_revoke_anon_write_grants.sql` (cabut izin tulis pengunjung tanpa login di semua tabel dan view). Lihat Nomor 6.
- `20261021070000_auth_user_fk_set_null.sql` (catatan pelaku dikosongkan saat akun dihapus). Lihat Nomor 5.
- `20261021080000_expert_role_flow_only.sql` (peran `expert` tidak bisa dicentang/dicabut manual; hanya lewat persetujuan pendaftaran dan arsip expert). Lihat bagian 2p.
- `20261021090000_review_direct_write_lockdown.sql` (status pengajuan dan penugasan reviewer tidak bisa ditulis langsung dari browser; konflik kepentingan lewat RPC). Lihat bagian 2q. Butuh kode branch ini (tombol "nyatakan konflik" memakai RPC baru).
- `20261021100000_learning_progress_server_record.sql` (kelulusan modul hanya dicatat server dari kuis resmi; percobaan kuis; ringkasan trainer). Lihat bagian 2r. Butuh kode branch ini; kode lama tetap jalan tetapi kelulusan dari browser tidak lagi tersimpan.
- `20261021110000_workflow_status_history_sla.sql` (riwayat status semua pengajuan lewat trigger; SLA per langkah; pemohon menarik permintaan pelatihan). Lihat bagian 2s. Kode branch ini tetap jalan tanpa migrasi ini (riwayat dan SLA kosong; tombol tarik error dengan jelas).
- `20261021120000_trainer_module_update.sql` (trainer membuka/membatalkan pembaruan modul tayangnya sendiri). Lihat bagian 2t. Tanpa migrasi ini tombol "Ajukan Pembaruan" menampilkan error; fitur lain tidak terpengaruh.
- `20261022010000_admin_module_revision_live_source.sql` ("Buka revisi modul tayang" oleh approver/admin mulai dari versi tayang; ditolak bila kiriman trainer menunggu keputusan). Lihat bagian 2u. Kode lama tetap jalan.
- `20261022020000_knowledge_resource_live_during_revision.sql` (publikasi Knowledge Hub tetap tayang selama revisi/pembaruan; kontributor membuka/membatalkan pembaruan; 1 publikasi yang tersembunyi karena permintaan revisi ditayangkan kembali). Lihat bagian 2v. Butuh kode branch ini untuk tombol pembaruan dan label konsol; setelah migrasi `test:kr-rpc` versi branch ini yang berlaku.
- `20261022030000_expert_profile_update.sql` (expert memperbarui profilnya lewat review; profil, role, dan trainer tidak dicabut selama revisi/pembaruan). Lihat bagian 2w. Butuh kode branch ini untuk tombol pembaruan; setelah migrasi `test:expert-rpc` versi branch ini yang berlaku.
- `20261022040000_content_version_history.sql` (riwayat versi modul/publikasi/profil expert, baca saja). Lihat bagian 2x. Tanpa migrasi ini panel "Riwayat Versi" menampilkan pesan migrasi; fitur lain tidak terpengaruh.
- `20261022050000_trainer_role_from_expert_choice.sql` (expert jadi trainer otomatis hanya bila memilih peran Trainer). Lihat bagian 2y. Tidak mengubah data yang ada.

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

- **PDF 13 modul Master masih aset publik Lovable** (bagian 2i). Perlu file PDF aslinya untuk dipindah ke penyimpanan privat.
- **My Learning menghapus aplikasi African Countries dari browser** setiap kali dibuka (bagian 2i). Perlu keputusan: apakah program ini memang sudah tidak dipakai?
- **Role participant tanpa persetujuan admin.** Menyimpan biodata langsung memberi role participant, sedangkan flowchart PB-ACA-03 menyebut role diberikan saat admin menyetujui. Perlu keputusan.
- **Expert yang disetujui otomatis menjadi trainer aktif.** Slide 39 menyiratkan persetujuan trainer terpisah. Perlu keputusan.
- **Expert tidak bisa mundur setelah Accept** pada permintaan layanan; hanya admin yang bisa membatalkan.
- Notifikasi dalam aplikasi sudah mencakup permintaan layanan dan kualifikasi trainer; notifikasi email/chat belum ada.
- Kuota peserta yang disebut di flowchart belum dicek di kode.
- Antrean Verifikasi Expert sudah aman untuk data besar (dibaca bertahap), tetapi tampilannya masih memuat semua baris sekaligus; paginasi tampilan bisa ditambahkan bila jumlah pengajuan sudah ribuan.
- `src/integrations/supabase/types.ts` disinkronkan manual; sebaiknya dibuat ulang lewat Supabase CLI (`npx supabase login`, lalu `npx supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts`).
- 58 akun sisa tes lama (`@example.test`) sudah dihapus dari database intern-update (17 Oktober 2026) bersama 350 baris log aktivitasnya; tersisa 24 akun pengguna asli.
- Kelulusan kuis dan sertifikat peserta masih dicatat di `localStorage` browser (Slide 15: tidak boleh penyimpanan lokal di frontend). Penilaian kuisnya sudah di server.
- Pertanyaan untuk mentor: apakah "publisher" harus terpisah dari "approver"? Saat ini approve langsung menayangkan modul.
- Belum diuji manual di browser: pengiriman modul trainer, keputusan modul oleh approver, dan kuis peserta setelah kunci jawaban dipindah.