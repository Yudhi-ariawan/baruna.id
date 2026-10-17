# Menunggu Arahan Mentor

Daftar pekerjaan yang sengaja ditahan karena aturannya belum diputuskan. Mengerjakannya sebelum ada keputusan berisiko dikerjakan dua kali.
Acuan: `dokumen/CATATAN_PERBAIKAN.md` (bagian 5) dan 51 slide proses bisnis di `dokumen/`.

## Yang menunggu arahan

1. **Template dan isi sertifikat**: penandatangan, format nomor, JP, dan jenis sertifikat.
2. **Syarat lulus pelatihan.**
3. **Role participant**: diberikan saat biodata disimpan atau saat admin menyetujui.
4. **Expert yang disetujui**: otomatis jadi trainer atau tidak.
5. **Publisher** terpisah dari **approver** atau tidak.
6. **Profile Claim** dan fitur **Penugasan Expert**.

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
- Kelulusan kuis dan sertifikat masih dicatat di `localStorage` (melanggar Slide 15).

### Role dan alur
- Role participant: PB-ACA-03 menyebut role diberikan saat admin menyetujui, tetapi kode memberikannya saat biodata disimpan.
- Expert disetujui otomatis jadi trainer aktif; Slide 39 menyiratkan persetujuan trainer terpisah.
- Approve modul langsung menayangkan; apakah perlu langkah publisher terpisah.
- Profile Claim (Slide 37) dan Penugasan Expert (fitur disembunyikan sementara).

### Ruang belajar (setelah perbaikan 2h di CATATAN_PERBAIKAN.md)
- **Full Training** kini lewat persetujuan admin di `/admin/enrollments` (bagian 2i). Yang belum diputuskan: apakah program African Countries masih dipakai? Halaman My Learning menghapusnya otomatis dari browser.
- **Demo Mode** tidak lagi membuka ruang belajar. Admin yang ingin presentasi harus memakai akun peserta yang sudah disetujui. Apakah perlu mode pratinjau khusus admin (diperiksa di server)?
- **PDF modul Master** sudah tidak ditautkan di halaman publik, tetapi filenya masih aset publik Lovable. Perlu file PDF asli untuk dipindah ke penyimpanan privat.

## Yang aman dikerjakan tanpa menunggu
- ~~Tutup akses ruang belajar lewat `localStorage`~~ (selesai untuk modul Master dan dinamis, lihat 2h).
- ~~Pecah `academy.learn.$id.tsx`~~ (selesai, 228 baris).
- Uji manual di browser: pendaftaran peserta, pengiriman modul trainer, keputusan modul oleh approver, kuis peserta.
- Migrasi: hanya database intern-update; `main` adalah ranah mentor.
- ~~Hapus 58 akun tes~~ (selesai 17 Oktober 2026; tersisa 24 pengguna asli).
- Buat ulang `types.ts` lewat Supabase CLI (perlu login Supabase).
