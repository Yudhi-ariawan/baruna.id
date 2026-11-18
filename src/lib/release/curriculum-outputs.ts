// Curriculum output documents (dokumen/output/bulan-N/*.md) shown on the temporary
// /kesiapanrilis page, so they can be presented without opening files one by one.
// Pure helpers only; the files are read on the server after the login check.

export type CurriculumDoc = {
  month: number;
  slug: string;
  title: string;
  markdown: string;
};

export const MONTH_TITLES: Record<number, string> = {
  1: "Bulan 1: Pemetaan dan Perancangan",
  2: "Bulan 2: Sistem Inti",
  3: "Bulan 3: CMS, Notifikasi, Pembayaran, Analitik",
  4: "Bulan 4: AI, Pencarian, Konten, UI/UX",
  5: "Bulan 5: Infrastruktur, Pengujian, UAT, Deploy",
  6: "Bulan 6: Panduan, Pelatihan, Dokumentasi",
};

// Presentation order for Bulan 1 (index first, then topic 1.1 -> 1.4). Files not
// listed here follow in alphabetical order, so new outputs show up automatically.
const ORDER = [
  "DOKUMEN_PEMETAAN_KONDISI",
  "FEATURE_GAP_MATRIX",
  "INFRASTRUCTURE_INVENTORY",
  "DATA_CONTENT_INVENTORY",
  "INITIAL_ISSUE_REGISTER",
  "REQUIREMENT_LIST",
  "USER_STORIES",
  "BUSINESS_PROCESS_MAP",
  "BUSINESS_RULES",
  "SYSTEM_ARCHITECTURE",
  "ERD",
  "DATA_DICTIONARY",
  "ROLE_PERMISSION_MATRIX",
  "SYSTEM_OF_RECORD_MAPPING",
  "INTEGRATION_ARCHITECTURE_DAN_REGISTER",
  "WORKING_REPOSITORY_DAN_DEV_ENVIRONMENT",
  "DATA_MIGRATION_PLAN",
  "BACKLOG",
];

/** Builds the document list from a map of "…/bulan-N/NAME.md" paths to file contents. */
export function toCurriculumDocs(files: Record<string, string>): CurriculumDoc[] {
  const docs: CurriculumDoc[] = [];
  for (const [path, markdown] of Object.entries(files)) {
    const m = /bulan-(\d+)\/([^/]+)\.md$/i.exec(path.replace(/\\/g, "/"));
    if (!m) continue;
    const heading = /^#\s+(.+)$/m.exec(markdown);
    docs.push({
      month: Number(m[1]),
      slug: m[2],
      title: heading ? heading[1].replace(/\s*BARUNA\b/g, "").trim() : m[2].replace(/_/g, " "),
      markdown,
    });
  }
  const rank = (slug: string) => {
    const i = ORDER.indexOf(slug);
    return i === -1 ? ORDER.length : i;
  };
  return docs.sort((a, b) => a.month - b.month || rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug));
}
