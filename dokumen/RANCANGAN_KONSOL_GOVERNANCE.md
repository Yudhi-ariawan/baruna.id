# Rancangan Konsol Kurasi `/governance` (21 Oktober 2026)

Status: **dikerjakan 21 Okt 2026 (PC), belum di-push.** Hasil dan uji: `dokumen/CATATAN_PERBAIKAN.md` bagian 2o. Menjawab temuan `dokumen/AUDIT_PERAN.md`: rantai kurasi resmi (reviewer → verifier → approver → publisher) hanya bisa dijalankan admin/super admin karena antrean ada di dalam portal `/admin` yang pintunya `users.read`.

Acuan: slide 3 (aktor), slide 4 (lajur Admin Console/Operator terpisah dari lajur Review/Approval), slide 12 (Request a Training), slide 16 (matriks 10 peran), slide 37 (PB-EXP-02).

## Prinsip

1. **Per peran, sesuai slide 16.** Setiap peran melihat dan melakukan persis tugasnya; tidak ada tombol yang tidak boleh dipakainya.
2. **Satu sumber aturan.** Konsol tidak membuat aturan akses baru. Menu dan tombol memakai pemeriksaan yang sudah dipakai server function dan RPC keputusan masing-masing; server tetap menolak walau tombol dipaksa tampil.
3. **Tanpa kode ganda.** Halaman Verifikasi dipindah, bukan disalin; `/admin` menautkan ke sana.
4. **Tanpa fitur palsu.** Tahap yang belum ada di aplikasi (catatan reviewer, rekam verifikasi, tahap publisher, kelengkapan oleh operator, konversi permintaan pelatihan) tidak ditampilkan seolah ada; dicatat untuk mentor.

## Pembagian

| Area | Untuk | Isi |
|---|---|---|
| `/admin` | admin, super admin | Dashboard sistem, Users & Access, Kualifikasi Trainer (aturan database saat ini: admin saja), tautan "Verifikasi & Kurasi" ke `/governance` |
| `/governance` | reviewer, verifier, approver, publisher, operator, admin, super admin | Konsol kurasi: antrean sesuai peran |

Halaman awal setelah login dan tautan Navbar memakai aturan yang sama: admin/super admin ke `/admin`; peran kurasi ke `/governance`. Pengguna yang punya keduanya melihat keduanya.

## Menu dan aksi per peran

Aturan diambil dari pemeriksaan server yang sudah ada (kolom "Sumber aturan").

| Menu `/governance` | Reviewer | Verifier | Approver | Publisher | Operator | Admin / Super admin | Sumber aturan |
|---|---|---|---|---|---|---|---|
| Verifikasi Expert | baca | baca | baca + putuskan, arsip, pulihkan | – | – | semua | `getExpertGovernanceAccess` / `admin_expert_decide` |
| Verifikasi Modul | baca | baca | baca + putuskan, buka revisi | – | – | semua | `modules.functions` / `_can_decide_review` |
| Verifikasi Publikasi (Knowledge Hub) | baca | baca | baca + putuskan, arsip, pulihkan | – | – | semua | `publications.functions` / `admin_kr_decide` |
| Persetujuan Peserta | – | – | baca + putuskan | – | baca + putuskan | semua | `enrollments.functions` / `_is_enrollment_admin` |
| Permintaan Pelatihan | rekomendasi (bila ditugaskan) | – | tugaskan reviewer, putuskan | – | – | semua | `has_role` + `assign_reviewer`, `finalize_decision` |
| Ringkasan (beranda konsol) | jumlah antrean menu yang terlihat | sama | sama | penjelasan "tahap publikasi belum terpisah" | sama | sama | dari menu di atas |

Catatan:
- "Putuskan" hanya untuk pengajuan orang lain (pengaju tidak boleh memutuskan miliknya sendiri; sudah dijaga RPC).
- Publisher belum punya pekerjaan: persetujuan saat ini langsung menayangkan (pertanyaan mentor).
- Permintaan Pelatihan memakai alur review generik yang sudah ada (satu-satunya jenis yang memakainya). Langkah "Konversi / Penjadwalan" (slide 12) belum ada.

## Halaman lama `/governance`

| Lama | Nasib |
|---|---|
| All Subjects | Diganti menu per jenis di atas |
| My Queue | Masuk ke "Permintaan Pelatihan" (penugasan reviewer) |
| Templates | Dipertahankan di bawah menu Permintaan Pelatihan (kriteria review), hanya admin/approver |
| Role Admin | Dihapus; pakai `/admin/users` |

Alamat lama `/admin/experts`, `/admin/modules`, `/admin/publications`, `/admin/enrollments` dialihkan ke `/governance/...` supaya tautan lama tetap jalan.

## Langkah pengerjaan

1. Server function `getGovernanceConsoleAccess`: untuk akun yang login, kembalikan per menu `canRead` dan `canDecide` dengan memanggil pemeriksaan yang sudah ada (bukan daftar baru).
2. Layout `/governance` (seperti `/admin`): pintu = punya minimal satu menu `canRead`; sidebar dari hasil langkah 1.
3. Pindahkan halaman Verifikasi Expert/Modul/Publikasi dan Persetujuan Peserta ke `/governance/*`; sembunyikan tombol keputusan bila `canDecide` salah.
4. Menu Permintaan Pelatihan dari komponen governance lama (`AssignmentPanel`, rekomendasi, keputusan).
5. Navbar, halaman awal setelah login, dan sidebar `/admin` memakai langkah 1.
6. Pengalihan alamat lama; hapus halaman lama yang diganti.
7. Uji: skrip yang membuat akun uji per peran (reviewer, verifier, approver, publisher, operator, peserta), memanggil `getGovernanceConsoleAccess` dan fungsi keputusan dengan token masing-masing, lalu membersihkan akunnya; `npm run audit:bom-waktu`; uji manual di browser per peran.

Tidak perlu migrasi database (aturan sudah ada di database).

## Untuk mentor (tidak dikerjakan di sini)

- Catatan reviewer dan rekam verifikasi di alur Expert/Modul/Knowledge Hub (slide 37: *verification record*, *recommendation record*).
- Tahap publisher terpisah dari approver.
- Ruang kerja operator: cek kelengkapan, minta perbaikan, siapkan untuk review.
- Permintaan Pelatihan: langkah TNA, rekomendasi program, konversi/penjadwalan (slide 12).
- Peran `admin` vs `super_admin` (slide hanya punya satu Admin).
