---
name: cek-bom-waktu
description: Menjalankan Audit 360° Anti-Bom Waktu & Anti-Konflik (kode, edge cases, race conditions, RLS, database constraints, lintas-role, dan suite test otomatis npm run audit:bom-waktu). Gunakan setiap kali user mengetik "cek bom waktu" atau "/audit".
---

# Audit 360° Anti-Bom Waktu & Anti-Konflik (`cek bom waktu`)

Ketika user mengetik **`cek bom waktu`** atau **`/audit`**, lakukan langkah-langkah audit menyeluruh berikut secara berurutan tanpa perlu instruksi tambahan:

## 1. Audit Celah Bug & Bom Waktu Masa Depan (Code & Edge Cases)
Periksa seluruh file yang baru diubah atau fitur terkait terhadap potensi masalah jangka panjang:
- **Race Condition & Double-Submit:** Pastikan tombol submit memiliki *idempotency guard* di backend dan proteksi `disabled` saat request berjalan.
- **Null / Undefined / Missing Row Safety:** Gunakan `.maybeSingle()` alih-alih `.single()` untuk tabel opsional (`profiles`, `experts`, `participant_biodata`, `review_drafts`) dan sediakan *auto-provisioning* atau *fallback* aman.
- **Karakter Spesial & SQL Wildcard:** Hindari `ilike` mentah untuk pencocokan eksak URL/ID yang mengandung `_` atau `%`. Gunakan perbandingan ternormalisasi.
- **Batas Ukuran File & Format:** Pastikan batas ukuran file tervalidasi di frontend dan backend (PDF <= 10MB, PPT/PPTX <= 25MB, Foto Banner <= 2MB, Video <= 50MB).
- **Cache & State Invalidation:** Pastikan `clearKnowledgeHubCache()` dan React Query `invalidateQueries` dipanggil setelah mutasi data, serta *badge* notifikasi revisi otomatis bersih setelah *resubmit*.

## 2. Audit Konflik Database, Skema & RLS
Periksa keselarasan dengan skema Supabase PostgreSQL:
- **Unique Index & Constraint:** Pastikan tidak ada pelanggaran `ux_kr_extern_url_active` (tautan eksternal kembar pada `knowledge_resources`), `ux_review_decisions_single_final` (`supersedes_decision_id`), atau *slug collision*.
- **Tanda Tangan RPC (PostgreSQL Functions):** Pastikan pemanggilan `.rpc(...)` menggunakan nama argumen yang persis sesuai definisi migrasi SQL (`kr_draft_create`, `kr_draft_update`, `kr_draft_submit`, dll.).
- **Row Level Security (RLS):** Pastikan operasi pembacaan lintas-tabel di *server function* yang berpotensi terhalang RLS bagi role non-admin/non-expert di-*scope* dengan aman ke `context.userId`.

## 3. Audit Lintas-Role & Zero-Breakage
Pastikan alur berjalan mulus untuk semua role:
- `registered_user` (Pengguna Terdaftar Baru)
- `participant` (Peserta Pelatihan Academy dengan `participant_biodata`)
- `trainer` / `expert` (Pakar & Pengajar BARUNA)
- `admin` / `qa_reviewer` / `approver` (Kurator & Verifikator)

## 4. Eksekusi Suite Validasi Otomatis (`npm run audit:bom-waktu`)
Jalankan perintah berikut di terminal dan pastikan `exit code 0`:
```powershell
npm run audit:bom-waktu
```
Perintah ini menjalankan:
1. `npx tsc --noEmit`
2. `npm run test:lifecycle`
3. `npm run test:kh-roles`
4. `npm run build`

