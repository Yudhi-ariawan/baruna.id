import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Layers,
  Eye,
  Download,
  Calendar,
  Building2,
  RefreshCw,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listAdminPublicationSubmissions,
  type AdminPublicationItem,
} from "@/lib/admin/publications.functions";
import { AdminPublicationDetailModal } from "@/components/baruna/admin/AdminPublicationDetailModal";

export const Route = createFileRoute("/admin/publications")({
  head: () => ({
    meta: [
      { title: "Verifikasi Publikasi & Knowledge Hub — BARUNA Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPublicationsPage,
  errorComponent: ({ error, reset }) => (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800 space-y-3">
      <h2 className="text-lg font-bold">Terjadi Kendala Memuat Data Verifikasi Publikasi</h2>
      <p className="text-xs text-red-600 font-mono">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <button
        onClick={() => reset()}
        className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
      >
        Coba Lagi
      </button>
    </div>
  ),
});

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function formatBytes(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminPublicationsPage() {
  const listFn = useServerFn(listAdminPublicationSubmissions);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<AdminPublicationItem | null>(null);

  const query = useQuery({
    queryKey: ["admin", "publications"],
    queryFn: () => listFn(),
  });

  const rawItems = query.data?.items ?? [];
  const stats = query.data?.stats ?? { total: 0, pending: 0, revision: 0, approved: 0, rejected: 0 };

  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      // Tab filter
      if (activeTab === "pending" && item.status !== "pending" && item.status !== "under_review") return false;
      if (activeTab === "revision" && item.status !== "revision_requested") return false;
      if (activeTab === "approved" && item.status !== "approved") return false;
      if (activeTab === "rejected" && item.status !== "rejected") return false;

      // Type filter
      if (typeFilter !== "all" && item.type !== typeFilter) return false;

      // Search query
      if (search.trim()) {
        const needle = search.toLowerCase();
        const hay = [item.title, item.authorName, item.authorInstitution, item.topic, ...item.keywords]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      return true;
    });
  }, [rawItems, activeTab, typeFilter, search]);

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(rawItems.map((i) => i.type))).filter(Boolean);
  }, [rawItems]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-navy">
            Verifikasi Publikasi & Dokumen Pengetahuan
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Kurasi naskah jurnal, riset, best practice, dan dokumen pengetahuan yang diajukan oleh trainer & kontributor.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
          className="gap-1.5 text-xs font-semibold text-navy hover:bg-slate-100"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
          Segarkan Data
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Pengajuan</span>
            <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-navy">{stats.total}</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Menunggu Kurasi</span>
            <span className="rounded-lg bg-amber-100 p-2 text-amber-800">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-900">{stats.pending}</p>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-800">Perlu Revisi</span>
            <span className="rounded-lg bg-orange-100 p-2 text-orange-800">
              <AlertCircle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-orange-900">{stats.revision}</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Disetujui & Tayang</span>
            <span className="rounded-lg bg-emerald-100 p-2 text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-900">{stats.approved}</p>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger value="all" className="text-xs font-semibold">
                Semua ({stats.total})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs font-semibold text-amber-800">
                Menunggu Kurasi ({stats.pending})
              </TabsTrigger>
              <TabsTrigger value="revision" className="text-xs font-semibold text-orange-800">
                Perlu Revisi ({stats.revision})
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-xs font-semibold text-emerald-800">
                Disetujui ({stats.approved})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs font-semibold text-red-800">
                Ditolak ({stats.rejected})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari judul, penulis, institusi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>

            {uniqueTypes.length > 0 && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-white px-2 text-xs font-medium text-navy"
              >
                <option value="all">Semua Tipe Resourch</option>
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Content Table / Cards */}
        {query.isLoading ? (
          <div className="rounded-xl border border-border bg-white p-12 text-center text-xs text-muted-foreground">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-marine mb-2" />
            Memuat daftar pengajuan publikasi...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            <h3 className="text-sm font-bold text-navy">Tidak ada pengajuan publikasi</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {search || typeFilter !== "all" || activeTab !== "all"
                ? "Tidak ada data yang cocok dengan kriteria filter saat ini."
                : "Belum ada dokumen publikasi yang diajukan untuk diverifikasi."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <section
                key={item.subjectId}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-xs transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[11px] font-semibold text-marine border-marine/30">
                        {item.type}
                      </Badge>
                      <Badge
                        className={`text-[10px] ${
                          item.status === "approved"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : item.status === "revision_requested"
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : item.status === "rejected"
                                ? "bg-red-100 text-red-800 border-red-200"
                                : "bg-blue-100 text-blue-800 border-blue-200"
                        }`}
                      >
                        {item.statusLabel}
                      </Badge>
                      {item.topic && (
                        <span className="text-[11px] text-muted-foreground">
                          · Topik: <strong className="text-navy">{item.topic}</strong>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-navy font-display line-clamp-1">
                      {item.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-navy">
                        <User className="h-3 w-3 text-marine" /> {item.authorName}
                      </span>
                      {item.authorInstitution && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {item.authorInstitution}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(item.createdAt)}
                      </span>
                      {item.fileInfo && (
                        <span className="flex items-center gap-1 text-marine font-semibold">
                          <FileText className="h-3 w-3" /> {item.fileInfo.name} ({formatBytes(item.fileInfo.size)})
                        </span>
                      )}
                    </div>

                    {item.abstract && (
                      <p className="text-xs text-muted-foreground line-clamp-2 pt-1 leading-relaxed">
                        {item.abstract}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setSelectedItem(item)}
                      className="text-xs font-bold bg-navy hover:bg-marine text-white shadow-2xs"
                    >
                      Periksa & Keputusan
                    </Button>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Review & Detail Modal */}
      <AdminPublicationDetailModal
        item={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        onDecisionSuccess={() => setSelectedItem(null)}
      />
    </div>
  );
}

