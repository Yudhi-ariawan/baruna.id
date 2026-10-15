# Panduan Standar Arsitektur, Keamanan, dan Keberlanjutan Sistem BARUNA
*(BARUNA Long-Term Scalability & Engineering Standards)*

Dokumen ini disusun sebagai acuan wajib bagi seluruh pengembang (baik tim pengembang manusia maupun agen AI/AI Coding Assistant) untuk memastikan aplikasi BARUNA tetap aman, cepat, terstruktur, dan stabil digunakan dalam jangka panjang oleh puluhan ribu pengguna secara bersamaan.

---

## 1. Filosofi Pengembangan: "Responsible Vibe Coding"

Pengembangan dengan bantuan AI (*AI-assisted development* / *vibe coding*) memberikan kecepatan tinggi, namun wajib diimbangi dengan disiplin arsitektur (*engineering discipline*) agar tidak menimbulkan utang teknis (*technical debt*) yang merugikan.

### 5 Pilar Utama:
1. **Terukur & Berbasis Dokumen:** Setiap pengembangan fitur baru harus merujuk pada dokumen proses bisnis resmi (`dokumen/README.md` dan 51 slide SOP).
2. **Bebas Galat Kompilasi (*Strict TypeScript*):** Tidak boleh ada kode yang ditinggalkan dalam keadaan error tipe atau gagal build (`npm run build` wajib lulus 100%).
3. **Keamanan Berlapis (*Zero Trust / RLS First*):** Jangan pernah mengandalkan validasi di sisi browser saja; keamanan data utama berada pada RLS PostgreSQL dan middleware server.
4. **Modularitas Komponen:** Hindari menumpuk ribuan baris kode dalam satu file; pecah menjadi komponen yang dapat digunakan ulang (*reusable*).
5. **Efisien Skalabilitas:** Hemat kuota kueri database, batasi ukuran unggahan berkas, dan gunakan koneksi *pooling*.

### Prinsip Wajib: Banyak Pengguna, Banyak Perangkat, Bersamaan
BARUNA dipakai banyak orang sekaligus, dari perangkat yang berbeda (HP, laptop, dua tab, dua perangkat milik satu orang). Setiap fitur yang menulis data **wajib** dirancang dengan asumsi berikut:
1. **Klik ganda dan kirim ulang itu normal.** Penulisan harus idempoten: mengulang aksi yang sama tidak boleh membuat data ganda atau mengubah hasil.
2. **Dua orang bisa bertindak di saat yang sama.** Gunakan kunci baris (`FOR UPDATE`), advisory lock per pengguna, dan kunci optimistik (`updated_at` mentah dari JSON) untuk data yang bisa diubah lebih dari satu orang.
3. **Satu aksi = satu transaksi.** Perubahan yang melibatkan beberapa tabel dilakukan dalam satu RPC database agar tidak ada keadaan "setengah tersimpan". Jangan merangkai beberapa panggilan `supabaseAdmin` lalu berharap semuanya berhasil.
4. **Gagal harus terlihat.** Dilarang `console.warn` lalu mengembalikan sukses. Pengguna dan admin harus menerima pesan yang jelas dan bisa ditindaklanjuti.
5. **Aturan ditegakkan di database.** Apa pun yang bisa dipanggil dari SDK browser (RPC yang di-`GRANT` ke `authenticated`) harus memeriksa sendiri hak akses dan batasannya; pemeriksaan di UI/server function hanya untuk pesan yang ramah.
6. **Bacaan tanpa efek samping.** Halaman yang dibuka (GET) tidak boleh menulis data, kecuali perbaikan sekali-jalan yang terkunci dan idempoten.
7. **Data yang terus tumbuh harus dibatasi.** Respons yang dimuat setiap kali halaman dibuka wajib memiliki batas jumlah/ukuran.

---

## 2. Standar Basis Data & Migrasi (Supabase / PostgreSQL)

1. **Disiplin Migrasi Skema:**
   * Dilarang keras mengubah, menambah, atau menghapus kolom/tabel langsung di dashboard web Supabase tanpa membuat berkas migrasi SQL.
   * Setiap perubahan struktur data wajib dicatat dalam berkas migrasi berurutan di folder `supabase/migrations/<timestamp>_<nama_migrasi>.sql`.
2. **Row Level Security (RLS) Wajib Aktif:**
   * Semua tabel yang menampung data pengguna (`expert_applications`, `module_drafts`, `service_requests`, dll.) wajib mengaktifkan RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
   * Kebijakan akses (*Policies*) harus jelas:
     * Pengguna umum hanya dapat membaca data yang berstatus `published` atau `approved`.
     * Pemilik data hanya dapat mengakses dan mengedit datanya sendiri (`auth.uid() = user_id`).
     * Admin/Verifikator hanya dapat mengakses data sesuai hak kewenangannya di RBAC.
3. **Penggunaan Kunci Layanan (*Service Role Key*):**
   * Objek `supabaseAdmin` (yang mengabaikan RLS) **hanya boleh digunakan pada server functions** untuk operasi administratif internal atau agregasi lintas sistem yang telah divalidasi identitas pemanggilnya (`context.userId`).
   * Dilarang membocorkan atau mengekspos kunci `SUPABASE_SERVICE_ROLE_KEY` ke sisi frontend browser.
4. **Koneksi Database Skala Besar (*Connection Pooling*):**
   * Di lingkungan produksi (*production*), aplikasi wajib terhubung ke database menggunakan **Supabase Transaction Pooler (Port 6543 / Supavisor)**, bukan Direct Connection (Port 5432), untuk mencegah kehabisan batas koneksi saat diakses banyak pengguna secara bersamaan.

---

## 3. Standar Arsitektur Frontend & Kinerja (TanStack Router & Query)

1. **Modularitas Berkas & Ukuran Komponen:**
   * Jika sebuah berkas rute (`src/routes/...`) telah melebihi 400–500 baris, lakukan pemisahan komponen (*refactoring*):
     * Tempatkan komponen tampilan reusable di `src/components/baruna/...`.
     * Tempatkan fungsi logika dan validasi tipe di `src/lib/...`.
2. **Manajemen Caching (*TanStack Query*):**
   * Hindari penggunaan `staleTime: 0` (default) untuk data yang jarang berubah (seperti direktori pakar, katalog kurikulum, atau daftar bidang keahlian).
   * Gunakan `staleTime` yang tepat untuk mencegah lonjakan kueri berulang saat pengguna berganti-ganti tab:
     ```ts
     // Contoh data master/referensi:
     staleTime: 1000 * 60 * 5, // 5 menit
     gcTime: 1000 * 60 * 30,    // 30 menit
     ```
3. **Pratinjau & Penanganan Dokumen:**
   * Akses berkas lampiran (PDF/gambar) harus memanfaatkan *Signed URL* langsung dari Supabase Storage yang dibuka di tab baru browser (`window.open(signedUrl, '_blank')`).
   * Hindari penggunaan viewer pihak ketiga yang tidak stabil atau membebani server lokal.

---

## 4. Standar Penyimpanan Berkas (*Object Storage*)

1. **Pembatasan Ukuran Unggahan (*Upload Quota*):**
   * Terapkan validasi ukuran berkas ketat di sisi klien dan sisi server:
     * Silabus / Dokumen PDF: Maksimal 10 MB.
     * Materi Presentasi (PPT/PPTX): Maksimal 25 MB.
     * Foto Profil / Gambar: Maksimal 2 MB (format disarankan WebP/JPEG/PNG).
2. **Keamanan Bucket Storage:**
   * Bucket penyimpanan dokumen privat (seperti CV, ijazah, atau naskah kuis evaluasi) harus disetel sebagai **Private Bucket**, hanya dapat diakses melalui URL berbatas waktu (*time-limited signed URL*).

---

## 5. Pengujian Kualitas & Alur Rilis (*Quality Assurance & Release*)

Sebelum kode di-commit dan di-push ke GitHub:
1. **Validasi Kompilasi:**
   Jalankan `npm run build` untuk memastikan tidak ada kesalahan TypeScript, sintaks TanStack Router, atau plugin bundling.
2. **Pemeriksaan Keamanan Berkas:**
   Pastikan berkas `.env`, kredensial lokal, dan data rahasia tidak pernah masuk ke *git staging* (`git check-ignore .env`).
3. **Pesan Commit yang Terfokus:**
   Gunakan format commit konvensional: `feat(...)`, `fix(...)`, `refactor(...)`, atau `chore(...)`.

---

## 6. Integrasi Ekosistem Lintas Modul (Slide 41)

Pastikan ketiga pilar utama BARUNA saling terhubung secara konsisten:
* **Modul Experts $\rightarrow$ Academy:** Pakar yang disetujui memasok modul kurikulum resmi dan rekam jejak fasilitasi kelas.
* **Modul Experts $\rightarrow$ Knowledge Hub:** Pakar menjadi kontributor ilmiah dan penelaah substansi dokumen pengetahuan.
* **Modul Academy & Knowledge Hub $\rightarrow$ Experts:** Menghasilkan rekam jejak, jam belajar (*learning hours*), dan data reputasi pakar secara otomatis.

---

## 7. Siklus Hidup Pengajuan Expert (PB-EXP-01 / PB-EXP-02)

Status pengajuan expert tersebar di `review_subjects.current_status`, `review_subjects.metadata.review_status`, keputusan terakhir di `review_decisions`, dan `review_drafts.status`. Agar tidak terjadi konflik antar-fitur:

1. **Satu sumber kebenaran status:** gunakan `deriveExpertEffectiveStatus()` di `src/lib/experts/application-status.ts`. Dilarang menulis ulang logika penentuan status di halaman/fungsi lain.
2. **Guard transisi keputusan:** setiap keputusan admin wajib lolos `getExpertDecisionBlocker()` (server) — arsip harus dipulihkan dulu, keputusan yang sama tidak boleh diulang, dan approve pada expert yang sudah disetujui hanya melakukan sinkronisasi ulang tanpa baris keputusan baru.
3. **Pemisahan wewenang:** reviewer/verifier hanya membaca antrean; keputusan, arsip, dan pemulihan hanya untuk `approver`, `admin`, `super_admin`. Pemohon tidak boleh memutuskan pengajuannya sendiri.
4. **Optimistic lock:** penulisan status `review_subjects` dari server function wajib memakai `.eq("updated_at", <nilai yang dibaca>)` agar klik ganda / dua verifikator bersamaan tidak saling menimpa.
5. **Duplicate check:** satu akun hanya boleh memiliki satu pengajuan aktif dan satu profil `experts` kanonik; publikasi ulang menautkan ke profil yang sudah ada (slug dipertahankan, statistik trainer tidak di-reset).
6. **Validasi payload server:** payload pengajuan divalidasi `ExpertPayloadSchema` dan path dokumen wajib berada di `users/<userId>/` (`src/lib/experts/application-validation.ts`). Batas unggahan memakai `src/lib/storage/upload-limits.ts`.
7. **Status trainer = tabel riwayat ber-versi:** `expert_trainer_status` menyimpan satu baris per perubahan. Baca selalu versi terbaru (`getLatestTrainerStatus()` / `ORDER BY version DESC, granted_at DESC LIMIT 1`), jangan pernah `.maybeSingle()`. Kode yang dipanggil saat membuka halaman (GET) tidak boleh mengaktifkan ulang trainer yang dinonaktifkan admin.
8. **Tanpa "rekayasa" unggahan:** unggahan yang gagal wajib menghentikan proses dengan pesan jelas. Dilarang menyimpan metadata berkas tanpa `path` (lampiran "hantu") atau diam-diam pindah ke bucket lain. Server menolak pengiriman final yang berisi lampiran tanpa `path`.
9. **Penugasan Expert (PB-EXP-03):** status `expert_service_requests` hanya diubah lewat RPC (`admin_service_request_transition`, `trainer_service_request_respond`, `expert_service_request_reply`, `expert_service_request_cancel`). Setiap perubahan dicatat di `expert_service_request_events` (juga menjadi utas pesan "Request info" ↔ balasan). Admin wajib mengirim `updatedAt` mentah dari JSON daftar (jangan diubah lewat `Date`, presisi mikrodetik hilang). Penyelesaian menulis tepat satu baris `expert_training_facilitation_history` (`service_request_id` unik). Expert hanya dapat ditugaskan bila memiliki portal trainer aktif.
10. **Kualifikasi Trainer (Slide 39):** expert non-trainer mengajukan lewat `/experts/trainer-application`; admin memutuskan di `/admin/trainer-applications`. Persetujuan **menambah versi baru** `expert_trainer_status`, tidak pernah meng-`UPDATE` riwayat. Arsip/pulihkan expert juga menambah versi (`appendTrainerStatusVersion`), dan pemulihan hanya membatalkan perubahan yang dibuat oleh pengarsipan.

## 8. Pendaftaran Peserta (PB-ACA-03)

1. **Satu sumber kebenaran:** status pendaftaran hanya dibaca dari `course_enrollment_applications`. Dilarang menurunkan role atau status persetujuan dari `auth.users.user_metadata` — pengguna dapat mengubah metadata miliknya sendiri lewat SDK browser. Metadata hanya boleh dipakai untuk data tampilan (nama, foto).
2. **Hanya lewat RPC:** pendaftar memakai `course_enrollment_apply` (idempoten: status `approved`/`pending` tidak pernah di-reset), admin memakai `admin_course_enrollment_decide`. Role `authenticated` tidak memiliki hak INSERT/UPDATE langsung ke tabel.
3. **Keputusan atomik:** baris keputusan, pemberian role `participant`, dan baris `enrolments` ditulis dalam satu transaksi. Kegagalan salah satunya membatalkan semuanya dan ditampilkan ke admin — dilarang `console.warn` lalu mengembalikan "sukses".
4. **Role primer:** database mewajibkan tepat satu role primer aktif per pengguna. Saat memberi role tambahan, cek role primer lain **tanpa** menghitung baris role yang sedang diberikan; role `expert` tetap primer.
5. **Keputusan final:** keputusan yang sama boleh diulang (idempoten), tetapi `approved` tidak dapat dibalik menjadi `rejected` atau sebaliknya. Admin tidak boleh memutuskan pendaftarannya sendiri.

## 9. Modul Trainer (Slide 41 Experts → Academy)

1. **Gerbang di database, bukan hanya di server function:** RPC `module_draft_create/update/submit` dapat dipanggil langsung dari SDK browser, sehingga RPC itu sendiri wajib memeriksa trainer aktif (`_module_trainer_gate`), kuota level (`_module_level_limit`, membaca tabel konfigurasi `trainer_level_module_limits`; `LEVEL_MODULE_LIMIT` di TypeScript hanya nilai cadangan), dan kepemilikan lampiran (`_assert_module_attachments`). Jika aturan di TypeScript berubah, ubah juga fungsi SQL-nya.
2. **Keputusan modul hanya lewat `admin_module_decide`:** satu transaksi untuk subjek, baris keputusan, draf, `module_registry`, dan `knowledge_resources`; kunci baris + `expectedUpdatedAt` mentah dari JSON. Dilarang menghapus baris `review_decisions` sebagai "rollback". Proyeksi Knowledge Hub berjalan setelah commit dan bersifat idempoten.
3. **Keputusan baru jatuh tempo** bila ada revisi (`review_subject_revisions.submitted_at`) setelah keputusan terakhir. `restore` mengembalikan status sebelum diarsipkan dan tidak pernah menayangkan modul yang belum pernah disetujui; modul `revoked` tidak dipulihkan dari panel admin.
4. **Peran pemutus** (`_can_decide_review`): `super_admin`, `admin`, `approver` (RBAC resmi) serta peran lama `admin`/`management`. Reviewer/verifier hanya meninjau. Pengaju tidak boleh memutuskan modulnya sendiri.
5. **Simpan/kirim modul = satu transaksi** lewat `trainer_module_save` (buat, ubah, kirim, dan label antrean admin), terkunci per trainer; ukuran payload maksimal 1 MB.
6. **Kuota level** (`_trainer_module_quota`) menghitung modul tayang **ditambah** modul baru yang masih menunggu verifikasi. UI membaca `moduleQuota` dari bootstrap, bukan menghitung sendiri.
7. **"Buka revisi modul tayang" hanya lewat RPC `request_published_module_revision`** (satu transaksi, peran pemutus yang sama, tanpa jalur cadangan TypeScript). Isi kuis draf revisi diambil dari draf terakhir, bukan dari `module_registry`, karena salinan registry tidak memuat kunci jawaban.
8. **Revisi modul tayang tidak menurunkan versi tayang:** "Minta revisi" atau "Tolak" atas revisi modul yang sedang tayang membiarkan versi yang disetujui tetap publik.
9. **Portal trainer tanpa efek samping:** `trainer_portal_bootstrap` hanya membaca dan dibatasi (100 draf, 20 riwayat per draf). Status trainer pertama untuk expert lama dibuat sekali lewat `trainer_status_backfill_self`. `expert_trainer_status` memiliki indeks unik `(expert_id, version)`.
10. **Kunci jawaban kuis tidak pernah publik:** trigger `trg_mr_extract_quiz_keys` memindahkan `correctAnswer`/`explanation` ke `module_quiz_answer_keys` (hanya service role) pada setiap penulisan `module_registry`. Browser hanya menerima soal; penilaian lewat `gradePublishedModuleQuiz`.

---
*Dokumen ini diperbarui secara berkala sesuai dengan evolusi sistem dan tata kelola BARUNA.*

## Aturan migrasi baru (wajib)

Database `main` dan `intern-update` adalah dua database Supabase berbeda dan migrasi ditempel manual tanpa catatan. Karena itu, **setiap kali menambah file di `supabase/migrations/`**, di commit yang sama wajib:

1. Menambah satu baris bernomor di `supabase/check_migrations.sql` (cek tabel/fungsi/indeks yang dibuat migrasi itu) dan memperbarui jumlah barisnya di komentar.
2. Memperbarui daftar "Migrasi yang harus dijalankan" di `dokumen/CATATAN_PERBAIKAN.md`.
3. Menguji migrasi dua kali berturut-turut (harus bisa dijalankan ulang) di Postgres lokal.

Tujuannya: saat mentor merge, pengecek langsung menunjukkan migrasi mana yang belum dijalankan.
