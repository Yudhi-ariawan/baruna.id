# Laporan Perkembangan BARUNA (14 Oktober – 2 November 2026)

Branch `intern-update`. Acuan: 51 slide proses bisnis. Rincian teknis per perbaikan ada di `CATATAN_PERBAIKAN.md`.

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

**Yang diperbaiki / dihapus**
- **Template Review dihapus** (keputusan pemilik proyek): hanya untuk Permintaan Pelatihan, opsional, belum pernah dipakai, dan kriterianya harus ditulis dalam format JSON yang membingungkan. Review tetap berjalan dengan rekomendasi dan alasan.

**Keputusan**
- Topik Knowledge Hub dan bidang keahlian Expert **tetap dua daftar terpisah**, karena isinya berbeda ("dokumen ini tentang apa" dan "orang ini ahli apa") dan dipakai formulir yang berbeda.

**Pengujian:** setiap perubahan database dibuktikan dulu dengan uji langsung sebelum migrasi (daftar trainer 1/5, topik 3/12, bahasa 3/12), lalu diuji ulang sesudah migrasi (5/5, 12/12, 12/12). Semua uji lain tetap lulus dan data uji dibersihkan. Semuanya sudah di-push ke `intern-update`.

**Menunggu keputusan mentor**
- Apakah Operator boleh mengelola Data Master.
- Apakah Publisher harus terpisah dari Approver.
- Perlakuan peserta yang sudah lulus saat modul naik versi.
- Template sertifikat, syarat lulus, SLA, dan notifikasi email.
- Apakah migrasi email kontak expert dijalankan di intern-update.
