// Screen rules for CMS drafts and form submissions. They mirror the database checks
// of migration 20261118010000 (_cms_page_problem, _cms_form_problem, _cms_menu_problem,
// _cms_submission_problem), so a draft that passes here is not refused there; the
// database stays the authority. Keys point to fields: "title_id", "block.2.url",
// "block.2.items.0.title_id", "field.1.key", "menu.0.children.1.href".
import type { CmsBlock, CmsField, CmsFormPayload, CmsMenuItem, CmsMenuPayload, CmsPagePayload } from "./cms-types";
import { CMS_DOMAINS, CMS_FIELD_TYPES, CMS_MENU_ICONS } from "./cms-types";

export type CmsFieldErrors = Record<string, string>;

const len = (v: unknown) => (typeof v === "string" ? v.trim().length : 0);
/** Required text min..max, or optional (min 0) up to max. */
function text(errors: CmsFieldErrors, key: string, v: unknown, min: number, max: number, label: string) {
  const n = len(v);
  if (min > 0 && n === 0) errors[key] = `${label} wajib diisi.`;
  else if (n > 0 && n < min) errors[key] = `${label} minimal ${min} karakter.`;
  else if (n > max) errors[key] = `${label} maksimal ${max.toLocaleString("id-ID")} karakter.`;
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export function slugOk(s: string): boolean {
  return s.length >= 2 && s.length <= 80 && SLUG_RE.test(s);
}
/** Same rule as public._cms_url_ok: internal path or https:// host; nothing else. */
export function urlOk(u: string): boolean {
  if (!u || u.length > 500 || /\s/.test(u)) return false;
  if (u === "/" || /^\/[A-Za-z0-9_-]/.test(u)) return true;
  return /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{2,5})?(\/.*)?$/i.test(u);
}
const URL_HINT = "Tautan harus diawali https:// atau / (alamat di BARUNA).";
const IMAGE_RE = /^cms\/[0-9a-f]{32}\.(png|jpg|webp)$/;

function block(errors: CmsFieldErrors, b: CmsBlock, i: number, formSlugs: string[]) {
  const k = (f: string) => `block.${i}.${f}`;
  const image = (key: string, v: unknown) => {
    if (typeof v === "string" && v !== "" && !IMAGE_RE.test(v)) errors[key] = "Unggah ulang gambarnya.";
  };
  switch (b.type) {
    case "banner":
      text(errors, k("title_id"), b.title_id, 2, 160, "Judul");
      text(errors, k("title_en"), b.title_en, 0, 160, "Judul (Inggris)");
      text(errors, k("text_id"), b.text_id, 0, 1000, "Teks");
      text(errors, k("text_en"), b.text_en, 0, 1000, "Teks (Inggris)");
      image(k("image"), b.image);
      if ((b.stats ?? []).length > 4) errors[k("stats")] = "Maksimal 4 angka.";
      (b.stats ?? []).forEach((s, j) => {
        text(errors, k(`stats.${j}.label_id`), s.label_id, 1, 60, "Label angka");
        text(errors, k(`stats.${j}.value`), s.value, 1, 30, "Nilai angka");
      });
      break;
    case "text":
      text(errors, k("heading_id"), b.heading_id, 0, 160, "Judul bagian");
      text(errors, k("body_id"), b.body_id, 1, 5000, "Isi teks");
      text(errors, k("body_en"), b.body_en, 0, 5000, "Isi teks (Inggris)");
      break;
    case "cards":
      text(errors, k("heading_id"), b.heading_id, 0, 160, "Judul bagian");
      if (b.items.length < 1 || b.items.length > 12) errors[k("items")] = "Kartu harus 1–12.";
      b.items.forEach((c, j) => {
        text(errors, k(`items.${j}.title_id`), c.title_id, 2, 160, "Judul kartu");
        text(errors, k(`items.${j}.text_id`), c.text_id, 0, 600, "Teks kartu");
        image(k(`items.${j}.image`), c.image);
        if (len(c.url) && !urlOk((c.url ?? "").trim())) errors[k(`items.${j}.url`)] = URL_HINT;
      });
      break;
    case "cta":
      text(errors, k("title_id"), b.title_id, 2, 160, "Judul");
      text(errors, k("text_id"), b.text_id, 0, 600, "Teks");
      text(errors, k("button_id"), b.button_id, 1, 60, "Teks tombol");
      if (!urlOk((b.url ?? "").trim())) errors[k("url")] = len(b.url) ? URL_HINT : "Tautan tombol wajib diisi.";
      break;
    case "faq":
      if (b.items.length < 1 || b.items.length > 20) errors[k("items")] = "Tanya-jawab harus 1–20.";
      b.items.forEach((q, j) => {
        text(errors, k(`items.${j}.q_id`), q.q_id, 2, 300, "Pertanyaan");
        text(errors, k(`items.${j}.a_id`), q.a_id, 1, 2000, "Jawaban");
      });
      break;
    case "links":
      if (b.items.length < 1 || b.items.length > 20) errors[k("items")] = "Tautan harus 1–20.";
      b.items.forEach((l, j) => {
        text(errors, k(`items.${j}.label_id`), l.label_id, 1, 160, "Label tautan");
        if (!urlOk((l.url ?? "").trim())) errors[k(`items.${j}.url`)] = len(l.url) ? URL_HINT : "Tautan wajib diisi.";
      });
      break;
    case "form":
      if (!formSlugs.includes((b.form_slug ?? "").trim())) errors[k("form_slug")] = "Pilih formulir dari menu yang sama.";
      break;
    default:
      errors[`block.${i}`] = "Jenis blok tidak dikenal.";
  }
}

export function pageErrors(p: CmsPagePayload, opts: { isNew: boolean; usedSlugs: string[]; formSlugs: string[] }): CmsFieldErrors {
  const e: CmsFieldErrors = {};
  if (!CMS_DOMAINS.includes(p.domain)) e.domain = "Pilih menu pemilik.";
  if (opts.isNew) {
    if (!slugOk(p.slug)) e.slug = "Alamat: 2–80 huruf kecil, angka, dan tanda hubung (mis. visi-misi).";
    else if (opts.usedSlugs.includes(p.slug)) e.slug = "Alamat itu sudah dipakai.";
    else if ((CMS_DOMAINS as readonly string[]).includes(p.slug) && p.slug !== p.domain) e.slug = "Alamat bernama menu lain tidak boleh dipakai.";
  }
  text(e, "title_id", p.title_id, 3, 160, "Judul");
  text(e, "title_en", p.title_en, 0, 160, "Judul (Inggris)");
  text(e, "summary_id", p.summary_id, 0, 500, "Ringkasan");
  text(e, "summary_en", p.summary_en, 0, 500, "Ringkasan (Inggris)");
  if (p.blocks.length < 1) e.blocks = "Tambahkan minimal satu blok.";
  if (p.blocks.length > 30) e.blocks = "Maksimal 30 blok.";
  p.blocks.forEach((b, i) => block(e, b, i, opts.formSlugs));
  return e;
}

export function formErrors(f: CmsFormPayload, opts: { isNew: boolean; usedSlugs: string[] }): CmsFieldErrors {
  const e: CmsFieldErrors = {};
  if (opts.isNew) {
    if (!slugOk(f.slug)) e.slug = "Alamat: 2–80 huruf kecil, angka, dan tanda hubung (mis. daftar-fellowship).";
    else if (opts.usedSlugs.includes(f.slug)) e.slug = "Alamat itu sudah dipakai.";
  }
  text(e, "title_id", f.title_id, 3, 160, "Judul");
  text(e, "description_id", f.description_id, 0, 2000, "Deskripsi");
  if (!Number.isInteger(f.max_per_user_per_day) || f.max_per_user_per_day < 1 || f.max_per_user_per_day > 20) {
    e.max_per_user_per_day = "Batas kiriman per hari harus 1–20.";
  }
  if (f.fields.length < 1) e.fields = "Tambahkan minimal satu kolom.";
  if (f.fields.length > 30) e.fields = "Maksimal 30 kolom.";
  const keys = new Set<string>();
  f.fields.forEach((fd: CmsField, i) => {
    const k = (x: string) => `field.${i}.${x}`;
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(fd.key)) e[k("key")] = "Kode: huruf kecil/angka/garis bawah, diawali huruf (mis. nama_instansi).";
    else if (keys.has(fd.key)) e[k("key")] = "Kode kolom sudah dipakai kolom lain.";
    keys.add(fd.key);
    text(e, k("label_id"), fd.label_id, 2, 160, "Label");
    text(e, k("help_id"), fd.help_id, 0, 300, "Petunjuk");
    if (!(CMS_FIELD_TYPES as readonly string[]).includes(fd.type)) e[k("type")] = "Pilih jenis kolom.";
    if (fd.type === "select") {
      const opts2 = (fd.options ?? []).map((o) => o.trim());
      if (opts2.length < 2 || opts2.length > 30 || opts2.some((o) => !o || o.length > 100) || new Set(opts2).size !== opts2.length) {
        e[k("options")] = "Isi 2–30 pilihan berbeda, satu per baris.";
      }
    }
    if (fd.max_length != null && (!["text", "textarea"].includes(fd.type) || fd.max_length < 1 || fd.max_length > 5000)) {
      e[k("max_length")] = "Batas panjang 1–5.000, hanya untuk teks.";
    }
  });
  return e;
}

function menuItem(e: CmsFieldErrors, m: CmsMenuItem, key: string) {
  text(e, `${key}.label_id`, m.label_id, 1, 40, "Label");
  text(e, `${key}.label_en`, m.label_en, 0, 40, "Label (Inggris)");
  const href = (m.href ?? "").trim();
  if (!urlOk(href)) e[`${key}.href`] = href ? "Alamat diawali / (di BARUNA) atau https:// (situs lain)." : "Alamat wajib diisi.";
  else if (m.is_external !== /^https:\/\//i.test(href)) e[`${key}.href`] = "Alamat https:// ditandai \"situs lain\"; alamat / tidak.";
  if (m.icon && !(CMS_MENU_ICONS as readonly string[]).includes(m.icon)) e[`${key}.icon`] = "Ikon tidak dikenal.";
}

export function menuErrors(p: CmsMenuPayload): CmsFieldErrors {
  const e: CmsFieldErrors = {};
  if (p.items.length < 1) e.items = "Tambahkan minimal satu menu.";
  if (p.items.length > 12) e.items = "Maksimal 12 menu utama.";
  p.items.forEach((m, i) => {
    menuItem(e, m, `menu.${i}`);
    if ((m.children ?? []).length > 12) e[`menu.${i}.children`] = "Maksimal 12 submenu.";
    (m.children ?? []).forEach((c, j) => menuItem(e, c, `menu.${i}.children.${j}`));
  });
  return e;
}

/** Visitor-side check of a form submission (same rules as _cms_submission_problem). */
export function submissionErrors(fields: CmsField[], data: Record<string, unknown>): CmsFieldErrors {
  const e: CmsFieldErrors = {};
  for (const f of fields) {
    const v = data[f.key];
    if (f.type === "checkbox") {
      if (f.required && v !== true) e[f.key] = "Wajib dicentang.";
      continue;
    }
    const empty = v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    if (empty) {
      if (f.required) e[f.key] = "Wajib diisi.";
      continue;
    }
    if (f.type === "number") {
      if (typeof v !== "number" || !Number.isFinite(v)) e[f.key] = "Isi dengan angka.";
      continue;
    }
    const s = String(v).trim();
    if (f.type === "text" || f.type === "textarea") {
      const max = f.max_length ?? (f.type === "text" ? 500 : 5000);
      if (s.length > max) e[f.key] = `Maksimal ${max.toLocaleString("id-ID")} karakter.`;
    } else if (f.type === "email") {
      if (s.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) e[f.key] = "Format email tidak valid.";
    } else if (f.type === "date") {
      const d = new Date(`${s}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) e[f.key] = "Tanggal tidak valid.";
    } else if (f.type === "select") {
      if (!(f.options ?? []).map((o) => o.trim()).includes(s)) e[f.key] = "Pilih salah satu pilihan.";
    }
  }
  return e;
}
