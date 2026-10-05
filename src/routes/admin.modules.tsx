import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Mail,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  User,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DocumentViewerModal } from "@/components/baruna/DocumentViewerModal";
import { triggerFileDownload } from "@/lib/storage/mime";
import {
  listAdminModuleSubmissions,
  getAdminModuleDetail,
  recordAdminModuleDecision,
  type AdminModuleItem,
  type AdminModuleDetail,
  type AdminModuleDocument,
} from "@/lib/admin/modules.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/modules")({
  head: () => ({
    meta: [
      { title: "Verifikasi Modul — BARUNA Administration" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminModulesPage,
  errorComponent: ({ error, reset }) => (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800 space-y-3">
      <h2 className="text-lg font-bold">Terjadi Kendala Memuat Data Verifikasi Modul</h2>
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

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 font-medium">
          <CheckCircle2 className="h-3 w-3" /> Disetujui (Tayang)
        </Badge>
      );
    case "archived":
      return (
        <Badge className="bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100 flex items-center gap-1 font-medium">
          <Archive className="h-3 w-3 text-slate-600" /> Diarsipkan (Tidak Tayang)
        </Badge>
      );
    case "resubmitted":
      return (
        <Badge className="bg-sky-100 text-sky-900 border-sky-300 hover:bg-sky-100 flex items-center gap-1 font-semibold shadow-2xs">
          <RotateCcw className="h-3 w-3 text-sky-600 animate-spin" style={{ animationDuration: "3s" }} /> Sudah Direvisi
        </Badge>
      );
    case "revision_requested":
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 flex items-center gap-1 font-medium">
          <RotateCcw className="h-3 w-3" /> Perlu Revisi
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100 flex items-center gap-1 font-medium">
          <XCircle className="h-3 w-3" /> Ditolak
        </Badge>
      );
    case "under_review":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 flex items-center gap-1 font-medium">
          <Clock className="h-3 w-3" /> Sedang Direview
        </Badge>
      );
    case "decision_pending":
    case "pending":
    default:
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 flex items-center gap-1 font-medium">
          <Clock className="h-3 w-3" /> Menunggu Verifikasi
        </Badge>
      );
  }
}

function AdminModulesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const listFn = useServerFn(listAdminModuleSubmissions);
  const detailFn = useServerFn(getAdminModuleDetail);
  const decisionFn = useServerFn(recordAdminModuleDecision);

  const {
    data: modules = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["admin", "modules", statusFilter, search],
    queryFn: () => listFn({ data: { status: statusFilter, search } }),
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const total = modules.length;
    let pending = 0;
    let resubmitted = 0;
    let revision = 0;
    let approved = 0;
    let archived = 0;

    modules.forEach((item) => {
      if (
        item.status === "pending" ||
        item.status === "under_review" ||
        item.status === "decision_pending"
      ) {
        pending++;
      } else if (item.status === "resubmitted") {
        pending++;
        resubmitted++;
      } else if (item.status === "revision_requested") {
        revision++;
      } else if (item.status === "approved") {
        approved++;
      } else if (item.status === "archived") {
        archived++;
      }
    });

    return { total, pending, resubmitted, revision, approved, archived };
  }, [modules]);

  const { data: activeDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ["admin", "module-detail", selectedSubjectId],
    queryFn: () => (selectedSubjectId ? detailFn({ data: { subjectId: selectedSubjectId } }) : null),
    enabled: Boolean(selectedSubjectId),
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-marine/10 p-1.5 text-marine shrink-0">
              <BookOpen className="h-5 w-5" />
            </span>
            <h1 className="font-display text-lg sm:text-xl md:text-2xl font-bold text-navy">
              Verifikasi &amp; Review Modul Pelatihan
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Tinjau pengajuan modul dari Trainer, periksa kelengkapan berkas dokumen, silabus materi, dan
            berikan keputusan (Setujui, Minta Revisi, Arsipkan, atau Tolak).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Segarkan Data
          </Button>
        </div>
      </div>

      {/* Statistics Cards - Responsive Grid for all mobile & desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="rounded-xl border border-border bg-white p-3 sm:p-4 shadow-2xs">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Modul
          </p>
          <p className="font-display text-xl sm:text-2xl font-bold text-navy mt-1">{stats.total}</p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
            {stats.archived > 0 ? `${stats.archived} diarsipkan` : "Semua status"}
          </p>
        </div>

        <div className="rounded-xl border border-yellow-200 bg-yellow-50/60 p-3 sm:p-4 shadow-2xs">
          <p className="text-[10px] sm:text-xs font-semibold text-yellow-800 uppercase tracking-wider flex items-center gap-1 truncate">
            <Clock className="h-3 w-3 shrink-0" /> Menunggu
          </p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <p className="font-display text-xl sm:text-2xl font-bold text-yellow-900">{stats.pending}</p>
            {stats.resubmitted > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-800 border border-sky-200 truncate">
                <RotateCcw className="h-2 w-2" /> {stats.resubmitted} Revisi
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-yellow-700/80 mt-0.5 truncate">Perlu verifikasi</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4 shadow-2xs">
          <p className="text-[10px] sm:text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1 truncate">
            <RotateCcw className="h-3 w-3 shrink-0" /> Perlu Revisi
          </p>
          <p className="font-display text-xl sm:text-2xl font-bold text-amber-900 mt-1">{stats.revision}</p>
          <p className="text-[10px] sm:text-[11px] text-amber-700/80 mt-0.5 truncate">Tunggu trainer</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 sm:p-4 shadow-2xs">
          <p className="text-[10px] sm:text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1 truncate">
            <CheckCircle2 className="h-3 w-3 shrink-0" /> Disetujui
          </p>
          <p className="font-display text-xl sm:text-2xl font-bold text-emerald-900 mt-1">{stats.approved}</p>
          <p className="text-[10px] sm:text-[11px] text-emerald-700/80 mt-0.5 truncate">Aktif tayang</p>
        </div>
      </div>

      {/* Filter and Search Bar - Mobile swipeable */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center overflow-x-auto gap-1 bg-slate-100 p-1 rounded-xl whitespace-nowrap scrollbar-none -mx-1 px-1">
          {[
            { id: "all", label: "Semua" },
            { id: "pending", label: "Menunggu" },
            { id: "resubmitted", label: "Sudah Direvisi" },
            { id: "revision_requested", label: "Perlu Revisi" },
            { id: "approved", label: "Disetujui" },
            { id: "archived", label: "Diarsipkan" },
            { id: "rejected", label: "Ditolak" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-white text-navy shadow-xs"
                  : "text-muted-foreground hover:text-navy"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64 md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari judul modul, topik, trainer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-white text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-marine/30"
          />
        </div>
      </div>

      {/* Main Content Area: Responsive Mobile Cards + Desktop Table */}
      <div className="rounded-2xl border border-border bg-white shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-marine mb-2" />
            Memuat daftar pengajuan modul...
          </div>
        ) : modules.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-base font-semibold text-navy">Tidak ada pengajuan modul ditemukan</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {search || statusFilter !== "all"
                ? "Cobalah sesuaikan kata kunci pencarian atau ubah filter status di atas."
                : "Belum ada trainer yang mengajukan modul pelatihan baru."}
            </p>
          </div>
        ) : (
          <>
            {/* 1. MOBILE CARD VIEW (Displayed on mobile & small tablets < md) */}
            <div className="block md:hidden divide-y divide-border/60">
              {modules.map((item) => (
                <div key={item.subjectId} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-marine block">
                        {item.moduleType || "Modul Pelatihan"}
                      </span>
                      <h3 className="font-display text-sm font-bold text-navy line-clamp-2 mt-0.5">
                        {item.title}
                      </h3>
                    </div>
                    <div className="shrink-0">{getStatusBadge(item.status)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground block">Trainer</span>
                      <span className="font-semibold text-navy truncate block flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3 text-marine shrink-0" />
                        <span className="truncate">{item.authorName}</span>
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground block">Durasi</span>
                      <span className="font-semibold text-navy truncate block mt-0.5">
                        {item.estimatedHours} Jam Belajar
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground block">Lampiran</span>
                      <span className="font-semibold text-marine flex items-center gap-1 mt-0.5">
                        <FileCheck2 className="h-3.5 w-3.5" /> {item.documentsCount} Dokumen
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground block">Diajukan</span>
                      <span className="font-medium text-slate-600 truncate block mt-0.5">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    {item.publishedModuleId && (
                      <button
                        type="button"
                        onClick={() => window.open(`/academy/self-paced/${item.publishedModuleId}`, "_blank", "noopener,noreferrer")}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 py-2 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Lihat di Kursus
                      </button>
                    )}
                    <Button
                      size="sm"
                      className="w-full sm:flex-1 bg-navy hover:bg-navy/90 text-white text-xs font-semibold py-2 rounded-xl shadow-xs"
                      onClick={() => setSelectedSubjectId(item.subjectId)}
                    >
                      Periksa &amp; Verifikasi Modul
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. DESKTOP TABLE VIEW (Displayed on screens >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50/70 text-xs font-semibold uppercase text-muted-foreground">
                    <th className="px-6 py-3.5">Judul Modul &amp; Topik</th>
                    <th className="px-6 py-3.5">Trainer / Penulis</th>
                    <th className="px-6 py-3.5">Durasi &amp; Format</th>
                    <th className="px-6 py-3.5 text-center">Berkas Lampiran</th>
                    <th className="px-6 py-3.5">Diajukan Pada</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {modules.map((item) => (
                    <tr key={item.subjectId} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-navy">{item.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <span className="capitalize">{item.moduleType}</span>
                          {item.topic && (
                            <>
                              <span>•</span>
                              <span className="text-marine font-medium">{item.topic}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-medium text-navy text-xs flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-marine" />
                          {item.authorName}
                        </div>
                        {item.authorInstitution && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {item.authorInstitution}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs">
                        <div className="font-medium text-navy">{item.estimatedHours} Jam Belajar</div>
                        <div className="text-muted-foreground text-[11px]">
                          {item.deliveryFormat} • {item.level}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          <FileCheck2 className="h-3.5 w-3.5 text-marine" />
                          {item.documentsCount} Dokumen
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          {getStatusBadge(item.status)}
                          {item.status === "resubmitted" && (
                            <span className="text-[11px] font-medium text-sky-700">
                              Revisi dikirim {formatDate(item.resubmittedAt || item.updatedAt)}
                            </span>
                          )}
                          {item.publishedModuleId ? (
                            <button
                              type="button"
                              onClick={() => window.open(`/academy/self-paced/${item.publishedModuleId}`, "_blank", "noopener,noreferrer")}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-marine hover:underline mt-0.5 cursor-pointer"
                            >
                              <ExternalLink className="h-3 w-3" /> Tayang di Kursus
                            </button>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-navy hover:bg-navy/90 text-white text-xs font-semibold"
                          onClick={() => setSelectedSubjectId(item.subjectId)}
                        >
                          Periksa &amp; Verifikasi
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Verification Detail Dialog */}
      {selectedSubjectId && (
        <ModuleDetailModal
          subjectId={selectedSubjectId}
          detail={activeDetail}
          isLoading={isDetailLoading}
          onClose={() => setSelectedSubjectId(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["admin", "modules"] });
            queryClient.invalidateQueries({
              queryKey: ["admin", "module-detail", selectedSubjectId],
            });
            setSelectedSubjectId(null);
          }}
          decisionFn={decisionFn}
        />
      )}
    </div>
  );
}

// Modal Component for Viewing Details and Performing Verification
function ModuleDetailModal({
  subjectId,
  detail,
  isLoading,
  onClose,
  onSuccess,
  decisionFn,
}: {
  subjectId: string;
  detail?: AdminModuleDetail | null;
  isLoading: boolean;
  onClose: () => void;
  onSuccess: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decisionFn: any;
}) {
  const [rationale, setRationale] = useState("");
  const [rationaleError, setRationaleError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    name: string;
    category?: string;
  } | null>(null);

  const handleDecision = async (
    decision: "approve" | "return_for_revision" | "reject" | "archive" | "restore",
  ) => {
    setRationaleError(null);
    if ((decision === "return_for_revision" || decision === "reject") && !rationale.trim()) {
      const errMsg = "Wajib menyertakan catatan evaluasi / alasan revisi pada kolom di bawah.";
      setRationaleError(errMsg);
      toast.error(errMsg);
      return;
    }

    const actionText =
      decision === "approve"
        ? "menyetujui & mempublikasikan modul ini"
        : decision === "return_for_revision"
          ? "meminta revisi perbaikan kepada trainer"
          : decision === "archive"
            ? "mengarsipkan modul ini dan menariknya dari tayang publik"
            : decision === "restore"
              ? "memulihkan modul ini dan menayangkannya kembali ke publik"
              : "menolak pengajuan modul ini";

    if (!confirm(`Apakah Anda yakin ingin ${actionText}?`)) {
      return;
    }

    try {
      setSubmitting(true);
      await decisionFn({
        data: {
          subjectId,
          decision,
          rationale: rationale.trim() || undefined,
        },
      });

      toast.success(
        decision === "approve"
          ? "Modul berhasil disetujui dan dipublikasikan ke Registry & Self-Paced Courses!"
          : decision === "return_for_revision"
            ? "Permintaan revisi telah dikirimkan ke Trainer dengan catatan perbaikan."
            : decision === "archive"
              ? "Modul berhasil diarsipkan dan ditarik dari tayang publik."
              : decision === "restore"
                ? "Modul berhasil dipulihkan dan ditayangkan kembali ke publik."
                : "Pengajuan modul telah ditolak.",
      );

      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses keputusan.";
      toast.error(msg);
      setRationaleError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[96vw] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 md:p-8">
        {isLoading || !detail ? (
          <div className="py-24 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-marine mb-3" />
            <p className="text-sm font-semibold text-navy">Memuat rincian pengajuan modul...</p>
          </div>
        ) : (
          <>
            <DialogHeader className="border-b border-border pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-marine/10 p-2.5 text-marine shrink-0">
                    <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <div>
                    <DialogTitle className="text-base sm:text-xl font-bold text-navy leading-snug">
                      {detail.title}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Diajukan oleh {detail.authorName} • {formatDate(detail.createdAt)}
                    </DialogDescription>
                  </div>
                </div>
                <div>{getStatusBadge(detail.status)}</div>
              </div>
            </DialogHeader>

            {detail?.status === "archived" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-100/90 px-4 py-3 text-xs text-slate-800">
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-slate-600 shrink-0" />
                  <span>
                    <strong>Modul Diarsipkan:</strong> Modul ini berstatus arsip dan tidak tayang di katalog publik (*Knowledge Hub* maupun Kursus Mandiri).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDecision("restore")}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" /> Pulihkan &amp; Publikasikan Ulang
                </button>
              </div>
            )}

            {detail?.status === "approved" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Pengajuan Disetujui:</strong> Modul ini telah aktif dan dipublikasikan ke Self-Paced Courses.
                  </span>
                </div>
                {detail.publishedModuleId && (
                  <button
                    type="button"
                    onClick={() => window.open(`/academy/self-paced/${detail.publishedModuleId}`, "_blank", "noopener,noreferrer")}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Buka Modul Publik
                  </button>
                )}
              </div>
            )}

            {detail?.status === "resubmitted" && (
              <div className="mt-3 rounded-xl border border-sky-300 bg-sky-50/90 p-4 shadow-2xs">
                <div className="flex items-center gap-2 font-bold text-sky-950 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-200 text-sky-800 shrink-0">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </span>
                  Pengajuan Modul Ini Sudah Direvisi oleh Trainer
                  <Badge variant="outline" className="bg-sky-100 text-sky-800 border-sky-300 text-[10px] ml-auto">
                    Revisi Baru Siap Verifikasi
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-sky-900 leading-relaxed">
                  Trainer telah memperbarui data dan mengunggah dokumen perbaikan pada{" "}
                  <strong>{formatDate(detail.resubmittedAt || detail.updatedAt)}</strong>. Silakan periksa perubahan silabus materi dan berkas lampiran sebelum memberikan persetujuan (ACC).
                </p>
                {detail.lastRevisionRationale && (
                  <div className="mt-3 rounded-lg border border-sky-200 bg-white p-3 text-xs">
                    <span className="block font-semibold text-slate-800 text-[11px] uppercase tracking-wider mb-0.5">
                      Catatan Permintaan Revisi Sebelumnya (dari Verifikator):
                    </span>
                    <p className="italic text-slate-700">
                      &quot;{detail.lastRevisionRationale}&quot;
                    </p>
                  </div>
                )}
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-4 bg-slate-100 p-1 rounded-xl scrollbar-none whitespace-nowrap -mx-1 px-1 sm:mx-0 sm:px-1">
                <TabsTrigger value="overview" className="shrink-0 px-3 py-1.5 text-xs font-semibold">
                  Ringkasan &amp; Silabus
                </TabsTrigger>
                <TabsTrigger value="author" className="shrink-0 px-3 py-1.5 text-xs font-semibold">
                  Data Trainer
                </TabsTrigger>
                <TabsTrigger value="documents" className="shrink-0 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5">
                  Lampiran Berkas ({detail.documents.length})
                </TabsTrigger>
                <TabsTrigger value="decision" className="shrink-0 px-3 py-1.5 text-xs font-semibold text-marine">
                  Keputusan Verifikasi
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: RINGKASAN & SILABUS */}
              <TabsContent value="overview" className="mt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Topik / Bidang
                    </span>
                    <p className="text-sm font-semibold text-navy mt-1">
                      {detail.topic || "Tidak dicantumkan"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Bidang Kompetensi
                    </span>
                    <p className="text-sm font-semibold text-navy mt-1">
                      {detail.competency || "Tidak dicantumkan"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Format &amp; Level
                    </span>
                    <p className="text-sm font-semibold text-navy mt-1">
                      {detail.deliveryFormat} • {detail.level}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Estimasi Jam Belajar
                    </span>
                    <p className="text-sm font-semibold text-navy mt-1">
                      {detail.estimatedHours} Jam Pembelajaran
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Bahasa Pengantar
                    </span>
                    <p className="text-sm font-semibold text-navy mt-1">{detail.language}</p>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Metode Penilaian &amp; Passing Score
                    </span>
                    <p className="text-sm font-semibold text-navy mt-1">
                      {detail.assessmentMethod || "Quiz / Ujian"} ({detail.passingScore ?? 70}%)
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Deskripsi Ringkas Modul
                  </span>
                  <p className="text-sm text-foreground mt-2 whitespace-pre-line leading-relaxed">
                    {detail.summary || "Belum ada deskripsi modul."}
                  </p>
                </div>

                {detail.targetParticipants && (
                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Target Peserta / Prasyarat
                    </span>
                    <p className="text-sm text-foreground mt-1">{detail.targetParticipants}</p>
                  </div>
                )}

                {detail.learningObjectives.length > 0 && (
                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                      Tujuan Pembelajaran (Learning Objectives)
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                      {detail.learningObjectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {detail.competencyOutcomes && (
                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Capaian Hasil Kompetensi
                    </span>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">
                      {detail.competencyOutcomes}
                    </p>
                  </div>
                )}

                {detail.rationale && (
                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Urgensi Strategis (Rationale)
                    </span>
                    <p className="text-sm text-foreground mt-1">{detail.rationale}</p>
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: DATA TRAINER */}
              <TabsContent value="author" className="mt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Nama Trainer / Penulis
                    </span>
                    <p className="text-sm font-semibold text-navy mt-1 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-marine" />
                      {detail.authorName}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Email Kontak
                    </span>
                    <p className="text-sm font-semibold text-navy mt-1 flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-marine" />
                      {detail.authorEmail || "—"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Institusi / Afiliasi
                    </span>
                    <p className="text-sm font-semibold text-navy mt-1">
                      {detail.authorInstitution || "Tidak dicantumkan"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Pemegang Hak Cipta
                    </span>
                    <p className="text-sm font-semibold text-navy mt-1">
                      {detail.copyrightHolder || detail.authorName}
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: BERKAS LAMPIRAN */}
              <TabsContent value="documents" className="mt-5 space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <strong>Pemeriksaan Berkas Modul Pelatihan:</strong>
                    <p className="mt-0.5 text-blue-800">
                      Tinjau berkas silabus modul, slide presentasi, panduan trainer, dan materi kuis.
                      Klik tombol buka/unduh untuk memverifikasi isi dokumen di tab baru sebelum
                      menyetujui.
                    </p>
                  </div>
                </div>

                {detail.documents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground/60" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Tidak ada berkas lampiran yang diunggah.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {detail.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col justify-between rounded-xl border border-border bg-white p-4 shadow-2xs hover:border-marine/40 transition"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                              {doc.type}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatBytes(doc.size)}
                            </span>
                          </div>
                          <h4 className="mt-2 font-medium text-navy text-sm break-all line-clamp-2">
                            {doc.name}
                          </h4>
                          {doc.uploadedAt && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Diunggah: {formatDate(doc.uploadedAt)}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2">
                          {doc.downloadUrl ? (
                            <>
                              <a
                                href={doc.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-marine/10 py-2 px-3 text-xs font-semibold text-marine hover:bg-marine hover:text-white transition"
                                title="Buka berkas langsung di tab peramban baru"
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> Buka di Tab
                              </a>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setPreviewDoc({
                                    url: doc.downloadUrl!,
                                    name: doc.name,
                                    category: doc.type,
                                  })
                                }
                                className="h-8 text-xs font-semibold border-border hover:bg-slate-100 text-navy gap-1"
                                title="Pratinjau cepat di dalam dialog"
                              >
                                <Eye className="h-3.5 w-3.5 text-marine" /> Pratinjau
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => triggerFileDownload(doc.downloadUrl!, doc.name)}
                                className="h-8 w-8 text-muted-foreground hover:text-navy hover:bg-slate-100"
                                title="Unduh langsung file asli"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic flex items-center justify-center py-2 bg-slate-50 rounded-lg w-full">
                              Berkas tidak dapat diakses
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* TAB 4: KEPUTUSAN VERIFIKASI */}
              <TabsContent value="decision" className="mt-5 space-y-5">
                {detail.decisionsHistory && detail.decisionsHistory.length > 0 && (
                  <div className="rounded-xl border border-border bg-slate-50 p-4">
                    <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-2">
                      Riwayat Keputusan Sebelumnya
                    </h4>
                    <div className="space-y-2">
                      {detail.decisionsHistory.map((hist) => (
                        <div
                          key={hist.id}
                          className="rounded-lg border border-border bg-white p-3 text-xs"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="capitalize">{hist.decision.replace(/_/g, " ")}</span>
                            <span className="text-muted-foreground">
                              {formatDate(hist.createdAt)}
                            </span>
                          </div>
                          {hist.rationale && (
                            <p className="mt-1 text-slate-600 italic">
                              &quot;{hist.rationale}&quot;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-white p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                      Catatan Evaluasi / Umpan Balik Verifikator (Rationale)
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Tuliskan catatan kelayakan, hasil telaah kurikulum modul, atau rincian perbaikan
                      dokumen yang harus dilengkapi oleh Trainer jika meminta revisi.
                    </p>
                    <Textarea
                      rows={4}
                      placeholder="Contoh: Modul sangat baik dan relevan. Mohon lampirkan kunci jawaban kuis pada dokumen penilaian dan perbaiki deskripsi silabus..."
                      value={rationale}
                      onChange={(e) => {
                        setRationale(e.target.value);
                        if (rationaleError) setRationaleError(null);
                      }}
                      className={`w-full text-sm ${rationaleError ? "border-destructive ring-1 ring-destructive" : ""}`}
                    />
                    {rationaleError && (
                      <p className="mt-1.5 text-xs font-semibold text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {rationaleError}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={submitting}
                      className="w-full sm:w-auto text-xs order-last sm:order-first py-2 sm:py-1.5"
                    >
                      Batal
                    </Button>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                      {detail?.status === "approved" ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={submitting}
                            onClick={() => handleDecision("archive")}
                            className="w-full sm:w-auto text-xs border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1.5 py-2.5 sm:py-2"
                          >
                            <Archive className="h-4 w-4 shrink-0 text-slate-600" /> Arsipkan Modul (Tarik Tayang)
                          </Button>

                          <Button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleDecision("approve")}
                            className="w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 py-2.5 sm:py-2 shadow-xs"
                          >
                            <CheckCircle2 className={`h-4 w-4 shrink-0 ${submitting ? "animate-spin" : ""}`} />
                            {submitting ? "Memproses..." : "Perbarui Publikasi"}
                          </Button>
                        </>
                      ) : detail?.status === "archived" ? (
                        <Button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleDecision("restore")}
                          className="w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 py-2.5 sm:py-2 shadow-xs"
                        >
                          <ArchiveRestore className={`h-4 w-4 shrink-0 ${submitting ? "animate-spin" : ""}`} />
                          {submitting ? "Memproses..." : "Pulihkan & Publikasikan Kembali"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={submitting}
                            onClick={() => handleDecision("reject")}
                            className="w-full sm:w-auto text-xs border-rose-300 text-rose-700 hover:bg-rose-50 flex items-center justify-center gap-1.5 py-2.5 sm:py-2"
                          >
                            <XCircle className="h-4 w-4 shrink-0" /> Tolak Modul
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            disabled={submitting}
                            onClick={() => handleDecision("return_for_revision")}
                            className="w-full sm:w-auto text-xs border-amber-300 text-amber-700 hover:bg-amber-50 flex items-center justify-center gap-1.5 py-2.5 sm:py-2"
                          >
                            <RotateCcw className={`h-4 w-4 shrink-0 ${submitting ? "animate-spin" : ""}`} />
                            {submitting ? "Memproses..." : "Minta Revisi Dokumen"}
                          </Button>

                          <Button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleDecision("approve")}
                            className="w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 py-2.5 sm:py-2 shadow-xs"
                          >
                            <CheckCircle2 className={`h-4 w-4 shrink-0 ${submitting ? "animate-spin" : ""}`} />
                            {submitting ? "Memproses..." : "Setujui & Publikasikan Modul"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
        {previewDoc && (
          <DocumentViewerModal
            url={previewDoc.url}
            name={previewDoc.name}
            category={previewDoc.category}
            isOpen={Boolean(previewDoc)}
            onClose={() => setPreviewDoc(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

