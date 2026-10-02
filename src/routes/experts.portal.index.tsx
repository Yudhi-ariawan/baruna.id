import { createFileRoute, Link } from "@tanstack/react-router";
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
  AlertCircle,
  BookOpenCheck,
  Archive,
  ChevronRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { LEVEL_LABEL, formatUsp } from "@/lib/trainerModules";
import { useTrainerPortal } from "@/lib/experts/useTrainerPortal";
import { Badge } from "@/components/ui/badge";

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

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function resolveDraftStatus(d: {
  status: string;
  reviewStatus: string | null;
  reviewHistory?: Array<{ decision: string; comment: string | null; actor: string; at: string }>;
}) {
  const latestDecision = d.reviewHistory?.[0];
  const dec = latestDecision?.decision;

  if (d.reviewStatus === "archived" || d.status === "archived" || dec === "archive") {
    return {
      status: "archived",
      label: "Diarsipkan",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
      cardBorder: "border-slate-200 bg-slate-50/40",
      icon: Archive,
      decision: latestDecision,
    };
  }

  if (d.reviewStatus === "approved" || dec === "approve") {
    return {
      status: "approved",
      label: "Disetujui / Tayang",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      cardBorder: "border-emerald-200 bg-emerald-50/20",
      icon: CheckCircle2,
      decision: latestDecision,
    };
  }

  if (d.reviewStatus === "revision_requested" || dec === "return_for_revision") {
    return {
      status: "revision_requested",
      label: "Perlu Revisi",
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
      label: "Dalam Proses Review",
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
  const query = useTrainerPortal();
  const data = query.data;

  if (query.isLoading) {
    return (
      <PageShell
        sidebar={{
          ...EXPERTS_SIDEBAR_META,
          title: "Trainer Portal",
          subtitle: "Ruang kerja pengajar resmi BARUNA.",
          sections: trainerPortalNav("/experts/portal"),
        }}
      >
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Clock className="mx-auto h-8 w-8 text-marine animate-spin" />
          <p className="mt-3 text-sm text-muted-foreground">Memuat dashboard pengajar…</p>
        </div>
      </PageShell>
    );
  }

  if (!data?.trainer || data.access !== "active_trainer") {
    return (
      <PageShell
        sidebar={{
          ...EXPERTS_SIDEBAR_META,
          title: "Trainer Portal",
          subtitle: "Ruang kerja pengajar resmi BARUNA.",
          sections: trainerPortalNav("/experts/portal"),
        }}
      >
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
          Data ruang kerja pengajar tidak tersedia atau Anda belum terdaftar sebagai Trainer aktif.
        </div>
      </PageShell>
    );
  }

  const trainer = data.trainer;
  const modules = data.modules ?? [];
  const history = data.history ?? [];
  const moduleDrafts = data.moduleDrafts ?? [];

  // Group module drafts by status
  const archivedDrafts = moduleDrafts.filter(
    (d) => resolveDraftStatus(d).status === "archived",
  );
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
  const inReviewCount = pendingDrafts.length;
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

  return (
    <PageShell
      sidebar={{
        ...EXPERTS_SIDEBAR_META,
        title: "Trainer Portal",
        subtitle: "Ruang kerja pengajar resmi BARUNA.",
        sections: trainerPortalNav("/experts/portal"),
      }}
      cta={{
        icon: LayoutDashboard,
        title: "Ingin mengajukan modul baru?",
        description: "Setiap modul kurikulum yang disetujui akan tayang sebagai kursus resmi di BARUNA.",
        button: "Ajukan Modul",
        href: "/experts/portal/submit-module",
      }}
    >
      <div className="space-y-6">
        {/* ========================================================
            1. HEADER ELEGAN & RINGKAS (CLEAN GREETING & CTAs)
           ======================================================== */}
        <header className="rounded-3xl bg-gradient-to-br from-navy via-navy to-marine/90 p-6 sm:p-8 text-white shadow-soft">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-200">
                  Trainer Portal
                </span>
                <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Trainer Aktif
                </span>
                <span className="rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 text-xs font-bold flex items-center gap-1">
                  <Award className="h-3 w-3" /> Level: {LEVEL_LABEL[trainer.level === "not_assigned" ? "none" : trainer.level]}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
                Selamat Datang, {trainer.fullName}
              </h1>

              <p className="text-xs sm:text-sm text-white/80 max-w-2xl leading-relaxed">
                {[trainer.title, trainer.organization, trainer.country].filter(Boolean).join(" · ")}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                to="/experts/portal/submit-module"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-navy shadow-sm hover:bg-slate-100 transition"
              >
                <FileEdit className="h-4 w-4 text-marine" /> Submit Modul Baru
              </Link>
              <Link
                to="/experts/portal/review-status"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition"
              >
                <Clock className="h-4 w-4 text-sky-300" /> Status Review
              </Link>
            </div>
          </div>
        </header>

        {/* ========================================================
            2. ACTIONABLE ALERT (ONLY SHOWN WHEN ACTION REQUIRED)
           ======================================================== */}
        {revisionDrafts.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/95 p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="rounded-xl bg-amber-200 p-2.5 text-amber-900 shrink-0 mt-0.5">
                  <RotateCcw className="h-5 w-5 text-amber-800" />
                </span>
                <div>
                  <span className="inline-block rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Tindakan Diperlukan
                  </span>
                  <h3 className="font-display text-sm sm:text-base font-bold text-navy mt-0.5">
                    {revisionDrafts.length === 1
                      ? `Revisi Diperlukan: "${revisionDrafts[0].title}"`
                      : `${revisionDrafts.length} Modul Memerlukan Revisi Dokumen`}
                  </h3>
                  <p className="mt-1 text-xs text-amber-900/90 leading-relaxed">
                    Verifikator kurikulum telah memberikan catatan evaluasi untuk dokumen atau silabus modul Anda.
                  </p>
                </div>
              </div>

              <Link
                to="/experts/portal/review-status"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition shrink-0 self-start sm:self-center"
              >
                Tinjau &amp; Perbaiki <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* ========================================================
            3. SUMMARY STAT CARDS (4 METRICS)
           ======================================================== */}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={BookOpenCheck}
            label="Modul Disetujui (Tayang)"
            value={approvedModules}
            sub="Kurikulum resmi aktif di Academy"
            color="emerald"
          />
          <StatCard
            icon={Clock}
            label="Dalam Peninjauan"
            value={inReviewCount}
            sub="Antrean verifikasi kurikulum"
            color="blue"
          />
          <StatCard
            icon={Users}
            label="Peserta Terfasilitasi"
            value={formatUsp(trainer.uniqueSuccessfulParticipants)}
            sub="Peserta lulus terverifikasi"
            color="marine"
          />
          <StatCard
            icon={TrendingUp}
            label="Total Jam Belajar"
            value={formatUsp(learningHours)}
            sub={`${instructionalHours} jam instruksional dirancang`}
            color="purple"
          />
        </div>

        {/* ========================================================
            4. MAIN DASHBOARD GRID (2 COLUMNS: LEFT 8 / RIGHT 4)
           ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (8 cols): Activity & Module Submissions */}
          <div className="lg:col-span-8 space-y-6">
            {/* Section: Pengajuan Modul Saya */}
            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-navy flex items-center gap-2">
                    <FileText className="h-4.5 w-4.5 text-marine" /> Pengajuan Modul Saya
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Daftar modul yang diajukan beserta status verifikasi kurikulum.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <Link
                    to="/experts/portal/submit-module"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-navy transition"
                  >
                    <FileEdit className="h-3.5 w-3.5" /> Submit Baru
                  </Link>
                  <Link
                    to="/experts/portal/review-status"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-muted transition"
                  >
                    Lihat Semua ({moduleDrafts.length})
                  </Link>
                </div>
              </div>

              {moduleDrafts.length === 0 ? (
                <div className="py-10 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm font-semibold text-navy">Belum ada modul yang diajukan</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                    Mulai ajukan silabus dan materi modul pelatihan Anda untuk diverifikasi oleh tim kurikulum BARUNA.
                  </p>
                  <Link
                    to="/experts/portal/submit-module"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-marine px-4 py-2 text-xs font-semibold text-white hover:bg-navy transition shadow-xs"
                  >
                    Ajukan Modul Pertama <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-border/60">
                  {moduleDrafts.slice(0, 5).map((d) => {
                    const statusInfo = resolveDraftStatus(d);
                    const StatusIcon = statusInfo.icon;
                    const payload = (d.payload as Record<string, unknown>) ?? {};
                    const metadata = (payload.metadata as Record<string, unknown>) ?? {};
                    const hours = Number(payload.estimated_learning_hours || 0);

                    return (
                      <div
                        key={d.id}
                        className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-sm font-bold text-navy truncate">
                              {d.title}
                            </h3>
                            <Badge
                              className={`flex items-center gap-1 text-[11px] font-medium py-0.5 px-2 ${statusInfo.badgeClass}`}
                            >
                              <StatusIcon className="h-3 w-3" /> {statusInfo.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                            <span>{hours > 0 ? `${hours} Jam Belajar` : "Self-paced"}</span>
                            <span>•</span>
                            <span>Level {String(metadata.level || "Intermediate")}</span>
                            <span>•</span>
                            <span>Diperbarui {formatDate(d.updatedAt)}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                          {statusInfo.status === "revision_requested" ? (
                            <Link
                              to="/experts/portal/submit-module"
                              search={{ draftId: d.id }}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 transition"
                            >
                              <FileEdit className="h-3 w-3" /> Perbaiki
                            </Link>
                          ) : (
                            <Link
                              to="/experts/portal/review-status"
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-navy hover:bg-slate-100 transition"
                            >
                              Detail <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Section: Katalog Kursus Aktif di Academy */}
            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div>
                  <h2 className="font-display text-base sm:text-lg font-bold text-navy flex items-center gap-2">
                    <BookOpen className="h-4.5 w-4.5 text-emerald-600" /> Katalog Kursus Aktif di Academy
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Modul kurikulum resmi Anda yang aktif tayang di katalog publik.
                  </p>
                </div>
                <Link
                  to="/experts/portal/portfolio"
                  className="text-xs font-semibold text-marine hover:underline"
                >
                  Portofolio Mengajar &rarr;
                </Link>
              </div>

              {modules.filter((m) => m.status === "published" || m.status === "approved").length > 0 ? (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {modules
                    .filter((m) => m.status === "published" || m.status === "approved")
                    .slice(0, 4)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="rounded-xl border border-emerald-200/80 bg-emerald-50/15 p-4 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                            Aktif Tayang
                          </span>
                          <h4 className="font-display text-sm font-bold text-navy mt-1.5 line-clamp-2">
                            {m.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Versi {m.version} · {m.hours ?? 0} Jam Pelatihan
                          </p>
                        </div>

                        <Link
                          to="/academy"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-marine hover:underline self-start"
                        >
                          <ExternalLink className="h-3 w-3" /> Buka di Academy
                        </Link>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Belum ada kursus yang disetujui untuk tayang di katalog publik.
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN (4 cols): Quick Status Widget & Recent History */}
          <div className="lg:col-span-4 space-y-6">
            {/* Widget 1: Ringkasan Status Verifikasi */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="font-display text-sm font-bold text-navy flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-marine" /> Ringkasan Status Kurikulum
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Distribusi status modul pengajuan Anda.
              </p>

              <div className="mt-4 space-y-2.5">
                <StatusRow
                  label="Disetujui &amp; Tayang"
                  count={approvedDrafts.length}
                  badgeClass="bg-emerald-100 text-emerald-800"
                />
                <StatusRow
                  label="Sedang Diverifikasi"
                  count={pendingDrafts.length}
                  badgeClass="bg-blue-100 text-blue-800"
                />
                <StatusRow
                  label="Perlu Revisi"
                  count={revisionDrafts.length}
                  badgeClass="bg-amber-100 text-amber-800"
                />
                <StatusRow
                  label="Diarsipkan oleh Admin"
                  count={archivedDrafts.length}
                  badgeClass="bg-slate-100 text-slate-700"
                />
                {rejectedDrafts.length > 0 && (
                  <StatusRow
                    label="Ditolak"
                    count={rejectedDrafts.length}
                    badgeClass="bg-rose-100 text-rose-800"
                  />
                )}
              </div>

              <div className="mt-4 pt-3.5 border-t border-border">
                <Link
                  to="/experts/portal/review-status"
                  className="inline-flex items-center justify-between w-full rounded-xl bg-slate-50 hover:bg-slate-100 p-2.5 text-xs font-semibold text-navy transition"
                >
                  <span>Pusat Pelacakan Status</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </div>
            </div>

            {/* Widget 2: Riwayat Fasilitasi Terakhir */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
                <h3 className="font-display text-sm font-bold text-navy flex items-center gap-2">
                  <History className="h-4 w-4 text-marine" /> Riwayat Mengajar
                </h3>
                <Link
                  to="/experts/portal/portfolio"
                  className="text-[11px] font-semibold text-marine hover:underline"
                >
                  Detail &rarr;
                </Link>
              </div>

              {history.length > 0 ? (
                <div className="mt-3 divide-y divide-border/60">
                  {history.slice(0, 3).map((h) => (
                    <div key={h.id} className="py-2.5 first:pt-0 last:pb-0">
                      <p className="text-xs font-bold text-navy truncate">{h.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {[h.organizer, h.participants ? `${h.participants} Peserta` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Belum ada catatan kegiatan fasilitasi kelas.
                </p>
              )}
            </div>

            {/* Widget 3: Tips & Standar Kurikulum BARUNA */}
            <div className="rounded-2xl border border-marine/20 bg-marine/5 p-4.5">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-marine/10 p-2 text-marine shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-navy text-xs">Standar Kurikulum BARUNA</p>
                  <p className="text-foreground/80 leading-relaxed">
                    Setiap modul yang diajukan dinilai berdasarkan kelengkapan silabus, kesesuaian durasi instruksional, serta metode evaluasi kelulusan.
                  </p>
                  <Link
                    to="/experts/portal/review-status"
                    className="inline-block pt-1 font-semibold text-marine hover:underline text-[11px]"
                  >
                    Pelajari Alur Review &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function StatusRow({
  label,
  count,
  badgeClass,
}: {
  label: string;
  count: number;
  badgeClass: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-slate-700">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}>
        {count}
      </span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: "marine" | "emerald" | "blue" | "purple";
}) {
  const colorMap = {
    marine: "bg-marine/10 text-marine",
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
  };

  const iconClass = color ? colorMap[color] : "bg-marine/10 text-marine";

  return (
    <div className="rounded-2xl border border-border bg-card p-4.5 shadow-soft hover:border-marine/30 transition">
      <div className="flex items-center gap-2.5">
        <span className={`rounded-xl p-2 ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold text-navy">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground leading-normal">{sub}</p>}
    </div>
  );
}
