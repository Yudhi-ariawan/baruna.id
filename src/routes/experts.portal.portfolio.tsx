import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpenCheck,
  Users,
  TrendingUp,
  Award,
  Clock,
  CheckCircle2,
  FileText,
  ExternalLink,
  History,
  Building2,
  Globe,
  ArrowRight,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { LEVEL_LABEL, formatUsp } from "@/lib/trainerModules";
import { useTrainerPortal } from "@/lib/experts/useTrainerPortal";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/experts/portal/portfolio")({
  head: () => ({
    meta: [
      { title: "Portofolio Mengajar — Portal Trainer BARUNA" },
      {
        name: "description",
        content: "Daftar kurikulum modul resmi yang telah disetujui, jam ajar, dan rekam jejak fasilitasi pengajar di ekosistem BARUNA.",
      },
    ],
  }),
  component: PortfolioPage,
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

function PortfolioPage() {
  const q = useTrainerPortal();
  const d = q.data;
  const t = d?.trainer;
  const rawModules = d?.modules ?? [];
  const drafts = d?.moduleDrafts ?? [];
  const history = d?.history ?? [];

  const portfolioCta = {
    icon: BookOpenCheck,
    title: "Ingin memperluas portofolio Anda?",
    description: "Setiap modul kurikulum yang disetujui akan memperkuat rekam jejak dan kredensial Anda di BARUNA.",
    button: "Ajukan Modul Baru",
    href: "/experts/portal/submit-module",
  };

  if (q.isLoading) {
    return (
      <PageShell
        sidebar={{
          ...EXPERTS_SIDEBAR_META,
          title: "Portal Trainer",
          subtitle: "Portofolio mengajar.",
          sections: trainerPortalNav("/experts/portal/portfolio"),
        }}
        cta={portfolioCta}
      >
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Clock className="mx-auto h-8 w-8 text-marine animate-spin" />
          <p className="mt-3 text-sm text-muted-foreground">Memuat data portofolio mengajar…</p>
        </div>
      </PageShell>
    );
  }

  if (!t) {
    return (
      <PageShell
        sidebar={{
          ...EXPERTS_SIDEBAR_META,
          title: "Portal Trainer",
          subtitle: "Portofolio mengajar.",
          sections: trainerPortalNav("/experts/portal/portfolio"),
        }}
        cta={portfolioCta}
      >
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-destructive">Data portofolio trainer tidak tersedia atau Anda belum memiliki profil trainer aktif.</p>
        </div>
      </PageShell>
    );
  }

  // Combine modules from module_registry and approved drafts to guarantee no data is dropped
  const approvedModulesMap = new Map<string, {
    id: string;
    title: string;
    summary: string | null;
    status: string;
    hours: number;
    version: number | string;
    language: string | null;
    targetParticipants?: string | null;
    updatedAt?: string;
  }>();

  rawModules
    .filter((m) => ["approved", "published"].includes(m.status))
    .forEach((m) => {
      approvedModulesMap.set(m.id, {
        id: m.id,
        title: m.title,
        summary: m.summary,
        status: m.status,
        hours: m.hours ?? 0,
        version: m.version,
        language: m.language,
        targetParticipants: m.targetParticipants,
        updatedAt: m.updatedAt,
      });
    });

  // Also include approved drafts if not already represented
  drafts
    .filter((dr) => dr.reviewStatus === "approved" || dr.reviewHistory?.[0]?.decision === "approve")
    .forEach((dr) => {
      const payload = (dr.payload as Record<string, unknown>) ?? {};
      const idKey = dr.subjectId || dr.id;
      if (!approvedModulesMap.has(idKey)) {
        approvedModulesMap.set(idKey, {
          id: idKey,
          title: dr.title,
          summary: typeof payload.summary === "string" ? payload.summary : null,
          status: "published",
          hours: Number(payload.estimated_learning_hours || 0),
          version: "1.0",
          language: typeof payload.language === "string" ? payload.language : "Indonesia",
          targetParticipants: typeof payload.target_participants === "string" ? payload.target_participants : null,
          updatedAt: dr.updatedAt,
        });
      }
    });

  const approvedList = Array.from(approvedModulesMap.values());
  const totalInstructionalHours = approvedList.reduce((acc, m) => acc + (m.hours || 0), 0);
  const totalGraduated = t.uniqueSuccessfulParticipants || 0;
  const learningHoursGenerated = totalInstructionalHours * totalGraduated;

  return (
    <PageShell
      sidebar={{
        ...EXPERTS_SIDEBAR_META,
        title: "Portal Trainer",
        subtitle: "Portofolio mengajar & kurikulum.",
        sections: trainerPortalNav("/experts/portal/portfolio"),
      }}
      cta={portfolioCta}
    >
      <div className="space-y-6">
        {/* Header Profile Trainer */}
        <header className="rounded-3xl bg-gradient-to-r from-navy via-navy to-marine/90 p-6 sm:p-8 text-white shadow-soft">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-200">
                  Portofolio Mengajar
                </span>
                <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Trainer Terverifikasi
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight">
                {t.fullName}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/80">
                {Boolean(t.title) && <span>{t.title}</span>}
                {Boolean(t.organization) && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> {t.organization}
                    </span>
                  </>
                )}
                {Boolean(t.country) && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" /> {t.country}
                    </span>
                  </>
                )}
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <Badge className="bg-white/15 text-white border-white/20 hover:bg-white/20 flex items-center gap-1 font-bold text-xs py-1 px-3">
                  <Award className="h-3.5 w-3.5 text-amber-300" />
                  Level: {LEVEL_LABEL[t.level === "not_assigned" ? "none" : t.level]}
                </Badge>
                {t.expertiseAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full bg-white/10 border border-white/10 px-3 py-0.5 text-xs font-medium text-white/90"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
              <Link
                to="/experts/portal/submit-module"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white text-navy font-bold px-4 py-2.5 text-xs hover:bg-slate-100 transition shadow-sm"
              >
                <BookOpenCheck className="h-4 w-4 text-marine" /> Ajukan Modul Tambahan
              </Link>
              <Link
                to="/experts/portal/review-status"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/10 border border-white/20 text-white font-semibold px-4 py-2 text-xs hover:bg-white/20 transition"
              >
                Lihat Status Pengajuan <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </header>

        {/* 4 Stat Metrik Pengajaran */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatBox
            icon={BookOpenCheck}
            label="Modul Disetujui (Tayang)"
            value={approvedList.length}
            sub="Kurikulum resmi aktif di BARUNA"
          />
          <StatBox
            icon={Clock}
            label="Total Jam Kurikulum"
            value={`${totalInstructionalHours} Jam`}
            sub="Durasi instruksional yang dirancang"
          />
          <StatBox
            icon={Users}
            label="Peserta Terfasilitasi"
            value={formatUsp(totalGraduated)}
            sub="Peserta terdaftar & lulus program"
          />
          <StatBox
            icon={TrendingUp}
            label="Akumulasi Jam Belajar"
            value={formatUsp(learningHoursGenerated)}
            sub={`${totalInstructionalHours} jam × ${formatUsp(totalGraduated)} peserta`}
          />
        </div>

        {/* Section: Daftar Modul Kurikulum Resmi */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-emerald-100 p-2 text-emerald-800">
                  <BookOpenCheck className="h-5 w-5" />
                </span>
                <h2 className="font-display text-xl font-bold text-navy">
                  Modul Kurikulum Resmi Saya ({approvedList.length})
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Kurikulum yang telah melewati proses verifikasi dan sah digunakan untuk pelatihan di ekosistem BARUNA Academy.
              </p>
            </div>

            <Link
              to="/academy"
              className="inline-flex items-center gap-1 text-xs font-semibold text-marine hover:underline self-start sm:self-center"
            >
              Lihat di Katalog Publik Academy <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {approvedList.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {approvedList.map((m) => (
                <article
                  key={m.id}
                  className="rounded-2xl border border-emerald-200/90 bg-white p-5 shadow-2xs hover:border-emerald-400 transition"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Disetujui &amp; Tayang
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Versi {m.version}
                        </span>
                        {Boolean(m.language) && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">Bahasa: {m.language}</span>
                          </>
                        )}
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs font-semibold text-navy">
                          {m.hours} Jam Pelatihan
                        </span>
                      </div>

                      <h3 className="font-display text-lg font-bold text-navy">
                        {m.title}
                      </h3>

                      {m.summary ? (
                        <p className="text-xs text-slate-700 leading-relaxed max-w-3xl">
                          {m.summary}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          Modul pelatihan standar kelautan dan perikanan terakreditasi BARUNA.
                        </p>
                      )}

                      {m.targetParticipants && (
                        <p className="text-[11px] text-muted-foreground">
                          <strong>Sasaran Peserta:</strong> {m.targetParticipants}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0">
                      <Link
                        to="/experts/portal/review-status"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-slate-50 px-3.5 py-2 text-xs font-semibold text-navy hover:bg-slate-100 transition"
                      >
                        <FileText className="h-3.5 w-3.5 text-marine" /> Berkas Silabus
                      </Link>
                      <Link
                        to="/academy"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-marine/10 text-marine px-3.5 py-2 text-xs font-bold hover:bg-marine hover:text-white transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Akses di Academy
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-slate-50/50 p-10 text-center">
              <BookOpenCheck className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <h3 className="mt-3 font-display text-base font-bold text-navy">
                Belum ada modul yang disetujui
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                Modul yang Anda ajukan akan otomatis tercantum pada portofolio ini setelah disetujui oleh tim verifikator BARUNA.
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Link
                  to="/experts/portal/submit-module"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-4 py-2 text-xs font-semibold text-white hover:bg-navy transition"
                >
                  Ajukan Modul Sekarang <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/experts/portal/review-status"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-muted transition"
                >
                  Cek Status Pengajuan
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Section: Peran Pengajar & Riwayat Fasilitasi */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-marine/10 p-2 text-marine">
                <History className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-navy">
                  Peran &amp; Riwayat Fasilitasi Pelatihan
                </h2>
                <p className="text-xs text-muted-foreground">
                  Catatan kegiatan fasilitasi, pengampu kelas, dan mentoring yang Anda ampu.
                </p>
              </div>
            </div>
          </div>

          {/* Peran yang diemban */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Peran Pengajar Terverifikasi
            </h3>
            {t.trainingRoles && t.trainingRoles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {t.trainingRoles.map((role) => (
                  <Badge
                    key={role}
                    className="bg-navy/5 text-navy border-navy/20 font-semibold px-3 py-1 text-xs"
                  >
                    {role}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Peran otomatis tercatat saat Anda ditugaskan memfasilitasi program pelatihan.
              </p>
            )}
          </div>

          {/* Riwayat Kegiatan */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Riwayat Fasilitasi
            </h3>
            {history.length > 0 ? (
              <div className="space-y-3">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-white p-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-navy">{h.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[
                          h.organizer,
                          h.role,
                          h.country,
                          h.participants ? `${h.participants} Peserta` : null,
                          h.startDate ? formatDate(h.startDate) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs font-medium self-start sm:self-center">
                      Selesai
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                Belum ada riwayat fasilitasi kelas yang tercatat pada sistem.
              </div>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs hover:shadow-soft transition">
      <div className="flex items-center gap-2 text-xs font-bold text-marine">
        <Icon className="h-4 w-4" />
        <span className="text-muted-foreground uppercase text-[10px] tracking-wider">{label}</span>
      </div>
      <p className="mt-2.5 font-display text-2xl sm:text-3xl font-extrabold text-navy">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground leading-normal">{sub}</p>
    </div>
  );
}
