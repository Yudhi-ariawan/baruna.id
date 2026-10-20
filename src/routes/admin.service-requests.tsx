import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceRequestActionPanel } from "@/components/admin/service-requests/ServiceRequestActionPanel";
import { useDebounced } from "@/hooks/use-debounced";
import { REQUEST_TYPE_CONFIG, formatDate } from "@/lib/experts";
import { serviceRequestStatusText } from "@/lib/experts/portal-services.types";
import {
  ADMIN_SERVICE_REQUEST_FILTERS,
  listAdminServiceRequests,
} from "@/lib/admin/service-requests.functions";

export const Route = createFileRoute("/admin/service-requests")({
  head: () => ({
    meta: [
      { title: "Penugasan Expert — BARUNA Administration" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminServiceRequestsPage,
});

type Filter = (typeof ADMIN_SERVICE_REQUEST_FILTERS)[number];

const FILTER_LABEL: Record<Filter, string> = {
  open: "Perlu Tindakan",
  unassigned: "Belum Ada Expert",
  information_requested: "Menunggu Info",
  confirmed: "Dikonfirmasi",
  scheduled: "Terjadwal",
  completed: "Selesai",
  declined: "Ditolak",
  cancelled: "Dibatalkan",
  all: "Semua",
};

const PAGE_SIZE = 25;

function AdminServiceRequestsPage() {
  const client = useQueryClient();
  const list = useServerFn(listAdminServiceRequests);
  const [status, setStatus] = useState<Filter>("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const term = useDebounced(search.trim(), 350);

  const query = useQuery({
    queryKey: ["admin", "service-requests", status, term, page],
    queryFn: () => list({ data: { status, search: term, page, pageSize: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const counts = query.data?.counts;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Always read the selected row from the latest data so the optimistic lock
  // (updatedAt) is fresh after a refetch.
  const selected = items.find((r) => r.id === selectedId) ?? null;

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["admin", "service-requests"] });
    await client.invalidateQueries({ queryKey: ["admin", "assignable-experts"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marine/10 text-marine"><Inbox className="h-5 w-5" /></span>
            <h1 className="font-display text-lg font-bold text-navy sm:text-2xl">Penugasan Expert</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            PB-EXP-03: tinjau permintaan layanan, cocokkan dan tugaskan expert, lalu catat penyelesaian ke riwayat fasilitasi.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching} className="self-start text-xs font-semibold">
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Segarkan
        </Button>
      </div>

      {/* Banner informasi status disembunyikan */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-900 shadow-2xs">
        <p className="font-bold text-amber-950 flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Status Navigasi: Disembunyikan Sementara
        </p>
        <p className="mt-1 text-amber-800 leading-relaxed">
          Menu Penugasan Expert disembunyikan sementara dari navigasi sidebar admin karena alur tata kelola dan SOP penugasan layanan expert masih dalam tahap peninjauan proses bisnis resmi BARUNA.
        </p>
      </div>

      {counts && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-5">
          {([
            ["Perlu tindakan", counts.open, "border-yellow-200 bg-yellow-50/60 text-yellow-900"],
            ["Belum ada expert", counts.unassigned, "border-amber-200 bg-amber-50/60 text-amber-900"],
            ["Dikonfirmasi", counts.confirmed, "border-sky-200 bg-sky-50/60 text-sky-900"],
            ["Selesai", counts.completed, "border-emerald-200 bg-emerald-50/60 text-emerald-900"],
            ["Ditutup", counts.closed, "border-border bg-white text-navy"],
          ] as const).map(([label, value, cls]) => (
            <div key={label} className={`rounded-xl border p-3 shadow-2xs sm:p-4 ${cls}`}>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider sm:text-xs">{label}</p>
              <p className="mt-1 font-display text-xl font-bold sm:text-2xl">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="-mx-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap rounded-xl bg-slate-100 p-1 px-1">
          {ADMIN_SERVICE_REQUEST_FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => { setStatus(f); setPage(0); }} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${status === f ? "bg-white text-navy shadow-xs" : "text-muted-foreground hover:text-navy"}`}>
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Cari nomor, pemohon, expert…" maxLength={120} className="w-full rounded-xl border border-border bg-white py-2 pl-9 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-marine/30" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-2xs">
        {query.isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Memuat permintaan…</p>
        ) : query.isError ? (
          <p className="p-6 text-center text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Gagal memuat permintaan."}</p>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Tidak ada permintaan pada filter ini.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((r) => {
              const v = r.payload.values ?? {};
              const title = v.eventName || v.trainingTitle || v.subjectArea || v.objective || v.technicalIssue || "Permintaan expert";
              return (
                <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-marine">{r.requestNumber} · {REQUEST_TYPE_CONFIG[r.type]?.label ?? r.type}</p>
                    <p className="truncate font-semibold text-navy">{title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.requesterName || r.requesterEmail || "—"} · {v.organization || "Organisasi tidak diisi"} · {formatDate(r.submittedAt || r.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">Expert: <strong className={r.assignedExpert ? "text-navy" : "text-amber-700"}>{r.assignedExpert || "Belum ditugaskan"}</strong></p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{serviceRequestStatusText(r.status)}</span>
                    <Button size="sm" className="bg-navy text-xs font-semibold text-white hover:bg-navy/90" onClick={() => setSelectedId(r.id)}>Kelola</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total} permintaan · halaman {page + 1} dari {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || query.isFetching} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= pages || query.isFetching} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {selected && (
        <ServiceRequestActionPanel key={`${selected.id}:${selected.updatedAt}`} request={selected} onClose={() => setSelectedId(null)} onChanged={refresh} />
      )}
    </div>
  );
}
