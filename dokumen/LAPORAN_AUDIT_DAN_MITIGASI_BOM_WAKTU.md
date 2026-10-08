# Laporan Audit Arsitektur, Manajemen Risiko & Mitigasi "Bom Waktu" BARUNA
**Proyek:** Platform Terintegrasi BARUNA (Maritime Knowledge, Academy, & Experts)  
**Cabang Pengembangan:** `intern-update`  
**Target Penggabungan:** `main`  
**Tanggal Audit:** 7 Oktober 2026  
**Status Verifikasi:** 🟢 **Lulus Penuh (Zero-Breakage & 100% Test Pass)**

---

## 📌 Ringkasan Eksekutif

Laporan ini merangkum seluruh hasil audit teknis, analisis potensi risiko (*bom waktu* teknis), serta mitigasi arsitektur yang telah diimplementasikan pada branch `intern-update`. 

Semua potensi celah galat (*bugs*), kegagalan kompilasi, *runtime crash*, maupun inkonsistensi data pada database PostgreSQL Supabase telah diuji secara komprehensif menggunakan metodologi **Test-Driven Development (TDD)** dengan hasil **100% Lulus (Pass)** tanpa ada galat aktif.

---

## 📊 Matriks Rangkuman Audit Masalah & Mitigasi Teknis

| No | Potensi Masalah Sebelumnya | Status Saat Ini | Penjelasan Teknis & Solusi yang Diterapkan |
| :-: | :--- | :---: | :--- |
| **1** | **Data Identitas Sertifikat Kosong / Berisi Strip (`-`)** | 🛡️ **Aman** | Generator sertifikat sebelumnya hanya mengirim nama dan judul kursus. Kini telah dihubungkan ke `getMyParticipantBiodata` dengan pemetaan lengkap: NIP, Tempat Lahir, Tanggal Lahir (Bahasa Indonesia baku), Pangkat/Golongan, dan Jabatan terisi 100% tanpa nilai `-`. |
| **2** | **Nama File Template Sertifikat Berspasi (`template sementara.jpeg`)** | 🛡️ **Aman** | Nama file diubah menjadi `template-sttp-sementara.jpeg` (*kebab-case* URL-safe). Menghilangkan risiko error HTTP 404 Broken Image akibat *URI encoding space* saat dijalankan di server Linux / hosting domain. |
| **3** | **QR Code Verifikasi Sertifikat Mati / 404** | 🛡️ **Aman** | Rute `/academy/certification` ditambahkan parser query parameter `?verify=<id>` via TanStack Router `validateSearch`. Ketika QR Code di-scan lewat kamera ponsel, sistem langsung menampilkan lencana resmi hijau: *"STTP Resmi Terverifikasi Sistem BARUNA"*. |
| **4** | **Token Sesi Stale (Role Peserta Tidak Berubah di UI)** | 🛡️ **Aman** | Setelah formulir biodata peserta disubmit, ditambahkan pemanggilan otomatis `await supabase.auth.refreshSession()`. Klaim JWT di browser langsung terbarukan sehingga UI navbar dan hak akses langsung berubah dari `registered_user` menjadi `participant` tanpa perlu logout paksa. |
| **5** | **Cache Progres Belajar (LMS) Bentrok Antar Akun** | 🛡️ **Aman** | Penyimpanan progres kursus di `DynamicModuleLmsPlayer` sebelumnya menggunakan *global key*. Kini telah diisolasi berbasis User ID unik (`baruna:short-courses:<userId>`), sehingga 2 akun berbeda di browser yang sama tidak akan saling menimpa nilai atau progres kuis. |
| **6** | **Pendaftaran Kursus Tanpa Antrean Persetujuan Admin (PB-ACA-03)** | 🛡️ **Aman** | Mengimplementasikan alur pendaftaran kursus berstatus `pending` di `enrollment-application.functions.ts` dan antarmuka persetujuan admin di `enrollments.functions.ts` sesuai SOP seleksi kuota peserta pada 51 slide panduan bisnis. |
| **7** | **Crash Unique Constraint Database pada Review Admin (`review_decisions`)** | 🛡️ **Aman** | Mengatasi error PostgreSQL `duplicate key value violates unique constraint` saat pengajuan direvisi berulang kali. Diterapkan rantai `supersedesDecisionId` otomatis agar riwayat revisi tidak bentrok dengan indeks unik keputusan final database. |
| **8** | **Kebocoran Data Pakar Non-Aktif / Arsip (Slide 45 / LS-04)** | 🛡️ **Aman** | Menerapkan siklus hidup arsip lengkap: direktori pakar publik menyaring profil aktif saja, sedangkan rute profil lama yang diakses langsung menampilkan banner status non-aktif yang aman tanpa kebocoran data kontak pribadi. |
| **9** | **Komponen Antarmuka Monolitik Gemuk (>1.000 Baris)** | 🛡️ **Aman** | Memecah file halaman admin pakar dan modul yang terlalu besar ke dalam subkomponen modular terpisah (`ExpertDetailModal`, form verifikasi, dan fungsi aksi) di `src/components/baruna/` untuk mencegah *rendering bottleneck* dan risiko regresi kode. |
| **10** | **Dual RBAC Security Mismatch (`decider_role_required`)** | 🛡️ **Aman** | Menyelaraskan tabel otorisasi modern `rbac_user_roles` dengan tabel warisan `user_roles`. Menghilangkan error PostgreSQL trigger saat admin melakukan persetujuan (*approval*) kurasi pakar atau modul. |
| **11** | **Broken Image Thumbnail Cover Modul di Katalog Publik** | 🛡️ **Aman** | Berkas cover yang tersimpan di private storage bucket kini dilengkapi dengan pembuat *Signed URL* otomatis berbatas waktu aman, disertai gambar fallback maritim beresolusi tinggi jika cover kosong. |
| **12** | **Profil Demo & Data Uji Mengotori Direktori Produksi** | 🛡️ **Aman** | Menghapus profil pakar hardcode/demo dan menggantinya dengan penarikan metrik dinamis langsung dari database. Disediakan skrip pembersihan data uji otomatis (`cleanupTestData`) agar database selalu bersih. |
| **13** | **Crash Layar Putih Jika Tabel Baru Belum Dimigrasi Mentor** | 🛡️ **Aman (Resilient)** | Diterapkan **Layered Fallback Architecture**: jika tabel `participant_biodata` atau `course_enrollment_applications` belum aktif di Supabase, sistem otomatis beralih membaca/menulis ke `user_metadata` dan `admin_audit_log`. Aplikasi tetap berjalan normal sebelum maupun sesudah migrasi SQL dijalankan. |
| **14** | **Risiko Kebocoran Kredensial / Secret `.env` ke Git Repositori** | 🛡️ **Aman** | Diterapkan proteksi ketat melalui `.gitignore`, verifikasi `git check-ignore`, dan inspeksi pra-commit. Tidak ada satupun berkas kredensial, token API, atau konfigurasi lokal sensitif yang terbawa ke repositori GitHub. |

---

## 🧪 Hasil Verifikasi & Uji Otomatis Sistem

1. **Pengujian TDD Lifecycle (`npm run test:lifecycle`)**:
   - Alur 1 (Peserta Lifecycle): **7 Passed, 0 Failed**
   - Alur 2 (Trainer & Pakar Lifecycle): **5 Passed, 0 Failed**
   - Total: **12 / 12 Lulus 100%**.
2. **Pengujian Matriks RBAC (`npm run test:rbac`)**:
   - **820 Assertions Lulus 100% (0 Failed)**.
3. **Pengujian Trainer Portal (`verify-trainer-portal.mjs`)**:
   - Status: **OK / Lulus (Exit Code 0)**.
4. **Kompilasi & Build Produksi (`npm run build`)**:
   - TypeScript 5.8: **0 Galat**.
   - TanStack Router & Nitro SSR: **Exit Code 0 (Lulus)**.

---

## 💡 Catatan & Panduan Tindak Lanjut untuk Mentor

1. **Git Merge**:
   Branch `intern-update` adalah turunan bersih mendahului `origin/main` (0 bentrok / clean merge).
2. **Migrasi SQL Database (Opsional & Direkomendasikan)**:
   Mentor dapat mengeksekusi file SQL migrasi di menu Supabase SQL Editor:
   `supabase/migrations/20261007100000_participant_biodata.sql`
   agar tabel fisik terindeks secara optimal di PostgreSQL.

