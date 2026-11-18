// Labels and small helpers of the CMS console screens (kept apart from the
// components so React fast refresh keeps working).
export { DRAFT_STATUS } from "@/components/governance/programs/programLabels";

export const CMS_QUERY_KEY = ["governance", "cms"];
export const cmsDraftKey = (id: string) => ["governance", "cms-draft", id];

export const PAGE_STATUS: Record<string, { label: string; tone: string }> = {
  published: { label: "Tayang", tone: "bg-emerald-50 text-emerald-700" },
  on_hold: { label: "Diturunkan sementara", tone: "bg-amber-50 text-amber-800" },
  closed: { label: "Ditutup", tone: "bg-amber-50 text-amber-800" },
  archived: { label: "Diarsipkan", tone: "bg-slate-100 text-slate-500" },
};

export const KIND_LABEL = { page: "Halaman", form: "Formulir", menu: "Menu navigasi" } as const;

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";

/** Move an item in a list (immutably). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/** Replace one item of a list (immutably). */
export function setAt<T>(list: T[], i: number, item: T): T[] {
  return list.map((x, j) => (j === i ? item : x));
}
