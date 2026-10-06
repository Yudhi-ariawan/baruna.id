import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAdminExpertApplications,
  getAdminExpertDetail,
  recordAdminExpertDecision,
  archiveAdminExpert,
  unarchiveAdminExpert,
  type AdminExpertItem,
  type AdminExpertDetail,
} from "@/lib/admin/experts.functions";
import { Button } from "@/components/ui/button";
import { ExpertDetailModal } from "@/components/admin/experts/ExpertDetailModal";
import { formatDate, getStatusBadge } from "@/components/admin/experts/expertAdminUtils";

export const Route = createFileRoute("/admin/experts")({
  head: () => ({
    meta: [
      { title: "Verifikasi Expert — BARUNA Administration" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminExpertsPage,
  errorComponent: ({ error, reset }) => (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800 space-y-3">
      <h2 className="text-lg font-bold">Terjadi Kendala Memuat Data Verifikasi Expert</h2>
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

function AdminExpertsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const listFn = useServerFn(listAdminExpertApplications);
  const detailFn = useServerFn(getAdminExpertDetail);
  const decisionFn = useServerFn(recordAdminExpertDecision);
  const archiveFn = useServerFn(archiveAdminExpert);
  const unarchiveFn = useServerFn(unarchiveAdminExpert);

  const {
    data: allApplications = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["admin", "experts"],
    queryFn: () => listFn({ data: { status: "all" } }),
  });

  // Calculate global statistics across all applications
  const stats = useMemo(() => {
    const total = allApplications.length;
    let pending = 0;
    let resubmitted = 0;
    let revision = 0;
    let approved = 0;
    let archived = 0;

    allApplications.forEach((item) => {
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
  }, [allApplications]);

  // Filtered applications based on status tab and search term
  const applications = useMemo(() => {
    let list = allApplications;

    if (statusFilter !== "all") {
      if (statusFilter === "archived") {
        list = list.filter((it) => it.status === "archived");
      } else if (statusFilter === "revision_requested") {
        list = list.filter((it) => it.status === "revision_requested");
      } else if (statusFilter === "resubmitted") {
        list = list.filter((it) => it.status === "resubmitted");
      } else if (statusFilter === "pending") {
        list = list.filter(
          (it) =>
            it.status === "pending" ||
            it.status === "under_review" ||
            it.status === "decision_pending" ||
            it.status === "resubmitted",
        );
      } else {
        list = list.filter((it) => it.status === statusFilter);
      }
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (it) =>
          it.applicantName.toLowerCase().includes(q) ||
          (it.email && it.email.toLowerCase().includes(q)) ||
          (it.institution && it.institution.toLowerCase().includes(q)) ||
          it.expertise.some((e) => e.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [allApplications, statusFilter, search]);

  // Selected candidate detail query
  const { data: activeDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ["admin", "expert-detail", selectedSubjectId],
    queryFn: () => (selectedSubjectId ? detailFn({ data: { subjectId: selectedSubjectId } }) : null),
    enabled: Boolean(selectedSubjectId),
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-marine/10 text-marine shrink-0">
              <UserCheck className="h-5 w-5" />
            </span>
            <h1 className="font-display text-lg sm:text-xl md:text-2xl font-bold text-navy">
              Verifikasi &amp; Tata Kelola Expert
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Berdasarkan Panduan Proses Bisnis BARUNA (PB-EXP-01 &amp; PB-EXP-02). Kelola verifikasi berkas,
            keahlian, dan persetujuan narasumber kelautan dan perikanan.
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

      {/* Statistics Cards - Responsive Grid for mobile and desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="rounded-xl border border-border bg-white p-3 sm:p-4 shadow-2xs">
          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Pengajuan
          </p>
          <p className="font-display text-xl sm:text-2xl font-bold text-navy mt-1">{stats.total}</p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Semua status</p>
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
          <p className="text-[10px] sm:text-[11px] text-amber-700/80 mt-0.5 truncate">Tunggu pemohon</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 sm:p-4 shadow-2xs">
          <p className="text-[10px] sm:text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1 truncate">
            <CheckCircle2 className="h-3 w-3 shrink-0" /> Disetujui
          </p>
          <p className="font-display text-xl sm:text-2xl font-bold text-emerald-900 mt-1">{stats.approved}</p>
          <p className="text-[10px] sm:text-[11px] text-emerald-700/80 mt-0.5 truncate">Tayang di direktori</p>
        </div>
      </div>

      {/* Filter and Search Bar - Mobile swipeable */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center overflow-x-auto gap-1 bg-slate-100 p-1 rounded-xl whitespace-nowrap scrollbar-none -mx-1 px-1">
          {[
            { id: "all", label: "Semua", count: stats.total },
            { id: "pending", label: "Menunggu", count: stats.pending },
            { id: "resubmitted", label: "Sudah Direvisi", count: stats.resubmitted },
            { id: "revision_requested", label: "Perlu Revisi", count: stats.revision },
            { id: "approved", label: "Disetujui", count: stats.approved },
            { id: "archived", label: "Diarsipkan", count: stats.archived },
            { id: "rejected", label: "Ditolak" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? "bg-white text-navy shadow-xs"
                  : "text-muted-foreground hover:text-navy"
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    tab.id === "archived"
                      ? "bg-slate-200 text-slate-700"
                      : tab.id === "approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64 md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari nama, institusi, email..."
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
            Memuat data permohonan expert...
          </div>
        ) : applications.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-display text-base font-semibold text-navy">
              Tidak Ada Pengajuan Ditemukan
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              {search || statusFilter !== "all"
                ? "Cobalah mengubah kata kunci pencarian atau filter status."
                : "Belum ada pendaftaran calon expert yang masuk ke sistem."}
            </p>
          </div>
        ) : (
          <>
            {/* 1. MOBILE CARD VIEW (Displayed on mobile & small tablets < md) */}
            <div className="block md:hidden divide-y divide-border/60">
              {applications.map((item) => (
                <div key={item.subjectId} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-sm font-bold text-navy truncate">
                        {item.applicantName}
                      </h3>
                      {item.jobTitle && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.jobTitle}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">{getStatusBadge(item.status)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground block">Institusi</span>
                      <span className="font-semibold text-navy truncate block mt-0.5">
                        {item.institution || "Independen"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground block">Negara / Wilayah</span>
                      <span className="font-semibold text-navy truncate block mt-0.5">
                        {item.country || "Indonesia"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground block">Lampiran</span>
                      <span className="font-semibold text-marine flex items-center gap-1 mt-0.5">
                        <FileCheck2 className="h-3.5 w-3.5" /> {item.documentsCount} Berkas
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground block">Tanggal Daftar</span>
                      <span className="font-medium text-slate-600 truncate block mt-0.5">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  {item.expertise.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.expertise.slice(0, 3).map((exp, idx) => (
                        <span
                          key={idx}
                          className="inline-block rounded bg-marine/10 px-2 py-0.5 text-[10px] font-medium text-marine"
                        >
                          {exp}
                        </span>
                      ))}
                      {item.expertise.length > 3 && (
                        <span className="text-[10px] text-muted-foreground self-center">
                          +{item.expertise.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    {item.publishedSlug && item.status !== "archived" && (
                      <a
                        href={`/experts/${item.publishedSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 py-2 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Lihat di Direktori
                      </a>
                    )}
                    {item.status === "archived" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-marine text-marine hover:bg-marine/10 text-xs font-semibold py-2 rounded-xl"
                        onClick={async () => {
                          if (!window.confirm("Pulihkan pakar ini ke direktori publik?")) return;
                          try {
                            await unarchiveFn({ data: { subjectId: item.subjectId } });
                            toast.success("Pakar berhasil dipulihkan ke direktori publik.");
                            refetch();
                          } catch (err: unknown) {
                            toast.error(err instanceof Error ? err.message : "Gagal memulihkan pakar.");
                          }
                        }}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Pulihkan ke Direktori
                      </Button>
                    ) : (item.status === "approved" || item.isPublished) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold py-2 rounded-xl"
                        onClick={async () => {
                          const reason = window.prompt("Alasan pengarsipan pakar (opsional):", "Nonaktif sementara / Uji coba");
                          if (reason === null) return;
                          try {
                            await archiveFn({ data: { subjectId: item.subjectId, rationale: reason.trim() } });
                            toast.success("Pakar berhasil diarsipkan.");
                            refetch();
                          } catch (err: unknown) {
                            toast.error(err instanceof Error ? err.message : "Gagal mengarsipkan pakar.");
                          }
                        }}
                      >
                        <Archive className="h-3.5 w-3.5 mr-1 text-slate-500" /> Arsipkan
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      className="w-full sm:flex-1 bg-navy hover:bg-navy/90 text-white text-xs font-semibold py-2 rounded-xl shadow-xs"
                      onClick={() => setSelectedSubjectId(item.subjectId)}
                    >
                      Periksa &amp; Verifikasi Expert
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. DESKTOP TABLE VIEW (Displayed on screens >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Kandidat / Pelamar</th>
                    <th className="px-6 py-4">Institusi & Kontak</th>
                    <th className="px-6 py-4">Kepakaran & Peran</th>
                    <th className="px-6 py-4 text-center">Dokumen</th>
                    <th className="px-6 py-4">Tanggal Daftar</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {applications.map((item) => (
                    <tr key={item.subjectId} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-navy">{item.applicantName}</div>
                        {item.jobTitle && (
                          <div className="text-xs text-muted-foreground">{item.jobTitle}</div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-foreground">{item.institution || "—"}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {item.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {item.email}
                            </span>
                          )}
                          {item.country && <span>{item.country}</span>}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {item.expertise.slice(0, 2).map((exp, idx) => (
                            <span
                              key={idx}
                              className="inline-block rounded bg-marine/10 px-2 py-0.5 text-[11px] font-medium text-marine"
                            >
                              {exp}
                            </span>
                          ))}
                          {item.expertise.length > 2 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{item.expertise.length - 2}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Peran: {item.roles.join(", ") || "Trainer"}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          <FileCheck2 className="h-3.5 w-3.5 text-marine" />
                          {item.documentsCount} Berkas
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
                          {item.publishedSlug && item.status !== "archived" && (
                            <a
                              href={`/experts/${item.publishedSlug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-marine hover:underline mt-0.5"
                            >
                              <ExternalLink className="h-3 w-3" /> Tayang di Direktori
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.status === "archived" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-marine text-marine hover:bg-marine/10 text-xs font-semibold gap-1"
                              onClick={async () => {
                                if (!window.confirm("Pulihkan pakar ini ke direktori publik?")) return;
                                try {
                                  await unarchiveFn({ data: { subjectId: item.subjectId } });
                                  toast.success("Pakar berhasil dipulihkan ke direktori publik.");
                                  refetch();
                                } catch (err: unknown) {
                                  toast.error(err instanceof Error ? err.message : "Gagal memulihkan pakar.");
                                }
                              }}
                              title="Pulihkan pakar ke direktori publik"
                            >
                              <ArchiveRestore className="h-3.5 w-3.5" /> Pulihkan
                            </Button>
                          ) : (item.status === "approved" || item.isPublished) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold gap-1"
                              onClick={async () => {
                                const reason = window.prompt("Alasan pengarsipan pakar (opsional):", "Nonaktif sementara / Uji coba");
                                if (reason === null) return;
                                try {
                                  await archiveFn({ data: { subjectId: item.subjectId, rationale: reason.trim() } });
                                  toast.success("Pakar berhasil diarsipkan.");
                                  refetch();
                                } catch (err: unknown) {
                                  toast.error(err instanceof Error ? err.message : "Gagal mengarsipkan pakar.");
                                }
                              }}
                              title="Arsipkan pakar dari direktori publik"
                            >
                              <Archive className="h-3.5 w-3.5 text-slate-500" /> Arsipkan
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-navy hover:bg-navy/90 text-white text-xs font-semibold"
                            onClick={() => setSelectedSubjectId(item.subjectId)}
                          >
                            Periksa &amp; Verifikasi
                          </Button>
                        </div>
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
        <ExpertDetailModal
          subjectId={selectedSubjectId}
          detail={activeDetail}
          isLoading={isDetailLoading}
          onClose={() => setSelectedSubjectId(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["admin", "experts"] });
            queryClient.invalidateQueries({
              queryKey: ["admin", "expert-detail", selectedSubjectId],
            });
            setSelectedSubjectId(null);
          }}
          decisionFn={decisionFn}
          archiveFn={archiveFn}
          unarchiveFn={unarchiveFn}
        />
      )}
    </div>
  );
}

