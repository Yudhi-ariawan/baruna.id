// Searchable text of a CMS page (site search, CATATAN_PERBAIKAN 2bt): headings, text,
// card titles, questions and answers, captions and link labels, without markdown
// signs, per language and capped so a long page does not bloat the search list.
import { CMS_DOMAIN_LABEL, cmsPagePath, cmsText, type CmsBlock, type CmsPageListItem } from "./cms-types";

const CAP = 3000;
const plain = (s?: string | null) =>
  (s ?? "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_#>`]/g, "").replace(/\s+/g, " ").trim();

export function cmsBlocksText(blocks: CmsBlock[]): { text_id: string; text_en: string } {
  const id: string[] = [];
  const en: string[] = [];
  const add = (a?: string | null, b?: string | null) => {
    if (a) id.push(plain(a));
    en.push(plain(b || a));
  };
  for (const b of blocks) {
    switch (b.type) {
      case "banner": add(b.title_id, b.title_en); add(b.text_id, b.text_en); break;
      case "text": case "media": add(b.heading_id, b.heading_en); add(b.body_id, b.body_en); break;
      case "cards": add(b.heading_id, b.heading_en); for (const c of b.items) { add(c.title_id, c.title_en); add(c.text_id, c.text_en); } break;
      case "cta": add(b.title_id, b.title_en); add(b.text_id, b.text_en); break;
      case "faq": add(b.heading_id, b.heading_en); for (const q of b.items) { add(q.q_id, q.q_en); add(q.a_id, q.a_en); } break;
      case "gallery": add(b.heading_id, b.heading_en); for (const p of b.items) add(p.caption_id, p.caption_en); break;
      case "links": add(b.heading_id, b.heading_en); for (const l of b.items) add(l.label_id, l.label_en); break;
      default: break;
    }
  }
  const join = (xs: string[]) => xs.filter(Boolean).join(" ").slice(0, CAP);
  return { text_id: join(id), text_en: join(en) };
}

/** Site-search entries for published CMS pages (category "pages" of /search). */
export function cmsSearchHits(pages: CmsPageListItem[], language: string) {
  const id = language === "id";
  return pages.map((p) => ({
    id: `cms-${p.id}`,
    category: "pages" as const,
    kind: `${id ? "Halaman" : "Page"} · ${CMS_DOMAIN_LABEL[p.domain]}`,
    label: cmsText(language, p.title_id, p.title_en),
    summary: cmsText(language, p.summary_id, p.summary_en) || undefined,
    to: cmsPagePath(p),
    keywords: [id ? p.text_id ?? "" : p.text_en || p.text_id || ""].filter(Boolean),
    isLive: true,
  }));
}
