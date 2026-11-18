// Indonesian messages for the CMS database error codes (migration 20261118010000).
// Codes may carry a position after a colon: "cms_block_url_invalid:3" = block 3,
// "cms_field_key_invalid:2" = field 2, "cms_submission_required:nama" = field "nama".

const ERRORS: Record<string, string> = {
  forbidden: "Akun Anda tidak berwenang untuk tindakan ini.",
  authentication_required: "Sesi login berakhir. Silakan masuk kembali.",
  cms_kind_invalid: "Jenis konten tidak dikenal.",
  cms_domain_invalid: "Pilih menu pemilik konten.",
  cms_domain_immutable: "Menu pemilik konten tidak bisa diganti di draf ini.",
  cms_target_not_found: "Konten tidak ditemukan. Muat ulang halaman.",
  cms_archived: "Konten ini sudah diarsipkan.",
  cms_draft_exists: "Sudah ada draf terbuka untuk konten ini. Buka draf itu, atau tarik dulu.",
  cms_draft_not_found: "Draf tidak ditemukan.",
  cms_draft_not_editable: "Draf ini sudah dikirim atau diputuskan, jadi tidak bisa diubah.",
  cms_draft_stale: "Draf baru saja berubah di perangkat lain. Muat ulang lalu ulangi.",
  cms_draft_unchanged: "Belum ada perubahan dibanding versi yang tayang.",
  cms_payload_invalid: "Isi draf tidak bisa dibaca. Muat ulang halaman.",
  cms_slug_invalid: "Alamat (slug): 2–80 huruf kecil, angka, dan tanda hubung (mis. visi-misi).",
  cms_slug_exists: "Alamat itu sudah dipakai konten lain.",
  cms_slug_immutable: "Alamat dan menu pemilik tidak bisa diubah setelah tayang.",
  cms_slug_reserved: "Alamat bernama menu (about, community, fellowship, partnership, events) hanya untuk halaman utama menu itu.",
  cms_title_invalid: "Judul (Indonesia) wajib 3–160 karakter.",
  cms_title_en_invalid: "Judul (Inggris) maksimal 160 karakter.",
  cms_summary_invalid: "Ringkasan maksimal 500 karakter.",
  cms_description_invalid: "Deskripsi maksimal 2.000 karakter.",
  cms_blocks_invalid: "Daftar blok tidak bisa dibaca.",
  cms_blocks_required: "Halaman wajib punya minimal satu blok.",
  cms_blocks_too_many: "Maksimal 30 blok per halaman.",
  cms_block_invalid: "Blok tidak bisa dibaca.",
  cms_block_type_invalid: "Jenis blok tidak dikenal.",
  cms_block_title_invalid: "Judul blok belum diisi atau terlalu panjang.",
  cms_block_text_invalid: "Teks blok belum diisi atau terlalu panjang.",
  cms_block_image_invalid: "Gambar tidak ditemukan. Unggah ulang (PNG/JPG/WebP, maksimal 2 MB).",
  cms_block_stats_invalid: "Angka banner: maksimal 4, masing-masing berisi label dan nilai.",
  cms_block_items_invalid: "Isian di dalam blok belum lengkap atau jumlahnya di luar batas.",
  cms_block_url_invalid: "Tautan harus diawali https:// atau / (alamat di BARUNA).",
  cms_block_button_invalid: "Teks tombol wajib diisi (maksimal 60 karakter).",
  cms_block_form_unknown: "Formulir tidak ditemukan di menu yang sama.",
  cms_form_limit_invalid: "Batas kiriman per orang per hari harus 1–20.",
  cms_form_fields_required: "Formulir wajib punya minimal satu kolom.",
  cms_form_fields_too_many: "Maksimal 30 kolom per formulir.",
  cms_field_invalid: "Kolom formulir tidak lengkap.",
  cms_field_key_invalid: "Kode kolom: huruf kecil, angka, garis bawah, 2–40 karakter, diawali huruf (mis. nama_instansi).",
  cms_field_key_duplicate: "Ada kode kolom yang sama.",
  cms_field_label_invalid: "Label kolom wajib 2–160 karakter.",
  cms_field_help_invalid: "Petunjuk kolom maksimal 300 karakter.",
  cms_field_type_invalid: "Jenis kolom tidak dikenal.",
  cms_field_options_invalid: "Kolom pilihan butuh 2–30 pilihan yang berbeda (masing-masing 1–100 karakter).",
  cms_field_max_invalid: "Batas panjang hanya untuk teks, 1–5.000 karakter.",
  cms_menu_empty: "Menu wajib punya minimal satu item.",
  cms_menu_too_many: "Maksimal 12 item menu utama.",
  cms_menu_item_invalid: "Item menu tidak lengkap.",
  cms_menu_label_invalid: "Label menu wajib 1–40 karakter.",
  cms_menu_href_invalid: "Alamat menu harus diawali / (di BARUNA) atau https:// (situs lain).",
  cms_menu_external_mismatch: "Alamat https:// harus ditandai \"situs lain\", dan alamat / tidak.",
  cms_menu_icon_invalid: "Ikon menu tidak dikenal.",
  cms_menu_children_invalid: "Maksimal 12 submenu per menu.",
  cms_menu_too_deep: "Submenu hanya satu tingkat.",
  cms_decision_invalid: "Keputusan tidak dikenal.",
  cms_note_required: "Tuliskan alasan (minimal 5 karakter).",
  cms_note_too_long: "Alasan maksimal 2.000 karakter.",
  cms_self_decision_forbidden: "Draf yang Anda buat atau kirim sendiri harus diputuskan orang lain.",
  cms_not_submitted: "Draf ini belum dikirim atau sudah diputuskan.",
  cms_stale: "Konten tayang sudah berubah sejak draf dibuat. Tarik draf ini lalu buat draf baru.",
  cms_reason_required: "Tuliskan alasan (5–500 karakter).",
  cms_status_invalid: "Status tidak dikenal.",
  cms_status_unchanged: "Status sudah seperti itu.",
  cms_open_drafts_exist: "Masih ada draf terbuka untuk konten ini. Selesaikan atau tarik dulu.",
  cms_form_not_open: "Formulir ini sedang tidak menerima kiriman.",
  cms_submission_limit: "Anda sudah mencapai batas kiriman formulir ini untuk hari ini. Coba lagi besok.",
  cms_submission_invalid: "Isian tidak valid.",
  cms_submission_required: "Isian wajib belum diisi.",
  cms_submission_too_long: "Isian terlalu panjang.",
  cms_submission_unknown_field: "Formulir berubah sejak halaman dibuka. Muat ulang halaman.",
};

/** Friendly message plus where (block/field number or field key), from a raw error. */
export function cmsErrorText(raw: string): string {
  const code = raw.trim();
  // Longest matching key wins: "cms_self_decision_forbidden" must not read as "forbidden".
  const key = Object.keys(ERRORS)
    .filter((k) => code.includes(k))
    .sort((a, b) => b.length - a.length)[0];
  if (!key) {
    if (/Could not find the (function|table)|schema cache/.test(code)) {
      return "Konten CMS membutuhkan migrasi database 20261118010000. Jalankan supabase/check_migrations.sql.";
    }
    return code;
  }
  const where = code.slice(code.indexOf(key) + key.length).match(/^:([\w-]+)/)?.[1];
  if (!where) return ERRORS[key];
  if (/^\d+$/.test(where)) {
    const what = key.startsWith("cms_block") ? "Blok" : key.startsWith("cms_field") ? "Kolom" : "Item menu";
    return `${what} ${where}: ${ERRORS[key]}`;
  }
  return `${ERRORS[key]} (${where})`;
}

/** Position carried by an error code: block/field/menu number (1-based) or a field key. */
export function cmsErrorWhere(raw: string): string | null {
  return raw.match(/:([\w-]+)\s*$/)?.[1] ?? null;
}
