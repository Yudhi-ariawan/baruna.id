import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrainerApplicationReview } from "@/components/admin/trainer-applications/TrainerApplicationReview";
import { listAdminTrainerApplications } from "@/lib/admin/trainer-applications.functions";

export const Route = createFileRoute("/admin/trainer-applications")({
  head: () => ({
    meta: [
      { title: "Kualifikasi Trainer — BARUNA Administration" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminTrainerApplicationsPage,
});

const FILTERS = [
  ["submitted", "Menunggu"],
  ["approved", "Disetujui"],
  ["rejected", "Ditolak"],
  ["withdrawn", "Ditarik"],
  ["all", "Semua"],
] as const;
type Filter = (typeof FILTERS)[number][0];

function AdminTrainerApplicationsPage() {
  const client = useQueryClient();
  const list = useServerFn(listAdminTrainerApplications);
  const [status, setStatus] = useState<Filter>("submitted");
  const query = useQuery({
    queryKey: ["admin", "trainer-applications", status],
    queryFn: () => list({ data: { status } }),
    staleTime: 15_000,
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["admin", "trainer-applications"] });
  const counts = query.data?.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marine/10 text-marine"><GraduationCap className="h-5 w-5" /></span>
            <h1 className="font-display text-lg font-bold text-navy sm:text-2xl">Kualifikasi Trainer</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Slide 39: expert terverifikasi mengajukan kualifikasi trainer. Persetujuan menambah versi baru status trainer (riwayat tidak ditimpa).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching} className="self-start text-xs font-semibold">
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Segarkan
        </Button>
      </div>

      <div className="-mx-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap rounded-xl bg-slate-100 p-1 px-1 sm:w-fit">
        {FILTERS.map(([id, label]) => {
          const count = id !== "all" ? counts?.[id] : undefined;
          return (
            <button key={id} type="button" onClick={() => setStatus(id)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${status === id ? "bg-white text-navy shadow-xs" : "text-muted-foreground hover:text-navy"}`}>
              {label}
              {typeof count === "number" && count > 0 && <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-700">{count}</span>}
            </button>
          );
        })}
      </div>

      {query.isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Memuat pengajuan…</p>
      ) : query.isError ? (
        <p className="rounded-xl bg-destructive/10 p-5 text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Gagal memuat pengajuan."}</p>
      ) : query.data?.items.length ? (
        <div className="space-y-3">
          {query.data.items.map((app) => <TrainerApplicationReview key={`${app.id}:${app.updatedAt}`} app={app} onChanged={refresh} />)}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-white py-16 text-center text-sm text-muted-foreground">Tidak ada pengajuan pada filter ini.</p>
      )}
    </div>
  );
}
