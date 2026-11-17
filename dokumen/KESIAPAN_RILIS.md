# Kesiapan Rilis BARUNA (diperbarui 16 November 2026, mencakup pekerjaan sampai 16 November)

Ringkasan posisi proyek: apa yang sudah diperbaiki, apa yang belum, dan apa yang harus selesai sebelum dipakai banyak pengguna.
Rincian teknis per perbaikan: `dokumen/CATATAN_PERBAIKAN.md` (rencana sisa pekerjaan ada di bagian 2l).
Keputusan yang menunggu mentor: `dokumen/MENUNGGU_ARAHAN_MENTOR.md`.
Halaman `/kesiapanrilis` menampilkan dokumen ini sebagai papan: bagian A (butir yang "diuji manual oleh …" masuk kolom Test manual), bagian B, dan bagian E (Bug). Tulis setiap butir sebagai `- **Judul (tanggal):** isi`.

## Kesimpulan

**Belum siap untuk rilis luas. Siap untuk uji terbatas (pilot) dengan syarat.**
Fondasinya jauh lebih kuat dari 17 Oktober: aturan penting kini dijaga di database, bukan hanya di tampilan.
"Vibe coding" bukan alasannya; alasannya adalah apa yang belum dibuktikan (bagian C).

Status pemeriksaan terakhir (16 Nov, laptop): semua migrasi sampai `20261116040000` sudah dijalankan di intern-update, kecuali `20261008030000`/`040000` (email kontak expert, menunggu keputusan; CATATAN_PERBAIKAN 2ac). Pengecek `check_migrations.sql` sekarang 77 baris. `tsc`, `build`, dan semua uji langsung lulus (daftar di CATATAN_PERBAIKAN bagian 4); 0 akun uji tertinggal. Database `main` belum dicek.

## A. Sudah diperbaiki

- **Expert:** keputusan, publikasi, arsip, dan revisi dalam satu transaksi; kunci dua-admin-bersamaan; pemisahan wewenang; tulis langsung dari browser ditutup; satu aturan "pemilik profil" (`original_contributor_id`); direktori aman untuk data besar.
- **Trainer dan modul:** kunci jawaban kuis di tabel privat; simpan modul satu transaksi; kuota menghitung antrean; revisi modul tayang tidak menariknya dari publik.
- **Peserta:** pendaftaran, progres, dan penerbitan sertifikat lewat RPC database (nomor dari server, klik ganda aman); verifikasi sertifikat membaca data asli; biodata satu RPC dengan validasi (akun nonaktif tidak bisa hidup lagi); sinkron kursus mandiri lewat `self_paced_sync` yang tidak pernah menurunkan progres.
- **Ruang belajar:** isi modul dan penilaian kuis hanya untuk peserta disetujui, penulis, dan admin (`can_access_module_content`); Full Training lewat persetujuan admin; link materi 1 jam; draf modul belum tayang tidak bisa diambil publik.
- **Knowledge Hub:** keputusan publikasi dalam satu transaksi dengan aturan status dan peran.
- **Keamanan database (20 Okt):** audit RLS/view/grant (`supabase/audit_security.sql`); tulis lewat view `languages` dan fungsi internal yang terbuka ditutup; sistem peran lama dihentikan.
- **Sertifikat:** ditandai "CONTOH / BELUM RESMI" sampai template dan aturan resmi siap.
- **Kebersihan:** akun uji tidak lagi menumpuk; `academy.learn.$id.tsx` dipecah.
- **Peran dan konsol (21 Okt):** Konsol Kurasi per peran; peran expert hanya lewat alur pendaftaran; status pengajuan dan penugasan reviewer tidak bisa ditulis langsung dari browser.
- **Pembelajaran dan permintaan pelatihan (21 Okt):** kelulusan modul dicatat server dari kuis resmi; dashboard peserta; My Training Requests dari server dengan riwayat status, SLA, dan notifikasi.
- **Versi konten (21–22 Okt):** modul, publikasi Knowledge Hub, dan profil expert yang tayang **tetap tayang selama revisi**; trainer, kontributor, dan expert bisa mengajukan pembaruan sendiri lewat review; riwayat versi terlihat; peserta yang sedang belajar diberi tahu saat modul diperbarui.
- **Trainer (22 Okt):** expert menjadi trainer otomatis hanya bila memilih peran Trainer.
- **Admin (23 Okt):** Tambah User tidak lagi diam-diam gagal memberi peran.
- **Data Master (23 Okt):** bidang keahlian expert, aturan level trainer, dan kuota modul per level dikelola di Konsol Kurasi dengan validasi dan audit trail; tidak lagi ditulis tetap di kode atau hanya lewat SQL.
- **Data Master lanjutan (2 Nov):** daftar trainer per level, topik Knowledge Hub, bahasa, dan kategori pelatihan Request a Training dikelola di Data Master dan diperiksa database saat formulir dikirim; Template Review (yang tidak punya fungsi) dihapus; antrean Konsol Kurasi dipaginasi.
- **Program Academy (4 Nov):** Master Course (dengan modul dan gambar sampul) dan Course Offering dibuat dan diubah lewat draf, disetujui Approver/Admin lain, dan berversi; course tayang tampil di katalog Training, Self-Paced, dan All Programs; jalur ubah lama yang melewati persetujuan ditutup (CATATAN_PERBAIKAN 2ai-2al).
- **Sertifikat (5 Nov):** sertifikat kelulusan kini bisa terbit lewat tampilan (semua modul selesai + evaluasi akhir terkirim bila diwajibkan); evaluasi kosong, jenis sertifikat pilihan sendiri (mis. kompetensi), dan sertifikat gratis untuk course berbayar ditutup di database; template evaluasi dipilih di formulir offering dan tidak bisa diubah satu orang; gambar sampul yang tidak terpakai bisa dibersihkan (CATATAN_PERBAIKAN 2am-2ao). Peserta bisa melihat dan mengunduh **lembar sertifikat sementara** (PDF bertanda SEMENTARA/CONTOH, tanpa stempel atau tanda tangan pejabat, dengan QR ke halaman verifikasi; 2ap). Halaman My Learning menampilkan course dari Course Offering beserta sertifikatnya (2aq, 9 Nov).
- **Persetujuan kelulusan sebelum sertifikat terbit (9 Nov, PB-ACA-05, Slide 24, 26, 27; CATATAN_PERBAIKAN 2ar):**
  - Sebelumnya: peserta selesai belajar, klik tombol, lalu sertifikatnya langsung terbit sendiri. Panduan tidak mengizinkan ini.
  - Sekarang: peserta menyelesaikan modul dan evaluasi, sistem otomatis memasukkannya ke antrean persetujuan, dan di tab Certificate tertulis "Menunggu persetujuan kelulusan". Approver atau Admin **lain** membuka menu **Persetujuan Kelulusan** di Konsol Kurasi, lalu memilih **Setujui** (peserta dinyatakan lulus dan sertifikatnya terbit) atau **Minta remedial** (wajib menulis alasan, dan peserta bisa membacanya). Peserta mendapat notifikasi, lalu bisa melihat dan mengunduh sertifikatnya.
  - Aturan yang ikut dipenuhi: tersedia tombol **Setujui terpilih**; tidak ada orang yang bisa menyetujui kelulusannya sendiri; Operator dan Reviewer hanya bisa melihat antrean; **pembayaran tidak lagi menahan kelulusan** (course berbayar tetap bisa lulus, hanya sertifikatnya yang ditahan); sertifikat yang sudah terbit tetap berlaku.
  - Bukti: `test:completion-approval` 26/26 sesudah migrasi (3/26 sebelum), termasuk dua modul ditandai bersamaan dan dua pemutus bersamaan; semua uji lain lulus; sudah diuji manual oleh pemilik proyek.
- **Pendaftaran dengan persetujuan untuk Course Offering (10 Nov, PB-ACA-03, Slide 22; CATATAN_PERBAIKAN 2as):** offering bisa memakai aturan **"Wajib disetujui admin"**. Di halaman course peserta menekan **Ajukan pendaftaran** (bila biodata belum ada, diarahkan mengisinya lalu kembali), lalu melihat status *Menunggu persetujuan*. Admin, Operator, atau Approver memutuskan di **Persetujuan Peserta**: ditolak (dengan alasan, peserta bisa mengajukan lagi) atau disetujui (peserta otomatis terdaftar dan bisa belajar). Pengajuan hanya diterima untuk offering yang memang meminta pengajuan, masih tayang, dan dalam masa pendaftaran; judulnya diambil dari database. Bukti: `test:offering-application` 18/18 (11/18 sebelum migrasi), semua uji lain lulus, diuji manual oleh pemilik proyek.
- **Dokumen persyaratan dan Minta Perbaikan (10 Nov, Slide 22; CATATAN_PERBAIKAN 2at):** admin menulis daftar dokumen per offering (satu baris satu dokumen). Peserta mengunggah PDF (maks 10 MB) ke penyimpanan privat sebelum mengajukan. Di Persetujuan Peserta, admin membuka dokumen lewat tautan sementara, lalu bisa memilih **Minta Perbaikan** dengan catatan. Peserta mengganti dokumen dan menekan **Kirim ulang**. Selama menunggu perbaikan, pengajuan tidak bisa langsung disetujui atau ditolak. Dokumen hanya bisa dibuka pemiliknya dan pengelola pendaftaran. Bukti: `test:enrollment-revision` 16/16 sesudah migrasi (3/16 sebelum); diuji manual oleh pemilik proyek (offering dengan dua dokumen, minta perbaikan).
- **Notifikasi keputusan pendaftaran dan dashboard peserta (10 Nov, Slide 13, 22, 27; CATATAN_PERBAIKAN 2au):**
  - Sebelumnya: setelah admin menekan Minta Perbaikan, peserta tidak menerima notifikasi apa pun (begitu juga saat disetujui atau ditolak), dan dashboard menulis "Menunggu persetujuan 0" tanpa menyebut pengajuannya. Course Offering di dashboard dihitung seperti modul: progresnya selalu 0%, tertulis "kuis belum dikerjakan", dan tombol *Lanjutkan* membuka halaman yang salah.
  - Sekarang: peserta menerima notifikasi *disetujui*, *ditolak* (dengan alasan), dan *diminta perbaikan* (dengan catatan), dengan tautan ke halaman course atau modulnya. Dashboard menampilkan pengajuan yang perlu perbaikan, lengkap dengan catatan dan tombol **Perbaiki dan kirim ulang**. Course Offering tampil dengan "x dari y modul selesai", status kelulusan, dan tombol ke halaman course. Halaman modul juga menampilkan status *Admin Meminta Perbaikan*.
  - Tanpa migrasi. Bukti: `test:participant-dashboard` 21/21 (9/21 dengan kode lama), termasuk data dan notifikasi peserta lain yang tidak terlihat.
- **Full Training tidak lagi macet setelah Minta Perbaikan (11 Nov, Slide 22; CATATAN_PERBAIKAN 2av):**
  - Sebelumnya: bila admin menekan *Minta Perbaikan* pada pengajuan Full Training, halaman peserta tetap menulis "Under Review" tanpa tombol kirim ulang, sementara admin tidak bisa memutuskan karena sistem menunggu perbaikan. Pengajuan terjebak. Notifikasi dan dashboard juga salah mengira Full Training sebagai modul dan menautkan ke halaman yang tidak ada.
  - Sekarang: halaman pengajuan Full Training dan daftar pengajuannya menampilkan **Revision Requested** dengan catatan admin. Peserta menulis tanggapan lalu menekan **Kirim ulang**, dan pengajuan kembali menunggu keputusan admin. Kotak yang sama ada di dashboard, sehingga bisa dipakai dari perangkat mana pun (formulir Full Training sendiri hanya tersimpan di satu browser). Notifikasinya menuju halaman Pendaftaran.
  - Tanpa migrasi. Bukti: `test:participant-dashboard` 29/29 (27/29 dengan kode sebelumnya).
- **Pendaftaran tahan permintaan serentak (11 Nov, CATATAN_PERBAIKAN 2aw):** uji baru `test:enrollment-concurrency` mengirim permintaan pada detik yang sama dari beberapa login. Hasilnya: peserta yang menekan *Ajukan* dari tiga perangkat sekaligus tetap menghasilkan satu pengajuan; dua admin yang memutuskan bersamaan menghasilkan satu keputusan (yang kalah diberi tahu "sudah diputuskan"); pendaftaran course tidak pernah ganda; kirim ulang yang bersamaan tercatat satu kali. 15/15 lulus tanpa perubahan kode, jadi kunci di database terbukti bekerja.
- **Dokumen pendaftaran tercatat di server sebelum dikirim (11 Nov, CATATAN_PERBAIKAN 2aw):** dokumen yang diunggah di halaman course langsung tercatat di server dengan label *belum dikirim*, sehingga terlihat dan bisa dikirim dari HP atau laptop mana pun dengan akun yang sama. Unggahan terakhir yang dipakai bila dua perangkat mengganti dokumen yang sama, dan catatannya hilang begitu pengajuan terkirim. Berkas yang tidak terpakai dibersihkan dengan `npm run cleanup:enrollment-documents`. Bukti: `test:enrollment-uploads` 15/15 sesudah migrasi (2/15 sebelum).
- **Berkas formulir Full Training sampai ke admin dan bisa diganti saat perbaikan (11 Nov, Slide 22; CATATAN_PERBAIKAN 2ax):**
  - Sebelumnya: lima berkas di formulir Full Training (paspor, CV, surat penugasan, surat motivasi, foto) hanya dicatat namanya di browser. Admin tidak bisa membukanya, dan setelah *Minta Perbaikan* peserta tidak punya tempat untuk mengunggah ulang (temuan uji manual pemilik proyek).
  - Sekarang: berkas terkirim ke penyimpanan privat (PDF maks 10 MB, JPG/PNG maks 2 MB) dan bisa dibuka admin. Saat diminta perbaikan, tombol di notifikasi membuka halaman program yang menampilkan catatan admin dan kelima dokumen. Peserta cukup mengganti dokumen yang bermasalah lalu menekan **Send again**, dari perangkat mana pun. Pengajuan yang dikirim sebelum perbaikan ini harus melengkapi kelima dokumen sekali, karena berkasnya dulu tidak pernah terkirim.
  - Bukti: `test:full-training-documents` 19/19 sesudah migrasi (4/19 sebelum); PGlite 31/31; semua uji lain lulus; sudah diuji manual oleh pemilik proyek (11 Nov): mengunggah kelima berkas saat perbaikan, admin membuka berkas lalu menyetujui, dan halaman pengajuan peserta menampilkan *Accepted* beserta kelima dokumen yang terkirim.
- **Pengajuan lama yang tercatat dengan judul offering (11 Nov, CATATAN_PERBAIKAN 2ay):** sebelumnya notifikasi dan dashboard menganggapnya modul dan menautkan ke halaman yang tidak ada. Sekarang judul diterjemahkan ke kode offering, sehingga tautannya menuju halaman course yang benar. Tanpa migrasi. Bukti: bagian 5 `test:live-notifications` lulus (kode lama gagal 2 cek). Di intern-update tidak ada pengajuan seperti itu; `main` belum diperiksa.
- **Keputusan tampil langsung tanpa memuat ulang (11 Nov, Slide 13; CATATAN_PERBAIKAN 2ay):** sebelumnya keputusan admin baru terlihat saat halaman dimuat ulang. Sekarang *setujui*, *tolak*, *minta perbaikan*, dan keputusan kelulusan langsung muncul di lonceng, dashboard, dan halaman pendaftaran peserta (sekitar 0,4 detik lewat Supabase Realtime), dan antrean Persetujuan Peserta langsung menampilkan kiriman ulang. Peserta hanya menerima perubahan miliknya sendiri. Sumber notifikasi lain disegarkan tiap 60 detik. Bukti: `test:live-notifications` 14/14 sesudah migrasi (10/14 sebelum), semua uji lain lulus.
- **Operator mengelola Data Master lewat usulan (16 Nov, Slide 16; keputusan pemilik proyek; CATATAN_PERBAIKAN 2az):** Operator kini bisa membuka Data Master. Setiap perubahan yang ia simpan menjadi usulan di panel *Usulan Perubahan*, lalu Approver atau Admin **lain** menyetujui (perubahan diterapkan dengan aturan yang sama) atau menolak dengan alasan. Approver dan Admin tetap menyimpan langsung, dan setiap langkah tercatat. Bukti: `test:master-data-requests` 21/21 sesudah migrasi (5/21 sebelum).
- **Publisher menurunkan sementara dan menayangkan lagi (16 Nov, Slide 16; keputusan pemilik proyek; CATATAN_PERBAIKAN 2ba):** konten yang disetujui tetap langsung tayang (Slide 21). Lewat menu *Penayangan*, Publisher atau Admin bisa menurunkan sementara Course Offering, modul, publikasi Knowledge Hub, atau profil Expert dengan alasan; konten langsung hilang dari semua halaman publik dan tidak menerima pendaftaran baru. *Tayangkan lagi* mengembalikannya, dan selama diturunkan alur lain tidak bisa menayangkannya kembali. Belum: penjadwalan tayang, serta Events/Partnership/Community/About yang belum punya data di database. Bukti: `test:publication-hold` 16/16 sesudah migrasi (1/16 sebelum).
- **Full Training menjadi Course Offering: kehadiran dan pengalihan (16 Nov, Slide 23; keputusan pemilik proyek; CATATAN_PERBAIKAN 2bb):** menu *Kehadiran* untuk membuat sesi course angkatan dan mencatat Hadir/Terlambat/Izin/Tidak hadir per peserta; peserta melihat kehadirannya di halaman course. Program Full Training lama bisa ditautkan ke offering pengganti di Program Academy: pendaftar baru diarahkan ke course itu, sedangkan pengajuan yang sudah berjalan selesai di jalur lama. Kehadiran belum menjadi syarat lulus. Bukti: `test:offering-attendance` 14/14 sesudah migrasi (3/14 sebelum); semua 42 uji lulus. Sudah diuji manual oleh pemilik proyek (16 Nov, laptop): Master Course 13 modul dan offering `africa-fisheries-2026-b1` dibuat dan disetujui orang lain, program lama ditautkan, *Enroll Now* membawa ke course baru, peserta mengunggah 5 dokumen PDF dan disetujui, sesi "Hari 1 — Pembukaan" dicatat, dan peserta melihat kehadirannya. Datanya diperiksa ada di database Supabase, bukan di browser. Uji di HP menyusul (bagian B).
- **Semua halaman pas di layar HP (17 Nov):** pemilik proyek menemukan Knowledge Hub tidak responsif di HP. Audit otomatis membuka 113 halaman dengan lebar HP (390 px), termasuk halaman yang butuh login: 8 halaman melebar (Knowledge Hub 756 px, detail publikasi, Events Following, Admin Publikasi, Academy, Alumni, Alumni Network, detail Full Training) sehingga di HP tampil mengecil atau terpotong. Penyebab umumnya: grid tanpa kolom dasar di ukuran HP membesar mengikuti teks satu baris (judul, nama organisasi); plus nama berkas panjang tanpa spasi di Admin Publikasi. Perbaikan: `grid-cols-1` sebagai dasar pada 220 grid di 93 berkas (tampilan tablet/laptop tidak berubah) dan nama berkas dipotong dengan "…". Audit ulang: 0 dari 113 halaman melebar, tidak ada halaman error. 14 halaman beralamat dinamis (detail event, alumni, pathway, dll.) belum diukur, tetapi memakai grid yang sama sehingga ikut diperbaiki.
- **Uji di HP dan dua perangkat (17 Nov):** sudah diuji manual oleh pemilik proyek dengan HP (peserta) dan laptop (admin, serta peserta di jendela kedua), lewat `npm run dev -- --host` di Wi-Fi yang sama. (1) Kehadiran: admin mengubah Terlambat menjadi Hadir di laptop, HP menampilkan Hadir setelah dimuat ulang. (2) Dokumen pendaftaran: diunggah di HP, terlihat sebagai *belum dikirim* di perangkat lain, dikirim ulang dari sana, dibuka dan disetujui admin; notifikasi "Pendaftaran disetujui" muncul di HP tanpa memuat ulang. (3) Tampilan HP: menu akun tanpa item dobel, kartu *Recommended for You* bisa digeser, dialog Persetujuan Peserta bisa digulir.
- **Lintas perangkat untuk Course Offering (9 Nov):** pendaftaran, modul yang ditandai selesai, evaluasi akhir, dan sertifikat course dari Course Offering tersimpan di database dan dibaca dengan identitas akun, sehingga muncul sama di perangkat atau browser mana pun dengan akun yang sama (My Learning dan tab Certificate). Lembar PDF sementara dibuat ulang di perangkat itu dari data database, jadi isinya sama. Dibuktikan oleh `test:certificate-sheet` (data diambil lewat server dengan token akun; peserta lain tidak mendapatkannya). Uji manual dengan dua perangkat nyata belum dilakukan.

## B. Belum diperbaiki atau belum diputuskan

- ~~Keamanan, Nomor 4-7~~ **SELESAI 21 Okt:** metadata modul tidak lagi terbaca pengunjung (4); izin tulis pengunjung dicabut di semua tabel/view (6); pengajuan Knowledge Hub divalidasi di database, termasuk berkas wajib milik pengaju (7); catatan pelaku dikosongkan saat akun dihapus, kepemilikan tetap dilindungi (5). Rincian: `CATATAN_PERBAIKAN.md` bagian 2l.
- ~~Konsistensi, Nomor 8-9~~ **SELESAI 21 Okt:** halaman governance membaca sistem peran baru, nama peran resmi (8); Impact Analytics hanya angka dari data, sisanya "Belum tersedia" (9).
- **Kelulusan kursus mandiri** (video/PDF/PPT/kuis modul bawaan) tetap laporan dari browser, karena isinya ada di kode. Tidak ada hak di server yang bergantung padanya (sertifikatnya berlabel CONTOH). Status ini sengaja dibiarkan.
- **Modul bawaan** (Ocean Literacy, AZA, Africa Fisheries) isinya di kode aplikasi, jadi hanya digerbang di tampilan. 13 PDF Master masih aset publik Lovable.
- **Full Training dan AZA** progresnya hanya di `localStorage` (tidak ikut berpindah perangkat). Program African Countries juga dihapus otomatis dari browser oleh halaman My Learning. Berkas formulir Full Training: lihat bagian E (perbaikan siap, 11 Nov).
- **Menunggu mentor:** template dan syarat sertifikat, format nomor resmi, syarat lulus (termasuk apakah kehadiran wajib), Profile Claim (A1), data perjalanan/visa peserta, Penugasan Expert (disembunyikan), notifikasi email, kuota peserta, peserta yang sudah lulus saat modul diperbarui, email kontak expert di intern-update. (Role participant dan expert-jadi-trainer sudah diputuskan pemilik proyek, 21 dan 22 Okt.)
- **Program Academy, belum:** *certificate model* per Course Offering (Slide 26) dan jenis sertifikat lain, yang butuh data kehadiran dan asesmen (Slide 23); modul masih ditandai selesai oleh peserta sendiri, belum wajib lulus kuis/penilaian (Slide 24), jadi sertifikat tetap berlabel "CONTOH / BELUM RESMI"; hanya sertifikat kelulusan yang tersedia (jenis lain menunggu aturan); dari alur pendaftaran (Slide 22): seleksi/skor dan waitlist (unggah dokumen dan minta perbaikan sudah ada sejak 10 Nov), daftar dokumen wajib per offering menunggu mentor, berkas unggahan yang tidak terpakai dibersihkan dengan perintah manual `cleanup:enrollment-documents` (belum terjadwal otomatis); aturan "Wajib hak akses khusus" masih ditutup; pembayaran belum ada (course mandiri hanya "Gratis"; course angkatan mencatat penanggung biaya tanpa tarif atau tagihan); desain dan isi STTP resmi (tanda tangan, stempel, format nomor) belum ada; isi pertanyaan template evaluasi dikelola lewat SQL; pembersihan sampul dijalankan manual; Webinar dan Workshop masih data contoh. Rencana di CATATAN_PERBAIKAN akhir 2al dan 2ao.
- **Teknis:** `types.ts` disinkronkan manual (menunggu `npx supabase login`).
- **Operasional:** database `main` belum diperiksa dan belum menerima migrasi (ranah mentor).

- **Uji manual A Data Master dan B Penayangan (16 Nov):** langkahnya ada di bagian F; belum dilaporkan selesai. Sejauh ini Data Master baru dicoba dengan akun Super Admin, yang memang langsung menyimpan tanpa usulan.

## C. Kenapa belum siap dirilis luas

1. **Lintas device:** course dari Course Offering (pendaftaran, progres, evaluasi akhir, sertifikat) ikut berpindah perangkat karena seluruhnya di database (9 Nov). Kursus mandiri lama ikut berpindah lewat sinkronisasi ke server (tombol "Sinkronkan dari Akun Cloud"). Full Training dan AZA **tidak**: progres dan sertifikatnya hanya di browser tempat belajar (menunggu keputusan nasib program lama, P4).
2. **Banyak user bersamaan:** belum ada uji beban; pengaturan Supavisor (port 6543) belum diperiksa.
3. **Berbagai perangkat dan browser:** tampilan di HP dan browser lain belum diuji.
4. **Berbagai role:** diuji lewat skrip dan database, belum oleh orang lewat browser dengan akun nyata. Yang secara khusus belum diuji manual: P3 (modul dinamis), P5 (form biodata, halaman Akun, unggah foto), P6 (kursus mandiri di dua perangkat), keputusan Knowledge Hub, dan fitur 22–23 Okt (pembaruan profil expert, pembaruan publikasi, riwayat versi, Tambah User, Data Master).
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

## E. Bug dan celah yang diketahui

Per 11 Nov tidak ada bug terbuka yang diketahui. Semua temuan audit 10 Nov sudah diperbaiki dan dipindah ke bagian A. Yang masih perlu: uji dua perangkat sungguhan (bagian C).


## F. Langkah uji manual pekerjaan 16 November

Persiapan: buat akun yang perannya **hanya Operator** dan **hanya Publisher** lewat Portal Admin → Tambah User. Akun `admin99` memegang hampir semua peran, sehingga perubahannya selalu langsung tersimpan.

**A. Data Master (Operator mengusulkan, Approver/Admin menyetujui).**
1. Login sebagai Operator, buka Konsol Kurasi → Data Master, lalu tambah satu bahasa (misalnya Sundanese, kode `su`).
2. Pastikan muncul "Usulan terkirim" dan bahasanya belum ada di daftar.
3. Login sebagai Approver/Admin, lalu klik **Setujui** di *Usulan Perubahan*. Bahasanya kini muncul.
4. Ulangi dengan usulan lain, lalu **Tolak** dengan alasan. Operator melihat alasannya di riwayat.

**B. Publisher (turunkan sementara dan tayangkan lagi).**
1. Login sebagai Publisher, buka **Penayangan**, dan pilih satu modul.
2. Klik **Turunkan sementara** dan tulis alasannya.
3. Buka halaman Academy di jendela lain: modul itu sudah hilang.
4. Klik **Tayangkan lagi**: modul itu tampil kembali.

**C. Full Training ke Course Offering (sudah diuji manual oleh pemilik proyek, 16 Nov).**
1. Di Program Academy, buat Master Course "International Training on Fisheries for African Countries" beserta modulnya, lalu minta orang lain menyetujuinya.
2. Buat Offering cohort-based, blended, "Wajib disetujui admin", dengan dokumen Passport Copy, CV, Nomination Letter, Motivation Letter, dan Recent Passport Photo. Minta disetujui.
3. Di panel *Full Training lama → Course Offering*, pilih offering tadi lalu Simpan.
4. Logout, buka halaman program Full Training, dan klik *Enroll Now*: Anda dibawa ke halaman course baru.
5. Login dengan akun peserta lain, ajukan pendaftaran di course itu (lima dokumen PDF), lalu setujui sebagai admin.
6. Buka menu **Kehadiran**, pilih offering, tambah sesi "Hari 1", tandai peserta Hadir, lalu Simpan.
7. Login sebagai peserta dan buka halaman course: di kolom samping tertulis "Hadir 1 dari 1 sesi tercatat".

Temuan selama uji C: kode modul yang disalin dari tabel membawa karakter Tab tersembunyi sehingga draf ditolak tanpa menyebut modul mana. Sudah diperbaiki: formulir Program Academy kini merapikan kode otomatis dan menandai isian yang salah di kolomnya (CATATAN_PERBAIKAN 2bc).

Pelajaran proses: sebelum bekerja di perangkat lain selalu `git pull`; setelah selesai commit + push.
