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
*Dokumen ini diperbarui secara berkala sesuai dengan evolusi sistem dan tata kelola BARUNA.*
