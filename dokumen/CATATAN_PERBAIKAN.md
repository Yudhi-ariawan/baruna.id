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

## 2i. Peserta: isi belajar modul hanya untuk yang berhak (P3)

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

Temuan audit yang BELUM diperbaiki: keputusan publikasi Knowledge Hub belum atomik dan tanpa guard status/peran; 12 policy tulis admin lama (`has_role`); `finalize_decision` tidak memeriksa jenis pengajuan; metadata modul tayang (`attached_resources`, `documents`, `video_url`) terbaca pengunjung lewat API langsung; 9 foreign key ke `auth.users` tanpa `ON DELETE` (akun tidak bisa dihapus; `test:kh-roles` meninggalkan 3 akun tiap kali dijalankan).

---

## 3. Migrasi yang harus dijalankan

**Database main dan intern-update adalah dua database Supabase berbeda.** Migrasi yang ditempel manual di SQL Editor tidak meninggalkan catatan, jadi gunakan pengecek:

1. Buka `supabase/check_migrations.sql`, tempel di SQL Editor database yang ingin diperiksa, lalu Run. (Hanya membaca, tidak mengubah apa pun.)
2. Hasilnya satu baris per migrasi (35 baris): `OK` atau `BELUM DIJALANKAN`.
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
- Notifikasi dalam aplikasi sudah mencakup permintaan layanan dan kualifikasi trainer; notifikasi email/chat belum ada.
- Kuota peserta yang disebut di flowchart belum dicek di kode.
- Antrean Verifikasi Expert sudah aman untuk data besar (dibaca bertahap), tetapi tampilannya masih memuat semua baris sekaligus; paginasi tampilan bisa ditambahkan bila jumlah pengajuan sudah ribuan.
- `academy.learn.$id.tsx` masih sekitar 1.629 baris; perlu dipecah.
- `src/integrations/supabase/types.ts` disinkronkan manual; sebaiknya dibuat ulang lewat Supabase CLI.
- Sekitar 46 akun sisa tes lama (`@example.test`) masih ada di database intern-update.
- Kelulusan kuis dan sertifikat peserta masih dicatat di `localStorage` browser (Slide 15: tidak boleh penyimpanan lokal di frontend). Penilaian kuisnya sudah di server.
- Pertanyaan untuk mentor: apakah "publisher" harus terpisah dari "approver"? Saat ini approve langsung menayangkan modul.
- Belum diuji manual di browser: pengiriman modul trainer, keputusan modul oleh approver, dan kuis peserta setelah kunci jawaban dipindah.
