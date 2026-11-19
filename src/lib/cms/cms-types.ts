// Dynamic CMS (kurikulum 3.1; migration 20261118010000; CATATAN_PERBAIKAN 2br).
// Shapes follow the database payloads exactly: the database validates them again.

export const CMS_DOMAINS = ["about", "community", "fellowship", "partnership", "events"] as const;
export type CmsDomain = (typeof CMS_DOMAINS)[number];
export const CMS_DOMAIN_LABEL: Record<CmsDomain, string> = {
  about: "About BARUNA",
  community: "Community",
  fellowship: "Fellowship & Exchange",
  partnership: "Partnership",
  events: "Events",
};
/** Public address of each menu's landing page (a CMS page whose slug is the menu name).
 *  Events keeps its own event hub at /events (the Events CMS comes later), so its
 *  landing page is served at /p/events. */
export const CMS_LANDING_PATH: Record<CmsDomain, string> = {
  about: "/about",
  community: "/community",
  fellowship: "/fellowship",
  partnership: "/partnership",
  events: "/p/events",
};

export type CmsKind = "page" | "form" | "menu";
export type CmsDraftStatus = "draft" | "submitted" | "revision_requested" | "approved" | "rejected" | "withdrawn";

// ---------------------------------------------------------------- blocks
export type CmsStat = { label_id: string; label_en?: string; value: string };
export type CmsCard = { title_id: string; title_en?: string; text_id?: string; text_en?: string; image?: string | null; url?: string };
export type CmsFaqItem = { q_id: string; q_en?: string; a_id: string; a_en?: string };
export type CmsLink = { label_id: string; label_en?: string; url: string };
export type CmsPhoto = { image: string | null; caption_id?: string; caption_en?: string };

export type CmsBlock =
  | { type: "banner"; title_id: string; title_en?: string; text_id?: string; text_en?: string; image?: string | null; stats?: CmsStat[] }
  | { type: "text"; heading_id?: string; heading_en?: string; body_id: string; body_en?: string }
  | { type: "media"; heading_id?: string; heading_en?: string; body_id: string; body_en?: string; image: string | null; image_side?: "left" | "right" }
  | { type: "gallery"; heading_id?: string; heading_en?: string; items: CmsPhoto[] }
  | { type: "cards"; heading_id?: string; heading_en?: string; items: CmsCard[] }
  | { type: "cta"; title_id: string; title_en?: string; text_id?: string; text_en?: string; button_id: string; button_en?: string; url: string }
  | { type: "faq"; heading_id?: string; heading_en?: string; items: CmsFaqItem[] }
  | { type: "form"; form_slug: string }
  | { type: "links"; heading_id?: string; heading_en?: string; items: CmsLink[] };
export type CmsBlockType = CmsBlock["type"];

export const CMS_BLOCK_LABEL: Record<CmsBlockType, { label: string; hint: string }> = {
  banner: { label: "Banner", hint: "Judul besar, teks pendek, gambar, dan sampai 4 angka" },
  text: { label: "Teks", hint: "Judul bagian dan paragraf (tebal, miring, daftar, tautan)" },
  media: { label: "Teks + gambar", hint: "Judul dan paragraf di samping satu gambar (gambar di kiri atau kanan)" },
  gallery: { label: "Galeri", hint: "1–8 foto berjajar, masing-masing dengan keterangan opsional" },
  cards: { label: "Kartu", hint: "1–12 kartu berisi judul, teks, gambar, dan tautan" },
  cta: { label: "Tombol ajakan", hint: "Judul, teks, dan satu tombol menuju halaman lain" },
  faq: { label: "Tanya-jawab", hint: "1–20 pasang pertanyaan dan jawaban" },
  form: { label: "Formulir", hint: "Menampilkan formulir CMS dari menu yang sama" },
  links: { label: "Daftar tautan", hint: "1–20 tautan ke dokumen atau situs lain" },
};

export function emptyBlock(type: CmsBlockType): CmsBlock {
  switch (type) {
    case "banner": return { type, title_id: "", title_en: "", text_id: "", text_en: "", image: null, stats: [] };
    case "text": return { type, heading_id: "", heading_en: "", body_id: "", body_en: "" };
    case "media": return { type, heading_id: "", heading_en: "", body_id: "", body_en: "", image: null, image_side: "right" };
    case "gallery": return { type, heading_id: "", heading_en: "", items: [{ image: null, caption_id: "", caption_en: "" }] };
    case "cards": return { type, heading_id: "", heading_en: "", items: [{ title_id: "", title_en: "", text_id: "", text_en: "", image: null, url: "" }] };
    case "cta": return { type, title_id: "", title_en: "", text_id: "", text_en: "", button_id: "", button_en: "", url: "" };
    case "faq": return { type, heading_id: "", heading_en: "", items: [{ q_id: "", q_en: "", a_id: "", a_en: "" }] };
    case "form": return { type, form_slug: "" };
    case "links": return { type, heading_id: "", heading_en: "", items: [{ label_id: "", label_en: "", url: "" }] };
  }
}

// ---------------------------------------------------------------- payloads
export type CmsPagePayload = {
  domain: CmsDomain; slug: string; title_id: string; title_en: string; summary_id: string; summary_en: string; blocks: CmsBlock[];
};

export const CMS_FIELD_TYPES = ["text", "textarea", "email", "number", "date", "select", "checkbox"] as const;
export type CmsFieldType = (typeof CMS_FIELD_TYPES)[number];
export const CMS_FIELD_TYPE_LABEL: Record<CmsFieldType, string> = {
  text: "Teks pendek", textarea: "Teks panjang", email: "Email", number: "Angka", date: "Tanggal", select: "Pilihan", checkbox: "Centang",
};
export type CmsField = {
  key: string; label_id: string; label_en?: string; help_id?: string; help_en?: string;
  type: CmsFieldType; required: boolean; options?: string[]; max_length?: number | null;
};
export type CmsFormPayload = {
  domain: CmsDomain; slug: string; title_id: string; title_en: string; description_id: string; description_en: string;
  fields: CmsField[]; notify_on_submit: boolean; max_per_user_per_day: number;
};

export const CMS_MENU_ICONS = ["home", "academy", "knowledge", "experts", "fellowship", "community", "events", "partnership", "about", "link"] as const;
export type CmsMenuIcon = (typeof CMS_MENU_ICONS)[number];
export type CmsMenuItem = {
  label_id: string; label_en?: string; href: string; is_external: boolean; is_active: boolean; icon?: CmsMenuIcon | null; children?: CmsMenuItem[];
};
export type CmsMenuPayload = { items: CmsMenuItem[] };

export type CmsPayload = CmsPagePayload | CmsFormPayload | CmsMenuPayload;

// ---------------------------------------------------------------- reads
export type CmsOverview = {
  can: { editDomains: CmsDomain[]; reviewDomains: CmsDomain[]; decide: boolean; publish: boolean; editMenu: boolean; decideMenu: boolean };
  pages: Array<{ id: string; domain: CmsDomain; slug: string; title: string; status: "published" | "on_hold" | "archived"; version: number; updatedAt: string; statusReason: string | null; openDraftId: string | null }>;
  forms: Array<{ id: string; domain: CmsDomain; slug: string; title: string; status: "published" | "closed" | "archived"; version: number; updatedAt: string; statusReason: string | null; newSubmissions: number; openDraftId: string | null }>;
  menu: { version: number; snapshot: CmsMenuPayload; openDraftId: string | null };
  drafts: Array<{ id: string; kind: CmsKind; domain: string; targetId: string | null; status: CmsDraftStatus; title: string; slug: string | null; createdBy: string | null; mine: boolean; submittedAt: string | null; updatedAt: string; decisionNote: string | null }>;
};

export type CmsDraft = {
  id: string; kind: CmsKind; domain: string; targetId: string | null; status: CmsDraftStatus; payload: CmsPayload;
  baseVersion: number | null; updatedAt: string; submittedAt: string | null; decisionNote: string | null; decidedAt: string | null;
  createdBy: string | null; mine: boolean; canEdit: boolean; canDecide: boolean; problem: string | null; live: CmsPayload | null;
  versions: Array<{ version: number; approvedAt: string; approvedBy: string | null }>;
};

/** A value a visitor typed into a CMS form field. */
export type CmsValue = string | number | boolean | null;

export type CmsSubmissionList = {
  form: { id: string; slug: string; title: string; domain: CmsDomain; fields: CmsField[] };
  rows: Array<{ id: string; createdAt: string; status: "new" | "reviewed" | "archived"; formVersion: number; data: Record<string, CmsValue>; submitter: string | null; submitterEmail: string | null; reviewedAt: string | null }>;
};

export type CmsPublicPage = {
  id: string; domain: CmsDomain; slug: string; title_id: string; title_en: string | null; summary_id: string | null; summary_en: string | null;
  blocks: CmsBlock[]; version: number; published_at: string; updated_at: string;
};
/** A published page in lists (sidebars, search); text_* only when asked for. */
export type CmsPageListItem = {
  id: string; domain: CmsDomain; slug: string; title_id: string; title_en: string | null; summary_id: string | null; summary_en: string | null;
  text_id?: string; text_en?: string;
};
/** Public address of a CMS page: the menu's own page for its landing slug, otherwise /p/<slug>. */
export function cmsPagePath(p: { domain: CmsDomain; slug: string }): string {
  return p.slug === p.domain ? CMS_LANDING_PATH[p.domain] : `/p/${p.slug}`;
}
export type CmsPublicForm = {
  id: string; domain: CmsDomain; slug: string; title_id: string; title_en: string | null; description_id: string | null; description_en: string | null;
  fields: CmsField[]; max_per_user_per_day: number; version: number;
};
export type CmsPublicMenuItem = {
  id: string; parent_id: string | null; label_id: string; label_en: string | null; href: string; is_external: boolean; icon: CmsMenuIcon | null; sort_order: number;
};

/** Text in the visitor's language; English falls back to Indonesian when empty. */
export function cmsText(language: string, id: string | null | undefined, en: string | null | undefined): string {
  const enText = (en ?? "").trim();
  return language === "en" && enText ? enText : (id ?? "").trim();
}

/** Public URL of a CMS image path (stored in the public cover bucket). */
export function cmsImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
  return base ? `${base}/storage/v1/object/public/knowledge-module-covers/${path}` : null;
}
