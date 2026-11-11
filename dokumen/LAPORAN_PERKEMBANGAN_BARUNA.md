# Laporan Perkembangan BARUNA (14 Oktober – 5 November 2026)

Branch `intern-update`. Acuan: 51 slide proses bisnis. Rincian teknis per perbaikan ada di `CATATAN_PERBAIKAN.md`.
Format tanggal di laporan ini: **tanggal/bulan/tahun** (04/11/2026 = 4 November 2026; di Windows tertulis 11/4/2026).

---

## 14/10/2026

**Yang diperbaiki**
- **Alur pendaftaran Expert** dikuatkan terhadap klik ganda dan dua admin yang memutuskan bersamaan.
  - Keputusan yang sama tidak bisa diulang.
  - Pemohon tidak bisa memutuskan pengajuannya sendiri.
- **Unggah berkas Expert:** tidak ada lagi lampiran "hantu". Bila unggah gagal, proses berhenti dengan pesan jelas.
- **Riwayat status trainer** sekarang berversi, sehingga membuka halaman tidak lagi mengaktifkan ulang trainer yang dinonaktifkan admin.
- **Email pemohon** dibaca dari data akun yang benar (sebelumnya dari kolom yang tidak ada).
- **Peserta:** celah persetujuan lewat data yang bisa diubah pengguna ditutup. Pendaftaran tidak lagi ganda, dan keputusan admin dalam satu transaksi.

**Yang dibuat**
- **Konsol Penugasan Expert (PB-EXP-03):** admin meninjau, mencocokkan, menugaskan, menjadwalkan, dan menyelesaikan permintaan. Ada alur tanya-jawab dua arah dengan pemohon.
- **Pengajuan Kualifikasi Trainer** untuk expert non-trainer.
- **Modularisasi:** halaman pengajuan modul trainer dipecah dari 1.518 menjadi 516 baris, tanpa perubahan perilaku.
- Dokumen catatan perbaikan untuk mentor.

---

## 15/10/2026

**Yang diperbaiki**
- **Modul trainer:**
  - Aturan kelayakan modul dipindah ke database.
  - Keputusan admin atomik.
  - Kunci jawaban kuis dipindah ke tabel privat.
  - Modul yang tayang tetap tayang selama direvisi.
  - Simpan modul dalam satu transaksi.
  - Kuota ikut menghitung modul yang masih menunggu keputusan.
- **Expert:** keputusan, publikasi, arsip, dan kirim ulang revisi dalam satu transaksi.
- **Jalur tulis langsung dari browser ditutup** untuk draf, pengajuan, dan profil.

**Yang dibuat**
- **Pengecek status migrasi** (`check_migrations.sql`, hanya membaca), karena main dan intern-update adalah dua database berbeda.
- Kuota modul per level dipindah dari kode ke tabel konfigurasi.
- Notifikasi untuk permintaan layanan dan kualifikasi trainer.
- Pencarian profil expert yang duplikat.

---

## 17/10/2026

**Yang diperbaiki**
- **Direktori dan antrean admin Expert** aman untuk data besar, dan pengaman duplikat aktif.
- **Bahasa profil expert** dipetakan ke daftar bahasa baku. Sebelumnya hampir semua bahasa gagal tersimpan tanpa pesan.
- Status "arsip" diizinkan di database.
- **Ruang belajar** hanya terbuka lewat persetujuan admin di server.
- Pembersihan uji `test:kh-roles` tidak lagi meninggalkan akun uji.

**Yang dibuat**
- Uji langsung ke database untuk keputusan Expert (`test:expert-rpc`).
- Dokumen kesiapan rilis dan daftar pertanyaan untuk mentor.

---

## 20/10/2026

**Yang diperbaiki**
- **Peserta:**
  - Pendaftaran, progres, dan penerbitan sertifikat lewat database.
  - Verifikasi sertifikat membaca data asli.
  - Biodata dan progres pelatihan mandiri tervalidasi.
  - Isi belajar modul hanya untuk peserta yang disetujui, penulis, dan admin.
- **Sertifikat** diberi tanda "CONTOH / BELUM RESMI" sampai template resmi siap.
- **Expert:** satu aturan "pemilik profil" di semua tempat. Judul halaman yang hurufnya rusak diperbaiki, dan statistik direktori tidak lagi terpotong di 1.000 baris.
- **Keamanan database:**
  - Tulis lewat view `languages` dan fungsi internal yang terbuka untuk umum ditutup.
  - Keputusan publikasi Knowledge Hub dalam satu transaksi.
  - **Sistem peran lama dihentikan**, karena membuat admin tersembunyi.
- **Impact Analytics** dibaca dari data platform.

**Yang dibuat**
- Query audit keamanan baca-saja (`audit_security.sql`).
- Uji langsung keputusan Knowledge Hub (`test:kr-rpc`).
- Menu Penugasan Expert disembunyikan sementara sampai SOP-nya jelas.

---

## 21/10/2026

**Yang diperbaiki**
- **Keamanan:**
  - Metadata modul tidak lagi terbaca pengunjung.
  - Izin tulis pengunjung tanpa login dicabut di semua tabel.
  - Catatan pelaku dikosongkan saat akun dihapus, tanpa merusak kepemilikan.
  - Aturan pengajuan Knowledge Hub divalidasi di database, termasuk berkas milik pengaju.
  - Status pengajuan dan penugasan reviewer tidak bisa ditulis langsung dari browser.
- **Peran expert** hanya bisa diberikan lewat persetujuan pendaftaran dan dicabut lewat arsip.
- **Impact Analytics** hanya menampilkan angka dari data. Yang belum tercatat tampil "Belum tersedia".
- **Menu akun di beranda** lebih cepat.

**Yang dibuat**
- **Konsol Kurasi per peran:** setiap peran hanya melihat menu sesuai tugasnya (Slide 16).
- **Kelulusan modul dicatat server** dari kuis resmi, plus dashboard peserta, pemantauan Admin/Operator, dan ringkasan trainer.
- **My Training Requests** dari server, dengan riwayat status, SLA, dan notifikasi.
- **Trainer memperbarui modul tayangnya sendiri.**
- Uji langsung baru: penguncian peran expert, pembatasan penulisan status pengajuan, dan progres belajar.

---

## 22/10/2026

**Yang diperbaiki**
- **Revisi modul oleh Admin/Approver** sekarang dimulai dari versi yang sedang tayang.
  - Sebelumnya, kuis dan lampiran yang sudah ditolak ikut terbawa lagi ke revisi.
  - Revisi tidak bisa dibuka selama masih ada kiriman trainer yang menunggu keputusan. Sebelumnya kiriman itu ditarik diam-diam.
- **Knowledge Hub: publikasi tetap tayang selama direvisi.**
  - Sebelumnya, publikasi yang diminta revisi atau ditolak hilang dari katalog, dan versi yang sudah disetujui ikut terhapus.
  - Sekarang revisi yang ditolak membuat versi lama tetap tayang. Revisi yang disetujui menaikkan nomor versinya.
  - Satu publikasi yang sempat tersembunyi ("Teknologi Pemantauan Rumpon…") ditayangkan kembali.
- **Expert: profil, role, dan status trainer tidak dicabut lagi saat diminta revisi.** Sebelumnya expert langsung hilang dari direktori dan kehilangan akses Portal Trainer hanya karena diminta melengkapi data.
- **Expert menjadi trainer hanya bila memilih peran "Trainer".**
  - Sebelumnya semua expert yang disetujui otomatis menjadi trainer, termasuk yang hanya memilih Reviewer.
  - Expert lain bisa menjadi trainer lewat pengajuan Kualifikasi Trainer.
  - Status trainer yang sudah ada tidak dicabut.
- Merapikan 10 peringatan Tailwind di editor, tanpa perubahan tampilan.

**Yang dibuat**
- **Ajukan Pembaruan (Knowledge Hub):** kontributor bisa memperbarui publikasinya sendiri dari My Contributions. Versi lama tetap tayang sampai pembaruan disetujui, dan pembaruan bisa dibatalkan sebelum dikirim.
- **Perbarui Profil (Expert):** expert bisa mengajukan pembaruan profilnya lewat review. Profil lama tetap tayang sampai pembaruan disetujui.
- **Riwayat Versi:** daftar v1, v2, dan seterusnya, lengkap dengan tanggal, penyetuju, dan alasan.
  - Tampil di Konsol Kurasi, Portal Trainer, My Contributions, dan halaman expert.
  - Data pribadi seperti kontak dan kunci jawaban kuis tidak ditampilkan.
- **Notifikasi peserta:** peserta yang sedang belajar (belum lulus) diberi tahu saat modulnya diperbarui ke versi baru.

---

## 23/10/2026

**Yang diperbaiki**
- **Tambah User tidak lagi diam-diam gagal memberi peran.**
  - Sebelumnya, admin biasa bisa mencentang peran, tetapi akun dibuat tanpa peran itu, tanpa pesan apa pun, dan audit trail mencatatnya seolah berhasil.
  - Sekarang permintaan itu ditolak sebelum akun dibuat, dengan pesan yang jelas.
  - Hanya Super Admin yang bisa memberi peran, sesuai aturan database. Admin biasa melihat peran dalam mode baca saja.

**Yang dibuat**
- **Menu "Data Master" di Konsol Kurasi** untuk Approver, Admin, dan Super Admin (Slide 16).
  - **Bidang keahlian:**
    - Bisa ditambah, diubah, dan diaktifkan/dinonaktifkan, lengkap dengan jumlah pemakaiannya.
    - Bidang yang sudah dipakai profil tidak bisa diganti namanya. Caranya: nonaktifkan, lalu buat bidang baru.
    - Bidang aktif terakhir tidak bisa dinonaktifkan.
  - **Aturan level trainer:** disimpan sebagai versi baru, dan versi lama tetap tercatat. Angkanya wajib naik berurutan, dan alasan perubahan wajib diisi.
  - **Kuota modul per level trainer:** batas jumlah modul aktif untuk Certified, Advanced, Senior, dan Master.
    - Sebelumnya hanya bisa diubah lewat SQL, tanpa catatan.
    - Angkanya 1–9.999. Level yang lebih tinggi tidak boleh mendapat kuota lebih kecil, dan alasan perubahan wajib diisi.
    - Bila dua orang menyimpan bersamaan, hanya satu yang tersimpan, jadi tidak ada perubahan yang tertimpa diam-diam.
    - Menurunkan kuota tidak menarik modul yang sudah ada.
    - Panel menampilkan jumlah trainer aktif per level dan riwayat perubahan.
  - Semua perubahan hanya bisa lewat database yang memeriksa peran, dan selalu tercatat di audit trail.
- **Formulir Become an Expert** sekarang membaca daftar bidang dari Data Master. Pendaftar tetap melihat 15 bidang yang sama dengan urutan yang sama. Bidang yang sudah dipilih tetapi kemudian dinonaktifkan tetap terlihat (bertanda) supaya bisa dihapus.
- **Saat pengajuan dikirim**, database memeriksa bahwa setiap bidang ada di daftar.
- **Tidak ada data yang dihapus.** Tiga bidang lama yang tidak pernah tampil dijadikan nonaktif. Menjalankan ulang migrasi tidak menimpa perubahan yang dibuat lewat Data Master.

**Pengujian:** setiap perbaikan dibuktikan dulu dengan uji langsung sebelum migrasi, lalu diuji ulang sesudahnya. Semua 21 rangkaian uji lulus dan data uji dibersihkan.

---

## 02/11/2026

**Yang diperiksa**
- **Audit catatan terhadap riwayat GitHub:** perubahan yang belum tercatat dimasukkan, dan bagian pengujian serta sisa pekerjaan diperbarui.
- **Temuan:** migrasi email kontak expert (`20261008030000`) belum pernah dijalankan di database intern-update. Dampaknya kecil: aplikasi tetap jalan, hanya email kontak expert tidak tampil di direktori. Pengecek migrasi sekarang memeriksanya.
- Pekerjaan 22–23 Okt dan audit ini sudah di-push ke branch `intern-update`.

**Yang dibuat**
- **Daftar trainer per level** di panel Kuota Modul (Data Master): nama, level, modul aktif (tayang dan menunggu keputusan), dan sisa kuota per trainer.
  - Saat angka kuota diubah tetapi belum disimpan, kolom **"Bila disimpan"** menunjukkan trainer mana yang terdampak.
  - Trainer yang statusnya aktif tetapi profilnya tidak tayang ditandai **"Portal tidak aktif"**.
  - Hanya untuk dibaca; level trainer tetap diubah lewat Kualifikasi Trainer.
- **Topik Knowledge Hub di Data Master:** 12 topik formulir *Contribute Knowledge* bisa ditambah, diubah, dan diaktifkan/dinonaktifkan.
  - Sebelumnya topik tertulis tetap di kode, dan database menerima **topik karangan maupun pengajuan tanpa topik**. Sekarang topik wajib dan harus dari daftar.
  - Topik lama yang sudah dipakai disimpan sebagai nonaktif, sehingga publikasinya tidak berubah.
- **Satu daftar bahasa di Data Master**, dipakai formulir Knowledge Hub, Request a Training, dan Expert (18 bahasa, termasuk Swahili).
  - Sebelumnya ada tiga daftar berbeda di kode, tabel bahasa tidak tercatat di migrasi, **approver bisa mengubah tabel bahasa langsung**, dan bahasa publikasi tidak diperiksa sama sekali.
  - Sekarang bahasa publikasi wajib dan harus dikenali dari daftar; sebutan umum seperti "Bahasa Indonesia" tetap dikenali.

- **Kategori pelatihan di Data Master** (daftar terpisah, sesuai keputusan): 13 kategori formulir *Request a Training* bisa ditambah, diubah, dan diaktifkan/dinonaktifkan.
  - Sebelumnya kategori tertulis tetap di kode, dan database menerima **kategori karangan maupun permintaan tanpa kategori**. Sekarang kategori wajib dari daftar atau "Other".
- **Paginasi antrean Konsol Kurasi:** Verifikasi Expert, Modul, Publikasi, dan Persetujuan Peserta menampilkan 25 baris per halaman, supaya halaman tetap ringan saat pengajuan sudah ratusan atau ribuan.

**Yang diperbaiki / dihapus**
- **Template Review dihapus** (keputusan pemilik proyek): hanya untuk Permintaan Pelatihan, opsional, belum pernah dipakai, dan kriterianya harus ditulis dalam format JSON yang membingungkan. Review tetap berjalan dengan rekomendasi dan alasan.

**Keputusan**
- Topik Knowledge Hub dan bidang keahlian Expert **tetap dua daftar terpisah**, karena isinya berbeda ("dokumen ini tentang apa" dan "orang ini ahli apa") dan dipakai formulir yang berbeda.

**Pengujian:** setiap perubahan database dibuktikan dulu dengan uji langsung sebelum migrasi (daftar trainer 1/5, topik 3/12, bahasa 3/12, kategori pelatihan 3/12), lalu diuji ulang sesudah migrasi (5/5, 12/12, 12/12, 12/12). Semua uji lain tetap lulus dan data uji dibersihkan. Semuanya sudah di-push ke `intern-update`.

**Menunggu keputusan mentor**
- Apakah Operator boleh mengelola Data Master.
- Apakah Publisher harus terpisah dari Approver.
- Perlakuan peserta yang sudah lulus saat modul naik versi.
- Template sertifikat, syarat lulus, SLA, dan notifikasi email.
- Apakah migrasi email kontak expert dijalankan di intern-update.

---

## 04/11/2026 (Rabu, 4 November 2026)

**Yang dibuat**
- **Layar admin Program Academy** di Konsol Kurasi (Slide 20–21): Master Course beserta modulnya, dan Course Offering (jadwal, delivery mode, model belajar, aturan pendaftaran, biaya, evaluasi akhir).
  - Setiap pembuatan atau perubahan dibuat sebagai **draf**, dikirim, lalu **disetujui Approver/Admin lain**; pembuat tidak bisa menyetujui drafnya sendiri. Data yang tayang tidak berubah sampai draf disetujui.
  - Setiap persetujuan menyimpan **versi baru** dan tercatat di audit trail.
  - Setelah course atau offering dipakai peserta, bagian yang memengaruhi kelulusan (susunan modul, model belajar, aturan pendaftaran, biaya) dikunci; judul, jam, urutan, dan tanggal tetap bisa diubah.
  - Program lama yang isinya masih di kode (AZA, Africa Fisheries) hanya bisa dilihat.
  - Sebelumnya tidak ada cara sama sekali untuk membuat atau mengubah program dari aplikasi.

- **Katalog publik:** course yang sudah disetujui dan tayang kini muncul sebagai kartu di halaman Training, Self-Paced Courses, dan All Programs (modul, jam, bahasa, aturan pendaftaran, jadwal, label masa pendaftaran). Sebelumnya hanya bisa dibuka dengan mengetik alamatnya.
- **Gambar sampul Master Course:** unggah PNG/JPG/WebP maksimal 2 MB di formulir course; jenis berkas diperiksa dari isinya; gambar ikut persetujuan dan riwayat versi, lalu dipakai kartu katalog.

**Temuan**
- Izin `academy.create` dan `academy.update` di matriks peran dimiliki hampir semua peran, termasuk peserta. Layar baru tidak memakai izin itu; matriksnya dicatat untuk ditinjau.
- **Jalur ubah lama:** enam fungsi database dari Juli memungkinkan satu admin/approver mengubah offering tayang tanpa draf dan tanpa persetujuan orang lain. Dibuktikan lewat uji (7 dari 14 cek gagal), lalu ditutup.
- **Aturan pendaftaran buntu:** "Wajib disetujui admin" dan "Wajib hak akses khusus" membuat offering baru tidak bisa diikuti siapa pun karena peserta belum punya formulir pengajuan. Untuk sementara layar hanya menawarkan "Terbuka" dan "Wajib akun terdaftar".
- **Sertifikat untuk offering baru belum bisa didapat peserta** (syarat lama meminta catatan evaluasi yang tidak lagi diisi dari layar mana pun). Termasuk topik Sertifikat yang ditunda.

**Yang diperbaiki**
- Skrip uji peran konsol tidak lagi gagal karena jam laptop sedikit berbeda dari jam database.

**Pengujian:** setiap perubahan dibuktikan sebelum migrasi lalu diuji ulang sesudahnya: Program Academy 1/21 menjadi 21/21, gambar sampul 10/14 menjadi 14/14, penutupan jalur ubah lama dan aturan pendaftaran 7/14 menjadi 14/14. Semua uji lain tetap lulus dan data uji dibersihkan. Sudah di-push ke `intern-update`.

**Pelajaran yang didapat**
- Lulus uji otomatis belum berarti fitur siap dipakai: uji manual menemukan program yang sudah disetujui tidak muncul di katalog, dan semua kartu memakai gambar yang sama.
- Aturan keamanan harus dijaga di database: ada fungsi lama yang masih bisa dipakai untuk melewati proses persetujuan.
- Setiap perbaikan database dibuktikan dulu dengan uji sebelum dan sesudah migrasi, supaya jelas celah yang diperbaiki benar-benar ada.

**Kendala**
- Program yang disetujui belum tampil di katalog publik, sehingga perlu menambah tampilan katalog.
- Ditemukan fungsi database lama yang mengubah program tanpa persetujuan orang kedua, dan aturan pendaftaran yang membuat peserta tidak bisa mendaftar; keduanya ditutup lewat migrasi.
- Sertifikat untuk program baru belum bisa diterbitkan (syarat lama bergantung pada langkah evaluasi yang tidak lagi ada di layar mana pun).
- Syarat lulus, persetujuan pendaftaran, dan pembayaran masih menunggu keputusan mentor, sehingga pengerjaannya ditunda.

**Dikerjakan berikutnya (dicatat 04/11)**
- Sertifikat untuk offering baru (syarat lulus dan evaluasi akhir).
- Alur pengajuan pendaftaran peserta untuk offering baru, supaya "Wajib disetujui admin" bisa dibuka lagi.
- Layar pemasangan template evaluasi akhir.
- Webinar dan Workshop.

---

## 05/11/2026 (Kamis, 5 November 2026)

**Yang dibuat**
- **Pembersihan gambar sampul course** yang tidak terpakai (`npm run cleanup:course-covers`). Bawaannya hanya menampilkan daftar; menghapus dengan `--apply`. Gambar yang dipakai course, draf terbuka, atau riwayat versi, dan gambar yang berumur kurang dari 24 jam, tidak pernah dihapus. Sampul Knowledge Hub tidak disentuh.
- **Lembar sertifikat sementara**: tombol *Lihat sertifikat* dan *Unduh PDF* di tab Certificate. Isinya diambil dari database (nama peserta, course, modul, jam, tanggal, nomor) dengan QR ke halaman verifikasi; tanpa stempel, tanda tangan, atau nama pejabat, dan bertanda SEMENTARA / CONTOH. Peserta lain tidak bisa mengambil sertifikat orang lain.
- **Pilihan template evaluasi akhir** di formulir Course Offering (End-of-Course atau End-of-Training), ikut persetujuan dan riwayat versi, dan dikunci setelah ada peserta. Sebelumnya template hanya bisa dipasang lewat SQL.

**Yang diperbaiki**
- **Jalur sertifikat.** Peserta yang menyelesaikan course lewat tampilan tidak pernah bisa mendapat sertifikat, karena syaratnya masih meminta catatan evaluasi lama yang tidak lagi diisi halaman course. Sebaliknya, peserta bisa menerbitkan sertifikat sendiri dengan mengirim evaluasi kosong lewat jalur lama. Sekarang syaratnya semua modul selesai, ditambah evaluasi akhir yang terkirim bila offering mewajibkannya, dan jalur lama ditutup. Halaman course menampilkan alasan yang bisa dipahami peserta.
- **Audit sesudahnya** menemukan tiga celah yang ikut terbuka setelah sertifikat bisa terbit, lalu ditutup: peserta bisa memilih sendiri sertifikat "kompetensi" (kini hanya sertifikat kelulusan); course berbayar menerbitkan sertifikat gratis (kini ditolak, dan formulir hanya menawarkan "Gratis"); template evaluasi bisa diubah oleh satu orang (kini ditutup).

**Pelajaran yang didapat**
- Memperbaiki jalan yang buntu bisa membuka celah baru yang sebelumnya tertutup tanpa sengaja, jadi setiap perbaikan perlu diaudit lagi dari sudut pandang pengguna yang mencoba curang.
- Pemeriksaan sebaiknya dilakukan dengan menjalankan alur pengguna sungguhan, bukan hanya membaca kode.

**Kendala**
- Syarat lulus resmi (apakah modul wajib lulus kuis), isi pertanyaan evaluasi, jenis sertifikat lain, dan pembayaran masih menunggu keputusan mentor, sehingga sertifikat tetap berlabel "CONTOH / BELUM RESMI".
- Dua skrip uji lama harus disesuaikan karena masih memakai aturan lama.

**Pengujian:** setiap perubahan dibuktikan sebelum migrasi lalu diuji ulang sesudahnya: jalur sertifikat 7/17 menjadi 17/17, lalu setelah audit 17/25 menjadi 25/25; pembersihan sampul 12/12; lembar sertifikat 9/9. Jalur sertifikat juga diuji manual dengan akun peserta (course tanpa dan dengan evaluasi akhir). Semua uji lain tetap lulus dan data uji dibersihkan. Sudah di-push ke `intern-update`.

---

## 09/11/2026 (Senin, 9 November 2026)

**Yang dibuat**
- **Course Offering di My Learning:** course yang diikuti lewat Course Offering dan sertifikatnya tampil di halaman My Learning. Datanya dibaca dari database dengan identitas akun, jadi sama di perangkat atau browser mana pun.
- **Persetujuan kelulusan sebelum sertifikat terbit** (Slide 24, PB-ACA-05). Peserta yang menyelesaikan modul dan evaluasi masuk antrean **Persetujuan Kelulusan** di Konsol Kurasi. Approver atau Admin lain memilih *Setujui* (sertifikat terbit) atau *Minta remedial* (dengan alasan yang bisa dibaca peserta). Peserta menerima notifikasi. Tersedia *Setujui terpilih*, dan tidak ada orang yang bisa menyetujui kelulusannya sendiri.

**Yang diperbaiki**
- Sebelumnya sertifikat langsung terbit ketika peserta menekan tombol, tanpa persetujuan siapa pun, padahal panduan meminta kelulusan disetujui dulu. Sekarang sertifikat hanya terbit setelah disetujui.
- Pembayaran tidak lagi menahan kelulusan: course berbayar tetap bisa lulus, hanya sertifikatnya yang ditahan.

**Pelajaran yang didapat**
- Satu tombol yang terlihat praktis bisa melompati langkah persetujuan yang diwajibkan proses bisnis, jadi alurnya perlu dicocokkan dengan slide panduan, bukan dengan tampilan.
- Data yang disimpan di database (bukan di browser) otomatis sama di semua perangkat.

**Kendala**
- Syarat lulus resmi, jenis sertifikat lain, dan STTP resmi masih menunggu arahan mentor. Tujuh hal yang perlu ditanyakan dicatat di `MENUNGGU_ARAHAN_MENTOR.md`.

**Pengujian:** persetujuan kelulusan 3/26 sebelum migrasi menjadi 26/26 sesudahnya, termasuk dua modul ditandai bersamaan dan dua pemutus bersamaan. Jalur sertifikat dan uji peran konsol disesuaikan dan lulus. Diuji manual oleh saya dengan akun peserta dan approver.

---

## 10/11/2026 (Selasa, 10 November 2026)

**Yang dibuat**
- **Pendaftaran dengan persetujuan untuk Course Offering** (Slide 22, PB-ACA-03). Offering bisa memakai aturan "Wajib disetujui admin". Peserta menekan *Ajukan pendaftaran* di halaman course (bila biodata belum ada, diarahkan mengisinya dulu). Admin, Operator, atau Approver memutuskan di **Persetujuan Peserta**, dan peserta yang disetujui otomatis terdaftar.
- **Dokumen persyaratan dan Minta Perbaikan.** Admin menulis daftar dokumen per offering (satu baris satu dokumen). Peserta mengunggah PDF (maks 10 MB) ke penyimpanan privat. Admin membuka dokumen lewat tautan sementara, lalu bisa memilih *Minta Perbaikan* dengan catatan. Peserta mengganti dokumen dan mengirim ulang.
- **Notifikasi keputusan pendaftaran.** Peserta menerima notifikasi saat pendaftarannya disetujui, ditolak (dengan alasan), atau diminta perbaikan (dengan catatan), lengkap dengan tautan ke halaman course atau modul. Riwayatnya tetap utuh.

**Yang diperbaiki**
- **Dashboard peserta.** Sebelumnya pengajuan yang diminta perbaikan tidak tampil sama sekali. Course Offering juga dihitung seperti modul: progresnya selalu 0%, tertulis "kuis belum dikerjakan", dan tombol *Lanjutkan* membuka halaman yang salah. Sekarang dashboard menampilkan catatan perbaikan dengan tombol *Perbaiki dan kirim ulang*, serta progres course ("x dari y modul selesai") dan status kelulusannya. Tombolnya membuka halaman course yang benar.
- Halaman modul kini menampilkan status *Admin Meminta Perbaikan* beserta catatannya.

**Pelajaran yang didapat**
- Uji manual dari sisi peserta menemukan hal yang tidak terlihat dari sisi admin: keputusan sudah tersimpan di database, tetapi peserta tidak tahu karena notifikasi dan dashboard belum membacanya.
- Satu fitur baru (status "perlu perbaikan") harus diikuti ke semua tempat yang membaca status itu: halaman course, dashboard, notifikasi, dan halaman modul.

**Kendala**
- Dokumen apa yang wajib per offering, seleksi/skor, dan waitlist masih menunggu arahan mentor.
- Berkas yang diunggah tetapi tidak jadi diajukan belum dibersihkan otomatis.

**Pengujian:** pengajuan offering 11/18 sebelum migrasi menjadi 18/18 sesudahnya. Dokumen dan minta perbaikan 3/16 sebelum migrasi menjadi 16/16 sesudahnya. Notifikasi dan dashboard 9/21 dengan kode lama menjadi 21/21. Semua uji lain lulus, `build` lulus, dan data uji dibersihkan. Diuji manual oleh saya: membuat offering dengan dua dokumen, mengajukan sebagai peserta, lalu meminta perbaikan sebagai admin.

---

## 11/11/2026 (Rabu, 11 November 2026)

**Yang dibuat**
- **Halaman sementara `/kesiapanrilis`** untuk laporan ke atasan. Isinya dibaca otomatis dari `KESIAPAN_RILIS.md` dan ditampilkan sebagai papan bergaya Trello (Sudah dikerjakan, Test manual, Belum, Bug) atau sebagai dokumen lengkap. Halaman ini memakai login yang diatur lewat `.env`, dan dokumennya hanya dikirim dari server setelah login. Saat ini hanya dipakai di lokal dan nanti akan dihapus.
- **Dokumen pendaftaran tercatat di server sebelum dikirim.** Dokumen yang diunggah di satu perangkat langsung terlihat dan bisa dikirim dari perangkat lain dengan akun yang sama. Berkas yang tidak terpakai bisa dibersihkan dengan `cleanup:enrollment-documents`.
- **Berkas formulir Full Training sampai ke admin** (Slide 22). Kelima berkas (paspor, CV, surat penugasan, surat motivasi, foto) kini diunggah ke penyimpanan privat (PDF maks 10 MB, JPG/PNG maks 2 MB) dan bisa dibuka admin di Persetujuan Peserta.
- **Keputusan tampil langsung (real-time).** Saat admin menyetujui, menolak, meminta perbaikan, atau menyetujui kelulusan, lonceng notifikasi, dashboard, dan halaman pendaftaran peserta langsung berubah dalam sekitar 0,4 detik tanpa dimuat ulang. Antrean Persetujuan Peserta juga langsung menampilkan kiriman ulang.

**Yang diperbaiki**
- **Full Training macet setelah Minta Perbaikan.** Sebelumnya peserta tidak bisa mengirim ulang, sementara admin tidak bisa memutuskan karena sistem menunggu perbaikan. Sekarang ada kotak perbaikan berisi catatan admin, kelima dokumen dengan tombol *Replace* per dokumen, tanggapan teks, dan *Send again*. Peserta cukup mengganti dokumen yang bermasalah, dari perangkat mana pun.
- Notifikasi dan dashboard yang salah mengira Full Training sebagai modul, serta pengajuan lama yang tercatat dengan judul offering, kini menuju halaman yang benar.
- Daftar dokumen di dialog Persetujuan Peserta dibuat ringkas (dua kolom), dan dialognya bisa digulir sehingga tombol keputusan selalu terjangkau.

**Pelajaran yang didapat**
- Uji manual menemukan masalah yang tidak terlihat dari kode: berkas Full Training ternyata hanya dicatat namanya di browser dan tidak pernah sampai ke admin.
- Penjelasan jujur bukan pengganti fitur yang memang dibutuhkan. Setelah dicoba sendiri, alur yang benar adalah unggah ulang yang sungguhan.
- Kunci database perlu dibuktikan dengan permintaan yang benar-benar bersamaan. Uji serentak membuktikan pengajuan dan keputusan tidak pernah ganda.

**Kendala**
- Pengajuan Full Training yang dikirim sebelum perbaikan harus melengkapi kelima dokumen sekali, karena berkasnya dulu tidak pernah terkirim.
- Tahap Full Training sesudah disetujui (konfirmasi, belajar, perjalanan, sertifikat) masih tersimpan di browser dan menunggu keputusan mentor tentang nasib program ini.
- Koneksi sempat putus saat uji serentak (`fetch failed`). Datanya tetap benar, dan ujinya lulus saat diulang.

**Pengujian:** uji serentak 15/15 tanpa perubahan kode. Unggahan tercatat 2/15 sebelum migrasi menjadi 15/15 sesudahnya. Dokumen Full Training 4/19 sebelum migrasi menjadi 19/19 sesudahnya. Notifikasi real-time 10/14 sebelum migrasi menjadi 14/14 sesudahnya. Dashboard 29/29. Semua 39 uji lulus, `build` lulus, dan data uji dibersihkan. Diuji manual oleh saya: Full Training diminta perbaikan, kelima berkas diunggah ulang, admin membuka berkas lalu menyetujui.
