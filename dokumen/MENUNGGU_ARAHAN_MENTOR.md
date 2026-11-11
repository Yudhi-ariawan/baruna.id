# Menunggu Arahan Mentor

Daftar pekerjaan yang sengaja ditahan karena aturannya belum diputuskan. Mengerjakannya sebelum ada keputusan berisiko dikerjakan dua kali.
Acuan: `dokumen/CATATAN_PERBAIKAN.md` (bagian 5) dan 51 slide proses bisnis di `dokumen/`.

## Yang menunggu arahan

1. **Template dan isi sertifikat**: penandatangan, format nomor, JP, dan jenis sertifikat.
2. **Syarat lulus pelatihan.** Sebagian DIPUTUSKAN pemilik proyek (21 Okt): kelulusan **modul** hanya dari kuis resmi (kuis trainer atau bank soal modul bawaan) yang dinilai dan dicatat server, dengan nilai batas dari modul; modul tanpa kuis resmi belum bisa lulus (CATATAN_PERBAIKAN 2r). Yang masih menunggu: syarat lulus **program/pelatihan** (pre/post-test, ujian akhir, kehadiran) dan apakah kuis wajib saat trainer mengajukan modul.
3. ~~**Role participant**~~ **DIPUTUSKAN pemilik proyek (21 Okt): tetap otomatis** saat biodata disimpan, agar admin tidak perlu menyetujui satu per satu saat pendaftar banyak. Akses materi tetap lewat persetujuan admin per kursus; peran yang dicabut admin tidak diberikan lagi. Berbeda dari teks PB-ACA-03 (peran diberikan saat admin menyetujui); mohon mentor mengonfirmasi.
4. ~~**Expert yang disetujui**: otomatis jadi trainer atau tidak.~~ **DIPUTUSKAN pemilik proyek (22 Okt): trainer otomatis HANYA bila expert memilih peran "Trainer" saat mendaftar** (pilihan itu diperiksa verifikator bersama CV dan dokumen). Expert yang tidak memilih Trainer tetap expert dan, bila ingin melatih, mengajukan **Kualifikasi Trainer** (Slide 39, `/experts/trainer-application`). Status trainer yang sudah ada tidak dicabut; 4 expert di intern-update semuanya memilih Trainer, jadi tidak berubah (CATATAN_PERBAIKAN 2y). Mohon mentor mengonfirmasi.
5. **Publisher** terpisah dari **approver** atau tidak. Slide 16 mendefinisikan Publisher sebagai "menayangkan informasi yang sudah disetujui untuk audiensnya": akses **penuh** pada Events, Partnership, Community, dan About; **terbatas** pada Academy, Knowledge Hub, Experts, dan Fellowship; dengan izin `publish` di semua domain. Di aplikasi, "Setujui" langsung menayangkan, sehingga Publisher belum punya pekerjaan. Usul pemilik proyek: tetap "setujui = tayang" sampai mentor memutuskan. Pertanyaan: apakah Publisher menjadi langkah terpisah setelah Approver, dan apa tugasnya selain menayangkan (misalnya mengatur waktu tayang atau memeriksa format katalog)?
6. **Profile Claim** dan fitur **Penugasan Expert**.
7. **Nilai SLA per langkah** (Slide 13). Sudah ada di sistem dengan nilai **sementara** untuk Request a Training: penugasan reviewer 72 jam, review 120 jam, keputusan 72 jam, dihitung dalam jam kalender. Admin bisa mengubahnya di Konsol Kurasi → SLA Alur Kerja tanpa ubah kode (CATATAN_PERBAIKAN 2s). Pertanyaan untuk mentor: nilai resminya berapa, apakah dihitung hari kerja (tanpa akhir pekan/libur), dan apakah jenis lain (expert, modul, publikasi) juga perlu SLA.
8. **Notifikasi email.** Saat ini notifikasi hanya di dalam BARUNA (lonceng/halaman Notifikasi). Mengirim email butuh layanan email (SMTP/penyedia) dan alamat pengirim resmi.
9. **Peserta saat modul diperbarui.** Trainer kini bisa memperbarui modul tayangnya (CATATAN_PERBAIKAN 2t), dan setelah disetujui versinya naik. Peserta yang sudah lulus versi lama tetap dianggap lulus, sedangkan peserta yang sedang belajar langsung melihat isi baru. Pertanyaan: apakah peserta yang sudah lulus wajib mengulang kuis versi baru? (Peserta yang sedang belajar sudah diberi tahu otomatis sejak 22 Okt, CATATAN_PERBAIKAN 2x; yang sudah lulus sengaja belum diberi tahu sampai ada keputusan.)
10. **Operator dan Data Master.** Data Master (bidang keahlian, aturan level trainer, kuota modul per level; CATATAN_PERBAIKAN 2aa, 2ab) sekarang hanya untuk Approver, Admin, dan Super Admin. Slide 16 juga memberi Operator akses penuh pada Experts dan Academy. Apakah Operator boleh mengelola Data Master?
11. **Email kontak expert di direktori.** Migrasi PC `20261008030000` dan `20261008040000` (menampilkan email kontak resmi expert) belum berlaku di intern-update dan mengisi email akun KKP tertentu (CATATAN_PERBAIKAN 2ac). Apakah dijalankan di intern-update, atau hanya di main?
12. **Sertifikat dan pendaftaran untuk offering dari layar Program Academy** (dicatat 4 Nov, CATATAN_PERBAIKAN 2al). (a) Syarat lulus resmi apa? Sekarang sertifikat butuh semua modul selesai plus satu catatan evaluasi lama yang tidak lagi diisi dari layar mana pun, jadi offering baru belum bisa menghasilkan sertifikat. Apakah evaluasi akhir (template evaluasi) menggantikannya? (b) Offering dengan "Wajib disetujui admin" atau "hak akses khusus" butuh formulir pengajuan peserta dan antrean persetujuan untuk offering baru; layar admin sementara hanya menerima "Terbuka" dan "Wajib akun terdaftar". Siapa yang menyetujui pendaftaran dan apa batas waktunya? (c) Pembayaran: sistem hanya mencatat penanggung biaya (peserta, instansi, sponsor, dst.), tanpa tarif, tagihan, atau status bayar. Apakah itu cukup, atau perlu mekanisme pembayaran?

## Daftar kerja berikutnya (dicatat 9 Nov, dikerjakan satu per satu)

1. **Jenis sertifikat lain.** Sekarang hanya *completion* yang bisa terbit (migrasi `20261105030000`). Temuan dari slide: Slide 24 (PB-ACA-05) mewajibkan *Review Completion* dan *Approval Completion* sebelum *Certificate Record*, dan kelulusan dihitung dari learning record, assessment result, kehadiran, dan evaluasi akhir; Slide 26 menaruh **completion rule** di Master Course, **certificate model** di Course Offering, dan objek **Completion** terpisah dari **Certificate**; Slide 27: tahap Completion & Certificate dikerjakan Admin + Reviewer, peserta hanya mengunduh. Daftar enam jenis tidak ada di slide (berasal dari `src/lib/learning/types.ts` dan `registry.ts`). Saat ini peserta menerbitkan sendiri tanpa persetujuan.
2. **Pembayaran.** Tidak ada mekanisme bayar; course mandiri hanya "Gratis", course angkatan hanya mencatat penanggung biaya. Slide 22 dan 24: *payment (jika ada) terpisah dan tidak menentukan kelulusan*. Perlu ditinjau: `certificate_payment_required` (migrasi `20261105030000`) menahan sertifikat, dan karena status selesai baru ditetapkan saat sertifikat terbit, kelulusan ikut tertahan.
3. **Alur persetujuan pendaftaran.** ~~Offering baru belum punya formulir pengajuan.~~ Koreksi 10 Nov: jalur pengajuan sudah ada; tombolnya di halaman course dibuat 10 Nov (CATATAN_PERBAIKAN 2as). Sisa dari Slide 22 (PB-ACA-03) yang perlu arahan: dokumen persyaratan apa yang wajib diunggah, perlukah "minta perbaikan" (sekarang hanya tolak lalu peserta mengajukan lagi), seleksi/skor, waitlist, dan batas waktu keputusan.
4. **Operator dan Data Master.** Apakah Operator boleh mengubah Data Master (langsung atau lewat persetujuan)? Lihat juga butir 10.
5. **Publisher vs Approver.** Apakah tayang adalah langkah terpisah setelah disetujui?
6. **Peserta yang sudah lulus saat modul diperbarui.** Wajib mengulang, cukup diberi tahu, atau dibiarkan? Apakah sertifikat mencatat versi modul? Lihat juga butir 9.
7. **Email kontak expert.** Perlu tampil di direktori publik? Email siapa? Dijalankan di intern-update atau hanya main? Lihat juga butir 11.

## Detail pertanyaan untuk mentor

### Sertifikat dan kelulusan
- Syarat lulus: nilai minimal, pre-test dan post-test wajib atau tidak, ujian akhir, kehadiran.
- JP per pelatihan: per kursus atau seragam.
- Penandatangan dan jabatan resmi; tanda tangan berupa gambar atau tanda tangan elektronik.
- Format nomor sertifikat resmi. Sekarang `BARUNA-TYPE-<acak>`, bukan nomor surat.
- Jenis sertifikat: STTP resmi instansi atau sertifikat BARUNA Academy (menentukan template).
- Aset resmi: template resolusi tinggi, logo, tanda tangan atau stempel.

### Kondisi sertifikat saat ini (untuk konteks)
- Penerbitan sudah di server (`issueCertificate`, RPC `check_certificate_eligibility`, tabel `certificates`).
- Tampilan digambar di browser (`src/lib/certificate.ts`) memakai `/template-sttp-sementara.jpeg`.
- Data tetap di kode: penandatangan "Lilly Aprilya Pregiwati", JP bawaan 8, instansi bawaan KKP, badge "CERTIFIED 2026".
- ~~Kelulusan kuis dan sertifikat masih dicatat di `localStorage` (melanggar Slide 15).~~ Sejak 21 Okt kelulusan modul dicatat server dari kuis resmi (CATATAN_PERBAIKAN 2r); sertifikat diterbitkan server.

### Role dan alur
- Role participant: PB-ACA-03 menyebut role diberikan saat admin menyetujui, tetapi kode memberikannya saat biodata disimpan. **Keputusan pemilik proyek 21 Okt: tetap otomatis** (lihat butir 3 di atas).
- ~~Expert disetujui otomatis jadi trainer aktif; Slide 39 menyiratkan persetujuan trainer terpisah.~~ Diputuskan 22 Okt: hanya bila memilih peran Trainer (butir 4).
- Approve modul langsung menayangkan; apakah perlu langkah publisher terpisah.
- Profile Claim (Slide 37) dan Penugasan Expert (fitur disembunyikan sementara).

### Ruang belajar (setelah perbaikan 2h di CATATAN_PERBAIKAN.md)
- **Full Training** kini lewat persetujuan admin di `/admin/enrollments` (bagian 2i). Yang belum diputuskan: apakah program African Countries masih dipakai? Halaman My Learning menghapusnya otomatis dari browser.
  - *(11 Nov)* Lima berkas di formulir Full Training (paspor, CV, surat penugasan, surat motivasi, foto) hanya dicatat namanya di browser. Berkasnya tidak pernah terkirim, admin tidak bisa membukanya, dan peserta tidak bisa mengunggah ulang saat diminta perbaikan (sekarang hanya bisa menjawab lewat teks, CATATAN_PERBAIKAN 2av). **Pertanyaan:** jika Full Training tetap dipakai, perlukah unggah berkas sungguhan seperti di Course Offering (butuh migrasi)? Atau pelatihan yang butuh pemeriksaan dokumen dibuat sebagai Course Offering dengan aturan "Wajib disetujui admin" dan dokumen persyaratan (sudah tersedia)?
- **Demo Mode** tidak lagi membuka ruang belajar. Admin yang ingin presentasi harus memakai akun peserta yang sudah disetujui. Apakah perlu mode pratinjau khusus admin (diperiksa di server)?
- **PDF modul Master** sudah tidak ditautkan di halaman publik, tetapi filenya masih aset publik Lovable. Perlu file PDF asli untuk dipindah ke penyimpanan privat.

## Yang aman dikerjakan tanpa menunggu
- ~~Tutup akses ruang belajar lewat `localStorage`~~ (selesai untuk modul Master dan dinamis, lihat 2h).
- ~~Pecah `academy.learn.$id.tsx`~~ (selesai, 228 baris).
- Uji manual di browser: pendaftaran peserta, pengiriman modul trainer, keputusan modul oleh approver, kuis peserta.
- Migrasi: hanya database intern-update; `main` adalah ranah mentor.
- ~~Hapus 58 akun tes~~ (selesai 17 Oktober 2026; tersisa 24 pengguna asli).
- Buat ulang `types.ts` lewat Supabase CLI (perlu login Supabase).

## Antrean kerja berikutnya: pembaruan berkala konten (dicatat 21 Okt)

Lanjutan bagian 2t di CATATAN_PERBAIKAN.md (modul: trainer bisa memperbarui modul tayang, sudah selesai dan diuji). Urutan yang disarankan:

1. ~~**Knowledge Hub: versi lama tetap tayang selama revisi, plus pembaruan dari kontributor.**~~ Selesai 22 Okt (CATATAN_PERBAIKAN 2v, migrasi `20261022020000`). Catatan asli:
   - Temuan: `admin_kr_decide` (migrasi `20261020060000`) dengan keputusan `return_for_revision` pada publikasi yang sudah tayang mengubah `knowledge_resources` menjadi `archived` + `private`, jadi publikasi hilang dari katalog selama revisi. Kontributor juga tidak bisa memulai pembaruan sendiri, karena `submit_draft_for_review` (`20261021050000`) hanya menerima draf tertaut saat statusnya `revision_requested`.
   - Arah perbaikan: ikuti pola modul. Kalau resource sedang tayang, revisi tidak mengarsipkannya. Persetujuan menaikkan `version` (trigger `trg_kr_version_snapshot` sudah mengisi `knowledge_resource_versions`). Penolakan mempertahankan versi lama. Tambah RPC kontributor `contributor_open_resource_update` / `contributor_cancel_resource_update` seperti `trainer_open_module_update`. Uji: `test:kr-rpc`, `test:kh-roles`, dan skrip uji langsung baru.
2. ~~**Expert: pembaruan profil oleh expert sendiri (review → versi baru).**~~ Selesai 22 Okt (CATATAN_PERBAIKAN 2w, migrasi `20261022030000`). Catatan asli:
   - Temuan: setelah disetujui, `submit_draft_for_review` menolak pengajuan expert baru (`expert_profile_exists`), dan draf tertaut hanya diterima saat `revision_requested`. Yang ada sekarang hanya admin/approver menyunting langsung tanpa review (`20261015070000`). PB-EXP-01 (Slide 36) meminta perbarui draft → review → versioning. Tabel `expert_versions` sudah ada.
   - Arah perbaikan: RPC expert membuka pembaruan profil (profil tayang tetap tampil di direktori), dikirim ke Verifikasi Expert. Disetujui berarti profil diperbarui dan `expert_versions` bertambah; ditolak berarti profil lama tetap. Periksa `admin_expert_decide` (`20261015060000`) dan aturan pemilik profil (`20261020030000`). Uji: `test:expert-rpc`, `test:expert-role-lock`.
3. ~~**Riwayat versi yang bisa dilihat, dan notifikasi ke peserta aktif saat modul diperbarui.**~~ Selesai 22 Okt (CATATAN_PERBAIKAN 2x, migrasi `20261022040000`). Peserta yang sudah lulus tetap menunggu butir 9. Catatan asli:
   - Riwayat versi (v1, v2, … + tanggal + siapa yang menyetujui) untuk modul, publikasi, dan profil expert. Sumbernya `module_registry_versions` / `knowledge_resource_versions` / `expert_versions`, dan penyetuju dari `review_decisions` lewat `audit_ref`. Tampilkan di portal pemilik dan Konsol Kurasi. Catatan: versi 1 modul tidak masuk `module_registry_versions` (trigger hanya saat UPDATE); isinya ada di `review_subject_revisions`.
   - Notifikasi peserta aktif saat modul naik versi: penerima dari `self_paced_enrollments` / `course_enrollment_applications` yang disetujui dan belum lulus. Apakah peserta yang sudah lulus wajib mengulang menunggu jawaban mentor (nomor 9 di atas).
4. ~~**Celah kecil yang sama di jalur admin.**~~ Selesai 22 Okt (CATATAN_PERBAIKAN 2u, migrasi `20261022010000`). Catatan asli: `request_published_module_revision` (`20261015040000`) masih mengambil kuis dan lampiran dari draf terbaru. Setelah pembaruan ditolak, draf terbaru itu adalah versi yang ditolak. Samakan dengan `trainer_open_module_update`, yang mengambil isi dari revisi yang disetujui lewat `module_registry.audit_ref`.

Ingat untuk setiap migrasi baru: tambah baris di `supabase/check_migrations.sql` dan daftar migrasi di CATATAN_PERBAIKAN.md bagian 3, lalu jalankan `npm run build`.
