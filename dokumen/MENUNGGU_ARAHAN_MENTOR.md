# Menunggu Arahan Mentor

Daftar pekerjaan yang sengaja ditahan karena aturannya belum diputuskan. Mengerjakannya sebelum ada keputusan berisiko dikerjakan dua kali.
Acuan: `dokumen/CATATAN_PERBAIKAN.md` (bagian 5) dan 51 slide proses bisnis di `dokumen/`.

## Yang menunggu arahan

1. **Template dan isi sertifikat**: penandatangan, format nomor, JP, dan jenis sertifikat.
2. **Syarat lulus pelatihan.** Sebagian DIPUTUSKAN pemilik proyek (21 Okt): kelulusan **modul** hanya dari kuis resmi (kuis trainer atau bank soal modul bawaan) yang dinilai dan dicatat server, dengan nilai batas dari modul; modul tanpa kuis resmi belum bisa lulus (CATATAN_PERBAIKAN 2r). Yang masih menunggu: syarat lulus **program/pelatihan** (pre/post-test, ujian akhir, kehadiran) dan apakah kuis wajib saat trainer mengajukan modul.
3. ~~**Role participant**~~ **DIPUTUSKAN pemilik proyek (21 Okt): tetap otomatis** saat biodata disimpan, agar admin tidak perlu menyetujui satu per satu saat pendaftar banyak. Akses materi tetap lewat persetujuan admin per kursus; peran yang dicabut admin tidak diberikan lagi. Berbeda dari teks PB-ACA-03 (peran diberikan saat admin menyetujui); mohon mentor mengonfirmasi.
4. ~~**Expert yang disetujui**: otomatis jadi trainer atau tidak.~~ **DIPUTUSKAN pemilik proyek (22 Okt): trainer otomatis HANYA bila expert memilih peran "Trainer" saat mendaftar** (pilihan itu diperiksa verifikator bersama CV dan dokumen). Expert yang tidak memilih Trainer tetap expert dan, bila ingin melatih, mengajukan **Kualifikasi Trainer** (Slide 39, `/experts/trainer-application`). Status trainer yang sudah ada tidak dicabut; 4 expert di intern-update semuanya memilih Trainer, jadi tidak berubah (CATATAN_PERBAIKAN 2y). Mohon mentor mengonfirmasi.
5. **DIPUTUSKAN pemilik proyek (16 Nov), opsi C versi ringkas:** "setujui = tayang" tetap; Publisher/Admin bisa menurunkan sementara dan menayangkan lagi (CATATAN_PERBAIKAN 2ba). Pengelolaan Events/Partnership/Community/About oleh Publisher menunggu menu itu punya data di database. Pertanyaan asli: **Publisher** terpisah dari **approver** atau tidak. Slide 16 mendefinisikan Publisher sebagai "menayangkan informasi yang sudah disetujui untuk audiensnya": akses **penuh** pada Events, Partnership, Community, dan About; **terbatas** pada Academy, Knowledge Hub, Experts, dan Fellowship; dengan izin `publish` di semua domain. Di aplikasi, "Setujui" langsung menayangkan, sehingga Publisher belum punya pekerjaan. Usul pemilik proyek: tetap "setujui = tayang" sampai mentor memutuskan. Pertanyaan: apakah Publisher menjadi langkah terpisah setelah Approver, dan apa tugasnya selain menayangkan (misalnya mengatur waktu tayang atau memeriksa format katalog)?
6. **Profile Claim** dan fitur **Penugasan Expert**.
7. **Nilai SLA per langkah** (Slide 13). Sudah ada di sistem dengan nilai **sementara** untuk Request a Training: penugasan reviewer 72 jam, review 120 jam, keputusan 72 jam, dihitung dalam jam kalender. Admin bisa mengubahnya di Konsol Kurasi → SLA Alur Kerja tanpa ubah kode (CATATAN_PERBAIKAN 2s). Pertanyaan untuk mentor: nilai resminya berapa, apakah dihitung hari kerja (tanpa akhir pekan/libur), dan apakah jenis lain (expert, modul, publikasi) juga perlu SLA.
8. **Notifikasi email.** Saat ini notifikasi hanya di dalam BARUNA (lonceng/halaman Notifikasi). Mengirim email butuh layanan email (SMTP/penyedia) dan alamat pengirim resmi.
9. **Peserta saat modul diperbarui.** Trainer kini bisa memperbarui modul tayangnya (CATATAN_PERBAIKAN 2t), dan setelah disetujui versinya naik. Peserta yang sudah lulus versi lama tetap dianggap lulus, sedangkan peserta yang sedang belajar langsung melihat isi baru. Pertanyaan: apakah peserta yang sudah lulus wajib mengulang kuis versi baru? (Peserta yang sedang belajar sudah diberi tahu otomatis sejak 22 Okt, CATATAN_PERBAIKAN 2x; yang sudah lulus sengaja belum diberi tahu sampai ada keputusan.)
10. **DIPUTUSKAN pemilik proyek (16 Nov), opsi C:** Operator membaca dan mengusulkan, Approver/Admin lain menyetujui (CATATAN_PERBAIKAN 2az). Pertanyaan asli: **Operator dan Data Master.** Data Master (bidang keahlian, aturan level trainer, kuota modul per level; CATATAN_PERBAIKAN 2aa, 2ab) sekarang hanya untuk Approver, Admin, dan Super Admin. Slide 16 juga memberi Operator akses penuh pada Experts dan Academy. Apakah Operator boleh mengelola Data Master?
11. **Email kontak expert di direktori.** Migrasi PC `20261008030000` dan `20261008040000` (menampilkan email kontak resmi expert) belum berlaku di intern-update dan mengisi email akun KKP tertentu (CATATAN_PERBAIKAN 2ac). Apakah dijalankan di intern-update, atau hanya di main?
12. **Sertifikat dan pendaftaran untuk offering dari layar Program Academy** (dicatat 4 Nov, CATATAN_PERBAIKAN 2al). (a) Syarat lulus resmi apa? Sekarang sertifikat butuh semua modul selesai plus satu catatan evaluasi lama yang tidak lagi diisi dari layar mana pun, jadi offering baru belum bisa menghasilkan sertifikat. Apakah evaluasi akhir (template evaluasi) menggantikannya? (b) Offering dengan "Wajib disetujui admin" atau "hak akses khusus" butuh formulir pengajuan peserta dan antrean persetujuan untuk offering baru; layar admin sementara hanya menerima "Terbuka" dan "Wajib akun terdaftar". Siapa yang menyetujui pendaftaran dan apa batas waktunya? (c) Pembayaran: sistem hanya mencatat penanggung biaya (peserta, instansi, sponsor, dst.), tanpa tarif, tagihan, atau status bayar. Apakah itu cukup, atau perlu mekanisme pembayaran?
13. **Tata Kelola Lintas Sistem (Slide 44, 46, 47, 48)** (dicatat 16 Nov): tarif/PNBP/SIMPONI, impor data historis (termasuk 20 alumni 2024 yang masih tertulis di kode), integrasi sistem, dan UAT. Rincian dan pertanyaannya di bagian "Portal Admin sesuai Slide 42-48" di bawah.
14. **Siapa yang boleh melihat formulir Permintaan Peran** (dicatat 16 Nov, CATATAN_PERBAIKAN 2be). Sekarang kartu "Permintaan Peran" di Profil Saya tampil untuk **semua** akun yang login, termasuk peserta dan masyarakat umum, dan bisa dipakai mengajukan Operator, Reviewer, Verifier, Approver, atau Publisher (keputusan tetap di super admin). Pemilik proyek menilai ini kurang pas setelah publik: peran kurasi adalah peran internal pengelola (Slide 16); peserta bisa bingung dan mengira itu langkah wajib atau jalur menjadi trainer (jalur trainer adalah Join as Expert); antrean super admin bisa penuh permintaan iseng; dan daftar peran beserta tugasnya terbuka untuk orang luar.
    **Usulan:** formulir hanya tampil (dan server hanya menerima) untuk akun dengan **email domain resmi** (mis. `@kkp.go.id`) **atau** akun yang **sudah memegang peran kurasi** (untuk meminta peran tambahan). Akun lain tidak melihat kartunya. Pengelola dari luar KKP tetap bisa diberi peran langsung oleh super admin di Users & Access. Ukuran kecil; tanpa migrasi bila domain ditulis di kode, satu migrasi kecil bila daftar domain diatur lewat Data Master.
    **Pertanyaan:** (a) Domain apa saja yang dianggap internal: cukup `@kkp.go.id`, atau juga UPT, BRSDM, instansi mitra? (b) Daftar domain cukup ditetapkan di kode, atau harus bisa diatur admin? (c) Atau formulir sebaiknya tetap untuk semua akun sesuai bunyi Slide 42 ("Pengguna mengirim permintaan akses/role")?

## Daftar kerja berikutnya (dicatat 9 Nov, dikerjakan satu per satu)

1. **Jenis sertifikat lain.** Sekarang hanya *completion* yang bisa terbit (migrasi `20261105030000`). Temuan dari slide: Slide 24 (PB-ACA-05) mewajibkan *Review Completion* dan *Approval Completion* sebelum *Certificate Record*, dan kelulusan dihitung dari learning record, assessment result, kehadiran, dan evaluasi akhir; Slide 26 menaruh **completion rule** di Master Course, **certificate model** di Course Offering, dan objek **Completion** terpisah dari **Certificate**; Slide 27: tahap Completion & Certificate dikerjakan Admin + Reviewer, peserta hanya mengunduh. Daftar enam jenis tidak ada di slide (berasal dari `src/lib/learning/types.ts` dan `registry.ts`). Saat ini peserta menerbitkan sendiri tanpa persetujuan.
2. **Pembayaran.** Tidak ada mekanisme bayar; course mandiri hanya "Gratis", course angkatan hanya mencatat penanggung biaya. Slide 22 dan 24: *payment (jika ada) terpisah dan tidak menentukan kelulusan*. Perlu ditinjau: `certificate_payment_required` (migrasi `20261105030000`) menahan sertifikat, dan karena status selesai baru ditetapkan saat sertifikat terbit, kelulusan ikut tertahan.
3. **Alur persetujuan pendaftaran.** ~~Offering baru belum punya formulir pengajuan.~~ Koreksi 10 Nov: jalur pengajuan sudah ada; tombolnya di halaman course dibuat 10 Nov (CATATAN_PERBAIKAN 2as). Sisa dari Slide 22 (PB-ACA-03) yang perlu arahan: dokumen persyaratan apa yang wajib diunggah, perlukah "minta perbaikan" (sekarang hanya tolak lalu peserta mengajukan lagi), seleksi/skor, waitlist, dan batas waktu keputusan.
4. ~~**Operator dan Data Master.**~~ Diputuskan 16 Nov (butir 10). Apakah Operator boleh mengubah Data Master (langsung atau lewat persetujuan)? Lihat juga butir 10.
5. ~~**Publisher vs Approver.**~~ Diputuskan 16 Nov (butir 5). Apakah tayang adalah langkah terpisah setelah disetujui?
6. **Peserta yang sudah lulus saat modul diperbarui.** Wajib mengulang, cukup diberi tahu, atau dibiarkan? Apakah sertifikat mencatat versi modul? Lihat juga butir 9.
7. **Email kontak expert.** Perlu tampil di direktori publik? Email siapa? Dijalankan di intern-update atau hanya main? Lihat juga butir 11.

## Portal Admin sesuai Slide 42-48 (dicatat 16 Nov, dikerjakan 17 Nov di laptop)

Sudah selesai 16 Nov: Jejak Audit `/admin/audit` dan pengalihan `/admin/reviews` (CATATAN_PERBAIKAN 2bd). Sisa dari pemetaan slide Tata Kelola Lintas Sistem:

**Bisa dikerjakan (perlu migrasi, ukuran sedang):**

1. ~~**Permintaan Akses / Peran (LS-01, Slide 42).**~~ **SELESAI 16 Nov tanpa migrasi** (CATATAN_PERBAIKAN 2be; keputusan pemilik proyek: peran kurasi saja, diputuskan super admin, tanpa tahap minta perbaikan). Untuk mentor: perlukah tahap "minta perbaikan" dan pembatalan oleh pengguna? Catatan asli: Alur di slide: pengguna mengajukan permintaan peran → Admin Console/Operator cek kelengkapan (minta perbaikan bila kurang) → review permintaan, verifikasi role & kewenangan → disetujui atau ditolak dengan alasan → notifikasi ke pengguna. Output: *Access Request Record*, role mapping, audit trail. Sekarang admin langsung memberi peran di Users & Access. **Koreksi 16 Nov:** sisi database sudah ada sejak migrasi `20260911073000`/`20260911080000`/`20261021080000`: tabel `rbac_role_change_requests` (RLS aktif, tulis hanya lewat RPC), `request_rbac_role_change` (pengguna mengajukan untuk dirinya sendiri; pemegang `users.assign_role` untuk orang lain), `decide_rbac_role_change` (hanya `roles.manage` = super_admin; pengaju/penerima tidak boleh menyetujui; peran langsung diterapkan; tercatat di `admin_audit_log`). Pembungkus `src/lib/auth/role-governance.server.ts` juga ada. Yang belum: server function, formulir pengajuan di halaman akun, antrean keputusan di Portal Admin, notifikasi ke pengguna, label di Jejak Audit. Tabel di intern-update masih kosong. Keputusan yang perlu diambil sebelum dikerjakan: peran apa yang boleh diajukan sendiri, siapa yang memutuskan (sekarang hanya super_admin, admin tidak bisa), dan apakah perlu tahap "cek kelengkapan / minta perbaikan" (status itu belum ada di tabel, jadi butuh migrasi). Peran `expert` tetap lewat alur pendaftaran expert. Migrasi baru wajib masuk `supabase/check_migrations.sql` dan daftar migrasi CATATAN_PERBAIKAN bagian 3.

**Besar, tanya mentor dulu sebelum dikerjakan:**

Kondisi di bawah diperiksa langsung ke kode dan database intern-update (16 Nov).

| Slide | Fitur | Perlu tanya mentor? | Ukuran bila dikerjakan | Bisa dikerjakan sekarang |
|---|---|---|---|---|
| LS-05 (46) | Tarif, Billing PNBP, pembayaran, SIMPONI | **Ya, paling penting** (menahan sertifikat berbayar) | Besar | Tidak |
| LS-03 (44) | Impor & migrasi data historis | **Ya** | Kecil (sekali jalan) sampai besar (menu impor) | Tidak |
| LS-06 (47) | Integrasi sistem & monitoring | Ya, tidak mendesak | Ikut integrasi pertama | Tidak |
| LS-07 (48) | Pengujian, UAT, kriteria penerimaan | Ya, ringan | Kecil bila cukup dokumen | Ya: template UAT dan Berita Acara |

#### LS-05 (Slide 46): Tarif, Billing PNBP, Pembayaran, SIMPONI Readiness

**Isi slide:** admin mengelola Master Tarif dan menetapkan pembayar/skema → menerbitkan tagihan (kode billing) → data disiapkan untuk SIMPONI (sistem PNBP Kemenkeu) → bukti bayar diverifikasi, status lunas dicatat dan direkonsiliasi → layanan/sertifikat diaktifkan. Output: Tariff Record, Billing Record, Payment Status, Payer Record, SIMPONI Readiness, Audit Trail.

**Kondisi aplikasi:**
- Course Offering angkatan selalu `fee_based`; yang dicatat hanya **penanggung biaya** (peserta, instansi, sponsor, dana pemerintah, berbagi biaya), tanpa nominal.
- Tidak ada tabel tarif, tagihan, pembayaran, maupun status bayar per peserta.
- Course mandiri "paid" dan "free_to_learn" (sertifikat berbayar) **ditolak** formulir admin (`program_access_model_unsupported`), dan peserta model itu tidak bisa mendapat sertifikat (`certificate_payment_required`, migrasi `20261105030000`).
- Kosakata `billing_requested`, `billing_issued`, `payment_confirmed`, `zero_tariff_approved` sudah ada di database sejak Juli tetapi dilarang dipakai.

**Kenapa tanya mentor:** tarif PNBP ditetapkan lewat Peraturan Pemerintah tentang jenis dan tarif PNBP KKP (aplikasi tidak boleh mengarang tarif); SIMPONI butuh akses resmi Kemenkeu (kode satker, akun billing) yang tidak bisa disiapkan tim pengembang.

**Pertanyaan:**
1. Apakah ada layanan BARUNA yang memang **berbayar**, atau semua dibiayai pemerintah/sponsor sehingga cukup mencatat penanggung biaya seperti sekarang?
2. Bila berbayar: tarif mengacu PP PNBP yang mana, dan siapa yang menetapkan nominal per program?
3. Pembayaran lewat **SIMPONI** langsung, atau bukti bayar diunggah lalu diverifikasi manual oleh operator?
4. Bolehkah sertifikat terbit sebelum lunas? Slide 22 dan 24 menyebut pembayaran "tidak menentukan kelulusan", sedangkan aturan database sekarang menahan sertifikat.

**Ukuran:** versi tanpa SIMPONI (tarif, tagihan, unggah bukti, verifikasi operator) kira-kira 3–4 migrasi dan 4–5 halaman; integrasi SIMPONI terpisah dan butuh kredensial Kemenkeu. Terkait butir 12(c) dan Daftar kerja no. 2 (Pembayaran).

#### LS-03 (Slide 44): Impor, Migrasi, dan Data Historis

**Isi slide:** operator memilih domain/dataset dan mengunggah file sumber/template → sistem menyimpan batch impor, memvalidasi format, memetakan kolom (mapping) → data masuk **staging** → hasil migrasi direview dan disetujui → diaktifkan sebagai record historis. Aturan: data historis wajib punya sumber/bukti dan timestamp, wajib duplicate check, tercatat di audit trail.

**Kondisi aplikasi:**
- Tidak ada fitur unggah/impor CSV atau Excel.
- **Data alumni Training 2024** (20 alumni dari 10 negara Afrika, 13 modul, 7–15 Sep 2024) **tertulis langsung di kode** (`src/data/edition2024.ts`), dipakai `/academy/alumni` dan `/academy/edition-2024`. Tidak ada di database: tidak bisa dicari, tidak punya sertifikat di sistem, dan hanya bisa diubah programmer.
- 11 expert KKP sudah ada di database, dimasukkan manual lewat skrip (bukan alur impor).

**Kenapa tanya mentor:** template, mapping, dan aturan validasi bergantung pada data lama apa yang ada dan formatnya. Bila datanya sedikit, menu impor lengkap berlebihan; cukup dimasukkan sekali lewat migrasi.

**Pertanyaan:**
1. Data lama apa yang harus masuk BARUNA (alumni sebelum 2024, sertifikat lama, expert dari sistem lain, publikasi lama)?
2. Formatnya apa (Excel, sistem lama, database lain) dan kira-kira berapa banyak?
3. **Sekali jalan** (dibantu tim pengembang) atau **berulang** (perlu menu impor untuk operator)?
4. Apakah 20 alumni 2024 perlu dipindah ke database (akun, klaim sertifikat, jaringan alumni)?

**Ukuran:** kecil bila sekali jalan (satu migrasi data + skrip cek); besar bila menu impor lengkap (staging, mapping, review, aktivasi, audit; kira-kira 2–3 migrasi dan 3–4 halaman).

#### LS-06 (Slide 47): Integrasi Sistem

**Isi slide:** pertukaran data dengan sistem internal/eksternal lewat **API Gateway** (OAuth2/API Key); validasi, mapping, penanganan error dan retry, log integrasi; **dasbor monitoring** dan alert ke admin; enkripsi, rate limiting, SLA per integrasi.

**Kondisi aplikasi:** BARUNA belum terhubung ke sistem luar mana pun (yang keluar hanya tautan video YouTube/Vimeo, bukan integrasi data). Belum ada API untuk sistem lain dan belum ada sistem yang mengirim data ke BARUNA.

**Kenapa ditunda:** monitoring baru berguna bila integrasinya ada; dasbor sekarang akan kosong.

**Pertanyaan:**
1. Sistem mana yang direncanakan terhubung (SIMPONI dari LS-05, kepegawaian/SSO KKP, satu data KKP, sistem pelatihan lain)?
2. Adakah sistem yang perlu **mengambil data dari BARUNA** (misalnya daftar expert atau alumni untuk portal lain)?

**Ukuran:** per integrasi. Kerangka log dan monitoring dibuat bersama integrasi pertama (kemungkinan SIMPONI).

#### LS-07 (Slide 48): Pengujian, UAT, dan Kriteria Penerimaan

**Isi slide:** admin menyiapkan lingkungan uji, menyusun **test case**, menjadwalkan UAT → pengguna menjalankan skenario dan memberi masukan → temuan dicatat sebagai **defect record** dan diperbaiki → approval acceptance dan **Berita Acara UAT**. Slide 50 menjadwalkan UAT September–Oktober 2026 dengan output "Berita Acara UAT" dan "Daftar temuan & tindak lanjut".

**Kondisi proyek:** 43 skrip uji otomatis `test:*` (menulis data uji ke database sungguhan lalu membersihkannya); langkah uji manual dan bug yang diketahui di `KESIAPAN_RILIS.md`; temuan dan perbaikan di `CATATAN_PERBAIKAN.md`. Di aplikasi belum ada menu test case, temuan, atau berita acara.

**Kenapa tidak harus jadi fitur:** UAT adalah proses proyek, bukan layanan untuk pengguna BARUNA; biasanya cukup di dokumen/spreadsheet yang ditandatangani.

**Pertanyaan:**
1. Cukup didokumentasikan di dokumen/spreadsheet dengan Berita Acara ditandatangani di luar aplikasi, atau KKP mewajibkan pencatatan di dalam sistem?
2. Siapa pengguna yang ikut UAT dan kapan jadwalnya (Sep–Okt di roadmap sudah lewat)?

**Bisa disiapkan tanpa menunggu:** template UAT (skenario per peran, kolom hasil, tabel temuan, format Berita Acara) dari langkah uji manual yang sudah ada.

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
- **Full Training: DIPUTUSKAN pemilik proyek (16 Nov), opsi A.** Program dibuat ulang sebagai Course Offering; kehadiran dibangun dan program lama dialihkan (CATATAN_PERBAIKAN 2bb). Masih ditanyakan: apakah data perjalanan/visa peserta perlu dikelola di BARUNA, dan apakah kehadiran menjadi syarat lulus.
- **Full Training** kini lewat persetujuan admin di `/admin/enrollments` (bagian 2i). Yang belum diputuskan: apakah program African Countries masih dipakai? Halaman My Learning menghapusnya otomatis dari browser.
  - *(11 Nov)* Lima berkas di formulir Full Training (paspor, CV, surat penugasan, surat motivasi, foto) hanya dicatat namanya di browser. Berkasnya tidak pernah terkirim, admin tidak bisa membukanya, dan peserta tidak bisa mengunggah ulang saat diminta perbaikan (sekarang hanya bisa menjawab lewat teks, CATATAN_PERBAIKAN 2av). ~~**Pertanyaan:** perlukah unggah berkas sungguhan?~~ **Diputuskan pemilik proyek (11 Nov): ya.** Berkas kini terkirim ke penyimpanan privat dan bisa diganti saat perbaikan (CATATAN_PERBAIKAN 2ax, migrasi `20261111020000`). Yang masih menunggu mentor: nasib program Full Training itu sendiri (progres belajarnya masih di browser).
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
