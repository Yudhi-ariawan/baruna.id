// Version history (v1, v2, ...) of a module, publication or expert profile.
// Collapsed by default; loads only when opened.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { getContentVersionHistory } from "@/lib/governance/version-history.functions";

const fmt = (iso: string) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const SOURCE_LABEL = {
  approval: "disetujui",
  resync: "disinkronkan ulang oleh admin",
  initial: "versi awal disetujui",
} as const;

export function VersionHistory({ subjectId, defaultOpen = false }: { subjectId: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const fn = useServerFn(getContentVersionHistory);
  const q = useQuery({
    queryKey: ["governance", "version-history", subjectId],
    queryFn: () => fn({ data: { subjectId } }),
    enabled: open,
    staleTime: 30_000,
  });

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 font-semibold text-navy hover:text-marine"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <History className="h-3.5 w-3.5 text-marine" /> Riwayat Versi
      </button>
      {open ? (
        <div className="mt-2">
          {q.isLoading ? (
            <p className="text-muted-foreground">Memuat riwayat versi…</p>
          ) : q.isError ? (
            <p className="text-destructive">{(q.error as Error).message}</p>
          ) : !q.data?.supported ? (
            <p className="text-muted-foreground">Jenis pengajuan ini tidak memiliki versi.</p>
          ) : q.data.versions.length === 0 ? (
            <p className="text-muted-foreground">Belum pernah tayang, jadi belum ada versi.</p>
          ) : (
            <ol className="space-y-1">
              {q.data.versions.map((v) => (
                <li key={`${v.version}-${v.publishedAt}`} className="rounded bg-muted/40 p-2">
                  <span className="font-bold text-navy">v{v.version}</span>
                  {v.version === q.data.currentVersion && q.data.published ? (
                    <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-emerald-800">
                      tayang
                    </span>
                  ) : null}
                  <span className="ml-2 text-muted-foreground">{fmt(v.publishedAt)}</span>
                  <span className="ml-2">
                    {SOURCE_LABEL[v.source]}
                    {v.approvedBy ? ` oleh ${v.approvedBy}` : ""}
                  </span>
                  {v.note ? <p className="mt-0.5 italic text-muted-foreground">"{v.note}"</p> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}
