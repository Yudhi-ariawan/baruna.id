import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ListTree,
  Clock,
  RotateCcw,
  FileEdit,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Paperclip,
  ExternalLink,
  Download,
  BookOpenCheck,
  ChevronRight,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { useTrainerPortal } from "@/lib/experts/useTrainerPortal";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/experts/portal/review-status")({
  head: () => ({
    meta: [
      { title: "Status Peninjauan Modul — Portal Trainer BARUNA" },
      {
        name: "description",
        content:
          "Pantau alur verifikasi kurikulum, periksa catatan verifikator, dan kelola dokumen pengajuan modul pelatihan BARUNA.",
      },
    ],
  }),
  component: ReviewStatusPage,
});

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type ModuleAttachedFile = {
  type: string;
  name: string;
  size: number;
  path?: string;
};

function getDraftFiles(payloadRaw: unknown): ModuleAttachedFile[] {
  const payload = (payloadRaw as Record<string, unknown>) ?? {};
  const metadata = (payload.metadata as Record<string, unknown>) ?? {};

  const rawList = Array.isArray(metadata.attached_resources)
    ? (metadata.attached_resources as Array<Record<string, unknown>>)
    : Array.isArray(payload.documents)
      ? (payload.documents as Array<Record<string, unknown>>)
      : Array.isArray(payload.attached_resources)
        ? (payload.attached_resources as Array<Record<string, unknown>>)
        : [];

  return rawList.map((doc) => ({
    type: String(doc.type || doc.category || "Dokumen Pendukung"),
    name: String(doc.fileName || doc.name || "Berkas"),
    size: Number(doc.fileSize || doc.size || 0),
    path: typeof doc.path === "string" ? doc.path : undefined,
  }));
}

function downloadFromUrl(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

type FilterTab = "all" | "approved" | "revision" | "pending";

function ReviewStatusPage() {
  const q = useTrainerPortal();
  const drafts = q.data?.moduleDrafts ?? [];
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [openingFile, setOpeningFile] = useState<string | null>(null);

  const handleOpenFile = async (filePath?: string, fileName?: string) => {
    if (!filePath) {
      toast.info("Berkas tersimpan sebagai metadata draf pengajuan.");
      return;
    }
    setOpeningFile(filePath);
    try {
      const { data, error } = await supabase.storage
        .from("expert-applications")
        .createSignedUrl(filePath, 3600);
      if (error || !data?.signedUrl) {
        toast.error("Gagal mendapatkan akses berkas.");
        return;
      }
      // Membuka signed URL langsung di tab baru agar browser menampilkan preview PDF / gambar secara native
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Tidak dapat membuka berkas.");
    } finally {
      setOpeningFile(null);
    }
  };

  const handleDownloadFile = async (filePath?: string, fileName?: string) => {
    if (!filePath) {
      toast.info("Berkas tersimpan sebagai metadata draf pengajuan.");
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from("expert-applications")
        .createSignedUrl(filePath, 3600);
      if (error || !data?.signedUrl) {
        toast.error("Gagal membuat tautan unduhan.");
        return;
      }
      downloadFromUrl(data.signedUrl, fileName || "dokumen-modul");
      toast.success("Memulai unduhan berkas...");
    } catch {
      toast.error("Gagal mengunduh berkas.");
    }
  };

  // Filter drafts
  const filteredDrafts = drafts.filter((d) => {
    const latestDecision = d.reviewHistory?.[0]?.decision;
    const isApproved = d.reviewStatus === "approved" || latestDecision === "approve";
    const isRevision =
      d.reviewStatus === "revision_requested" || latestDecision === "return_for_revision";
    const isPending =
      !isApproved && !isRevision && (d.reviewStatus === "pending" || d.reviewStatus === "under_review" || d.status === "submitted");

    if (activeTab === "approved") return isApproved;
    if (activeTab === "revision") return isRevision;
    if (activeTab === "pending") return isPending;
    return true;
  });

  const countApproved = drafts.filter(
    (d) => d.reviewStatus === "approved" || d.reviewHistory?.[0]?.decision === "approve",
  ).length;
  const countRevision = drafts.filter(
    (d) =>
      d.reviewStatus === "revision_requested" ||
      d.reviewHistory?.[0]?.decision === "return_for_revision",
  ).length;
  const countPending = drafts.filter((d) => {
    const latestDecision = d.reviewHistory?.[0]?.decision;
    return (
      d.reviewStatus !== "approved" &&
      latestDecision !== "approve" &&
      d.reviewStatus !== "revision_requested" &&
      latestDecision !== "return_for_revision"
    );
  }).length;

  return (
    <PageShell
      sidebar={{
        ...EXPERTS_SIDEBAR_META,
        title: "Portal Trainer",
        subtitle: "Pelacakan alur peninjauan modul.",
        sections: trainerPortalNav("/experts/portal/review-status"),
      }}
      cta={{
        icon: ListTree,
        title: "Transparansi Tata Kelola Kurikulum",
        description:
          "Semua keputusan dan umpan balik berasal langsung dari rekam jejak tata kelola tim verifikator BARUNA.",
        button: "Kembali ke Dashboard",
        href: "/experts/portal",
      }}
    >
      <div className="space-y-6">
        {/* Header Section */}
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-navy">
            Status Peninjauan Modul
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Pantau alur verifikasi kurikulum, periksa kelengkapan berkas dokumen, dan tindak lanjuti
            catatan evaluasi dari verifikator BARUNA.
          </p>
        </div>

        {/* Info banner: Panduan Alur Pasca-Submit */}
        <div className="rounded-2xl border border-marine/20 bg-marine/5 p-4 sm:p-5 flex items-start gap-3.5">
          <span className="rounded-xl bg-marine/10 p-2 text-marine shrink-0 mt-0.5">
            <Info className="h-5 w-5" />
          </span>
          <div className="space-y-1 text-xs text-foreground/80 leading-relaxed">
            <p className="font-bold text-navy text-sm">Alur Setelah Pengajuan Modul (Submit &rarr; Review &rarr; Approve)</p>
            <p>
              1. <strong>Pengajuan Terkirim:</strong> Modul dan berkas masuk ke sistem verifikasi tim kurikulum BARUNA.
            </p>
            <p>
              2. <strong>Peninjauan Kurikulum:</strong> Verifikator memeriksa silabus, materi ajar, dan metode evaluasi. Jika terdapat kekurangan, status akan berubah menjadi <em>Perlu Revisi</em> dengan catatan terperinci.
            </p>
            <p>
              3. <strong>Disetujui &amp; Tayang:</strong> Setelah disetujui, modul resmi tercatat pada <strong>Portofolio Mengajar</strong> Anda dan dapat dijadwalkan dalam pelaksanaan kelas pelatihan atau tayang di katalog kursus.
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeTab === "all"
                ? "bg-navy text-white shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Semua Modul ({drafts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approved")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeTab === "approved"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Disetujui ({countApproved})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("revision")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeTab === "revision"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Perlu Revisi ({countRevision})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeTab === "pending"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Dalam Proses ({countPending})
          </button>
        </div>

        {/* Content Area */}
        {q.isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Memuat data pengajuan modul...
          </div>
        ) : filteredDrafts.length ? (
          <div className="space-y-6">
            {filteredDrafts.map((d) => {
              const latestDecision = d.reviewHistory?.[0];
              const isRevision =
                d.reviewStatus === "revision_requested" ||
                latestDecision?.decision === "return_for_revision";
              const isApproved =
                d.reviewStatus === "approved" || latestDecision?.decision === "approve";
              const isRejected =
                d.reviewStatus === "rejected" || latestDecision?.decision === "reject";
              const files = getDraftFiles(d.payload);

              // Tentukan tahapan stepper
              // Step 1: Draf Disusun (Selalu done)
              // Step 2: Pengajuan Terkirim (Selalu done karena masuk antrean)
              // Step 3: Verifikasi Kurikulum (Done jika approved/rejected, in-progress jika pending/revision)
              // Step 4: Keputusan Akhir (Done jika approved/rejected/revision)
              const step1Done = true;
              const step2Done = true;
              const step3Done = isApproved || isRejected;
              const step3Active = !isApproved && !isRejected;

              return (
                <section
                  key={d.id}
                  className={`rounded-2xl border p-6 shadow-soft transition ${
                    isRevision
                      ? "border-amber-300 bg-amber-50/20"
                      : isApproved
                        ? "border-emerald-300 bg-emerald-50/15"
                        : "border-border bg-card"
                  }`}
                >
                  {/* Top Bar: Title & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Modul Pelatihan
                      </span>
                      <h2 className="mt-1 font-display text-xl font-bold text-navy">{d.title}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Diperbarui: {new Date(d.updatedAt).toLocaleDateString("id-ID", { dateStyle: "long" })}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isRevision ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 font-semibold text-xs py-1 px-3">
                          <RotateCcw className="h-3.5 w-3.5" /> Perlu Revisi Dokumen
                        </Badge>
                      ) : isApproved ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 font-semibold text-xs py-1 px-3">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Disetujui / Tayang
                        </Badge>
                      ) : isRejected ? (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-300 flex items-center gap-1 font-semibold text-xs py-1 px-3">
                          <AlertCircle className="h-3.5 w-3.5" /> Pengajuan Ditolak
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1 font-semibold text-xs py-1 px-3">
                          <Clock className="h-3.5 w-3.5 text-blue-600 animate-spin" /> Sedang Diverifikasi
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* VISUAL STEPPER TIMELINE */}
                  <div className="mt-6 pt-5 border-t border-border/80">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Progres Alur Verifikasi
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Step 1 */}
                      <div className="flex items-center gap-2 rounded-xl bg-card border border-border/80 p-2.5 shadow-2xs">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-navy leading-none">1. Draf Disusun</p>
                          <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Selesai</p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex items-center gap-2 rounded-xl bg-card border border-border/80 p-2.5 shadow-2xs">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-navy leading-none">2. Pengajuan Dikirim</p>
                          <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Terkirim</p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className={`flex items-center gap-2 rounded-xl bg-card border p-2.5 shadow-2xs ${
                        step3Done
                          ? "border-emerald-200"
                          : step3Active
                            ? "border-blue-300 ring-1 ring-blue-200 bg-blue-50/20"
                            : "border-border/80"
                      }`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          step3Done
                            ? "bg-emerald-100 text-emerald-700"
                            : isRevision
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                        }`}>
                          {step3Done ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isRevision ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : (
                            <Clock className="h-4 w-4 animate-pulse" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-navy leading-none">3. Verifikasi Tim</p>
                          <p className={`text-[10px] font-medium mt-0.5 ${
                            step3Done
                              ? "text-emerald-700"
                              : isRevision
                                ? "text-amber-700"
                                : "text-blue-700"
                          }`}>
                            {step3Done ? "Selesai Evaluasi" : isRevision ? "Perlu Revisi" : "Sedang Berjalan"}
                          </p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className={`flex items-center gap-2 rounded-xl bg-card border p-2.5 shadow-2xs ${
                        isApproved
                          ? "border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/30"
                          : isRevision
                            ? "border-amber-300 ring-1 ring-amber-200 bg-amber-50/30"
                            : isRejected
                              ? "border-rose-300 bg-rose-50/20"
                              : "border-border/80 opacity-70"
                      }`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          isApproved
                            ? "bg-emerald-600 text-white"
                            : isRevision
                              ? "bg-amber-500 text-white"
                              : isRejected
                                ? "bg-rose-500 text-white"
                                : "bg-muted text-muted-foreground"
                        }`}>
                          {isApproved ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isRevision ? (
                            <RotateCcw className="h-4 w-4" />
                          ) : isRejected ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-navy leading-none">4. Keputusan Akhir</p>
                          <p className={`text-[10px] font-semibold mt-0.5 ${
                            isApproved
                              ? "text-emerald-700"
                              : isRevision
                                ? "text-amber-700"
                                : isRejected
                                  ? "text-rose-700"
                                  : "text-muted-foreground"
                          }`}>
                            {isApproved
                              ? "Disetujui & Masuk Portofolio"
                              : isRevision
                                ? "Memerlukan Perbaikan"
                                : isRejected
                                  ? "Ditolak"
                                  : "Menunggu Penilaian"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PROMINENT BANNER FOR APPROVED STATUS */}
                  {isApproved && (
                    <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="rounded-lg bg-emerald-200 p-2 text-emerald-800 shrink-0 mt-0.5">
                          <BookOpenCheck className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-emerald-950">
                            Modul Resmi Disetujui &amp; Terdaftar
                          </p>
                          <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                            Modul ini telah memenuhi standar kurikulum BARUNA. Anda dapat melihat modul ini di halaman Portofolio Mengajar Anda.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          to="/experts/portal/portfolio"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition"
                        >
                          <BookOpenCheck className="h-3.5 w-3.5" /> Buka di Portofolio
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* PROMINENT BANNER FOR REVISION STATUS */}
                  {isRevision && (
                    <div className="mt-4 rounded-xl border border-amber-300 bg-white/95 p-4 sm:p-5 shadow-xs">
                      <div className="flex items-start gap-3">
                        <span className="rounded-lg bg-amber-100 p-2 text-amber-700 shrink-0 mt-0.5">
                          <RotateCcw className="h-5 w-5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-amber-900">
                            Verifikator Meminta Perbaikan Kurikulum / Dokumen
                          </p>
                          {latestDecision?.comment && (
                            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-slate-800">
                              <span className="font-bold text-amber-800 uppercase tracking-wide block mb-1 text-[11px]">
                                Catatan Evaluasi Verifikator:
                              </span>
                              <p className="italic text-slate-700 leading-relaxed">
                                &quot;{latestDecision.comment}&quot;
                              </p>
                            </div>
                          )}
                          <div className="mt-3.5">
                            <Link
                              to="/experts/portal/submit-module"
                              search={{ draftId: d.id }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition"
                            >
                              <FileEdit className="h-3.5 w-3.5" /> Perbaiki Draf &amp; Unggah Ulang Berkas
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BERKAS LAMPIRAN MODUL */}
                  <div className="mt-5 pt-4 border-t border-border/70">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5 text-marine" />
                        Berkas Dokumen Terlampir ({files.length} Dokumen)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Format PDF &amp; gambar dapat langsung dibuka di tab baru
                      </span>
                    </div>

                    {files.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        Belum ada dokumen lampiran yang diunggah pada pengajuan ini.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {files.map((file, fIdx) => (
                          <div
                            key={fIdx}
                            className="flex flex-col justify-between gap-2.5 rounded-xl border border-border bg-white p-3.5 shadow-2xs hover:border-marine/40 transition"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="rounded-lg bg-marine/10 p-2 text-marine shrink-0 mt-0.5">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-navy truncate">
                                  {file.type}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={file.name}>
                                  {file.name}
                                </p>
                                {file.size > 0 && (
                                  <p className="text-[10px] text-muted-foreground/75 mt-0.5">
                                    {formatBytes(file.size)}
                                  </p>
                                )}
                              </div>
                            </div>

                            {file.path ? (
                              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => handleOpenFile(file.path, file.name)}
                                  disabled={openingFile === file.path}
                                  title="Buka dokumen di tab baru tanpa harus mengunduh (PDF / Gambar)"
                                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-marine/10 px-2.5 py-1.5 text-[11px] font-bold text-marine hover:bg-marine hover:text-white transition cursor-pointer"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {openingFile === file.path ? "Membuka..." : "Buka di Tab"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadFile(file.path, file.name)}
                                  title="Unduh berkas ke komputer"
                                  className="inline-flex items-center justify-center rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                >
                                  <Download className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="inline-block rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 text-center">
                                Berkas Tersimpan
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* RIWAYAT KEPUTUSAN VERIFIKASI */}
                  <div className="mt-5 pt-4 border-t border-border/70">
                    <h3 className="font-display text-xs font-bold uppercase tracking-wider text-navy">
                      Riwayat Keputusan &amp; Catatan Verifikasi
                    </h3>
                    {d.reviewHistory.length ? (
                      <ul className="mt-3 divide-y divide-border/60">
                        {d.reviewHistory.map((h, i) => (
                          <li key={`${h.at}-${i}`} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold text-navy">{h.actor}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(h.at).toLocaleString("id-ID", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-semibold capitalize text-marine">
                              Status: {h.decision.replaceAll("_", " ")}
                            </p>
                            {h.comment && (
                              <p className="mt-1 text-xs text-foreground/80 leading-relaxed italic bg-muted/30 p-2.5 rounded-lg border border-border/60">
                                &quot;{h.comment}&quot;
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                        <Clock className="h-4 w-4" /> Belum ada keputusan verifikator yang dicatat untuk pengajuan ini.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <ListTree className="mx-auto h-8 w-8 text-marine" />
            <p className="mt-3 font-display text-lg font-bold text-navy">
              Tidak ada modul pada filter ini
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeTab === "all"
                ? "Draf yang tersimpan dan modul yang telah diajukan akan ditampilkan di sini."
                : "Tidak ditemukan modul dengan status yang dipilih."}
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}

