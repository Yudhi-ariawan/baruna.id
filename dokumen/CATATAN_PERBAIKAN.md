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
- Default privileges tidak diubah: tabel baru yang dibuat sesudahnya mendapat izin bawaan lagi; terlihat di `audit_security.sql` kategori 3 dan baris 44 pengecek (jalankan ulang migrasi ini).
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
- ~~Approver ikut bisa menulis daftar keahlian/peran expert/bahasa dan aturan level trainer (policy lama admin|management). Usul: khusus admin; menunggu keputusan.~~ Slide 16 memberi Approver akses penuh pada Experts/Academy, jadi tetap boleh, tetapi kini lewat Data Master dengan validasi dan audit (bagian 2aa).
- ~~"My Training Requests" (`academy.training-requests.*`) membaca salinan di browser + contoh palsu; keputusan approver tidak terlihat peminta.~~ Diperbaiki di bagian 2s.
- ~~`createUser` (Tambah User) mengabaikan peran yang gagal diberikan tanpa pesan.~~ Diperbaiki di bagian 2z.
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

**Masih terbuka:** peserta yang sudah lulus versi lama tetap lulus dan belum diberi tahu saat ada versi baru (kebijakan, tanya mentor). ~~Halaman riwayat versi (v1, v2, …) untuk trainer/admin belum ada.~~ Selesai di bagian 2x (22 Okt), termasuk notifikasi untuk peserta yang sedang belajar.

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

## 2z. "Tambah User" tidak lagi diam-diam gagal memberi peran (23 Okt)

**Acuan:** Slide 16 (Admin mengelola user dan role), temuan "createUser mengabaikan peran yang gagal" (bagian 2q) dan AUDIT_PERAN (admin vs super admin).

**Temuan (dibuktikan langsung lewat aplikasi yang berjalan, kode lama):**
- "Tambah User" butuh izin `users.invite`, tetapi pemberian peran (`assign_rbac_role`) butuh `users.assign_role`, yang di database **hanya dimiliki Super Admin**.
- Bila admin biasa membuat akun dengan peran, misalnya reviewer:
  - akun **tetap dibuat tanpa peran itu**;
  - kegagalannya hanya tercatat di log server, tanpa pesan di layar;
  - audit trail mencatat peran itu seolah berhasil diberikan.
- Akar masalahnya: pemeriksa izin aplikasi (`hasPermission`) menganggap admin punya semua izin, sehingga layar menawarkan centang peran dan tombol "Simpan Perubahan Peran" kepada admin biasa, padahal database selalu menolaknya.
- Pembaruan data profil setelah akun dibuat juga tidak dicek error-nya.

**Perbaikan (tanpa migrasi):**
- `canAssignRoles` dibaca dari database (`current_user_has_permission('users.assign_role')`), aturan yang sama dengan `assign_rbac_role`.
- `createUser` menolak **sebelum akun dibuat** bila ada peran selain Registered User dan pembuat akun tidak berhak (`role_assignment_forbidden`, pesan berbahasa Indonesia). Akun tidak dibuat setengah jadi.
- Registered User tidak diberikan ulang, karena peran itu sudah otomatis dari trigger pendaftaran.
- Bila akun sudah dibuat tetapi ada peran atau data profil yang gagal disimpan:
  - dialog ditutup, sehingga tidak terjadi percobaan ganda;
  - layar menampilkan apa yang gagal dan alasannya;
  - audit mencatat peran yang benar-benar diberikan beserta yang gagal.
- **Dialog Tambah User:** untuk admin biasa, peran selain Registered User dinonaktifkan dengan penjelasan.
- **Detail akun:** admin biasa melihat peran dalam mode baca saja dengan catatan "Perubahan peran hanya dapat dilakukan oleh Super Admin". Tombol yang sebelumnya selalu gagal tidak lagi ditampilkan.

**Uji:**
- `tsc` dan `build` lulus.
- Uji langsung baru `npm run test:create-user` (9 cek, lewat aplikasi yang berjalan dengan akun admin dan super admin sementara).
  - **Kode lama: 4/9.** Admin biasa diberi izin memberi peran di layar, dan permintaan peran reviewer menghasilkan akun tanpa peran itu dan tanpa pesan.
  - **Kode baru: 9/9.** Admin biasa ditolak sebelum akun dibuat; Registered User saja berhasil; super admin memberi reviewer dan peran di database sesuai; audit mencatat peran yang benar.
  - Akun uji tersisa 0.
- Catatan uji: server dev baru mengenali server function setelah halaman pemakainya dimuat, jadi skrip membuka `/admin/users` dulu.

---

## 2aa. Data Master: bidang keahlian expert dan aturan level trainer (23 Okt)

**Acuan:** Slide 16 (Approver dan Admin: akses penuh pada domain Experts dan Academy), ENGINEERING_STANDARDS (data master tidak ditulis tetap di kode), Slide 13 (konten tayang hanya berubah lewat review).

**Temuan (dibuktikan di database intern-update):**
- Daftar bidang keahlian di formulir *Become an Expert* ditulis tetap di kode (15 bidang). Tabel `expertise_taxonomy` berisi 9 bidang lain yang tidak pernah dipakai formulir, sehingga **9 bidang formulir tidak ada di database**. Tidak ada halaman untuk mengubah daftar.
- Aturan level trainer (`trainer_level_rules`) hanya bisa diubah lewat SQL Editor. Selain itu, **approver bisa menulis tabel itu langsung lewat API tanpa audit trail** (kebijakan lama admin|management).
- Isi bidang keahlian pada pengajuan expert tidak diperiksa: **bidang karangan diterima** saat dikirim dan bisa tayang di direktori.

**Perbaikan (migrasi `20261023010000`):**
- **Data:** 15 bidang formulir dimasukkan dengan urutan formulir dan aktif. Tiga bidang bawaan tabel yang tidak pernah tampil (Ocean Governance, Fisheries Surveillance, Fish Processing and Value Addition) dinonaktifkan bila tidak dipakai. Nilai yang sudah dipakai profil tetapi tidak ada di daftar ditambahkan sebagai nonaktif. **Tidak ada baris yang dihapus.** Bila Data Master sudah pernah dipakai, menjalankan ulang migrasi tidak menimpa perubahan.
- **Tulis langsung ditutup** (kebijakan lama dihapus, izin tulis dicabut). Perubahan hanya lewat RPC yang memeriksa peran (Super Admin, Admin, Approver) dan selalu tercatat di audit trail.
- **Bidang keahlian** (`master_expertise_save`, `master_expertise_set_active`):
  - Nama 2–120 karakter, unik (huruf besar/kecil dan spasi tidak dibedakan).
  - Bidang yang **sudah dipakai profil atau pengajuan tidak bisa diganti namanya**, karena profil yang tayang menyimpan nama itu dan mengubahnya tanpa review menyalahi Slide 13. Cara yang benar: nonaktifkan, lalu buat bidang baru.
  - Bidang aktif terakhir tidak bisa dinonaktifkan. Menonaktifkan tidak mengubah profil yang ada.
- **Aturan level trainer** (`master_trainer_levels_set`):
  - Disimpan **berversi**: versi lama ditutup, versi baru berlaku, riwayat tetap ada. Semua pembaca (direktori, Portal Trainer) sudah memilih versi yang berlaku.
  - Keempat level wajib, angka bulat 1–1.000.000 naik berurutan, alasan perubahan wajib. Simpan tanpa perubahan ditolak.
- **Pengajuan expert:** saat dikirim, setiap bidang wajib ada di daftar (maksimal 20). Bidang nonaktif yang sudah dipakai tetap diterima, sehingga profil lama bisa diperbarui. Menyimpan draf tidak terpengaruh.
- **Aplikasi:**
  - Menu **Data Master** di Konsol Kurasi untuk Approver dan Admin: tambah, ubah, aktif/nonaktif bidang (dengan jumlah pemakaian), dan aturan level trainer dengan riwayat versi.
  - Formulir *Become an Expert* membaca daftar dari Data Master. Bidang yang sudah dipilih tetapi nonaktif tetap terlihat (bertanda) supaya bisa dibiarkan atau dihapus.
  - Daftar di kode (`EXPERTISE_AREAS`) dihapus. Daftar **peran** expert tetap di kode, karena dipakai aturan sistem (peran Trainer menentukan status trainer).
- Skrip uji `test:expert-rpc`, `test:expert-profile-update`, dan `test:trainer-choice` memakai bidang "Aquaculture", karena "Oseanografi" tidak ada di daftar dan kini ditolak.

**Uji:**
- PGlite 45/45:
  - **Penyelarasan data:** 15 bidang aktif sesuai urutan; bidang bawaan tak dipakai dinonaktifkan, yang dipakai tetap aktif; nilai lama ditambahkan nonaktif; tidak ada yang dihapus.
  - **Hak akses:** pengguna biasa ditolak; tulis langsung ditolak di kedua tabel.
  - **Bidang:** tambah, nama ganda, panjang, karakter kontrol, deskripsi, ganti nama saat belum/sudah dipakai, nonaktif/aktif, aktif terakhir, audit.
  - **Level trainer:** jumlah level, level ganda, tidak naik, pecahan, nol, terlalu besar, alasan, tanpa perubahan, versi baru dan riwayat.
  - **Pengajuan:** bidang dari daftar, di luar daftar, nonaktif yang dipakai, lebih dari 20, simpan draf.
  - **Jalankan ulang** tidak menimpa perubahan.
- PGlite pembaruan profil expert tetap 47/47.
- `tsc` dan `build` lulus.
- Uji langsung baru `npm run test:master-data`. **Sebelum migrasi (intern-update, 23 Okt): 2/15**: 9 bidang formulir tidak ada, approver bisa menulis aturan level langsung, bidang karangan diterima saat dikirim, dan RPC belum ada. Aturan level asli tidak berubah (penulisan uji memakai nilai yang sama), dan data uji tersisa 0. **Sesudah migrasi dijalankan (intern-update, 23 Okt): 15/15.**

Pada percobaan pertama sesudah migrasi, satu cek di skrip uji keliru. Angka yang dimaksud "tidak naik" ternyata naik (7/8/9/10), sehingga fungsi dengan benar menyimpannya sebagai versi 2, dan pembersihan skrip tidak menghapusnya. Empat baris sisa itu dihapus berdasarkan ID-nya. Skrip kini memakai angka yang benar-benar turun, dan pembersihannya menghapus semua versi buatan akun uji lalu membuka kembali baris yang berlaku sebelum uji. Aturan level kembali tepat seperti semula (hanya versi 1: 30/100/1.000/10.001).

**Uji gabungan setelah migrasi:** master-data 15, expert-rpc 64, expert-profile-update 19, trainer-choice 5, create-user 9, version-history 16, knowledge-update 19, kr-rpc 24, kh-roles 20, admin-module-revision 18, module-update 24, training-requests 33, lifecycle 14, participant-rpc 27, expert-role-lock 10, review-lockdown 13, learning-progress 12, console-roles dan console-decisions lulus, rbac 820. Akun uji tersisa 0 (3 akun dari satu uji yang terputus sudah dihapus), total akun 27, bidang aktif 15.

**Untuk mentor:** di Slide 16, Operator juga punya akses penuh pada Experts dan Academy. Apakah Operator juga boleh mengelola Data Master?

---

## 2ab. Data Master: kuota modul per level trainer (23 Okt)

**Acuan:** Slide 26 dan 39 (data dikelola lewat Admin Console, tidak hard-coded, setiap perubahan masuk audit trail), Slide 16 (Approver dan Admin: akses penuh pada Experts dan Academy).

**Temuan (dibuktikan di database intern-update):**
- Batas modul aktif per level trainer sudah disimpan di tabel `trainer_level_module_limits` (Certified 2, Advanced 5, Senior 10, Master 999) dan dipakai saat trainer membuat modul.
- Komentar migrasi `20261015050000` menyebut nilainya "bisa diubah admin tanpa migrasi", tetapi **tidak ada RPC maupun halaman untuk mengubahnya**. Satu-satunya cara adalah SQL Editor, tanpa validasi dan tanpa audit trail.

**Perbaikan (migrasi `20261023020000`):**
- **Tulis langsung dicabut** dari anon/authenticated. RLS memang sudah tidak punya policy tulis; ini lapis kedua.
- **Data:** baris keempat level dipastikan ada. Nilai yang sudah ada tidak diubah, dan menjalankan ulang migrasi tidak menimpa perubahan.
- **`master_module_limits_set`** (Super Admin, Admin, Approver):
  - Keempat level wajib diisi, berupa bilangan bulat 1–9.999.
  - Level yang lebih tinggi tidak boleh mendapat kuota lebih kecil (boleh sama).
  - Alasan perubahan wajib diisi. Simpan tanpa perubahan ditolak.
  - Layar mengirim nilai yang dilihatnya. Bila nilai itu sudah diubah orang lain (perangkat atau kurator lain), simpan ditolak sehingga tidak ada yang tertimpa diam-diam. Layar lalu memuat nilai terbaru.
  - Setiap perubahan tercatat di audit trail: pelaku, nilai sebelum, nilai sesudah, dan alasan.
- **`master_module_limits_overview`:** kuota yang berlaku, jumlah trainer aktif per level, dan 20 perubahan terakhir.
- Kuota trainer yang **belum punya level tetap 0** dan tidak bisa diubah di sini (aturan `20261015050000`).
- **Menurunkan kuota tidak menarik modul yang sudah ada.** Trainer yang sudah melewati kuota baru hanya tidak bisa membuat modul baru. Layar menampilkan peringatan ini saat kuota diturunkan.
- **Aplikasi:** panel **Kuota Modul per Level Trainer** di Konsol Kurasi → Data Master, dengan jumlah trainer aktif per level dan riwayat perubahan.

**Uji:**
- PGlite 29/29:
  - **Sebelum migrasi:** tidak ada RPC untuk mengubah kuota.
  - **Hak akses:** pengguna biasa dan tanpa login ditolak; tulis langsung ditolak.
  - **Validasi:** level kurang, kunci di luar 4 level, kuota 0, lebih dari 9.999, pecahan, teks, negatif, level lebih tinggi lebih kecil, tanpa perubahan, nilai acuan berbeda atau kosong. Semua penolakan tidak mengubah data.
  - **Simpan:** fungsi kuota pembuatan modul langsung memakai nilai baru; audit trail lengkap; admin dengan layar lama ditolak.
  - **Ringkasan:** trainer aktif dihitung dari status terbaru (yang ditangguhkan tidak dihitung); riwayat terbaru tampil di atas.
  - **Jalankan ulang** migrasi tidak menimpa kuota.
- `tsc` dan `build` lulus.
- Uji langsung baru `npm run test:module-limits`. **Sebelum migrasi (intern-update, 23 Okt): 2/18**, karena RPC belum ada. Kuota asli 2/5/10/999 tidak berubah, dan data uji tersisa 0. Uji ini juga mencakup dua penyimpanan bersamaan dari dua akun: tepat satu yang tersimpan. **Sesudah migrasi dijalankan (intern-update, 23 Okt): 18/18**, termasuk simpan bersamaan (satu tersimpan, satu ditolak `module_limits_stale`) dan kuota pembuatan modul langsung memakai nilai baru. Kuota dikembalikan ke 2/5/10/999 dan catatan audit uji dihapus.

**Uji gabungan setelah migrasi:** module-limits 18, master-data 15, expert-rpc 64, expert-profile-update 19, trainer-choice 5, create-user 9, version-history 16, knowledge-update 19, kr-rpc 24, kh-roles 20, admin-module-revision 18, module-update 24, training-requests 33, lifecycle, participant-rpc 27, expert-role-lock 10, review-lockdown 13, learning-progress 12, console-roles, console-decisions, dan rbac lulus. Akun uji tersisa 0, total akun 27.

---

## 2ad. Data Master: daftar trainer per level dan dampak perubahan kuota (2 Nov)

**Asal:** uji manual pemilik proyek (2 Nov). Panel Kuota Modul per Level Trainer (2ab) hanya menampilkan jumlah ("4 trainer aktif"), sehingga kurator tidak tahu siapa yang terdampak saat mengubah kuota.

**Perbaikan (migrasi `20261102010000`, baca saja, tidak mengubah data):**
- `master_trainer_quota_list()` untuk Super Admin, Admin, Approver: satu baris per trainer aktif yang punya level, dengan nama tampil, slug, level, modul aktif (tayang + menunggu keputusan), dan kuota.
- Angkanya diambil dari `_trainer_module_quota`, fungsi yang sama yang dipakai saat trainer membuat modul, jadi persis sama dengan yang dilihat trainer.
- Trainer yang statusnya aktif tetapi profilnya tidak tayang atau role expert-nya tidak aktif ditandai **Portal tidak aktif** (tidak bisa membuat modul). Ditampilkan, tidak diubah diam-diam.
- Tanpa email atau kontak.
- **Aplikasi:** di panel kuota, **Lihat trainer per level** (dimuat saat dibuka). Status per trainer: sisa kuota, kuota penuh, melewati kuota, atau portal tidak aktif. Saat angka kuota diubah tetapi belum disimpan, kolom **Bila disimpan** menunjukkan dampaknya per trainer. Level trainer tetap hanya diubah lewat Kualifikasi Trainer.

**Uji:**
- PGlite 13/13: hak akses (pengguna biasa, tanpa login, anon tanpa EXECUTE); hanya trainer aktif berlevel (ditangguhkan dan belum berlevel tidak ikut); urutan; hitungan tayang + menunggu (draf tidak dihitung); role expert tidak aktif ditandai; angka sama dengan `_trainer_module_quota`; tanpa email; kuota baru langsung terlihat; migrasi bisa diulang.
- `tsc` dan `build` lulus.
- Uji langsung baru `npm run test:trainer-quota-list` (5 cek, membandingkan setiap baris dengan `_trainer_module_quota` dan jumlah per level dengan ringkasan panel). **Sebelum migrasi (intern-update, 2 Nov): 1/5**, karena fungsinya belum ada. Akun uji tersisa 0. **Sesudah migrasi dijalankan (intern-update, 2 Nov): 5/5.** Daftar berisi 4 trainer Certified, masing-masing 1/2 modul, dan setiap baris sama dengan `_trainer_module_quota`. Uji lain tetap lulus: module-limits 18, master-data 15, expert-rpc 64, expert-profile-update 19, trainer-choice 5, knowledge-update 19, kr-rpc 24, kh-roles 20, admin-module-revision 18, module-update 24, training-requests 33, lifecycle, participant-rpc 27, expert-role-lock 10, review-lockdown 13, learning-progress 12, rbac. Akun uji tersisa 0, total akun 27.

---

## 2af. Data Master: topik Knowledge Hub (2 Nov)

**Acuan:** Slide 32 (objek *Taxonomy / Category*), Slide 33 (*Metadata & Taxonomy* dikelola Admin; Admin Console mengelola kategori), Slide 26/39/41 (tidak hard-coded).

**Temuan (dibuktikan di database intern-update):**
- 12 topik formulir *Contribute Knowledge* ditulis tetap di kode (`TOPIC_CATEGORIES`); tidak ada tempat untuk mengubahnya.
- Database tidak memeriksa topik sama sekali. Pengajuan dengan **topik karangan** maupun **tanpa topik** diterima saat dikirim, lalu bisa tayang di katalog.
- Data: 9 publikasi dan 5 draf. Satu topik di luar daftar sudah dipakai ("Konservasi Ekosistem Pesisir & Perikanan Berkelanjutan"). Publikasi jenis `module` menyimpan judul outline modul di kolom yang sama; itu bukan topik formulir dan tidak ikut dihitung.

**Perbaikan (migrasi `20261102020000`):**
- Tabel `kh_topic_taxonomy` (dibaca siapa saja; tulis hanya lewat RPC). 12 topik formulir dimasukkan dengan urutannya; topik lama yang sudah dipakai ditambahkan **nonaktif**. Tidak ada data publikasi yang diubah. Menjalankan ulang migrasi tidak menimpa perubahan kurator.
- `master_kh_topics_overview`, `master_kh_topic_save`, `master_kh_topic_set_active` untuk Super Admin, Admin, Approver, dengan aturan yang sama seperti bidang keahlian (2aa): nama unik, topik terpakai tidak bisa diganti nama, topik aktif terakhir dilindungi, audit trail.
- `_kr_payload_problem`: saat dikirim, topik **wajib** dan **harus ada di daftar** (aktif atau nonaktif, agar publikasi lama tetap bisa diperbarui). Kunci lama `topic` tetap dibaca. Isi fungsi selebihnya sama persis dengan `20261021050000`.
- **Aplikasi:**
  - Panel **Topik Knowledge Hub** di Konsol Kurasi → Data Master (dimuat terpisah; panel lain tetap jalan sebelum migrasi).
  - Formulir kontribusi membaca topik dari database. Topik yang sudah dipilih tetapi nonaktif tetap terlihat dengan tanda.
  - Panel bidang keahlian dan topik memakai satu komponen yang sama (`TaxonomyMasterPanel`); tampilan bidang keahlian tidak berubah.
  - `TOPIC_CATEGORIES` dihapus dari kode. Pesan galat ramah untuk `kr_topic_required` dan `kr_topic_unknown`.
- Skrip uji `test:knowledge-update` dan `test:kh-roles` kini memakai topik dari daftar; sebelumnya `test:kh-roles` memakai 8 topik karangan yang setelah migrasi akan ditolak.

**Uji:**
- PGlite 29/29: bukti celah sebelum migrasi; 12 topik aktif berurutan, topik lama nonaktif, outline modul tidak disalin; pengajuan (di luar daftar, tanpa topik, kosong, beda huruf/spasi, nonaktif lama, kunci lama); hak akses dan tulis langsung; pengunjung bisa membaca; kelola (pemakaian, tambah, ganda, terlalu pendek, ganti nama terpakai/belum, nonaktif, aktif terakhir, audit); jalankan ulang.
- `tsc` dan lint lulus.
- Uji langsung baru `npm run test:kh-topics` (12 cek). **Sebelum migrasi (intern-update, 2 Nov): 3/12**: tabel dan RPC belum ada; **topik karangan dan pengajuan tanpa topik diterima**. Data uji tersisa 0. **Sesudah migrasi dijalankan (intern-update, 2 Nov): 12/12**: topik karangan ditolak (`kr_topic_unknown`), tanpa topik ditolak (`kr_topic_required`), topik dari daftar diterima. Daftar berisi 12 topik aktif dan 1 topik lama nonaktif. Uji lain tetap lulus: kh-roles 20/20 dan knowledge-update 19 (skrip versi baru), kr-rpc 24, master-data 15, expert-rpc 64, expert-profile-update 19, module-update 24, admin-module-revision 18, training-requests 33, lifecycle, participant-rpc 27, review-lockdown 13, learning-progress 12, module-limits 18, trainer-quota-list 5, rbac. Akun uji tersisa 0, total akun 27.

**Diputuskan pemilik proyek (2 Nov): tetap dua daftar terpisah.** Alasannya:
- Isinya berbeda: bidang keahlian menjawab "orang ini ahli apa" (mis. Hatchery Management, Feed Development, Quality Assurance), sedangkan topik menjawab "dokumen ini tentang apa" (mis. Ocean Literacy, Capacity Development). Hanya sebagian yang sama.
- Satu perubahan tidak boleh tanpa sengaja mengubah dua formulir: bidang keahlian dipakai formulir Become an Expert, topik dipakai formulir Contribute Knowledge.
- Slide memisahkannya: *Expertise* adalah objek Experts (Slide 39), *Taxonomy / Category* adalah objek Knowledge Hub (Slide 32).
- Bila nanti dibutuhkan, keduanya bisa dihubungkan tanpa digabung (mis. menampilkan expert yang bidangnya sama dengan topik publikasi).

---

## 2ag. Data Master: satu daftar bahasa (2 Nov)

**Acuan:** Slide 32 (Metadata Record: bahasa), Slide 39 (Language & Communication), Slide 26/39/41 (tidak hard-coded, dikelola Admin Console, audit trail).

**Temuan (dibuktikan di database intern-update):**
- Tabel `languages_taxonomy` (17 bahasa, kode ISO) ada di database dan dipakai profil expert, tetapi **tidak ada di file migrasi repo**: database lain tidak mendapatkannya.
- **Approver bisa menulis tabel itu langsung lewat API** (uji memakai nilai yang sama, data tidak berubah).
- Daftar bahasa di kode berbeda-beda: formulir Knowledge Hub 8 pilihan (termasuk Swahili yang tidak ada di tabel, dan "Other"), Request a Training 5, tombol cepat Expert 7.
- Bahasa publikasi Knowledge Hub tidak diperiksa: **bahasa karangan dan tanpa bahasa diterima**. Datanya sudah tidak seragam ("Bahasa Indonesia", "Indonesian", "Bahasa Indonesia & Bahasa Inggris").
- Pemetaan bahasa expert hanya mengenali bahasa aktif: menonaktifkan satu bahasa akan membuat pembaruan profil yang memakainya diam-diam kehilangan bahasa itu.

**Perbaikan (migrasi `20261102030000`):**
- `languages_taxonomy` dibuat bila belum ada (kolom sama dengan yang ada); 17 bahasa + **Swahili** diisi tanpa mengubah baris yang sudah ada. Tulis langsung dicabut; baca tetap terbuka.
- `master_languages_overview`, `master_language_save`, `master_language_set_active` (Super Admin, Admin, Approver): kode ISO 639 unik dan **tidak bisa diubah** setelah dibuat (dipakai foreign key); nama unik; bahasa terpakai tidak bisa diganti nama (nama asli dan urutan tetap bisa); bahasa aktif terakhir dilindungi; audit trail.
- `_expert_language_code`: bahasa nonaktif tetap dikenali (yang aktif didahulukan).
- `_kr_payload_problem`: bahasa publikasi **wajib** dan **harus dikenali dari daftar** (nama, nama asli, kode, atau sebutan umum seperti "Bahasa Indonesia"/"Inggris"). "Other" tidak lagi diterima untuk publikasi.
- **Aplikasi:**
  - Panel **Bahasa** di Konsol Kurasi → Data Master.
  - Formulir Knowledge Hub dan Request a Training memakai daftar dari database (`LanguageSelect`). Request a Training tetap punya pilihan "Other" (tidak diperiksa database, hanya untuk perencanaan). Nilai lama yang tidak ada di daftar tetap terlihat dengan tanda.
  - Formulir Expert: tombol pilihan bahasa dari database (kemahiran mengikuti pilihan); ketik bebas tetap ada dengan saran dari daftar.
  - Daftar `LANGUAGES` di `resources.ts` dan `trainingRequests.ts` dihapus. Filter bahasa di katalog program (`academy.programs.tsx`) tidak diubah: nilainya mengikuti data katalog program, bukan formulir.
- Skrip uji `test:knowledge-update` dan `test:kh-topics` kini mengirim bahasa (`test:kh-roles` sudah).

**Uji:**
- PGlite 33/33: bukti celah; database seperti intern-update (17 tetap, Swahili ditambah, baris lama tidak diubah, izin tulis lama dicabut, pengguna tetap bisa membaca); pengajuan (di luar daftar, "Other", tanpa bahasa ditolak; English, Indonesian, Bahasa Indonesia, inggris, Swahili, Español, pt dikenali); kelola (pemakaian, kode varian, kode ganda, kode bukan ISO, nama ganda, ganti nama terpakai, kode tidak berubah, nonaktif tetap dikenali, aktif terakhir, audit, jalankan ulang); database baru (tabel dibuat, pemetaan bekerja).
- `tsc` dan lint lulus.
- Uji langsung baru `npm run test:languages` (12 cek). **Sebelum migrasi (intern-update, 2 Nov): 3/12**: Swahili belum ada; approver bisa menulis tabel langsung; RPC belum ada; **bahasa karangan dan tanpa bahasa diterima**. Data uji tersisa 0. **Sesudah migrasi dijalankan (intern-update, 2 Nov): 12/12**: 18 bahasa aktif (termasuk Swahili), tulis langsung ditolak, bahasa karangan ditolak (`kr_language_unknown`), tanpa bahasa ditolak (`kr_language_required`), "Bahasa Indonesia" diterima; bahasa terpakai ("Indonesian", 6 pemakaian) tidak bisa diganti nama. Data bahasa expert yang ada tetap utuh. Uji lain tetap lulus: expert-rpc 64, expert-profile-update 19, trainer-choice 5, expert-role-lock 10, kh-topics 12, kh-roles 20/20, knowledge-update 19, kr-rpc 24, master-data 15, module-update 24, admin-module-revision 18, training-requests 33, lifecycle, participant-rpc 27, review-lockdown 13, learning-progress 12, module-limits 18, trainer-quota-list 5, rbac. Akun uji tersisa 0, total akun 27.

---

## 2ah. Data Master: kategori pelatihan (2 Nov)

**Acuan:** Slide 12 (Request a Training: TNA, rekomendasi program), Slide 26/41 (tidak hard-coded). **Keputusan pemilik proyek (2 Nov):** daftar terpisah dari topik Knowledge Hub dan bidang keahlian.

**Temuan (dibuktikan di database intern-update):**
- 13 kategori (+ "Other") formulir Request a Training ditulis tetap di kode (`TRAINING_CATEGORIES`).
- Database tidak memeriksa kategori: `submit_draft_for_review` tidak punya cabang `training_need`. **Kategori karangan dan permintaan tanpa kategori diterima.**
- Data: 0 draf dan 0 permintaan pelatihan, jadi tidak ada data lama yang perlu diselaraskan.

**Perbaikan (migrasi `20261102040000`):**
- Tabel `training_category_taxonomy` (dibaca siapa saja, karena formulir bisa dibuka sebelum login; tulis hanya lewat RPC). 13 kategori diisi dengan urutan formulir. "Other" tidak masuk daftar, tetapi tetap diterima.
- `master_training_categories_overview` / `_save` / `_set_active`: diturunkan dari RPC topik Knowledge Hub yang sudah teruji (2af), hanya nama yang berbeda.
- `_training_need_payload_problem`: `proposed_topics` wajib 1–5 kategori; setiap kategori harus ada di daftar (aktif atau nonaktif) atau "Other".
- `submit_draft_for_review`: **sama persis** dengan `20261022020000` (dicek dengan `diff`: hanya 3 baris cabang `training_need` yang bertambah).
- **Aplikasi:** panel **Kategori Pelatihan** di Data Master (komponen `TaxonomyMasterPanel` yang sama); formulir Request a Training memakai `TrainingCategorySelect` (daftar dari database + "Other"; nilai lama yang tidak ditawarkan lagi tetap terlihat); `TRAINING_CATEGORIES` dihapus dari kode; pesan galat ramah untuk pengiriman baru dan kirim ulang.

**Uji:**
- PGlite 26/26: bukti celah; 13 kategori berurutan, kategori lama terpakai nonaktif, "Other" tidak masuk daftar; pengajuan (di luar daftar, tanpa kategori, daftar kosong, kosong, lebih dari 5, bukan teks ditolak; dari daftar, "Other", nonaktif lama diterima; jalur Knowledge Hub tetap memakai aturannya sendiri); kelola (hak akses, tulis langsung, pemakaian, tambah, ganti nama terpakai, nama ganda, nonaktif, audit, jalankan ulang); pengunjung bisa membaca.
- `tsc` dan lint lulus.
- Uji langsung baru `npm run test:training-categories` (12 cek). **Sebelum migrasi (intern-update, 2 Nov): 3/12**: tabel dan RPC belum ada; **kategori karangan dan tanpa kategori diterima**. Data uji tersisa 0. **Sesudah migrasi dijalankan (intern-update, 2 Nov): 12/12**: kategori karangan ditolak (`training_category_unknown`), tanpa kategori ditolak (`training_category_required`), kategori dari daftar dan "Other" diterima. Karena `submit_draft_for_review` dipakai semua jenis pengajuan, semua uji dijalankan ulang dan lulus: training-requests 33, review-lockdown 13, expert-rpc 64, expert-profile-update 19, trainer-choice 5, expert-role-lock 10, kh-topics 12, languages 12, kh-roles 20/20, knowledge-update 19, kr-rpc 24, master-data 15, module-update 24, admin-module-revision 18, lifecycle, participant-rpc 27, learning-progress 12, module-limits 18, trainer-quota-list 5, rbac. Akun uji tersisa 0, total akun 27.

---

## 2ai. Program Academy: Master Course, Master Module, Course Offering (4 Nov)

**Acuan:** PB-ACA-01 (Slide 20) dan PB-ACA-02 (Slide 21): draf dibuat Admin/Operator, divalidasi, direview, disetujui, baru aktif; wajib versioning; dikelola lewat Admin Console; data tidak hard-coded; audit trail. **Keputusan pemilik proyek (4 Nov):** cakupan Course + Modul + Offering; aktivasi wajib disetujui orang lain (bukan pembuatnya).

**Temuan (dibuktikan di database intern-update):**
- 3 Master Course, 4 modul, dan 4 offering hanya bisa dibaca aplikasi. **Tidak ada jalur tulis sama sekali** selain migrasi; layar admin belum ada.
- **Izin `academy.create` dan `academy.update` dimiliki hampir semua peran, termasuk participant dan registered_user**, sehingga tidak bisa dipakai menjaga layar admin. Di sini dipakai pemeriksaan peran langsung. Matriks izin itu sendiri tidak diubah (perlu ditinjau terpisah).
- **Kelulusan peserta menghitung semua modul course** (tanpa memandang status modul), dan kemajuan disimpan sebagai `module:<kode>`. Mengubah susunan modul course yang sudah dipakai akan mengubah kelulusan peserta.
- Dua program lama (AZA, Africa Fisheries) isinya ada di kode (`learning_engine_version = legacy`).

**Perbaikan (migrasi `20261104010000`):**
- `academy_program_drafts`: setiap pembuatan atau perubahan course/offering adalah **draf**. Data tayang tidak berubah sampai draf disetujui. Satu draf terbuka per course/offering.
- **Peran:** pembuat draf = Super Admin, Admin, **Operator**, Approver (Slide 16, 20). Pemutus = Super Admin, Admin, Approver, dan **bukan pembuat atau pengirim draf itu**.
- **Alur:** Draf → Kirim (divalidasi) → Setujui / Minta revisi (wajib alasan) / Tolak (wajib alasan); pembuat bisa menarik drafnya. Saat disetujui, validasi dijalankan ulang dan versi tayang dicek belum berubah.
- **Versioning:** `master_course_versions` dan `course_offering_versions` menyimpan snapshot setiap versi yang disetujui; `course_offerings.admin_version` baru.
- **Validasi Master Course:** kode (tetap setelah dibuat), judul, deskripsi, bahasa dari Data Master, template pembelajaran, 1–60 modul (kode unik, judul, jam 0–500).
- **Validasi Course Offering:** mengikuti batasan database yang sudah ada: self-paced hanya online dan wajib model akses; cohort wajib penanggung biaya (model biaya fee-based); delivery mode harus cocok dengan model belajar; urutan tanggal; evaluasi akhir wajib konteks. Kode offering dan Master Course tetap setelah dibuat.
- **Kunci setelah dipakai:** course yang sudah punya pendaftar/peserta tidak bisa ditambah, dihapus, atau diganti kode modulnya (judul, jam, urutan tetap bisa). Offering yang sudah punya pendaftar tidak bisa diubah model belajar, delivery mode, aturan pendaftaran, dan model biayanya (judul, angkatan, tanggal tetap bisa).
- **Program lama** (isi di kode) hanya bisa dilihat; offering baru tidak bisa dibuat di bawah course lama.
- **Offering baru** memakai mesin belajar bersama (`shared_v1`), terbuka di `/academy/course/<kode>`, dengan feature flag yang sesuai.
- **Status:** course aktif ↔ arsip (tidak bisa diarsipkan selama ada offering tayang atau draf terbuka); offering tayang ↔ selesai/ditutup (tidak bisa ditayangkan lagi bila course-nya diarsipkan). Hanya pemutus, wajib alasan.
- Tulis langsung ke `master_courses`, `master_modules`, `course_offerings`, `learning_feature_flags` dicabut dari anon/authenticated. Semua langkah tercatat di audit trail.
- **Aplikasi:** menu **Program Academy** di Konsol Kurasi (daftar draf dan antrean persetujuan, Master Course, Course Offering), editor draf course (dengan pengelola modul) dan offering, panel keputusan, riwayat versi. Uji peran konsol (`test:console-roles`) ikut memeriksa menu baru.

**Belum termasuk (sengaja):**
- ~~Katalog publik *All Programs* masih membaca data contoh di kode; offering yang disetujui dibuka lewat alamatnya sendiri.~~ Sudah dikerjakan di 2aj.
- Isi materi per modul (`content_reference`), kapasitas peserta, dan penugasan template evaluasi akhir belum diatur dari layar ini.
- Konversi Request a Training (TNA) menjadi draf Master Course (Slide 25).

**Uji:**
- PGlite 78/78: hak akses (registered user, participant walau punya izin academy.create, tanpa login), tulis langsung ditolak, tabel draf tertutup; validasi course (kode, kode ganda, judul, bahasa, template, tanpa modul, modul ganda, jam 0, jam teks); simpan dengan layar lama, orang lain mengubah draf; kirim, terkunci setelah dikirim, operator tidak bisa memutuskan, minta revisi wajib alasan, belum tayang selama revisi, kirim ulang, keputusan dari layar lama, setuju (v1, modul berurutan, version record), keputusan ganda; approver tidak bisa menyetujui drafnya sendiri, admin lain menolak; perubahan (dari versi tayang, draf kedua ditolak, tanpa perubahan ditolak, kode tetap, tayang tetap selama ditinjau, v2); offering (course lama, kode ganda, 12 kombinasi tidak valid, setuju, mesin bersama, batasan database, feature flag, offering self-paced); setelah ada peserta (modul tidak bisa ditambah/dihapus, judul/jam/urutan bisa, format offering terkunci, judul bisa, versi 2); **peserta mendaftar di antara pengiriman dan persetujuan: persetujuan menolak dan data tayang tidak berubah**; program lama hanya baca; status (operator tidak bisa, arsip ditolak selama ada offering tayang, selesai/tutup, arsip, tidak bisa tayang lagi, course arsip tidak bisa diubah); ringkasan; audit lengkap; migrasi bisa diulang.
- `tsc`, lint, dan `build` lulus.
- Uji langsung baru `npm run test:academy-programs` (21 cek). **Sebelum migrasi (intern-update, 4 Nov): 1/21**: RPC belum ada (tidak ada jalur tulis). Data uji tersisa 0. **Sesudah migrasi dijalankan (intern-update, 4 Nov): 21/21**: pengguna biasa ditolak; approver tidak bisa menulis `master_courses` langsung (*permission denied*); offering lama hanya baca; course baru v1 dengan modul berurutan; approver tidak bisa menyetujui drafnya sendiri; v2 oleh admin lain; offering tayang di mesin belajar bersama dan lolos semua batasan database; modul terkunci setelah ada pendaftar; course dengan offering tayang tidak bisa diarsipkan; audit tercatat. Uji lain tetap lulus: participant-rpc 27, learning-progress 12, lifecycle, training-requests 33, console-roles, console-decisions, create-user 9, version-history 16, module-update 24, admin-module-revision 18, review-lockdown 13, expert-rpc 64, expert-profile-update 19, trainer-choice 5, expert-role-lock 10, kh-topics 12, languages 12, training-categories 12, kh-roles 20/20, knowledge-update 19, kr-rpc 24, master-data 15, module-limits 18, trainer-quota-list 5, rbac. Akun uji tersisa 0; course, offering, dan draf kembali 3/4/0.

**Catatan uji `test:console-roles`:** sempat gagal 17 cek, juga di server dev yang baru dijalankan. Penyebabnya waktu di skrip uji, bukan kode: aplikasi membaca peran dengan `valid_from <= jam server aplikasi`, sedangkan `valid_from` diisi jam database. Jam laptop sedikit di belakang (di bawah satu detik), dan skrip memanggil aplikasi sesaat setelah memberi peran, sehingga peran baru belum dianggap berlaku. Skrip kini menunggu sampai jam laptop melewati `valid_from` peran yang baru diberikan; setelah itu lulus di kedua server. Di produksi efeknya paling lama sepersekian detik setelah peran diberikan.

## 2aj. Offering yang tayang muncul di katalog publik (4 Nov)

**Masalah (ditemukan saat uji manual):** offering yang disetujui di Program Academy tidak bisa ditemukan peserta. Tidak ada menu atau kartu yang menautkannya; satu-satunya jalan adalah mengetik `/academy/course/<kode>`. Halaman *Training* seluruhnya data contoh di kode, sedangkan *Self-Paced Courses* dan *All Programs* hanya membaca modul yang dipublikasikan.

**Perbaikan (tanpa migrasi):**
- Server function publik `listCatalogOfferings` (`src/lib/academy/catalog.functions.ts`) membaca dengan kunci publik (sama dengan halaman course). Yang tampil hanya offering yang **tayang** (`published`), course-nya **aktif**, **bukan program lama** (program lama sudah punya kartu sendiri, jadi tidak dobel), dan berjalan di mesin belajar bersama `shared_v1` (yang halaman course-nya memang berfungsi). Offering yang ditandai selesai/ditutup, atau course-nya diarsipkan, otomatis hilang dari katalog.
- Kartu bersama `PublishedOfferings.tsx`: judul course, judul offering/angkatan, deskripsi, jumlah modul dan total jam (dihitung dari Master Module), bahasa (dari daftar bahasa Data Master), aturan pendaftaran, jadwal dan masa pendaftaran. **Tidak ada rating atau jumlah peserta buatan.** Kartu menuju `/academy/course/<kode>`.
- Ditampilkan di: **Training** (offering berbasis angkatan), **Self-Paced Courses** (offering mandiri, ikut dihitung di "Courses Available"), dan **All Programs** (mengikuti filter tipe Training/Self-paced dan kotak pencarian; tidak tampil pada filter Webinar/Workshop/Certification).

**Uji:** `tsc` dan `build` lulus; lint tidak menambah peringatan (18 peringatan di `academy.programs.tsx` sudah ada sebelumnya). Dicek langsung di server dev 8080 terhadap data intern-update: `/academy/training` menampilkan *Uji Manual Budidaya Rumput Laut* (offering `of-uji-manual-2026`) dengan tautan benar, dan tidak ada kartu offering lama (AZA, Africa Fisheries, Ocean Literacy); `/academy/self-paced` tidak menampilkan bagian baru (belum ada offering mandiri dari layar admin, sesuai); `/academy/programs` tampil pada semua tipe, tipe Training, dan pencarian "rumput", serta tidak tampil pada tipe Webinar, Self-paced, dan pencarian "zzzz".

**Belum:** filter di sisi kiri halaman Training masih angka contoh; belum diperiksa apakah halaman course menolak offering yang sudah selesai/ditutup bila dibuka lewat alamat langsung (`getOfferingByCode` tidak menyaring status). Gambar sampul masih gambar bawaan, karena Master Course belum punya kolom sampul (dikerjakan di 2ak).

## 2ak. Gambar sampul Master Course (4 Nov)

**Masalah (ditemukan saat uji manual):** kartu katalog dari 2aj memakai satu gambar bawaan yang sama untuk semua course, padahal formulir Master Course tidak punya isian gambar. Pembuat course tidak bisa memilih gambarnya.

**Keputusan pengguna:** unggah berkas, maksimal 2 MB, PNG/JPG/WebP (sesuai batas gambar di AGENTS.md).

**Perbaikan (migrasi `20261104020000`):**
- **Unggah lewat server** (`src/lib/academy/program-cover.functions.ts`): hanya **pembuat draf** Master Course yang masih bisa diubah (draf atau diminta revisi), dicek lewat RPC `program_draft_get` yang sama dengan editor. Ukuran maksimal 2 MB. Jenis berkas dibaca dari *byte* awal (PNG/JPEG/WebP), bukan dari nama berkas atau jenis yang dikirim browser. Berkas disimpan di bucket publik yang sudah ada, `knowledge-module-covers`, folder `academy-courses/` dengan nama acak; **tidak ada bucket baru**. Server hanya mengembalikan lokasinya.
- **Database:** kolom `master_courses.cover_path` (CHECK: hanya `academy-courses/<32 hex>.png|jpg|webp`). `_program_cover_ok` memastikan berkas benar-benar ada di bucket itu, berjenis gambar, dan berukuran 1 byte–2 MB. Pemeriksaan berjalan saat draf **dikirim** dan sekali lagi saat **disetujui**: kalau berkas hilang di antaranya, persetujuan ditolak dan data tayang tidak berubah. Sampul ikut snapshot (draf perubahan terisi sampul yang tayang, perbandingan "belum ada perubahan" ikut sampul, riwayat versi mencatat sampul yang disetujui). Draf tanpa sampul menghapus sampul saat disetujui.
- **Formulir:** isian "Gambar sampul (opsional)" dengan pratinjau, tombol Unggah/Ganti/Hapus, dan pesan dalam bahasa Indonesia; pemutus melihat pratinjau yang sama saat meninjau.
- **Katalog:** kartu memakai sampul yang disetujui; tanpa sampul (atau gambar gagal dimuat) memakai gambar bawaan halaman. Sebelum migrasi dijalankan, katalog tetap tampil tanpa sampul (query diulang tanpa kolom itu).

**Uji:**
- PGlite 31/31: migrasi di atas 20261104010000 dan bisa diulang; course lama tetap tanpa sampul; CHECK menolak alamat di luar folder; berkas tidak ada, bucket lain, lebih dari 2 MB, bukan gambar, di luar folder, `../`, alamat web luar, angka, GIF ditolak; tepat 2 MB WebP diterima; belum tayang sebelum disetujui; v1 bersampul dan tercatat di riwayat versi; draf perubahan terisi sampul; tanpa perubahan ditolak; sampul lama tayang selama ditinjau; **berkas hilang sebelum disetujui: persetujuan menolak**, lalu berhasil setelah berkas ada; v2 sampul baru; hapus sampul (v3); kolom dan fungsi pemeriksa tidak bisa diakses langsung. Rangkaian Academy lama 78/78 tetap lulus dengan migrasi baru.
- `tsc` dan `build` lulus; lint bersih untuk berkas baru (galat lint lama di `participant-biodata.functions.ts` bukan dari perubahan ini).
- Uji langsung baru `npm run test:course-cover` (14 cek; memanggil aplikasi yang berjalan). **Sebelum migrasi (intern-update, 4 Nov): 10/14.** Unggah sudah benar: pengguna biasa dan approver yang bukan pembuat ditolak ("tidak berwenang"); PDF yang menyamar ditolak; lebih dari 2 MB ditolak; PNG sah tersimpan dan bisa dibuka publik sebagai `image/png`. Gagal 4, yaitu celah yang ditutup migrasi: alamat sampul palsu **diterima** saat dikirim, dan course yang disetujui tidak menyimpan sampul (`column master_courses.cover_path does not exist`), sehingga riwayat versi dan katalog juga tidak punya sampul. Data uji dan berkas uji bersih.

**Catatan:** berkas yang diunggah tetapi tidak jadi dipakai (diganti sebelum disimpan, atau drafnya ditarik) tetap tersimpan dengan nama acak yang tidak tertaut di mana pun. Pembersihan berkas yatim belum dibuat. Sebelum disetujui, gambar sudah ada di bucket publik, tetapi alamatnya hanya diketahui pembuat dan peninjau.

**Hasil sesudah migrasi (intern-update, 4 Nov):** `test:course-cover` **14/14** (alamat palsu ditolak `program_cover_invalid`; course, riwayat versi, dan katalog publik menyimpan/membaca sampul; tulis langsung ditolak `permission denied`). Uji lain tetap lulus: academy-programs 21, console-roles, console-decisions, participant-rpc 27, learning-progress 12, lifecycle (Flow 1: 7, Flow 2: 7), module-update 24, admin-module-revision 18, expert-rpc 64, kr-rpc 24, kh-roles 20, knowledge-update 19, kh-topics 12, languages 12, training-categories 12, master-data 15, module-limits 18, trainer-quota-list 5.

## 2al. Audit Program Academy: jalur ubah lama dan aturan pendaftaran buntu (4 Nov)

Audit atas permintaan pengguna (banyak pengguna, banyak peran, banyak perangkat, konflik dengan fitur lain).

**Sudah aman (diperiksa di kode):**
- *Banyak perangkat / dua tab:* simpan draf dan keputusan memakai `_expected_updated_at`; layar lama ditolak `program_draft_stale`. Satu draf terbuka per course/offering (unique index).
- *Balapan antarpengguna:* persetujuan course/offering yang sudah ada memakai advisory lock per target + `FOR UPDATE` + cek versi dasar (`program_stale`); persetujuan item baru diserialkan per jenis, jadi dua course baru berkode sama tidak bisa sama-sama lolos. Validasi dijalankan ulang saat disetujui (peserta yang mendaftar di antaranya, berkas sampul yang hilang). Arsip course ditolak selama ada offering tayang atau draf terbuka.
- *Peran:* setiap RPC memeriksa peran saat dipanggil (peran dicabut langsung berlaku); pemutus tidak bisa memutuskan draf yang ia buat atau kirim.
- *Pendaftaran peserta:* `learning_enrol` memeriksa status tayang dan masa pendaftaran di database, dengan kunci per peserta per offering.

**Celah yang ditemukan (dibuktikan `npm run test:academy-guards`, sebelum migrasi: 7/14 gagal):**
1. **Jalur ubah lama.** Enam RPC dari Phase 1.4 (`set_offering_classification`, `set_self_paced_access_model`, `set_cohort_financial_model`, `set_cohort_payment_responsibility`, `configure_completion_evaluation_requirement`, `assign_completion_evaluation_template`) bersifat SECURITY DEFINER dan hanya memeriksa "admin atau management" (approver termasuk). Uji membuktikan **satu approver** mengubah offering tayang menjadi tatap muka + wajib disetujui admin, dan satu admin mengganti penanggung biaya, tanpa draf, tanpa persetujuan orang lain, tanpa riwayat versi; `admin_version` tetap 1 sehingga draf yang sedang ditinjau akan menimpanya diam-diam. Aplikasi tidak memakai keenam fungsi ini.
2. **Aturan pendaftaran buntu.** Offering dari layar admin dengan "Wajib disetujui admin" / "Wajib hak akses khusus" (atau delivery mode Approved Self-Paced) diterima, padahal `learning_enrol` meminta pengajuan yang disetujui dan halaman course tidak punya tombol pengajuan. *Koreksi 10 Nov (2as):* jalur pengajuan sendiri (`course_enrollment_apply` → Persetujuan Peserta → `admin_course_enrollment_decide`) sudah ada dan sudah mengenali kode offering; yang kurang hanya tombolnya di halaman course.

**Perbaikan (migrasi `20261104030000`):** hak panggil keenam RPC dicabut dari anon/authenticated (service_role tetap, untuk SQL Editor); `_program_offering_problem` menolak `approval_required`, `entitlement_required`, dan `approved_self_paced` dengan `program_access_rule_unsupported` (berlaku saat dikirim dan saat disetujui). Formulir offering hanya menawarkan "Terbuka" dan "Wajib akun terdaftar", dengan keterangan alasannya; delivery mode Approved Self-Paced disembunyikan. Katalog kini memberi label **Enrolment closed** / **Enrolment opens <tanggal>** sesuai masa pendaftaran (aturan yang sama dengan `learning_enrol`), supaya kartu tidak terlihat bisa diikuti padahal ditolak.

**Uji:** PGlite 22/22 (bukti celah sebelum migrasi; migrasi bisa diulang; keenam fungsi tidak bisa dipanggil authenticated/anon, service_role tetap; aturan wajib disetujui, hak akses khusus, Approved Self-Paced ditolak; aturan tidak dikenal dan pemeriksaan lain tetap; terdaftar dan mandiri terbuka diterima; draf yang sudah terkirim sebelum migrasi ditolak saat disetujui dan data tayang tidak berubah). Rangkaian Academy lama 77/78 dengan migrasi baru: satu-satunya beda adalah cek yang mengharapkan `access_mode = application-required`, turunan dari aturan `approval_required` yang memang tidak lagi dipakai. Sampul 31/31. `tsc`, lint berkas yang diubah, `build` lulus.

**Belum (perlu keputusan/pekerjaan tersendiri):**
- Alur pengajuan pendaftaran untuk offering (formulir pengajuan + antrean Persetujuan Peserta) supaya "Wajib disetujui admin" bisa dibuka lagi.
- **Sertifikat untuk offering baru belum bisa didapat:** `check_certificate_eligibility` mensyaratkan baris di `evaluations`, yang hanya diisi `submitEvaluation`; fungsi itu sudah tidak dipanggil dari layar mana pun (lihat catatan di `useBackendEnrolment.ts`). Ini bagian topik Sertifikat yang ditunda pengguna.
- Template evaluasi akhir hanya bisa dipasang lewat SQL Editor (`assign_completion_evaluation_template`, kini service_role saja).
- Berkas sampul yatim belum dibersihkan otomatis (2ak).

**Antrean kerja berikutnya (dicatat 4 Nov, dikerjakan besok):**
1. ~~**Sertifikat untuk offering baru.**~~ Tahap 1 selesai 5 Nov (2an); syarat lulus resmi (kuis/penilaian) tetap menunggu mentor. Mulai dengan pemeriksaan kecil tanpa mengubah apa pun: apakah layar evaluasi akhir baru (`CompletionEvaluationSection`, `completion_evaluation_*`) cukup menggantikan syarat lama `evaluations` di `check_certificate_eligibility` (migrasi `20261020010000`). Syarat lulus resmi menunggu mentor (MENUNGGU_ARAHAN_MENTOR butir 12). Template sertifikat (STTP di `public/`) memuat data pribadi; usul versi kosong.
2. **Alur pengajuan pendaftaran untuk offering baru** (formulir pengajuan peserta + antrean Persetujuan Peserta), lalu buka lagi "Wajib disetujui admin" di formulir offering dan di `_program_offering_problem`. Butuh keputusan mentor (butir 12b).
3. ~~**Layar pemasangan template evaluasi akhir**~~ Selesai 5 Nov sebagai pilihan template di formulir offering (2an). Mengubah isi pertanyaan template belum (menunggu pertanyaan resmi dari mentor).
4. ~~Pembersihan berkas sampul yatim (prioritas rendah).~~ Selesai 5 Nov (2am).
5. Webinar dan Workshop (ditunda atas permintaan pengguna; delivery mode `live_webinar_workshop`).

## 2am. Pembersihan gambar sampul course yang tidak terpakai (5 Nov)

**Masalah (catatan 2ak):** gambar sampul yang diunggah lalu diganti atau dihapus sebelum disimpan, atau yang drafnya ditarik/ditolak, tetap tersimpan di bucket publik `knowledge-module-covers/academy-courses/` tanpa dipakai apa pun.

**Perbaikan (tanpa migrasi):** skrip pemeliharaan `npm run cleanup:course-covers` (`scripts/cleanup-course-covers.mjs`, kunci service role dari `.env`). Bawaannya **dry run** (hanya menampilkan daftar); menghapus dengan `-- --apply`. Sebuah berkas dihapus hanya bila semua syarat terpenuhi:
- berada di `academy-courses/` dan bernama seperti unggahan (`<32 hex>.png|jpg|webp`); sampul modul Knowledge Hub di folder `modules/` pada bucket yang sama tidak pernah disentuh;
- tidak dipakai Master Course mana pun (`master_courses.cover_path`);
- tidak dipakai draf yang masih terbuka (draf, dikirim, diminta revisi);
- tidak tercatat di riwayat versi (`master_course_versions`), supaya gambar versi lama tetap bisa dilihat;
- berumur lebih dari 24 jam (bisa dinaikkan dengan `--min-age-hours=`, minimal 1), supaya gambar yang baru diunggah di perangkat mana pun tetapi belum disimpan tidak ikut terhapus.

Rujukan dibaca ulang tepat sebelum menghapus (draf bisa baru disimpan di antaranya). Gambar dari draf yang ditolak atau ditarik dianggap tidak terpakai. Bila seseorang menyimpan draf dengan gambar yang sudah lebih dari 24 jam belum disimpan dan sudah dihapus, pengiriman ditolak `program_cover_invalid` ("unggah ulang gambarnya"), jadi tidak ada data rusak.

**Uji:** uji langsung baru `npm run test:course-cover-cleanup` (12 cek; mengunggah berkas uji sendiri dan membatasi pembersih hanya pada berkas itu): dengan batas 24 jam tidak ada yang dihapus; dry run tidak menghapus apa pun; kandidat hanya berkas yatim dan berkas dari draf ditolak; berkas yang dipakai course tayang, draf terbuka, dan riwayat versi disimpan; nama di luar pola disimpan; `--apply` menghapus tepat 2 berkas; sampul modul Knowledge Hub tidak tersentuh. Data dan berkas uji bersih. Dry run di intern-update (5 Nov): 0 berkas (belum ada sampul diunggah). `--min-age-hours=0` ditolak.

**Catatan:** belum dijadwalkan otomatis; jalankan berkala oleh admin (mis. seminggu sekali) atau dijadwalkan di server bila sudah ada penjadwal.

## 2an. Jalur sertifikat: syarat memakai evaluasi akhir, jalur evaluasi kosong ditutup, template dipilih di offering (5 Nov)

**Masalah (diperiksa 5 Nov di intern-update dengan course uji, sebagai peserta):**
1. **Buntu lewat tampilan.** `check_certificate_eligibility` (20261020010000) mensyaratkan baris di tabel lama `evaluations`, sedangkan halaman course memakai evaluasi akhir yang baru (`completion_evaluation_*`), yang tidak pernah mengisi tabel itu. Peserta yang menyelesaikan semua modul, **bahkan setelah mengirim evaluasi akhir di tab Evaluation**, selalu ditolak `evaluation_missing`.
2. **Celah.** `learning_evaluation_submit` bisa dipanggil peserta langsung dengan isian kosong `{}`; setelah itu sertifikat langsung terbit. Satu sertifikat uji sempat terbit lewat jalur ini (`BARUNA-COMPLETION-2026-000029`, lalu dihapus; nomornya tidak dipakai ulang). Terkait temuan audit peserta 20 Okt (P1).
3. **Template.** Formulir offering hanya punya "wajib evaluasi akhir" + konteks, tanpa template. Offering baru yang mewajibkan evaluasi tidak punya kuesioner (`start_completion_evaluation`: "no completion evaluation template assigned"). Template hanya bisa dipasang lewat SQL.
4. Halaman course menampilkan kode mentah (`Not yet eligible — evaluation_missing`), dan tombol "Issue certificate" tetap aktif walau belum memenuhi syarat.

**Perbaikan:**
- Migrasi `20261105010000`: syarat sertifikat = pendaftaran aktif, semua modul selesai, dan **bila offering mewajibkan evaluasi akhir**: offering punya template (`completion_evaluation_not_configured` bila tidak, urusan admin) dan peserta sudah **mengirim** evaluasinya (`completion_evaluation_missing`). Offering tanpa evaluasi akhir: cukup semua modul selesai. Tabel lama `evaluations` tidak lagi dipakai. Bentuk hasil tetap sama. `learning_evaluation_submit` dicabut dari anon/authenticated (service_role tetap).
- Migrasi `20261105020000`: payload offering punya `completion_evaluation_template_id`; wajib (template **aktif** dengan **konteks sama**) bila evaluasi diwajibkan, harus kosong bila tidak (`program_evaluation_template_required` / `_invalid` / `_not_applicable`), diperiksa saat dikirim dan disetujui. Template ikut snapshot dan riwayat versi dan diterapkan saat disetujui. Setelah offering punya pendaftar, wajib/tidaknya evaluasi, konteks, dan template ikut dikunci, supaya syarat sertifikat tidak berubah di tengah jalan. `program_overview` mengirim daftar template aktif.
- Aplikasi: formulir offering punya pilihan **Template evaluasi** (hanya template aktif dengan konteks yang dipilih; berganti konteks mengosongkan pilihan; terkunci setelah ada pendaftar). Halaman course menampilkan alasan dalam bahasa Indonesia (mis. "Kirim evaluasi akhir di tab Evaluation terlebih dahulu", "(1 dari 2 modul)") dan tombol sertifikat nonaktif sampai server menyatakan memenuhi syarat.

**Uji:**
- PGlite sertifikat 21/21: bukti celah sebelum migrasi (lewat tampilan ditolak; evaluasi kosong diterima lalu sertifikat terbit); migrasi bisa diulang; `learning_evaluation_submit` ditolak untuk peserta, service_role tetap; tanpa evaluasi: modul belum lengkap 1/2, lengkap memenuhi syarat tanpa tabel lama, sertifikat terbit; wajib evaluasi tanpa template: `completion_evaluation_not_configured` dan penerbitan ditolak; dengan template: belum kirim dan masih draf ditolak, peserta tidak bisa mengubah status evaluasi langsung, terkirim memenuhi syarat dan terbit; ditarik, tanpa modul, tidak ada, milik orang lain (RLS). Rangkaian peserta lama 42 cek tetap lulus (dua cek perilaku lama disesuaikan).
- PGlite template 21/21: bukti celah sebelum migrasi; daftar template aktif saja di formulir; tanpa template, konteks lain, tidak aktif, id rusak, tidak ada, template tanpa evaluasi ditolak; konteks tetap wajib; template cocok diterima, disetujui, tayang v1, tercatat di riwayat versi; offering tanpa evaluasi tetap bisa; draf perubahan terisi template; tanpa perubahan ditolak; evaluasi dimatikan sebelum ada peserta boleh (v2); setelah ada peserta syarat evaluasi terkunci, judul tetap bisa. Rangkaian Academy lama 77/78 (cek `access_mode` dari 2al).
- `tsc`, lint berkas yang diubah, `build` lulus.
- Uji langsung baru `npm run test:certificate-path` (17 cek, sebagai peserta + operator + approver). **Sebelum migrasi (intern-update, 5 Nov): 7/17.** Gagal 10: semua modul selesai tetap `evaluation_missing`; tombol sertifikat ditolak; evaluasi kosong `{}` **diterima**; offering wajib evaluasi: **setelah evaluasi akhir benar-benar dikirim tetap ditolak** `evaluation_missing`; offering tanpa template dan dengan template konteks lain **diterima**; template tidak pernah terpasang. Lulus 7, termasuk: peserta tidak bisa mengubah status evaluasi langsung (sudah aman). Data uji bersih.

**Hasil sesudah migrasi (intern-update, 5 Nov):** `test:certificate-path` **17/17**: offering tanpa evaluasi memenuhi syarat setelah semua modul dan sertifikat terbit; evaluasi kosong ditolak `permission denied`; offering wajib evaluasi ditolak `completion_evaluation_missing` sampai evaluasi akhir dikirim, lalu terbit; offering tanpa template ditolak `program_evaluation_template_required`, template konteks lain `program_evaluation_template_invalid`, template cocok terpasang setelah disetujui. Dua skrip uji lama disesuaikan dengan aturan baru: `test:participant-rpc` (salinan Ocean Literacy yang mewajibkan evaluasi: kini mengirim evaluasi akhir lewat tab Evaluation, dan memeriksa jalur lama ditutup) menjadi **28/28**; `test:academy-programs` (offering wajib evaluasi kini menyebut template) **21/21**. Uji lain tetap lulus: academy-guards 14, course-cover 14, course-cover-cleanup 12, learning-progress 12, lifecycle (Flow 1 dan 2), console-roles, console-decisions, module-update 24, admin-module-revision 18, expert-rpc 64, kr-rpc 24, kh-roles 20, knowledge-update 19, kh-topics 12, languages 12, training-categories 12, master-data 15, module-limits 18, trainer-quota-list 5, training-requests 33. Data uji bersih; nomor seri sertifikat 000030 dan 000031 terpakai oleh uji.

**Belum (menunggu mentor):** modul masih ditandai selesai oleh peserta sendiri (`learning_progress_mark`), belum wajib lulus kuis/penilaian (Slide 24); isi pertanyaan resmi template; jenis sertifikat selain *completion*. Sertifikat tetap berlabel "CONTOH / BELUM RESMI". Server function lama `submitEvaluation` kini selalu gagal (tidak dipanggil dari layar mana pun).

## 2ao. Audit jalur sertifikat: jenis sertifikat, sertifikat berbayar, template evaluasi (5 Nov)

Audit atas pekerjaan hari ini (2am, 2an). Pembersih sampul (2am) tidak punya temuan. Untuk 2an, setelah sertifikat benar-benar bisa terbit, tiga celah yang sebelumnya tertutup karena jalur itu buntu menjadi terjangkau. Semua dibuktikan dengan `npm run test:certificate-path` yang diperluas. **Sebelum migrasi (intern-update, 5 Nov): 17/25, gagal 8.**

**Celah:**
1. **Jenis sertifikat dipilih peserta.** `issue_my_certificate` dan server function `issueCertificate` menerima enam jenis (completion, participation, program, applied-achievement, competency, statement-of-result) dengan syarat yang sama, dan satu sertifikat per jenis. Uji membuktikan peserta menerbitkan sendiri **sertifikat kompetensi** (`BARUNA-COMPETENCY-2026-000035`) tanpa asesmen, sehingga satu pendaftaran punya 2 sertifikat (bisa sampai 6).
2. **Sertifikat berbayar terbit gratis.** Offering mandiri dengan model akses "Berbayar" (`paid`) atau "Gratis belajar" (`free_to_learn`, artinya sertifikat berbayar) menerbitkan sertifikat setelah modul selesai, karena pembayaran belum ada. Formulir admin juga menerima kedua model itu. Offering AZA (`free_to_learn`) aman karena tidak punya modul di database.
3. **Template evaluasi bisa diubah satu orang.** `set_completion_evaluation_template_status`, `add_completion_evaluation_question`, dan `create_completion_evaluation_template` bisa dipanggil langsung oleh satu admin/approver (aplikasi tidak memakainya). Template yang sedang dipakai offering tayang bisa dinonaktifkan atau ditambah pertanyaan wajib; peserta lalu tidak bisa memulai evaluasi dan sertifikatnya tertahan dengan pesan "kirim evaluasi" yang tidak mungkin dipenuhi.

**Perbaikan (migrasi `20261105030000`):**
- `issue_my_certificate`: hanya `completion` yang bisa terbit; jenis lain ditolak `certificate_type_not_available` (jenis tak dikenal tetap `invalid_certificate_type`) sampai aturannya diputuskan.
- `check_certificate_eligibility`: offering mandiri `paid` / `free_to_learn` ditolak `certificate_payment_required` (sesudah pemeriksaan modul dan evaluasi, supaya peserta tetap melihat kemajuannya); template yang tidak aktif dibaca `completion_evaluation_not_configured` (urusan admin, bukan peserta).
- `_program_offering_problem`: model akses `paid` dan `free_to_learn` ditolak `program_access_model_unsupported`. Formulir offering hanya menawarkan "Gratis" dengan keterangan alasannya.
- Hak panggil ketiga RPC template dicabut dari anon/authenticated (service_role tetap). Template dikelola lewat SQL sampai isi resminya diputuskan.
- Pesan baru di aplikasi: "Sertifikat kursus ini berbayar, dan pembayaran belum tersedia di BARUNA" dan "Jenis sertifikat ini belum tersedia".
- Offering berbasis angkatan tidak diubah: selalu `fee_based`, dan penanggung biaya hanya dicatat. Apakah peserta harus membayar dulu termasuk pertanyaan mentor (butir 12c).

**Uji:** PGlite 24/24 (bukti keempat celah sebelum migrasi; migrasi bisa diulang; lima jenis selain completion ditolak, jenis tak dikenal tetap ditolak; completion tetap terbit; satu pendaftaran satu sertifikat; free_to_learn dan paid `certificate_payment_required` dan penerbitan ditolak; template pensiun `completion_evaluation_not_configured`; ketiga RPC template ditolak untuk peserta, service_role tetap; formulir menolak paid dan free_to_learn, gratis tetap diterima). Rangkaian Academy lama 77/78 dan peserta lama 42/42 tetap sama dengan migrasi ini. `tsc` dan `build` lulus. Uji langsung `test:certificate-path` sebelum migrasi: 17/25 (gagal 8, di atas). Pembuktian template memakai id yang tidak ada, jadi tidak ada template sungguhan yang tersentuh. Nomor seri 000033–000037 terpakai oleh uji.

**Hasil sesudah migrasi (intern-update, 5 Nov):** `test:certificate-path` **25/25**: sertifikat kompetensi ditolak `certificate_type_not_available` dan satu pendaftaran tetap satu sertifikat; offering `free_to_learn` dan `paid` ditolak `certificate_payment_required`; approver tidak bisa memanggil `set_completion_evaluation_template_status` (`permission denied`); formulir admin menolak "sertifikat berbayar" (`program_access_model_unsupported`). Uji lain tetap lulus: participant-rpc 28, academy-programs 21, academy-guards 14, course-cover 14, course-cover-cleanup 12, learning-progress 12, lifecycle (Flow 1: 7, Flow 2: 7), console-roles, console-decisions, module-update 24, admin-module-revision 18, expert-rpc 64, kr-rpc 24, kh-roles 20, knowledge-update 19, kh-topics 12, languages 12, training-categories 12, master-data 15, module-limits 18, trainer-quota-list 5, training-requests 33. Data uji bersih.
## 2ap. Lembar sertifikat sementara untuk Course Offering (5 Nov)

**Masalah (ditemukan saat uji manual):** sertifikat course baru tercatat dan bisa diverifikasi, tetapi tidak ada lembar yang bisa dilihat atau diunduh. Pembuat PDF lama (`src/lib/certificate.ts`, dipakai course mandiri lama) tidak bisa dipakai: ia memakai `public/template-sttp-sementara.jpeg` (berisi data pribadi dan stempel), dan versi cadangannya menuliskan nama pejabat, nama lembaga, dan kalimat dasar hukum STTP.

**Perbaikan (tanpa migrasi):**
- Server function `getMyCertificateSheet` (`src/lib/learning/certificate-sheet.functions.ts`): membaca sertifikat **milik peserta yang login** (RLS + `learner_id = userId`), nama dari profilnya, judul course/offering, jumlah modul, dan total jam dari database.
- Pembuat lembar baru `src/lib/learning/certificateSheet.ts`: digambar di canvas tanpa gambar latar; berisi BARUNA Academy, "Sertifikat Penyelesaian", nomor, nama peserta, course dan offering, jumlah modul dan jam, tanggal terbit, QR + alamat halaman verifikasi. **Tanpa stempel, tanda tangan, nama pejabat, atau kalimat hukum**; kotak tanda tangan sengaja kosong ("belum ditetapkan"), tanda air SEMENTARA / CONTOH BELUM RESMI, dan catatan merah bahwa lembar belum berlaku sebagai STTP. Diekspor sebagai PDF A4 landscape.
- Tab Certificate di halaman course: tombol **Lihat sertifikat** (tab baru dibuka langsung saat klik supaya tidak diblokir browser; bila tidak bisa, PDF diunduh) dan **Unduh PDF**.

**Uji:** `tsc`, lint, `build` lulus. Lembar dirender di Chrome headless dan diperiksa (nama panjang, judul, QR, tanda air). Uji langsung baru `npm run test:certificate-sheet` (9 cek, memanggil aplikasi): sertifikat terbit; pemilik mendapat nama dari profil, judul course dan offering, nomor, 2 modul dan 3,5 jam, tautan verifikasi sesuai database; peserta lain "Sertifikat tidak ditemukan"; tanpa login ditolak; nomor yang tidak ada ditolak. Data uji bersih.

**Belum:** desain dan isi resmi STTP (tanda tangan, stempel, format nomor) menunggu mentor; ~~sertifikat course baru belum tampil di halaman My Learning~~ (selesai di 2aq).

## 2aq. My Learning menampilkan course dan sertifikat dari Course Offering (9 Nov)

**Masalah:** halaman My Learning hanya membaca data lama (modul mandiri di browser, pendaftaran program lama, AZA). Peserta yang mengikuti course dari Course Offering (mesin belajar bersama) melihat "No Training Programs Yet", dan sertifikatnya hanya terlihat dari halaman course masing-masing. Server function `listMyEnrolments` dan `listMyCertificates` sudah ada tetapi tidak dipakai.

**Perbaikan (tanpa migrasi):**
- My Learning memanggil `listMyEnrolments` dan `listMyCertificates`; kehadiran course atau sertifikat ini ikut menentukan apakah halaman kosong.
- Bagian baru `MyCourseOfferings.tsx` (helper di `src/lib/learning/myOfferings.ts`): **BARUNA Academy Courses** (course yang diikuti, tanggal daftar, status *In progress* / *Completed*, tombol ke halaman course; hanya offering mesin bersama yang belum ditarik, program lama tetap di bagiannya sendiri) dan **My Certificates** (judul course dan offering, nomor, tanggal terbit, tautan verifikasi, tombol *Lihat sertifikat* / *Unduh PDF* dari 2ap).
- `listMyCertificates` kini membawa judul Master Course, hanya sertifikat berstatus `issued`, dan dibatasi `learner_id` pemanggil selain RLS.

**Uji:** `tsc`, lint berkas yang diubah (tanpa peringatan baru), `build` lulus. `test:certificate-sheet` diperluas menjadi **13 cek**: daftar sertifikat pemilik memuat sertifikatnya dengan judul course, daftar peserta lain tidak; daftar course pemilik memuat course yang selesai di mesin bersama, daftar peserta lain tidak. Dijalankan terhadap server dev uji di port 8081. Data uji bersih.

## 2ar. Completion Record dan persetujuan kelulusan (9 Nov)

**Masalah (dibandingkan dengan panduan):** Slide 24 (PB-ACA-05) mewajibkan *Review Completion* dan *Approval Completion* sebelum *Certificate Record*, Slide 26 memisahkan objek Completion dari Certificate, dan Slide 27 menempatkan tahap ini pada Admin + Reviewer dengan peserta hanya mengunduh. Di aplikasi, peserta menerbitkan sertifikatnya sendiri lewat tombol *Issue certificate* tanpa review. Status selesai baru tertulis saat sertifikat terbit, sehingga penahanan sertifikat course berbayar (2ao) ikut menahan kelulusan, padahal Slide 22 dan 24 menyatakan pembayaran tidak menentukan kelulusan.

**Perbaikan (migrasi `20261109010000`):**
- Tabel `course_completions` (satu per pendaftaran): dibentuk **otomatis** oleh trigger pada progres dan evaluasi akhir begitu syarat terpenuhi, berstatus `pending_review`. Trigger mengunci pendaftaran, jadi modul terakhir dan evaluasi yang dikirim bersamaan dari dua perangkat tidak saling terlewat.
- `completion_decide` / `completion_decide_many`: hanya pemutus (`_can_decide_review`), bukan pesertanya sendiri, dengan pemeriksaan layar usang (`_expected_updated_at`). **Setuju:** pendaftaran menjadi selesai dan sertifikat terbit. **Remedial:** wajib alasan, peserta melihat alasannya, dan bisa disetujui kemudian. Syarat diperiksa ulang saat disetujui. Massal: tiap baris berdiri sendiri, baris yang gagal dilaporkan.
- `completion_overview`: antrean untuk pemutus, Operator, dan Reviewer (baca saja).
- `issue_my_certificate` tidak lagi menerbitkan: mengembalikan sertifikat yang sudah ada, atau `certificate_requires_approval`.
- `check_certificate_eligibility`: pembayaran bukan syarat lagi. Course berbayar: lulus setelah disetujui, sertifikat ditahan (`certificate_held_reason`). Evaluasi yang sudah terkirim tetap dihitung walau templatenya dinonaktifkan kemudian.
- Data lama: sertifikat yang sudah terbit tetap berlaku dan dicatat `approved`; peserta yang sudah memenuhi syarat langsung masuk antrean.
- Aplikasi: menu **Persetujuan Kelulusan** di Konsol Kurasi (`governance.completions.tsx`, tab Menunggu / Perlu tindak lanjut / Disetujui, setujui terpilih, minta remedial); tombol *Issue certificate* diganti panel status (`CompletionStatusPanel`); notifikasi lulus dan remedial; My Learning menampilkan *Awaiting approval* / *Follow-up needed*. Server function `issueCertificate` dan hook-nya dihapus.

**Uji:** PGlite 57/57 (bukti sebelum migrasi; migrasi bisa diulang; data lama; record otomatis termasuk wajib evaluasi; akses tabel; peran; layar usang; remedial; keputusan ganda; audit; pemisahan wewenang; massal; pembayaran; kondisi berubah sebelum disetujui; antrean). `tsc`, lint, lulus. Uji langsung baru `npm run test:completion-approval` (26 cek, termasuk **dua modul ditandai bersamaan** dan **dua pemutus bersamaan**). **Sebelum migrasi (intern-update, 9 Nov): 3/26**: peserta menerbitkan sertifikat sendiri (`000045`, dihapus), belum ada Completion Record. Tiga skrip lama disesuaikan dengan alur persetujuan: `test:certificate-path`, `test:certificate-sheet`, `test:participant-rpc`.

**Hasil sesudah migrasi (intern-update, 9 Nov):** `test:completion-approval` **26/26**, termasuk dua modul ditandai bersamaan (tepat satu record) dan dua pemutus bersamaan (satu berhasil, satu sertifikat). Uji lain lulus: certificate-path 27, certificate-sheet 13, participant-rpc 30, console-roles (menu baru), console-decisions, academy-programs 21, academy-guards 14, course-cover 14, course-cover-cleanup 12, learning-progress 12, lifecycle (Flow 1: 7, Flow 2: 7), module-update 24, admin-module-revision 18, expert-rpc 64, kr-rpc 24, kh-roles 20, knowledge-update 19, kh-topics 12, languages 12, training-categories 12, master-data 15, module-limits 18, trainer-quota-list 5, training-requests 33. Data uji bersih. Diuji manual oleh pemilik proyek (9 Nov).

**Belum:** Tahap B (*certificate model* di Course Offering, Slide 26) dan Tahap C (jenis sertifikat lain, butuh kehadiran dan asesmen, Slide 23).

## 2as. Pengajuan pendaftaran untuk Course Offering "Wajib disetujui admin" (10 Nov)

**Koreksi:** di 2al dan di daftar kerja mentor saya menulis peserta "belum punya formulir pengajuan" untuk offering baru. Itu keliru (dikoreksi pengguna). Jalur pengajuan sudah ada sejak 15 Okt (bagian 2h–2j): biodata peserta sebagai syarat, `course_enrollment_apply` (aman dari klik ganda), antrean **Persetujuan Peserta**, `admin_course_enrollment_decide` (tolak dengan alasan, tidak bisa memutuskan milik sendiri, setelah disetujui memberi peran Participant dan langsung mendaftarkan peserta ke offering bila kode offering cocok). Yang kurang hanya tombol pengajuan di halaman course `/academy/course/<kode>`.

**Celah tambahan yang ditemukan (dibuktikan `npm run test:offering-application`, sebelum migrasi 11/18):** untuk kode offering, `course_enrollment_apply` menerima judul dari browser apa adanya, dan menerima pengajuan ke offering yang tidak meminta pengajuan, yang sudah selesai, atau yang masa pendaftarannya lewat.

**Perbaikan:**
- Migrasi `20261110010000`: `_program_offering_problem` menerima lagi "Wajib disetujui admin", dan delivery mode Approved Self-Paced hanya bersama aturan itu (`program_access_rule_mode_mismatch`); "Wajib hak akses khusus" tetap ditolak. `course_enrollment_apply` untuk kode offering: harus `approval_required` (`offering_no_application`), tayang (`offering_closed`), dalam masa pendaftaran (`enrolment_window_closed`), dan judul diambil dari database. Pengajuan modul dan program lama tidak berubah.
- Aplikasi: komponen `OfferingApplicationAction` di halaman course untuk offering "Wajib disetujui admin": tombol **Ajukan pendaftaran** (atau tautan **Isi biodata peserta dulu** yang kembali ke course), status **Menunggu persetujuan**, **Pengajuan belum disetujui** beserta alasan dan tombol **Ajukan lagi**. Formulir offering menawarkan lagi "Wajib disetujui admin" dan delivery mode Approved Self-Paced. Pesan galat baru di `enrollment-errors.ts`.

**Uji:** `tsc`, lint lulus. Uji langsung baru `npm run test:offering-application` (18 cek: biodata, pengajuan, judul dari database, klik ganda, offering terbuka/selesai/masa lewat, tolak dan ajukan lagi, setujui lalu otomatis terdaftar, belajar sampai antrean kelulusan, aturan formulir). Sebelum migrasi 11/18: alur lama sudah berjalan sampai ujung; gagal 7 = judul palsu diterima, tiga offering yang tidak layak menerima pengajuan, dan tiga aturan formulir. `test:academy-guards` disesuaikan (hanya "hak akses khusus" yang tetap ditolak). Data uji bersih.

**Hasil sesudah migrasi (intern-update, 10 Nov):** `test:offering-application` **18/18**. Uji lain lulus: academy-guards 13, academy-programs 21, completion-approval 26, certificate-path 27, certificate-sheet 13, participant-rpc 30, console-roles, console-decisions, course-cover 14, course-cover-cleanup 12, learning-progress 12, lifecycle (Flow 1: 7, Flow 2: 7), module-update 24, admin-module-revision 18, expert-rpc 64, kr-rpc 24, kh-roles 20, knowledge-update 19, kh-topics 12, languages 12, training-categories 12, master-data 15, module-limits 18, trainer-quota-list 5, training-requests 33. Data uji bersih. Diuji manual oleh pemilik proyek sampai persetujuan (10 Nov).

**Belum (Slide 22):** ~~unggah dokumen persyaratan, *minta perbaikan* ke peserta~~ (dikerjakan di 2at), seleksi/skor, waitlist.

## 2at. Pendaftaran: Minta Perbaikan dan dokumen persyaratan (10 Nov)

**Panduan (Slide 22, PB-ACA-03):** peserta *Isi Form Application* dan *Unggah Dokumen Persyaratan*; operator *Cek Kelengkapan Dokumen*, bila tidak lengkap *Minta Perbaikan / Klarifikasi ke Pengguna*; reviewer menyetujui atau *Tolak & Beri Alasan*. Sebelumnya keputusan hanya setuju atau tolak, tanpa dokumen.

**Perbaikan (migrasi `20261110020000`):**
- Status pengajuan baru `revision_requested`. `admin_course_enrollment_decide` punya keputusan `request_revision` (catatan wajib minimal 5 karakter, hanya dari `pending`). Pengajuan yang menunggu perbaikan tidak bisa langsung disetujui atau ditolak (`application_awaiting_revision`). Peserta mengirim ulang lewat `course_enrollment_apply`; riwayat tercatat di audit (`course_enrollment_revision_requested`).
- `course_offerings.required_documents`: daftar nama dokumen per offering (maks 10, 2–120 karakter, tidak ganda, baris kosong diabaikan), lewat draf, persetujuan, dan riwayat versi Program Academy; hanya untuk "Wajib disetujui admin" (`program_documents_*`).
- Bucket privat `enrollment-documents` (PDF saja, maks 10 MB). Peserta mengunggah lewat URL bertanda dari server (`createEnrollmentDocumentUpload`, hanya offering tayang yang meminta pengajuan). `course_enrollment_apply(..., _documents)` memeriksa tiap berkas: dokumen memang diminta, lokasi milik peserta itu, ada di bucket, PDF, 1 byte–10 MB; menolak bila ada dokumen wajib yang kurang (`documents_required:<nama>`), tanpa menyimpan pengajuan setengah. Saat kirim ulang, dokumen lama tetap dihitung dan yang dikirim baru menggantikan. Versi 3 argumen dihapus; pemanggil lama (modul) tetap jalan lewat nilai bawaan.
- `course_enrollment_documents` (baca hanya milik sendiri) dan `enrollment_document_path`: berkas hanya bisa dibuka pemiliknya dan pengelola pendaftaran (Admin/Operator/Approver), lewat tautan bertanda 10 menit (`getEnrollmentDocumentUrl`).
- Aplikasi: halaman course menampilkan daftar dokumen dengan tombol Unggah/Ganti, status *Admin meminta perbaikan* beserta catatan dan tombol *Kirim ulang*; Persetujuan Peserta punya tab *Perlu Perbaikan*, daftar dokumen dengan tombol *Buka* (`EnrollmentDocumentsList`), dan tombol *Minta Perbaikan*; formulir offering punya isian dokumen persyaratan (satu per baris) saat aturan "Wajib disetujui admin". Halaman course tetap terbuka sebelum migrasi (kolom dibaca dengan cadangan).

**Uji:** PGlite 38/38 (bukti sebelum migrasi; migrasi bisa diulang; bucket privat; satu versi fungsi pengajuan; validasi daftar dokumen di draf, tersimpan rapi, riwayat versi, draf perubahan; pengajuan tanpa dokumen, berkas belum terunggah, bukan PDF, lebih dari 10 MB, milik orang lain, bucket lain, dokumen tak diminta ditolak tanpa sisa; lengkap tercatat; dokumen untuk modul ditolak, pengajuan modul 3 argumen tetap jalan; minta perbaikan, catatan wajib, tidak bisa disetujui/ditolak selagi menunggu, kirim ulang hanya CV, audit, disetujui lalu terdaftar; akses dokumen pemilik/operator/orang lain; tabel tidak bisa diubah langsung). `tsc`, lint (tanpa masalah baru), `build` lulus. Uji langsung baru `npm run test:enrollment-revision` (16 cek, memanggil aplikasi untuk unggah dan buka dokumen). **Sebelum migrasi (intern-update, 10 Nov): 3/16** (penjagaan dari aplikasi saja, misalnya bukan PDF ditolak server); kolom dokumen, bucket, dan keputusan minta perbaikan belum ada. **Sesudah migrasi (intern-update, 10 Nov): 16/16**, semua uji lain lulus. Diuji manual oleh pemilik proyek (offering dengan dua dokumen, pengajuan, minta perbaikan). Data dan berkas uji bersih.

**Catatan:** berkas yang diunggah tetapi tidak jadi diajukan tetap tersimpan privat (belum dibersihkan otomatis). Dokumen apa yang wajib per offering diisi admin, menunggu arahan mentor.

## 2au. Notifikasi keputusan pendaftaran dan dashboard peserta (10 Nov)

**Ditemukan saat uji manual 2at:** setelah admin menekan *Minta Perbaikan*, peserta tidak menerima notifikasi, dan dashboard (`/dashboard`) menunjukkan "Menunggu persetujuan 0" tanpa menyebut pengajuan itu.

**Panduan:** Slide 13 dan 27 (setiap perubahan status menghasilkan notifikasi); Slide 22 (peserta diminta memperbaiki lalu mengirim ulang); Slide 15 (data belajar hanya dari sistem resmi).

**Masalah yang ditemukan:**
1. Keputusan di Persetujuan Peserta (setujui, tolak, minta perbaikan) tidak pernah menjadi notifikasi, baik untuk modul maupun Course Offering.
2. Dashboard hanya membaca status *pending/approved/rejected*. Pengajuan yang diminta perbaikan dibuang, sehingga tidak tampil di mana pun.
3. Course Offering yang disetujui lewat pengajuan dihitung sebagai modul. Progresnya diambil dari langkah video/PDF/PPT sehingga selalu 0%, tertulis "kuis belum dikerjakan", dan tombol *Lanjutkan* membuka `/academy/learn/<kode>` (halaman Full Training, bukan halaman course).
4. Course Offering yang didaftari langsung (aturan Terbuka/Wajib akun) tidak tampil di dashboard, dan kelulusannya tidak dihitung.
5. Halaman modul (`CourseEnrollmentAction`) tidak mengenal status *revision_requested*, sehingga catatan admin tidak terlihat.

**Perbaikan (tanpa migrasi, kode aplikasi saja):**
- `buildEnrollmentDecisionNotifications`: notifikasi *Pendaftaran disetujui*, *belum disetujui* (dengan alasan), dan *Admin meminta perbaikan* (dengan catatan), dibaca dari jejak audit `admin_audit_log` milik peserta itu. Karena itu riwayatnya utuh, misalnya permintaan perbaikan tetap tercatat setelah disetujui. Tautannya ke halaman course (offering), halaman modul, atau Pendaftaran (Full Training). Penentunya `src/lib/learning/enrollment-target.ts`.
- `getMyLearningOverview`: status *revision_requested* ikut dibaca (hitungan `revisionRequested`). Pengajuan diberi jenis (offering/modul/program). Course Offering dibaca dari `enrolments`, dengan progres dihitung sama seperti halaman course (modul master yang ditandai selesai), status persetujuan kelulusan, dan lulus = kelulusan disetujui. Offering tidak lagi masuk daftar modul. Semua dibaca dengan identitas peserta (RLS).
- Dashboard: kartu "Menunggu persetujuan" menyebut jumlah yang perlu perbaikan. *Status Pendaftaran* menampilkan catatan admin dengan tombol **Perbaiki dan kirim ulang** (atau **Lihat dan ajukan lagi** bila ditolak) ke halaman yang tepat. Baris Course Offering menampilkan "x dari y modul selesai" serta status persetujuan kelulusan, dan tombolnya ke `/academy/course/<kode>`.
- Halaman modul: status *Admin Meminta Perbaikan* tampil dengan catatan dan tombol **Perbaiki & Kirim Ulang**.

**Uji (10 Nov):** `npm run test:participant-dashboard` (21 cek, memanggil aplikasi; menjadi 29 cek di 2av). Isinya: menunggu, minta perbaikan beserta catatan dan hitungannya, notifikasi dengan tautan ke halaman course, kirim ulang lalu disetujui, satu baris course (bukan modul) dengan 0 dari 2 modul, riwayat notifikasi lengkap, progres 50% setelah satu modul ditandai, penolakan dengan alasan, data dan notifikasi peserta lain tidak terlihat, tanpa login ditolak. **Kode lama: 9/21. Kode baru: 21/21.** Data uji bersih. `tsc` dan lint lulus (tanpa masalah baru).

## 2av. Full Training: kirim ulang setelah Minta Perbaikan (11 Nov)

**Temuan (audit akhir 10 Nov, KESIAPAN_RILIS bagian E):** `admin_course_enrollment_decide` menolak *setujui/tolak* selama status `revision_requested` (`application_awaiting_revision`). Halaman Full Training (`academy.applications.$id`, `academy.applications.index`) tidak mengenal status itu (`effectiveApplicationStatus` menjadikannya "Under Review"), dan tombol kirim hanya muncul untuk status `none`. Akibatnya, bila admin meminta perbaikan pada pengajuan Full Training, tidak ada yang bisa melanjutkannya. Ada juga kesalahan dari 2au: `enrollmentKind` mencari Full Training di `programs` (`tr-01` dst.), padahal pengajuan Full Training memakai **slug pelatihan** (`fullTrainingCourseId`). Akibatnya, notifikasi dan dashboard menganggapnya modul dan menautkan ke `/academy/self-paced/<slug>` (404).

**Perbaikan (tanpa migrasi; `course_enrollment_apply` sudah menerima kirim ulang dari `revision_requested`):**
- Komponen `RevisionResubmitBox`: catatan admin, isian tanggapan peserta (terisi catatan sebelumnya dari server, maks 1000), dan tombol **Kirim ulang**, lewat `submitCourseEnrollmentApplication`. Dobel klik aman: tombol terkunci, dan RPC memakai kunci advisory.
- Halaman detail Full Training: label **Revision Requested** dan kotak kirim ulang. Halaman daftar: label dan catatan admin.
- Dashboard: untuk Full Training yang perlu perbaikan, kotak kirim ulang tampil langsung di *Status Pendaftaran*. Karena dashboard membaca dari server, kotak ini bisa dipakai dari perangkat lain (formulir Full Training hanya ada di satu browser). `getMyLearningOverview` ikut mengirim `notes`.
- `enrollmentKind`: slug di `trainingBySlug` dikenali sebagai Full Training ("program"), sehingga tautannya menuju `/academy/applications`.

**Uji:** `test:participant-dashboard` ditambah 8 cek Full Training: mengajukan; diminta perbaikan; admin terkunci selama menunggu; dashboard mengenali Full Training beserta catatan lamanya; notifikasi menuju Pendaftaran; peserta mengirim ulang dengan tanggapan; tanggapan tersimpan dan catatan keputusan lama dibersihkan; approver bisa menyetujui. **Kode sebelumnya: 27/29** (jenis terbaca "module", tautan ke `/academy/self-paced/...`). **Sesudah: 29/29.** `tsc`, lint, dan `build` lulus.

**Uji manual (11 Nov, pemilik proyek):** pengajuan Full Training diminta perbaikan, peserta membuka notifikasi lalu menekan *Send again*, dan status kembali *pending* (tercatat di `admin_audit_log`). Dari uji ini ditemukan bahwa peserta mencari unggah ulang berkas, padahal lima berkas di formulir Full Training hanya dicatat namanya di browser dan tidak pernah sampai ke admin. Tombol unggah ulang sengaja tidak dibuat karena akan menyesatkan. Sebagai gantinya, kotak perbaikan (`documentsStayLocal`) dan bagian *Submitted Documents* kini menjelaskan hal itu, dan peserta menjawab lewat teks. Keputusan unggah sungguhan diserahkan ke mentor (MENUNGGU_ARAHAN_MENTOR, Ruang belajar).

**Catatan:** pengajuan yang ditolak di Full Training tetap tanpa tombol ajukan lagi (perilaku lama, nasib program menunggu mentor, P4).

**Diperbarui di 2ax (11 Nov):** pemilik proyek meminta unggah ulang berkas yang sungguhan, jadi penjelasan "berkas hanya di browser" diganti dengan unggahan ke server.

## 2aw. Pendaftaran: uji serentak dan unggahan yang belum dikirim (11 Nov)

Dua temuan audit 10 Nov (KESIAPAN_RILIS bagian E).

**C. Uji serentak.** Kunci untuk pengajuan (kunci advisory per peserta dan course, baris dikunci `FOR UPDATE`) dan untuk keputusan (`FOR UPDATE`) sudah ada sejak 2as/2at, tetapi belum dibuktikan dengan permintaan yang benar-benar bersamaan. Uji langsung baru `npm run test:enrollment-concurrency` (15 cek, tanpa aplikasi). Setiap permintaan dikirim pada saat yang sama dari sesi login yang berbeda: dua perangkat milik satu peserta, atau dua admin.
- Enam peserta masing-masing mengajukan dari tiga perangkat sekaligus: tetap satu pengajuan, satu perubahan, dan satu catatan audit.
- Setujui lawan tolak oleh dua admin (3 kali): satu menang, yang lain mendapat `decision_already_final`, satu audit, dan pendaftaran course hanya ada bila yang menang adalah setujui.
- Dua admin menyetujui bersamaan: tanpa error, satu audit, satu pendaftaran.
- Minta perbaikan lawan setujui: satu menang, hasilnya tidak campur.
- Kirim ulang dari tiga perangkat setelah diminta perbaikan: satu kiriman ulang tercatat.
- Kirim ulang tepat saat admin menekan setujui: hasilnya salah satu urutan yang sah.

**Hasil: 15/15**, tanpa perubahan kode. Kuncinya terbukti bekerja.

**B. Unggahan yang belum dikirim.** Sebelumnya, PDF yang diunggah di halaman course hanya diingat tab itu sampai *Ajukan* ditekan. Di perangkat lain peserta harus mengunggah ulang, dan berkas pertama tertinggal tanpa rujukan.

Perbaikan (migrasi `20261111010000`):
- Tabel `course_enrollment_document_uploads`: satu baris per (peserta, offering, dokumen). Hanya pemilik yang bisa membaca, dan tidak ada tulis langsung dari browser.
- RPC `enrollment_document_register` memeriksa: berkas milik sendiri di bucket privat, PDF, 1 byte–10 MB, dokumen memang diminta offering, offering tayang dan meminta pengajuan, dan pengajuan masih bisa diubah (belum dikirim, ditolak, atau menunggu perbaikan; bukan `pending` atau `approved`). RPC ini memakai kunci yang sama dengan `course_enrollment_apply`. Unggahan baru untuk dokumen yang sama menggantikan yang lama dari perangkat mana pun, dan berkas yang sama dicatat dua kali tetap satu baris.
- Pemicu `course_enrollment_documents_consume_upload`: begitu dokumen terkirim bersama pengajuan, catatan unggahannya dihapus dalam transaksi yang sama.
- Aplikasi:
  - Halaman course mencatat setiap unggahan (`registerEnrollmentDocument`) dan menampilkannya dengan label *belum dikirim*.
  - `getMyCourseEnrollmentStatus` mengirim daftar unggahan tercatat.
  - `submitCourseEnrollmentApplication(useUploadedDocuments)` membaca unggahan tercatat milik peserta tepat sebelum mengirim.
  - Sebelum migrasi, halaman tetap jalan seperti dulu (unggahan diingat di tab).
- `npm run cleanup:enrollment-documents` (seperti pembersih sampul) menghapus berkas di `enrollment/<peserta>/` yang tidak dipakai dokumen terkirim maupun unggahan tercatat dan berumur lebih dari 24 jam. Bawaannya hanya menampilkan daftar; untuk menghapus pakai `--apply`. Rujukan dibaca ulang sebelum menghapus.

**Uji:**
- PGlite 24/24: bukti sebelum migrasi; migrasi bisa diulang; aturan pencatatan (milik sendiri, belum terunggah, bukan PDF, lebih dari 10 MB, dokumen tak diminta, offering tanpa pengajuan, berkas yang sama untuk dokumen lain, tanpa login, klik ganda, penggantian); tidak bisa ditulis langsung; kirim dari unggahan tercatat; catatan hilang dalam transaksi yang sama; ditolak selagi `pending` dan sesudah disetujui; ganti CV saat perbaikan.
- Uji langsung `npm run test:enrollment-uploads` (15 cek; dua login satu peserta sebagai HP dan laptop): unggah di HP terlihat di laptop; dua perangkat mengganti CV bersamaan tetap satu catatan; kirim dari laptop memakai unggahan terbaru; ditolak selagi menunggu keputusan; minta perbaikan lalu CV baru dari HP dikirim dari laptop; peserta lain tidak melihat atau memakai berkas orang lain; pembersih menghapus berkas pengganti yang terbuang dan menyimpan dokumen terkirim.
- **Sebelum migrasi (intern-update, 11 Nov): 2/15.** `tsc`, lint (tanpa masalah baru), dan `build` lulus.
- **Sesudah migrasi (dijalankan pemilik proyek, 11 Nov): 15/15.**

**Catatan:** unggahan tercatat yang tidak pernah dikirim tetap tersimpan (tidak kedaluwarsa). Pembersih dijalankan manual. Jadwal otomatis menunggu keputusan operasional.

## 2ax. Full Training: berkas formulir sampai ke admin dan bisa diganti saat perbaikan (11 Nov)

**Temuan (uji manual pemilik proyek, 11 Nov):** setelah admin menekan *Minta Perbaikan* pada pengajuan Full Training, peserta tidak punya tempat untuk mengunggah berkas lagi. Penyebabnya, lima berkas di formulir Full Training (Passport Copy, CV, Nomination Letter, Motivation Letter, Recent Passport Photo) hanya dicatat **namanya** di `localStorage`. Berkasnya tidak pernah terkirim, sehingga admin tidak bisa membukanya dan tidak ada yang bisa diganti. Penjelasan di 2av (peserta hanya menjawab lewat teks) tidak sesuai dengan yang diminta pemilik proyek, yaitu alur Slide 22 *Unggah Dokumen Persyaratan* → *Minta Perbaikan* → peserta memperbaiki.

**Perbaikan (migrasi `20261111020000`):**
- Tabel `full_training_programs` (id course = slug pelatihan, judul, daftar dokumen, aktif). Ini salinan daftar dokumen di sisi server, karena halaman program sendiri masih statis di `src/data/training.ts`. Isinya satu program yang ada sekarang, dan labelnya sama persis dengan `DOCUMENT_FIELDS` (dicek uji). Pengunjung hanya bisa membaca; tidak ada tulis dari browser.
- Bucket privat `enrollment-documents` kini juga menerima JPG/PNG. Dokumen Course Offering tetap **hanya PDF**. Dokumen Full Training boleh PDF (maks 10 MB) atau JPG/PNG (maks 2 MB), sesuai ENGINEERING_STANDARDS. DOC/DOCX tidak diterima lagi karena tidak bisa dibuka langsung di browser admin.
- `enrollment_document_register` dan `course_enrollment_apply` memperlakukan Full Training seperti offering. Berkas harus unggahan milik peserta sendiri; jenis dan ukurannya dicek dari metadata penyimpanan, termasuk kecocokan ekstensi dengan jenis berkas. Semua dokumen wajib ada, judul pengajuan diambil dari database, dan saat kirim ulang dokumen lama tetap berlaku. Artinya setelah *Minta Perbaikan* peserta cukup mengganti dokumen yang bermasalah. Pengecekan berkas disatukan di `_enrollment_document_file_size`, dan penentuan "course ini meminta dokumen apa" di `_enrollment_document_target` (offering menang bila ada id yang sama).
- Kolom `course_enrollment_document_uploads.offering_code` diganti nama menjadi `course_id`, dan argumen pertama `enrollment_document_register` menjadi `_course_id`.
- Pengajuan Full Training lama yang masih *pending* tidak terganggu. Bila nanti diminta perbaikan, peserta harus melengkapi kelima dokumen.

**Aplikasi:**
- Halaman pendaftaran program (`/academy/apply/<slug>`):
  - Bila server sudah punya pengajuan dari akun ini (dari perangkat mana pun), halaman menampilkan statusnya. *Pending* atau *approved* tidak bisa mengajukan dua kali. *Minta perbaikan* menampilkan kotak perbaikan (`FullTrainingApplyStatus`).
  - Langkah *Documents* mengunggah setiap berkas ke server (wajib masuk). Dokumen yang sudah diunggah di perangkat lain, atau dari pengajuan yang ditolak, langsung terhitung.
  - Kirim memakai unggahan tercatat (`useUploadedDocuments`).
- Kotak perbaikan `FullTrainingRevision`: catatan admin, kelima dokumen beserta berkas yang dipegang admin, tombol **Replace/Ganti** per dokumen dengan label *new, not sent yet*, tanggapan teks, lalu **Send again**. Tombol terkunci sampai semua dokumen ada. Kotak ini dipakai di halaman pendaftaran, halaman detail pengajuan, dan dashboard. Sebelum migrasi, kotak lama (hanya teks) tetap tampil.
- Notifikasi keputusan Full Training kini menuju `/academy/apply/<slug>`, yang membaca server, sehingga bisa dibuka dari perangkat mana pun. Halaman *My Applications* masih membaca browser.
- Halaman detail pengajuan menampilkan dokumen yang dipegang admin (bisa dibuka pemiliknya), bukan nama berkas di browser.
- Persetujuan Peserta menandai dokumen Full Training yang belum ada, sama seperti offering.
- Logika unggah dipakai bersama halaman offering dan Full Training (`useEnrollmentDocumentUpload`, `enrollment-document-rules.ts`). Pembersih `cleanup:enrollment-documents` kini juga mengenali berkas `.jpg`/`.png`.

**Uji:**
- PGlite (`pgtest/full_training_docs.mjs`) **31/31**:
  - Bukti sebelum migrasi: dokumen Full Training tidak bisa dicatat atau dikirim.
  - Migrasi: bisa diulang, kolom berganti nama, daftar dokumen dan bucket benar.
  - Aturan berkas: PDF dan PNG diterima; gambar lebih dari 2 MB, PDF lebih dari 10 MB, ekstensi tak cocok, dokumen tak diminta, dan berkas orang lain ditolak; offering tetap hanya PDF.
  - Pengajuan: dokumen kurang ditolak tanpa pengajuan setengah jadi; lima dokumen terkirim; selagi *pending* tidak bisa diganti.
  - Perbaikan: ganti CV saja, empat dokumen lain tetap, lalu disetujui.
  - Lain-lain: pengajuan lama tidak terganggu tetapi wajib melengkapi saat perbaikan; daftar program tidak bisa diubah dari browser; program nonaktif tidak menerima dokumen; alur offering tetap jalan.
- Uji langsung baru `npm run test:full-training-documents` (19 cek; dua login satu peserta sebagai HP dan laptop):
  - Daftar dokumen server sama dengan formulir.
  - Paspor JPG dan CV dari HP terlihat di laptop.
  - Gambar 3 MB dan Word ditolak.
  - Kirim dengan dokumen kurang ditolak tanpa sisa; lengkapi di laptop lalu terkirim dengan lima dokumen; selagi menunggu tidak bisa diganti.
  - Operator membuka CV, peserta lain tidak bisa.
  - Minta perbaikan: HP mengganti CV, laptop melihatnya lalu mengirim ulang, empat dokumen lain tetap.
  - Disetujui; peserta lain tidak melihat atau memakai berkas orang lain.
  - **Sebelum migrasi (intern-update, 11 Nov): 4/19. Sesudah migrasi (dijalankan pemilik proyek, 11 Nov): 19/19.** Semua uji `test:*` lain lulus sesudah migrasi. `participant-dashboard` mencari notifikasi Full Training dengan judul dari database, karena judul kini diambil dari `full_training_programs`, bukan dari halaman.
- `test:participant-dashboard` kini melampirkan dokumen saat mengajukan Full Training (bila tabelnya ada), dan tautan notifikasinya menuju `/academy/apply/<slug>`. Sebelum migrasi tetap 29/29.
- `test:enrollment-uploads` dan `test:enrollment-revision` memakai nama argumen baru (`courseId`). `tsc`, lint (tanpa masalah baru), dan `build` lulus.

**Uji manual (11 Nov, pemilik proyek):** pengajuan Full Training lama diminta perbaikan. Peserta mengunggah kelima berkas (PDF dan PNG) di kotak perbaikan lalu mengirim ulang. Admin membuka berkas di Persetujuan Peserta (daftar dokumen dibuat dua kolom dan dialog bisa digulir, commit 9a7ce9f dan 220b30e), lalu menyetujui. Halaman pengajuan peserta menampilkan *Accepted* dan *Submitted Documents (5/5)* dari server.

**Pengajuan yang dikirim sebelum migrasi:** berkasnya memang tidak pernah sampai ke server, karena saat itu formulir hanya menyimpan nama berkas di browser. Karena itu, saat diminta perbaikan, kelima dokumennya tampil *missing* dan harus diunggah sekali. Pengajuan sesudah migrasi menyimpan berkasnya, sehingga saat perbaikan hanya dokumen yang bermasalah yang perlu diganti.

**Catatan:** kode branch ini tetap jalan sebelum migrasi (Full Training kembali ke perilaku lama). Pengecualiannya: pencatatan unggahan offering (2aw) memakai argumen `_course_id` yang baru ada setelah migrasi ini. Sampai migrasi dijalankan, unggahan offering kembali diingat di tab saja. Jadi **jalankan migrasi ini sebelum push**.

## 2ay. Keputusan tampil langsung (real-time) dan pengajuan lama berjudul offering (11 Nov)

Dua temuan audit 10 Nov (KESIAPAN_RILIS bagian E), dikerjakan sebelum push atas permintaan pemilik proyek.

**1. Notifikasi belum real-time.** Lonceng, dashboard, dan halaman notifikasi mengambil data sekali lalu menyimpannya 15 detik. Keputusan admin (setujui, tolak, minta perbaikan, kelulusan) baru terlihat saat halaman dibuka atau dimuat ulang. Antrean Persetujuan Peserta juga tidak tahu ada kiriman ulang.

Perbaikan (migrasi `20261111030000`):
- `course_enrollment_applications` dan `course_completions` dimasukkan ke publikasi Supabase Realtime. Aman dijalankan ulang, dan tidak gagal bila publikasinya sudah mencakup semua tabel.
- Hook `useLiveLearningUpdates` di Navbar (semua halaman peserta) berlangganan perubahan baris milik pengguna yang login (`user_id=eq.<id>`). Begitu ada perubahan, cache notifikasi, dashboard, data belajar, dan status pendaftaran disegarkan (satu kali per keputusan, jeda 0,4 detik).
- `useLiveEnrollmentQueue` di Persetujuan Peserta: kiriman baru atau kiriman ulang langsung muncul.
- Keamanan: Realtime menerapkan RLS tabel pada setiap pelanggan. Peserta hanya menerima baris miliknya (`enrollment_apps_own_read`, `course_completions_own_read`). Hanya admin, operator, dan approver yang menerima semua pengajuan.
- Cadangan: lonceng dan halaman notifikasi menyegarkan diri tiap 60 detik selama tab terbuka. Ini menangkap sumber notifikasi lain (review, permintaan layanan, kualifikasi trainer, pembaruan modul), atau perubahan saat koneksi Realtime putus.
- Batas yang perlu diketahui: setiap tab yang login membuka satu koneksi Realtime. Paket gratis Supabase mengizinkan 200 koneksi serentak, Pro 500. Pesan hanya dikirim saat ada keputusan, jadi lalu lintasnya kecil.

**2. Pengajuan lama yang tercatat dengan judul offering.** Sebelum 2as, sebagian pengajuan offering menyimpan **judul** offering sebagai `course_id`, dan `admin_course_enrollment_decide` masih mengenali judul. Notifikasi dan dashboard hanya mengenali kode, sehingga pengajuan seperti itu dianggap modul dan ditautkan ke `/academy/self-paced/<judul>` (halaman tidak ada). Di intern-update saat ini tidak ada pengajuan seperti itu (diperiksa 11 Nov), tetapi `main` belum diperiksa.

Perbaikan (tanpa migrasi): `resolveOfferingIds` (`src/lib/learning/offering-ids.server.ts`) menerjemahkan kode **atau judul** offering menjadi kode, dengan urutan yang sama seperti RPC keputusan (kode dulu, lalu offering terbaru dengan judul itu). Fungsi ini dipakai notifikasi keputusan pendaftaran dan dashboard (`MyApplication.offeringCode`). Tautannya kini selalu ke `/academy/course/<kode>`, dan judul tidak lagi muncul sebagai modul. Tombol dashboard untuk Full Training juga menuju `/academy/apply/<slug>`, sama dengan notifikasinya (2ax).

**Uji:**
- PGlite (`pgtest/learning_realtime.mjs`) 4/4: tanpa publikasi tidak gagal; sebelum migrasi tabel belum dipublikasikan; sesudah migrasi (dua kali) kedua tabel masuk dan tabel lain tetap; publikasi `FOR ALL TABLES` tidak gagal.
- Uji langsung baru `npm run test:live-notifications` (14 cek; berlangganan Realtime sungguhan seperti aplikasi):
  - Peserta menerima *minta perbaikan* beserta catatannya tanpa memuat ulang.
  - Antrean admin menerima kiriman ulang.
  - Peserta menerima keputusan kelulusan.
  - Peserta lain tidak menerima apa pun, baik dengan filter id orang lain maupun tanpa filter.
  - Pengajuan berjudul offering: notifikasi menuju `/academy/course/<kode>`, dashboard mengenalinya sebagai Course Offering, dan judul tidak muncul sebagai modul.
- **Sesudah migrasi (dijalankan pemilik proyek, 11 Nov): 14/14.** Keputusan sampai ke peserta dalam sekitar 0,4 detik, dan kiriman ulang ke antrean admin sekitar 0,6 detik. Semua 39 uji `test:*` lulus. `enrollment-concurrency` sempat gagal 5 cek karena `fetch failed` (koneksi putus saat permintaan serentak; datanya tetap benar) dan lulus 15/15 saat diulang.
- **Sebelum migrasi (intern-update, 11 Nov): 10/14.** Keempat cek Realtime gagal (tidak ada event dalam 10 detik), dan tidak ada yang bocor. Dengan kode lama, bagian 5 gagal 2 cek (tautan `/academy/self-paced/Angkatan%20Live…`, jenis `module`). `tsc`, lint, dan `build` lulus.

---

## 2ac. Pelengkap catatan: perubahan yang belum tercatat (audit dokumen 2 Nov)

Hasil pencocokan riwayat GitHub `intern-update` (12–23 Okt) dengan catatan ini. Yang di bawah sudah ada di kode, tetapi sebelumnya belum dicatat.

**12–13 Okt (sebelum commit bertanda Claude):**
- `089e107` Revisi modul setelah tayang tanpa batas jumlah, struktur isian Knowledge Hub per jenis sumber, dan lampiran revisi tidak hilang.
- `4992578` Pencarian, item tersimpan (*saved*), kontribusi expert, karya di profil, dan analitik sumber membaca data asli.
- `23c3f04` Kartu dashboard peserta dan registered user membaca data akun yang sebenarnya.
- `19a92a7`, `6fb1c41` Notifikasi dengan tanda dibaca/belum dibaca; halaman Knowledge Hub memakai data asli; peringatan *schema cache* metrik dibungkam dengan cadangan metadata.
- `815fb57`, `b0128ef`, `66c691d` (PC) Jumlah dilihat dan diunduh per sumber Knowledge Hub (migrasi `20261013010000_knowledge_resource_metrics_tracking`, `20261013020000_atomic_knowledge_resource_metrics`), termasuk unduhan modul yang sah, tanpa balapan data dan tanpa pencarian akun berulang.
- `236813e` (PC) Statistik di footer dari data platform (migrasi `20261013010000_platform_partners_catalog`).

**Sesudahnya:**
- `9e14238` (20 Okt) Judul halaman Become an Expert tanpa huruf rusak (*mojibake*), label status arsip, dan statistik direktori expert tidak terpotong di 1.000 baris.
- `11de259` (21 Okt) Menu akun di beranda lebih cepat: cache tidak lagi dihapus setiap halaman dibuka, query server dijalankan paralel.
- `8d6a9a9` (22 Okt) 10 peringatan Tailwind di editor dirapikan, tanpa perubahan tampilan.

**Temuan saat audit: migrasi `20261008030000_publish_expert_contact_email` belum berlaku di intern-update** (dicek 2 Nov: kolom `experts.contact_email` dan `profiles.email` tidak ada).
- Migrasi ini dari PC (8 Okt), sebelum pengecek migrasi dibuat, dan sebelumnya tidak diperiksa pengecek. Sekarang diperiksa di baris 12.
- Dampaknya kecil: kode tetap jalan, hanya email kontak expert tidak pernah tampil di direktori.
- **Tidak dijalankan otomatis**, karena migrasi itu (dan `20261008040000` sesudahnya) mengisi email akun KKP tertentu. Perlu keputusan apakah dijalankan di intern-update. Bila ya: `030000` lalu `040000`. Definisi `experts_directory_v` di migrasi itu adalah yang terakhir di repo, dan pencabutan izin tulis view (`20261020050000`) tetap berlaku karena `CREATE OR REPLACE VIEW` tidak menghapus izin.

---

## 2ae. Template Review dihapus dari aplikasi (2 Nov)

**Keputusan pemilik proyek (2 Nov)** setelah mencoba fitur ini: hapus.

**Alasannya:**
- Fitur ini hanya berlaku untuk penugasan reviewer **Permintaan Pelatihan** dan sifatnya opsional; Verifikasi Expert, Modul, dan Publikasi tidak memakainya.
- Belum pernah dipakai di intern-update: 0 template sebelum 2 Nov, dan 0 penugasan yang memakai template.
- Kriteria harus ditulis sebagai JSON. Contoh bawaannya pun salah format: memakai `criteria[]`, padahal sistem hanya membaca `fields{}`, sehingga template tersimpan tanpa error tetapi reviewer tidak melihat kriteria apa pun. Perbaikan contohnya sempat di-commit (`0fad422`), tetapi tampilan JSON tetap tidak layak untuk kurator.

**Yang dihapus (tanpa migrasi):**
- Menu **Template Review** di Konsol Kurasi, halaman `/governance/templates` dan `/governance/templates/$id`.
- Pilihan "Review template" saat menugaskan atau memindahkan reviewer.
- Form kriteria di halaman review (`ReviewCriteriaForm`); reviewer tetap memberi rekomendasi dan alasan seperti sebelumnya.
- Server function pengelolaan template.

**Yang tidak diubah:**
- Tabel `review_templates`/`review_template_versions` dan RPC-nya di database tetap ada; tidak di-drop. RPC `assign_reviewer` tetap menerima template opsional (selalu kosong dari aplikasi).
- Pengaman `trg_template_version_immutable` (versi yang sudah dipublikasikan tidak bisa diubah atau dihapus).

**Data:** template uji pemilik proyek (2 Nov) dihapus: "expert" dan draf v2–v3 "Rubrik Permintaan Pelatihan v1". **Versi 1 template itu sudah dipublikasikan, sehingga pengaman database menolak penghapusannya**; template itu tidak lagi terlihat di aplikasi dan tidak dipakai penugasan mana pun. Penghapusan tuntasnya menunggu keputusan (perlu menonaktifkan pengaman sementara di SQL Editor).

**Uji:** `tsc`, `build`, dan lint lulus; daftar rute tidak lagi memuat halaman template. `test:training-requests` 33/33 (penugasan reviewer tanpa template), `test:review-lockdown` 13/13, dan `test:lifecycle` lulus.

**Bila nanti dibutuhkan lagi** (mis. mentor meminta lembar penilaian baku untuk reviewer): kodenya ada di riwayat git (sebelum commit penghapusan ini). Sebaiknya dibangun ulang sebagai formulir biasa, bukan JSON.

---

## 3. Migrasi yang harus dijalankan

**Database main dan intern-update adalah dua database Supabase berbeda.** Migrasi yang ditempel manual di SQL Editor tidak meninggalkan catatan, jadi gunakan pengecek:

1. Buka `supabase/check_migrations.sql`, tempel di SQL Editor database yang ingin diperiksa, lalu Run. (Hanya membaca, tidak mengubah apa pun.)
2. Hasilnya satu baris per migrasi (73 baris): `OK` atau `BELUM DIJALANKAN`.
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
- `20261023010000_master_data_expertise_trainer_levels.sql` (Data Master: bidang keahlian dan aturan level trainer; tulis langsung ditutup; bidang keahlian pengajuan expert diperiksa). Lihat bagian 2aa. **Butuh kode branch ini**: formulir Become an Expert membaca daftar dari database. Setelah migrasi, skrip uji expert versi branch ini yang berlaku.
- `20261023020000_master_data_trainer_module_limits.sql` (Data Master: kuota modul per level trainer, dengan validasi, pencegahan saling timpa, dan audit trail; tulis langsung dicabut). Lihat bagian 2ab. Jalankan setelah `20261023010000`.
- `20261102010000_master_data_trainer_quota_list.sql` (Data Master: daftar trainer aktif per level dengan pemakaian kuota modul; baca saja). Lihat bagian 2ad. Jalankan setelah `20261023020000`. Tanpa migrasi ini daftar menampilkan pesan migrasi; panel lain tidak terpengaruh.
- `20261102020000_master_data_kh_topics.sql` (Data Master: topik Knowledge Hub; pengajuan wajib memakai topik dari daftar). Lihat bagian 2af. Butuh `20261023010000`. **Butuh kode branch ini**: formulir kontribusi membaca topik dari database; setelah migrasi, skrip uji Knowledge Hub versi branch ini yang berlaku (payload uji memakai topik dari daftar).
- `20261102030000_master_data_languages.sql` (Data Master: satu daftar bahasa; tabel `languages_taxonomy` masuk repo; bahasa publikasi Knowledge Hub diperiksa saat dikirim). Lihat bagian 2ag. Jalankan setelah `20261102020000`. **Butuh kode branch ini** (formulir membaca bahasa dari database; payload uji Knowledge Hub memakai bahasa dari daftar).
- `20261102040000_master_data_training_categories.sql` (Data Master: kategori pelatihan Request a Training; permintaan wajib memakai kategori dari daftar atau "Other"). Lihat bagian 2ah. Butuh `20261023010000`. **Butuh kode branch ini** (formulir membaca kategori dari database).
- `20261104010000_academy_program_admin.sql` (Program Academy: draf, persetujuan, dan versi untuk Master Course, Master Module, Course Offering; tulis langsung ke tabel program dicabut). Lihat bagian 2ai. Butuh `20261102030000` (daftar bahasa). **Butuh kode branch ini** (menu Program Academy di Konsol Kurasi).
- `20261104020000_academy_course_cover.sql` (gambar sampul Master Course: kolom `cover_path`, diperiksa database saat dikirim dan disetujui, ikut riwayat versi). Lihat bagian 2ak. Jalankan setelah `20261104010000`. **Butuh kode branch ini** (isian unggah di formulir Master Course; katalog tetap berjalan tanpa sampul sebelum migrasi).
- `20261104030000_academy_program_guards.sql` (hak panggil 6 RPC lama pengubah offering dicabut dari anon/authenticated; offering dari layar admin hanya boleh aturan pendaftaran Terbuka/Wajib akun terdaftar). Lihat bagian 2al. Jalankan setelah `20261104010000`. Tidak mematahkan kode lama (RPC itu tidak dipakai aplikasi).
- `20261105010000_certificate_eligibility.sql` (syarat sertifikat memakai evaluasi akhir yang dipakai halaman course; jalur evaluasi lama `learning_evaluation_submit` ditutup untuk peserta). Lihat bagian 2an. **Butuh kode branch ini** (pesan syarat sertifikat di halaman course).
- `20261105020000_offering_evaluation_template.sql` (template evaluasi akhir dipilih di draf Course Offering, diperiksa database, ikut versi, dikunci setelah ada peserta). Lihat bagian 2an. Jalankan setelah `20261104030000`. **Butuh kode branch ini** (pilihan template di formulir offering).
- `20261105030000_certificate_guards.sql` (hanya sertifikat kelulusan yang bisa terbit; sertifikat course berbayar tidak terbit gratis; RPC ubah template evaluasi ditutup untuk pengguna biasa). Lihat bagian 2ao. Jalankan setelah `20261105010000` dan `020000`. **Butuh kode branch ini** (pilihan model akses di formulir offering, pesan syarat sertifikat).
- `20261109010000_completion_approval.sql` (Completion Record dan persetujuan kelulusan; peserta tidak lagi menerbitkan sertifikat sendiri; pembayaran tidak menahan kelulusan). Lihat bagian 2ar. Jalankan setelah `20261105030000`. **Butuh kode branch ini** (menu Persetujuan Kelulusan, status di tab Certificate).
- `20261110010000_offering_application.sql` (Course Offering "Wajib disetujui admin" dibuka lagi lewat jalur pengajuan peserta; pengajuan ke offering diperiksa: harus meminta pengajuan, tayang, masa pendaftaran buka, judul dari database). Lihat bagian 2as. Jalankan setelah `20261104030000`. **Butuh kode branch ini** (tombol Ajukan pendaftaran di halaman course).
- `20261110020000_enrollment_revision_documents.sql` (pendaftaran: keputusan *Minta Perbaikan*, dokumen persyaratan per offering, bucket privat dokumen). Lihat bagian 2at. Jalankan setelah `20261110010000`. **Butuh kode branch ini** (unggah dokumen di halaman course, tombol Minta Perbaikan dan daftar dokumen di Persetujuan Peserta, isian dokumen di formulir offering).
- `20261111010000_enrollment_document_uploads.sql` (dokumen pendaftaran yang sudah diunggah tetapi belum dikirim tercatat di server, sehingga terlihat di semua perangkat). Lihat bagian 2aw. Jalankan setelah `20261110020000`. Kode branch ini tetap jalan sebelum migrasi (unggahan diingat di layar seperti dulu).
- `20261111020000_full_training_documents.sql` (berkas formulir Full Training benar-benar terkirim ke admin dan bisa diganti saat *Minta Perbaikan*; dokumen Full Training boleh PDF atau JPG/PNG). Lihat bagian 2ax. Jalankan setelah `20261111010000`, **sebelum push** (lihat catatan 2ax).
- `20261111030000_learning_realtime.sql` (keputusan pendaftaran dan kelulusan tampil langsung lewat Supabase Realtime; tanpa perubahan data atau aturan). Lihat bagian 2ay. Kode branch ini tetap jalan sebelum migrasi (penyegaran tiap 60 detik).

Tanpa migrasi yang sesuai, fitur terkait menampilkan pesan error yang jelas (bukan data rusak). Migrasi sebaiknya dijalankan **sebelum atau bersamaan** dengan merge. `20261015020000` memindahkan kunci jawaban kuis; kode lama belum bisa menilai kuis modul yang baru ditayangkan setelah migrasi itu.

Peringatan: ada dua file dengan awalan `20261013010000`. Aman lewat SQL Editor, tetapi akan bentrok jika memakai `supabase db push`.

Setelah merge: jalankan `npm run build`, lalu uji dengan **dua akun berbeda** (admin tidak bisa memutuskan pengajuannya sendiri).

---

## 4. Pengujian

- `npx tsc --noEmit` dan `npm run build`: lulus.
- **Uji langsung ke database** (`npm run test:<nama>`, memakai `.env`; setiap uji membuat akun `@example.test` lalu membersihkannya sendiri). Hasil terakhir di intern-update (23 Okt), semua lulus:

  | Uji | Cek | Bagian | Uji | Cek | Bagian |
  |---|---|---|---|---|---|
  | `lifecycle` | 14 | 2, 2b | `module-update` | 24 | 2t |
  | `kh-roles` | 20 | 2k, 2l | `admin-module-revision` | 18 | 2u |
  | `expert-rpc` | 64 | 2d–2g | `knowledge-update` | 19 | 2v |
  | `participant-rpc` | 30 | 2h–2j, 2an, 2ar | `expert-profile-update` | 19 | 2w |
  | `kr-rpc` | 24 | 2k | `version-history`* | 16 | 2x |
  | `expert-role-lock` | 10 | 2p | `trainer-choice` | 5 | 2y |
  | `review-lockdown` | 13 | 2q | `create-user`* | 9 | 2z |
  | `learning-progress` | 12 | 2r | `master-data` | 15 | 2aa |
  | `training-requests` | 33 | 2s | `module-limits` | 18 | 2ab |
  | `console-roles`*, `console-decisions`* | lulus | 2o | `rbac` | lulus | matriks peran |
  | `trainer-quota-list` | 5 (setelah migrasi `20261102010000`) | 2ad | `kh-topics` | 12 (setelah migrasi `20261102020000`) | 2af |
  | `languages` | 12 (setelah migrasi `20261102030000`) | 2ag | `training-categories` | 12 (setelah migrasi `20261102040000`) | 2ah |
  | `academy-programs` | 21 (setelah migrasi `20261104010000`) | 2ai | `course-cover`* | 14 (setelah migrasi `20261104020000`) | 2ak |
  | `academy-guards` | 13 (setelah migrasi `20261110010000`) | 2al, 2as | `course-cover-cleanup` | 12 | 2am |
  | `certificate-path` | 27 (setelah migrasi `20261105010000`, `020000`, `030000`, `20261109010000`) | 2an, 2ao, 2ar | `certificate-sheet`* | 13 | 2ap, 2aq |
  | `completion-approval` | 26 (setelah migrasi `20261109010000`) | 2ar | `offering-application` | 18 (setelah migrasi `20261110010000`) | 2as |
  | `enrollment-revision`* | 16 (setelah migrasi `20261110020000`) | 2at | `participant-dashboard`* | 29 | 2au, 2av, 2ax |
  | `enrollment-concurrency` | 15 | 2aw | `enrollment-uploads`* | 15 (setelah migrasi `20261111010000`) | 2aw |
  | `full-training-documents`* | 19 (setelah migrasi `20261111020000`) | 2ax | `live-notifications`* | 14 (setelah migrasi `20261111030000`) | 2ay |

  \* memanggil aplikasi yang berjalan (`APP_BASE_URL` di `.env`, atau `npm run dev` untuk fitur yang belum di-deploy).
- Setiap perbaikan database juga diuji dulu di Postgres lokal (PGlite) dengan migrasi asli; jumlah ceknya ada di bagian masing-masing.
- Belum diuji manual di browser dengan akun nyata: alur penugasan Expert (fitur disembunyikan sementara), pendaftaran Peserta, pipeline modul Trainer, dan fitur 22–23 Okt (pembaruan profil expert, pembaruan Knowledge Hub, riwayat versi, Tambah User, Data Master).

---

## 5. Sisa pekerjaan dan keputusan untuk mentor

- **PDF 13 modul Master masih aset publik Lovable** (bagian 2i). Perlu file PDF aslinya untuk dipindah ke penyimpanan privat.
- **My Learning menghapus aplikasi African Countries dari browser** setiap kali dibuka (bagian 2i). Perlu keputusan: apakah program ini memang sudah tidak dipakai?
- ~~**Role participant tanpa persetujuan admin.**~~ **Diputuskan pemilik proyek (21 Okt): tetap otomatis** saat biodata disimpan; akses materi tetap lewat persetujuan admin (MENUNGGU_ARAHAN_MENTOR butir 3).
- ~~**Expert yang disetujui otomatis menjadi trainer aktif.**~~ **Selesai (22 Okt, bagian 2y):** trainer otomatis hanya bila expert memilih peran Trainer; yang lain lewat Kualifikasi Trainer.
- **Expert tidak bisa mundur setelah Accept** pada permintaan layanan; hanya admin yang bisa membatalkan.
- Notifikasi dalam aplikasi sudah mencakup permintaan layanan dan kualifikasi trainer; notifikasi email/chat belum ada.
- Kuota peserta yang disebut di flowchart belum dicek di kode.
- ~~Antrean Verifikasi Expert sudah aman untuk data besar (dibaca bertahap), tetapi tampilannya masih memuat semua baris sekaligus.~~ **Selesai (2 Nov):** antrean Verifikasi Expert, Verifikasi Modul, Verifikasi Publikasi, dan Persetujuan Peserta di Konsol Kurasi kini menampilkan 25 baris per halaman (`Pager`, `usePagedList`). Filter dan pencarian tetap berlaku untuk seluruh daftar; halaman kembali ke 1 saat filter berubah dan tetap dalam batas saat daftar menyusut setelah keputusan.
- `src/integrations/supabase/types.ts` disinkronkan manual; sebaiknya dibuat ulang lewat Supabase CLI (`npx supabase login`, lalu `npx supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts`).
- 58 akun sisa tes lama (`@example.test`) sudah dihapus dari database intern-update (17 Oktober 2026) bersama 350 baris log aktivitasnya; tersisa 24 akun pengguna asli.
- ~~Kelulusan kuis dan sertifikat peserta masih dicatat di `localStorage` browser.~~ **Selesai (21 Okt, bagian 2r):** kelulusan modul dicatat server dari kuis resmi; sertifikat diterbitkan server.
- Pertanyaan untuk mentor: apakah "publisher" harus terpisah dari "approver"? Saat ini approve langsung menayangkan modul.
- Pertanyaan untuk mentor: apakah peserta yang sudah lulus wajib mengulang saat modul naik versi (bagian 2x)?
- Pertanyaan untuk mentor: apakah Operator juga boleh mengelola Data Master (bagian 2aa, 2ab)?
- Keputusan: migrasi email kontak expert `20261008030000`/`040000` belum berlaku di intern-update (bagian 2ac).
- Belum diuji manual di browser: pengiriman modul trainer, keputusan modul oleh approver, kuis peserta setelah kunci jawaban dipindah, dan fitur 22–23 Okt (lihat bagian 4).