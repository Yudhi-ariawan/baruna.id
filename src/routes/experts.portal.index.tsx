import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Award,
  BookOpen,
  Users,
  TrendingUp,
  FileEdit,
  ArrowRight,
  History,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ExternalLink,
  Paperclip,
  AlertCircle,
  Info,
  BookOpenCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { LEVEL_LABEL, formatUsp } from "@/lib/trainerModules";
import { getTrainerPortalBootstrap } from "@/lib/experts/portal-services.functions";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/experts/portal/")({
  head: () => ({
    meta: [
      { title: "Trainer Portal — BARUNA Experts" },
      { name: "description", content: "Private dashboard for approved BARUNA trainers." },
    ],
    links: [{ rel: "canonical", href: "/experts/portal" }],
  }),
  component: PortalDashboard,
});

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

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

type ModuleAttachedFile = {
  type: string;
  name: string;
  size: number;
  path?: string;
  uploadedAt?: string;
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
    uploadedAt: typeof doc.uploadedAt === "string" ? doc.uploadedAt : undefined,
  }));
}

function resolveDraftStatus(d: {
  status: string;
  reviewStatus: string | null;
  reviewHistory?: Array<{ decision: string; comment: string | null; actor: string; at: string }>;
}) {
  const latestDecision = d.reviewHistory?.[0];
  const dec = latestDecision?.decision;

  if (d.reviewStatus === "approved" || dec === "approve") {
    return {
      status: "approved",
      label: "Disetujui / Tayang",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      cardBorder: "border-emerald-300/80 bg-emerald-50/20",
      icon: CheckCircle2,
      decision: latestDecision,
    };
  }

  if (d.reviewStatus === "revision_requested" || dec === "return_for_revision") {
    return {
      status: "revision_requested",
      label: "Perlu Revisi Dokumen",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
      cardBorder: "border-amber-300 bg-amber-50/30",
      icon: RotateCcw,
      decision: latestDecision,
    };
  }

  if (d.reviewStatus === "rejected" || dec === "reject") {
    return {
      status: "rejected",
      label: "Ditolak",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
      cardBorder: "border-rose-200 bg-rose-50/20",
      icon: XCircle,
      decision: latestDecision,
    };
  }

  if (d.status === "submitted" || d.reviewStatus === "pending" || d.reviewStatus === "under_review") {
    return {
      status: "pending",
      label: "Menunggu Verifikasi Admin",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
      cardBorder: "border-blue-200 bg-blue-50/20",
      icon: Clock,
      decision: latestDecision,
    };
  }

  return {
    status: "draft",
    label: "Draf Tersimpan",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    cardBorder: "border-border bg-card",
    icon: FileText,
    decision: latestDecision,
  };
}

function PortalDashboard() {
  const load = useServerFn(getTrainerPortalBootstrap);
  const query = useQuery({
    queryKey: ["experts", "trainer-portal-dashboard"],
    queryFn: () => load(),
    retry: false,
  });
  const data = query.data;

  if (query.isLoading)
    return <div className="p-10 text-sm text-muted-foreground">Loading trainer workspace…</div>;
  if (!data?.trainer || data.access !== "active_trainer")
    return (
      <div className="p-10 text-sm text-destructive">Trainer workspace data is unavailable.</div>
    );

  const trainer = data.trainer;
  const modules = data.modules ?? [];
  const history = data.history ?? [];
  const moduleDrafts = data.moduleDrafts ?? [];

  // Group module drafts by status
  const revisionDrafts = moduleDrafts.filter(
    (d) => resolveDraftStatus(d).status === "revision_requested",
  );
  const rejectedDrafts = moduleDrafts.filter((d) => resolveDraftStatus(d).status === "rejected");
  const approvedDrafts = moduleDrafts.filter((d) => resolveDraftStatus(d).status === "approved");
  const pendingDrafts = moduleDrafts.filter((d) => resolveDraftStatus(d).status === "pending");

  const approvedModules = modules.filter(
    (m) => m.status === "approved" || m.status === "published",
  ).length;
  const published = modules.filter((m) => m.status === "published").length;
  const instructionalHours = history.reduce(
    (sum, item) =>
      sum +
      (item.startDate && item.endDate
        ? Math.max(
            1,
            Math.round((Date.parse(item.endDate) - Date.parse(item.startDate)) / 86400000) + 1,
          ) * 8
        : 0),
    0,
  );
  const learningHours = instructionalHours * trainer.uniqueSuccessfulParticipants;

  const handleOpenFile = async (filePath?: string) => {
    if (!filePath) {
      toast.info("Berkas tersimpan sebagai metadata draf pengajuan.");
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from("expert-applications")
        .createSignedUrl(filePath, 3600);
      if (error || !data?.signedUrl) {
        toast.error("Gagal mendapatkan tautan akses berkas.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Tidak dapat membuka berkas.");
    }
  };

  return (
    <PageShell
      sidebar={{
        ...EXPERTS_SIDEBAR_META,
        title: "Trainer Portal",
        subtitle: "Approved BARUNA Trainer workspace.",
        sections: trainerPortalNav("/experts/portal"),
      }}
      cta={{
        icon: LayoutDashboard,
        title: "Ready to submit your next module?",
        description: "Additional modules unlock as your recognition level grows.",
        button: "Submit a Module",
        href: "/experts/portal/submit-module",
      }}
    >
      <div className="space-y-6">
        {/* Welcome Header */}
        <header className="rounded-2xl border border-marine/20 bg-gradient-to-br from-marine/5 to-transparent p-6 shadow-2xs">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marine">
            <LayoutDashboard className="h-3.5 w-3.5" /> Welcome back
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-navy">{trainer.fullName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[trainer.title, trainer.organization].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-marine/10 px-3 py-1 text-xs font-bold text-marine">
              <Award className="h-3 w-3" />{" "}
              {LEVEL_LABEL[trainer.level === "not_assigned" ? "none" : trainer.level]}
            </span>
            <span className="rounded-full bg-eco-community/10 px-3 py-1 text-xs font-semibold text-eco-community">
              Active trainer since {new Date(trainer.approvedAt).toLocaleDateString()}
            </span>
          </div>
        </header>

        {/* ========================================================
            STATUS NOTIFICATIONS (Approved, Revision, Rejected, Pending)
           ======================================================== */}
        <div className="space-y-3.5">
          {/* 1. NOTIFIKASI PERLU REVISI (AMBER) */}
          {revisionDrafts.map((d) => {
            const statusInfo = resolveDraftStatus(d);
            const comment = statusInfo.decision?.comment;
            return (
              <div
                key={d.id}
                className="rounded-2xl border border-amber-300 bg-amber-50/95 p-5 shadow-sm transition hover:border-amber-400"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <span className="rounded-xl bg-amber-200/80 p-2.5 text-amber-800 shrink-0 mt-0.5">
                      <RotateCcw className="h-5 w-5 text-amber-700" />
                    </span>
                    <div>
                      <span className="inline-block rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                        Perlu Tindakan Trainer
                      </span>
                      <h3 className="font-display text-base font-bold text-navy mt-1">
                        Revisi Diperlukan: &quot;{d.title}&quot;
                      </h3>
                      {comment && (
                        <div className="mt-2 text-xs text-slate-700 italic bg-white/90 p-3 rounded-xl border border-amber-200">
                          <span className="font-bold text-amber-800 not-italic block mb-0.5 text-[11px] uppercase tracking-wide">
                            Catatan Verifikator Admin:
                          </span>
                          &quot;{comment}&quot;
                        </div>
                      )}
                      <p className="mt-2 text-xs text-amber-800/90 leading-relaxed">
                        Verifikator meminta Anda memperbarui berkas dokumen atau menyempurnakan isi
                        silabus sebelum modul dapat disetujui.
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/experts/portal/submit-module"
                    search={{ draftId: d.id }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition shrink-0 self-start sm:self-center"
                  >
                    <FileEdit className="h-3.5 w-3.5" /> Perbaiki Dokumen &amp; Kirim Ulang
                  </Link>
                </div>
              </div>
            );
          })}

          {/* 2. NOTIFIKASI DISETUJUI & TAYANG (EMERALD) */}
          {approvedDrafts.map((d) => {
            const comment = resolveDraftStatus(d).decision?.comment;
            return (
              <div
                key={d.id}
                className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-5 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <span className="rounded-xl bg-emerald-200/80 p-2.5 text-emerald-800 shrink-0 mt-0.5">
                      <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    </span>
                    <div>
                      <span className="inline-block rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                        Modul Disetujui &amp; Dipublikasikan
                      </span>
                      <h3 className="font-display text-base font-bold text-navy mt-1">
                        Selamat! Modul &quot;{d.title}&quot; Telah Disetujui
                      </h3>
                      {comment && (
                        <p className="mt-1 text-xs text-slate-700 italic">
                          Catatan Reviewer: &quot;{comment}&quot;
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-emerald-800 leading-relaxed">
                        Modul Anda telah memenuhi standar kurikulum BARUNA dan kini aktif tayang
                        sebagai Self-Paced Course di Academy &amp; Knowledge Hub.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                      to="/experts/portal/portfolio"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition"
                    >
                      <BookOpenCheck className="h-3.5 w-3.5" /> Buka Portofolio Mengajar
                    </Link>
                    <Link
                      to="/academy"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-xs hover:bg-emerald-50 transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Katalog Kursus
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 3. NOTIFIKASI DITOLAK (ROSE) */}
          {rejectedDrafts.map((d) => {
            const comment = resolveDraftStatus(d).decision?.comment;
            return (
              <div
                key={d.id}
                className="rounded-2xl border border-rose-300 bg-rose-50/90 p-5 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <span className="rounded-xl bg-rose-200/80 p-2.5 text-rose-800 shrink-0 mt-0.5">
                      <XCircle className="h-5 w-5 text-rose-700" />
                    </span>
                    <div>
                      <span className="inline-block rounded-full bg-rose-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-900">
                        Pengajuan Belum Disetujui
                      </span>
                      <h3 className="font-display text-base font-bold text-navy mt-1">
                        Pengajuan Modul &quot;{d.title}&quot; Ditolak
                      </h3>
                      {comment && (
                        <div className="mt-2 text-xs text-slate-700 italic bg-white/90 p-3 rounded-xl border border-rose-200">
                          <span className="font-bold text-rose-800 not-italic block mb-0.5 text-[11px] uppercase tracking-wide">
                            Alasan Penolakan:
                          </span>
                          &quot;{comment}&quot;
                        </div>
                      )}
                      <p className="mt-2 text-xs text-rose-800/90">
                        Anda dapat meninjau catatan penolakan di atas dan mengajukan modul baru
                        dengan kurikulum yang disesuaikan.
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/experts/portal/submit-module"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-xs font-semibold text-rose-700 shadow-xs hover:bg-rose-50 transition shrink-0"
                  >
                    Ajukan Modul Baru
                  </Link>
                </div>
              </div>
            );
          })}

          {/* 4. NOTIFIKASI MENUNGGU REVIEW SEHABIS SUBMIT (BLUE) */}
          {pendingDrafts.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 sm:p-5 shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-blue-200/70 p-2 text-blue-700 shrink-0 mt-0.5">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="inline-block rounded-full bg-blue-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-900">
                      Sedang Ditinjau
                    </span>
                    <h3 className="font-display text-sm sm:text-base font-bold text-navy mt-0.5">
                      Modul &quot;{d.title}&quot; Sedang Dalam Proses Verifikasi
                    </h3>
                    <p className="mt-1 text-xs text-blue-900/80 leading-relaxed">
                      Pengajuan modul dan dokumen pendukung Anda telah berhasil diterima sistem dan
                      saat ini berada dalam antrean peninjauan oleh tim kurikulum BARUNA.
                    </p>
                  </div>
                </div>

                <Link
                  to="/experts/portal/review-status"
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition shrink-0 self-start sm:self-center"
                >
                  Pantau Status Review <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={FileEdit}
            label="Modul Disetujui"
            value={approvedModules}
            sub="Terdaftar resmi di kurikulum"
          />
          <StatCard
            icon={BookOpen}
            label="Kursus Tayang"
            value={published}
            sub="Aktif di katalog publik"
          />
          <StatCard
            icon={Users}
            label="Peserta Terfasilitasi"
            value={formatUsp(trainer.uniqueSuccessfulParticipants)}
            sub="Peserta lulus terverifikasi"
          />
          <StatCard
            icon={TrendingUp}
            label="Total Jam Belajar"
            value={formatUsp(learningHours)}
            sub={`${instructionalHours} jam instruksional`}
          />
        </div>

        {/* ========================================================
            SECTION: PENGAJUAN MODUL & KELENGKAPAN BERKAS (SUBMISSIONS & FILES)
           ======================================================== */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-marine/10 p-1.5 text-marine">
                  <FileText className="h-5 w-5" />
                </span>
                <h2 className="font-display text-lg font-bold text-navy">
                  Pengajuan Modul &amp; Berkas Saya
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Daftar modul yang telah diajukan beserta berkas dokumen pendukung yang diunggah
                (silabus, presentasi, panduan, dan kuis).
              </p>
            </div>

            <Link
              to="/experts/portal/submit-module"
              className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-navy transition self-start sm:self-center"
            >
              <FileEdit className="h-3.5 w-3.5" /> Submit Modul Baru
            </Link>
          </div>

          {moduleDrafts.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-semibold text-navy">Belum ada modul yang diajukan</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mulai ajukan modul pelatihan Anda untuk ditinjau oleh tim verifikator BARUNA.
              </p>
              <Link
                to="/experts/portal/submit-module"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-marine/10 px-4 py-2 text-xs font-semibold text-marine hover:bg-marine/20 transition"
              >
                Ajukan Modul Sekarang <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {moduleDrafts.map((d) => {
                const statusInfo = resolveDraftStatus(d);
                const StatusIcon = statusInfo.icon;
                const files = getDraftFiles(d.payload);
                const payload = (d.payload as Record<string, unknown>) ?? {};
                const metadata = (payload.metadata as Record<string, unknown>) ?? {};
                const outline = (payload.content_outline as Record<string, unknown>) ?? {};
                const hours = Number(payload.estimated_learning_hours || 0);

                return (
                  <div
                    key={d.id}
                    className={`rounded-2xl border p-5 shadow-2xs transition ${statusInfo.cardBorder}`}
                  >
                    {/* Header info */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-base font-bold text-navy">{d.title}</h3>
                          <Badge
                            className={`flex items-center gap-1 text-xs font-medium ${statusInfo.badgeClass}`}
                          >
                            <StatusIcon className="h-3 w-3" /> {statusInfo.label}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {Boolean(outline.topic) && (
                            <>
                              <span className="font-medium text-marine">{String(outline.topic)}</span>
                              <span>•</span>
                            </>
                          )}
                          <span>{hours} Jam Pembelajaran</span>
                          <span>•</span>
                          <span>{String(metadata.delivery_format || "Self-paced")}</span>
                          <span>•</span>
                          <span>Level {String(metadata.level || "Intermediate")}</span>
                          <span>•</span>
                          <span>Diajukan/Diperbarui: {formatDate(d.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {statusInfo.status === "revision_requested" && (
                          <Link
                            to="/experts/portal/submit-module"
                            search={{ draftId: d.id }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 transition"
                          >
                            <FileEdit className="h-3.5 w-3.5" /> Perbaiki Dokumen
                          </Link>
                        )}
                        <Link
                          to="/experts/portal/review-status"
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-muted transition"
                        >
                          Riwayat Review <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Evaluator Comment Callout if any */}
                    {statusInfo.decision?.comment && (
                      <div className="mt-3 rounded-xl border border-amber-200/90 bg-white/90 p-3 text-xs text-slate-800">
                        <span className="font-bold text-amber-800 block mb-0.5 text-[11px] uppercase tracking-wide">
                          Catatan Evaluasi Verifikator:
                        </span>
                        <p className="italic text-slate-700 leading-relaxed">
                          &quot;{statusInfo.decision.comment}&quot;
                        </p>
                      </div>
                    )}

                    {/* UPLOADED FILES SECTION */}
                    <div className="mt-4 pt-3.5 border-t border-border/60">
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                          <Paperclip className="h-3.5 w-3.5 text-marine" />
                          Berkas Dokumen Lampiran ({files.length} Berkas Diunggah)
                        </span>
                      </div>

                      {files.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/80 bg-white/50 p-3 text-center text-xs text-muted-foreground">
                          Belum ada berkas lampiran yang diunggah untuk modul ini.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {files.map((file, fIdx) => (
                            <div
                              key={fIdx}
                              className="flex items-center justify-between gap-2.5 rounded-xl border border-border bg-white p-3 shadow-2xs hover:border-marine/40 transition"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <FileText className="h-4 w-4 shrink-0 text-marine" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold text-navy truncate">
                                    {file.type}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {file.name} {file.size > 0 ? `(${formatBytes(file.size)})` : ""}
                                  </p>
                                </div>
                              </div>

                              <div>
                                {file.path ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenFile(file.path)}
                                    title="Buka / Unduh Berkas"
                                    className="inline-flex items-center gap-1 rounded-md bg-marine/10 px-2 py-1 text-[10px] font-bold text-marine hover:bg-marine hover:text-white transition cursor-pointer"
                                  >
                                    <ExternalLink className="h-3 w-3" /> Buka
                                  </button>
                                ) : (
                                  <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                                    Tersimpan
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Canonical Published Modules */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-navy">
                Katalog Modul Aktif di Academy
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Modul resmi yang telah disetujui dan aktif diikuti peserta di BARUNA Academy.
              </p>
            </div>
            <Link to="/academy" className="text-xs font-semibold text-marine">
              Buka Katalog Kursus <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          {modules.length ? (
            <div className="mt-4 divide-y divide-border">
              {modules.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-bold text-navy">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Version {m.version} · {m.hours ?? 0} hours{m.language ? ` · ${m.language}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-bold capitalize">
                    {m.status.replaceAll("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={BookOpen}
              text="Belum ada modul kanonikal yang diterbitkan ke profil Anda."
            />
          )}
        </section>

        {/* Training History */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
            <History className="h-5 w-5 text-marine" /> Training History
          </h2>
          {history.length ? (
            <div className="mt-4 space-y-3">
              {history.slice(0, 5).map((h) => (
                <div key={h.id} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-bold text-navy">{h.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      h.organizer,
                      h.country,
                      h.participants ? `${h.participants} participants` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={History} text="No facilitation history has been recorded yet." />
          )}
        </section>
      </div>
    </PageShell>
  );
}

function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
      <Icon className="mx-auto h-6 w-6 text-marine" />
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-marine" /> {label}
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold text-navy">{value}</p>
      {sub && <p className="mt-1 text-[0.65rem] text-muted-foreground">{sub}</p>}
    </div>
  );
}
