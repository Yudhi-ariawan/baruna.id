import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2, Search } from "lucide-react";
import { listAuditTrail } from "@/lib/admin/audit-trail.functions";
import { AUDIT_SOURCES, SOURCE_LABEL, type AuditEntry, type AuditSource } from "@/lib/admin/audit-labels";
import { AuditEntryRow } from "@/components/admin/audit/AuditEntryRow";

// Jejak Audit (Slide 42 LS-01, 43 LS-02, 45 LS-04; Slide 49 RACI baris 8: Admin
// Console menjalankan audit trail). Read-only; the server checks audit.read.
export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Jejak Audit — BARUNA Administration" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AuditTrailPage,
});

type Filters = { source: AuditSource | "all"; search: string; from: string; to: string };
const EMPTY: Filters = { source: "all", search: "", from: "", to: "" };

/** Local calendar day → ISO instant; "to" is inclusive, so it becomes the next midnight. */
function dayStart(day: string, addDays = 0): string | undefined {
  if (!day) return undefined;
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + addDays);
  return d.toISOString();
}

function AuditTrailPage() {
  const listFn = useServerFn(listAuditTrail);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);

  const q = useInfiniteQuery({
    queryKey: ["admin", "audit-trail", applied],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      listFn({
        data: {
          source: applied.source,
          search: applied.search,
          from: dayStart(applied.from),
          to: dayStart(applied.to, 1),
          before: pageParam,
        },
      }),
    getNextPageParam: (last, pages) => {
      if (!last.nextBefore) return undefined;
      // A page that adds nothing new (all rows share one timestamp) ends the list.
      const seen = new Set(pages.slice(0, -1).flatMap((p) => p.items.map((i) => i.key)));
      return last.items.some((i) => !seen.has(i.key)) ? last.nextBefore : undefined;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: AuditEntry[] = [];
    for (const page of q.data?.pages ?? []) {
      for (const item of page.items) {
        if (!seen.has(item.key)) {
          seen.add(item.key);
          out.push(item);
        }
      }
    }
    return out;
  }, [q.data]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setApplied({ ...draft, search: draft.search.trim() });
  };
  const pickSource = (source: Filters["source"]) => {
    setDraft((d) => ({ ...d, source }));
    setApplied((a) => ({ ...a, source }));
  };
  const reset = () => {
    setDraft(EMPTY);
    setApplied(EMPTY);
  };
  const rangeInvalid = Boolean(draft.from && draft.to && draft.from > draft.to);
  // Same rule as the server: event codes only use these characters.
  const searchInvalid = !/^[a-z0-9_ .-]*$/i.test(draft.search.trim());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-navy">
          <History className="h-6 w-6 text-marine" /> Jejak Audit
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Semua perubahan penting yang tercatat sistem: akun dan peran, keputusan kurasi, Data Master, penayangan,
          kehadiran, pembelajaran, dan perubahan status alur kerja. Halaman ini hanya untuk dibaca; catatan audit tidak
          dapat diubah atau dihapus.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", ...AUDIT_SOURCES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => pickSource(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${applied.source === s ? "bg-marine text-white" : "border border-border bg-white text-navy hover:bg-muted"}`}
          >
            {s === "all" ? "Semua sumber" : SOURCE_LABEL[s]}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-white p-3 text-xs">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 font-semibold text-navy">
          Kata kunci kode kejadian
          <span className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={draft.search}
              onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
              maxLength={60}
              placeholder="mis. role, publication_held, approved"
              className="w-full rounded-lg border border-border py-1.5 pl-7 pr-2 font-normal"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 font-semibold text-navy">
          Dari tanggal
          <input type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className="rounded-lg border border-border px-2 py-1.5 font-normal" />
        </label>
        <label className="flex flex-col gap-1 font-semibold text-navy">
          Sampai tanggal
          <input type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className="rounded-lg border border-border px-2 py-1.5 font-normal" />
        </label>
        <button type="submit" disabled={rangeInvalid || searchInvalid} className="rounded-lg bg-marine px-4 py-2 font-semibold text-white hover:bg-navy disabled:opacity-50">
          Terapkan
        </button>
        <button type="button" onClick={reset} className="rounded-lg border border-border px-3 py-2 font-semibold text-navy hover:bg-muted">
          Atur ulang
        </button>
        {rangeInvalid ? <p className="w-full text-destructive">"Dari tanggal" tidak boleh setelah "Sampai tanggal".</p> : null}
        {searchInvalid ? <p className="w-full text-destructive">Kata kunci hanya boleh huruf, angka, spasi, titik, garis bawah, atau tanda minus.</p> : null}
      </form>

      {q.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat jejak audit…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message === "forbidden" ? "Akun Anda tidak memiliki izin membaca audit." : (q.error as Error).message}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Tidak ada catatan yang cocok dengan filter ini.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Menampilkan {items.length} catatan, terbaru di atas. Klik baris untuk melihat rinciannya.</p>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
            {items.map((e) => <AuditEntryRow key={e.key} entry={e} />)}
          </ul>
          {q.hasNextPage ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => q.fetchNextPage()}
                disabled={q.isFetchingNextPage}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-muted disabled:opacity-50"
              >
                {q.isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Muat lebih banyak
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">Semua catatan sudah ditampilkan.</p>
          )}
        </>
      )}
    </div>
  );
}
