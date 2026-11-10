# Kesiapan Rilis BARUNA (diperbarui 10 November 2026, mencakup pekerjaan sampai 10 November)

Ringkasan posisi proyek: apa yang sudah diperbaiki, apa yang belum, dan apa yang harus selesai sebelum dipakai banyak pengguna.
Rincian teknis per perbaikan: `dokumen/CATATAN_PERBAIKAN.md` (rencana sisa pekerjaan ada di bagian 2l).
Keputusan yang menunggu mentor: `dokumen/MENUNGGU_ARAHAN_MENTOR.md`.

## Kesimpulan

**Belum siap untuk rilis luas. Siap untuk uji terbatas (pilot) dengan syarat.**
Fondasinya jauh lebih kuat dari 17 Oktober: aturan penting kini dijaga di database, bukan hanya di tampilan.
"Vibe coding" bukan alasannya; alasannya adalah apa yang belum dibuktikan (bagian C).

Status pemeriksaan terakhir (10 Nov, laptop): semua migrasi sampai `20261110020000` sudah dijalankan di intern-update, kecuali `20261008030000`/`040000` (email kontak expert, menunggu keputusan; CATATAN_PERBAIKAN 2ac). Pengecek `check_migrations.sql` sekarang 70 baris. `tsc`, `build`, dan semua uji langsung lulus (daftar di CATATAN_PERBAIKAN bagian 4); 0 akun uji tertinggal. Database `main` belum dicek.

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
- **Lintas perangkat untuk Course Offering (9 Nov):** pendaftaran, modul yang ditandai selesai, evaluasi akhir, dan sertifikat course dari Course Offering tersimpan di database dan dibaca dengan identitas akun, sehingga muncul sama di perangkat atau browser mana pun dengan akun yang sama (My Learning dan tab Certificate). Lembar PDF sementara dibuat ulang di perangkat itu dari data database, jadi isinya sama. Dibuktikan oleh `test:certificate-sheet` (data diambil lewat server dengan token akun; peserta lain tidak mendapatkannya). Uji manual dengan dua perangkat nyata belum dilakukan.

## B. Belum diperbaiki atau belum diputuskan

- ~~Keamanan, Nomor 4-7~~ **SELESAI 21 Okt:** metadata modul tidak lagi terbaca pengunjung (4); izin tulis pengunjung dicabut di semua tabel/view (6); pengajuan Knowledge Hub divalidasi di database, termasuk berkas wajib milik pengaju (7); catatan pelaku dikosongkan saat akun dihapus, kepemilikan tetap dilindungi (5). Rincian: `CATATAN_PERBAIKAN.md` bagian 2l.
- ~~Konsistensi, Nomor 8-9~~ **SELESAI 21 Okt:** halaman governance membaca sistem peran baru, nama peran resmi (8); Impact Analytics hanya angka dari data, sisanya "Belum tersedia" (9).
- **Kelulusan kursus mandiri** (video/PDF/PPT/kuis modul bawaan) tetap laporan dari browser, karena isinya ada di kode. Tidak ada hak di server yang bergantung padanya (sertifikatnya berlabel CONTOH). Status ini sengaja dibiarkan.
- **Modul bawaan** (Ocean Literacy, AZA, Africa Fisheries) isinya di kode aplikasi, jadi hanya digerbang di tampilan. 13 PDF Master masih aset publik Lovable.
- **Full Training dan AZA** progresnya hanya di `localStorage` (tidak ikut berpindah perangkat). Program African Countries juga dihapus otomatis dari browser oleh halaman My Learning.
- **Menunggu mentor:** template dan syarat sertifikat, format nomor resmi, syarat lulus, publisher vs approver, Profile Claim (A1), nasib Full Training (P4), Penugasan Expert (disembunyikan), notifikasi email, kuota peserta, peserta yang sudah lulus saat modul diperbarui, Operator dan Data Master, email kontak expert di intern-update. (Role participant dan expert-jadi-trainer sudah diputuskan pemilik proyek, 21 dan 22 Okt.)
- **Program Academy, belum:** *certificate model* per Course Offering (Slide 26) dan jenis sertifikat lain, yang butuh data kehadiran dan asesmen (Slide 23); modul masih ditandai selesai oleh peserta sendiri, belum wajib lulus kuis/penilaian (Slide 24), jadi sertifikat tetap berlabel "CONTOH / BELUM RESMI"; hanya sertifikat kelulusan yang tersedia (jenis lain menunggu aturan); dari alur pendaftaran (Slide 22): seleksi/skor dan waitlist (unggah dokumen dan minta perbaikan sudah ada sejak 10 Nov), daftar dokumen wajib per offering menunggu mentor, berkas unggahan yang tidak jadi diajukan belum dibersihkan otomatis; aturan "Wajib hak akses khusus" masih ditutup; pembayaran belum ada (course mandiri hanya "Gratis"; course angkatan mencatat penanggung biaya tanpa tarif atau tagihan); desain dan isi STTP resmi (tanda tangan, stempel, format nomor) belum ada; isi pertanyaan template evaluasi dikelola lewat SQL; pembersihan sampul dijalankan manual; Webinar dan Workshop masih data contoh. Rencana di CATATAN_PERBAIKAN akhir 2al dan 2ao.
- **Teknis:** `types.ts` disinkronkan manual (menunggu `npx supabase login`).
- **Operasional:** database `main` belum diperiksa dan belum menerima migrasi (ranah mentor).

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

Pelajaran proses: sebelum bekerja di perangkat lain selalu `git pull`; setelah selesai commit + push.
