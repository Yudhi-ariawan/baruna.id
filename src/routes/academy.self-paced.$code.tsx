import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  PlayCircle,
  Presentation,
  Sparkles,
  Target,
  Trophy,
  User,
  Video,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { Toaster } from "@/components/baruna/Toaster";
import { masterByCode, MINUTES_PER_JP } from "@/data/masterModules";
import { LMS_MODULES, type LmsModule } from "@/data/lms";
import { instructorBySlug } from "@/data/instructors";
import { programs, type Program } from "@/data/programs";
import { downloadCertificatePdf } from "@/lib/certificate";
import {
  useShortCourses,
  enrollShortCourse,
} from "@/lib/shortCourses";
import { barunaToast } from "@/lib/downloads";
import { useHomeExperience } from "@/components/baruna/home-experience";
import {
  getPublishedModuleDetail,
  type PublishedModuleDetail,
} from "@/lib/learning/learning.functions";

type LoaderData =
  | { kind: "master"; master: NonNullable<ReturnType<typeof lookupMaster>>; lms: LmsModule | undefined }
  | { kind: "dynamic"; module: PublishedModuleDetail }
  | { kind: "program"; program: Program };

function lookupMaster(code: string) {
  return masterByCode[code];
}
function lookupLms(lmsId: string) {
  return LMS_MODULES.find((m) => m.id === lmsId);
}

export const Route = createFileRoute("/academy/self-paced/$code")({
  loader: async ({ params }): Promise<LoaderData> => {
    const master = lookupMaster(params.code);
    if (master) return { kind: "master", master, lms: lookupLms(master.lmsId) };
    const program = programs.find((p) => p.id === params.code && p.type === "self-paced");
    if (program) return { kind: "program", program };

    // Dynamic module lookup from module_registry
    try {
      const publishedModule = await getPublishedModuleDetail({ data: { moduleId: params.code } });
      if (publishedModule) {
        return { kind: "dynamic", module: publishedModule };
      }
    } catch (err) {
      console.warn("Could not load dynamic module:", err);
    }

    throw notFound();
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    if (loaderData.kind === "master") {
      const m = loaderData.master;
      return {
        meta: [
          { title: `${m.title} — Self-Paced Course (${m.code}) — BARUNA Academy` },
          {
            name: "description",
            content: `Self-Paced access to the ${m.title} Master Module. Complete online at your own pace.`,
          },
        ],
        links: [{ rel: "canonical", href: `/academy/self-paced/${m.code}` }],
      };
    }
    if (loaderData.kind === "dynamic") {
      const mod = loaderData.module;
      return {
        meta: [
          { title: `${mod.title} — Self-Paced Course — BARUNA Academy` },
          { name: "description", content: mod.summary || "BARUNA self-paced course." },
        ],
        links: [{ rel: "canonical", href: `/academy/self-paced/${mod.id}` }],
      };
    }
    const p = loaderData.program;
    return {
      meta: [
        { title: `${p.title} — Self-Paced Course — BARUNA Academy` },
        { name: "description", content: p.description },
      ],
      links: [{ rel: "canonical", href: `/academy/self-paced/${p.id}` }],
    };
  },
  errorComponent: ({ error }: { error: any }) => (
    <AcademyShell active="self-paced">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Kendala Memuat Modul Pembelajaran</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {String(error?.message || error || "Terjadi kendala saat memuat detail modul pelatihan. Silakan coba kembali.")}
        </p>
        <Link
          to="/academy/self-paced"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-white"
        >
          Kembali ke Katalog Pelatihan <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AcademyShell>
  ),
  notFoundComponent: () => (
    <AcademyShell active="self-paced">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Modul Pembelajaran Tidak Ditemukan</h1>
        <Link
          to="/academy/self-paced"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-white"
        >
          Kembali ke Katalog Pelatihan <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AcademyShell>
  ),
  component: SelfPacedDetail,
});

function SelfPacedDetail() {
  const data = Route.useLoaderData();
  if (data.kind === "dynamic") return <DynamicModuleOverview module={data.module} />;
  if (data.kind === "program") return <StandaloneProgramDetail program={data.program} />;
  return <MasterModuleOverview master={data.master} lms={data.lms} />;
}

// ─── 1. OVERVIEW MODUL DINAMIS (DARI EXPERT REGISTRY) ─────────────────────────
function DynamicModuleOverview({ module }: { module: PublishedModuleDetail }) {
  const navigate = useNavigate();
  const { authState } = useHomeExperience();
  const { get, isCompleted } = useShortCourses();
  const isAuthenticated = authState === "authenticated";
  const enrollment = isAuthenticated ? get(module.id) : undefined;
  const done = isAuthenticated ? isCompleted(module.id) : false;

  const handleEnroll = () => {
    if (!isAuthenticated) {
      void navigate({
        to: "/auth",
        search: {
          mode: "signin",
          redirect: `/academy/self-paced/${module.id}`,
        },
      });
      return;
    }
    enrollShortCourse(module.id, {
      title: module.title,
      hours: module.hours,
      instructor: module.trainer.name,
      category: module.topic || "Fisheries Management",
    });
    barunaToast("Berhasil mendaftar! Mengalihkan ke Ruang Belajar...");
    navigate({ to: "/academy/learn/$id", params: { id: module.id } });
  };

  const handleDownloadCertificate = () => {
    downloadCertificatePdf({
      name: "Peserta BARUNA",
      country: "Indonesia",
      program: module.title,
      dates: new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      certNo: `BARUNA-MOD-${module.id.slice(0, 8).toUpperCase()}-2026`,
      verifyUrl: `https://baruna.kkp.go.id/verify/${module.id}`,
    });
    barunaToast("Sertifikat kelulusan berhasil diunduh!");
  };

  const coverDoc = module.documents.find(
    (d) =>
      d.type.toLowerCase().includes("cover") ||
      d.fileType?.includes("image") ||
      d.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/),
  );

  const aside = (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[0.65rem] font-bold text-foreground/70">
            MOD-{module.id.slice(0, 8).toUpperCase()}
          </span>
          {done ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-success">
              <CheckCircle2 className="h-3 w-3" /> Selesai 100%
            </span>
          ) : enrollment ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-marine/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-marine">
              <Sparkles className="h-3 w-3" /> Aktif Belajar
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-eco-community/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-eco-community">
              Tersedia Online
            </span>
          )}
        </div>

        <h3 className="mt-3 font-display text-base font-bold text-navy">Informasi Modul</h3>
        <ul className="mt-3 space-y-2 text-xs">
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Durasi Belajar</span>
            <span className="font-semibold text-navy">{module.hours} Jam Belajar (JP)</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Format</span>
            <span className="font-semibold text-navy">Self-Paced (Mandiri Online)</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Bahasa Pengantar</span>
            <span className="font-semibold text-navy">{module.language}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Passing Grade</span>
            <span className="font-semibold text-navy">{module.passingScore}%</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Sertifikat</span>
            <span className="font-semibold text-navy">Certificate of Completion</span>
          </li>
        </ul>

        {/* CTA ACTIONS */}
        <div className="mt-5 space-y-2.5">
          {!enrollment && !done ? (
            <button
              onClick={handleEnroll}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-marine py-3 text-sm font-bold text-white shadow-sm hover:bg-marine/90 transition"
            >
              {isAuthenticated ? "Enroll Course" : "Sign In to Enroll"} <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              {done ? (
                <div className="rounded-xl border border-success/40 bg-success/5 p-3 text-xs text-success">
                  <p className="flex items-center gap-1.5 font-bold">
                    <Award className="h-4 w-4" /> Modul Telah Selesai
                  </p>
                  <p className="mt-1 text-success/80">
                    Selamat! Anda telah lulus modul ini. Rekam kelulusan tersimpan resmi.
                  </p>
                  <button
                    onClick={handleDownloadCertificate}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                  >
                    <Download className="h-3.5 w-3.5" /> Unduh Sertifikat (PDF)
                  </button>
                </div>
              ) : null}

              <Link
                to="/academy/learn/$id"
                params={{ id: module.id }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-marine py-3 text-sm font-bold text-white shadow-sm hover:bg-marine/90 transition"
              >
                <PlayCircle className="h-4 w-4" />
                {done ? "Tinjau di Ruang Belajar" : "Lanjutkan Belajar →"}
              </Link>
            </>
          )}

          <Link
            to="/academy/learn"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 py-2 text-xs font-semibold text-foreground/80 hover:bg-muted transition"
          >
            ← Buka Dashboard My Learning
          </Link>
        </div>
      </div>

      {/* Trainer Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
          Instruktur Modul
        </span>
        <div className="mt-3 flex items-start gap-3">
          {module.trainer.avatarUrl ? (
            <img
              src={module.trainer.avatarUrl}
              alt={module.trainer.name}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-marine/20"
            />
          ) : (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-marine/15 font-display text-base font-bold text-marine">
              {module.trainer.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="font-display text-sm font-bold text-navy truncate">{module.trainer.name}</h4>
              <BadgeCheck className="h-4 w-4 shrink-0 text-marine" />
            </div>
            {module.trainer.headline && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{module.trainer.headline}</p>
            )}
            {module.trainer.institution && (
              <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-foreground/70">
                <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{module.trainer.institution}</span>
              </p>
            )}
          </div>
        </div>
        {module.trainer.slug && (
          <div className="mt-4 pt-3 border-t border-border flex justify-end">
            <Link
              to="/experts/$slug"
              params={{ slug: module.trainer.slug }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-marine hover:underline"
            >
              Lihat Profil Lengkap <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <AcademyShell active="self-paced" aside={aside}>
      <Toaster />
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/programs" className="font-medium text-foreground/70 hover:text-marine">Program &amp; Modul</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy truncate max-w-xs">{module.title}</span>
        </nav>

        {/* Cover Banner if available */}
        {coverDoc?.downloadUrl && (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-900 shadow-soft max-h-64">
            <img
              src={coverDoc.downloadUrl}
              alt={module.title}
              className="w-full h-full max-h-64 object-cover object-center"
            />
          </div>
        )}

        {/* Hero Header */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-marine/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
              Self-Paced Course
            </span>
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-[0.65rem] font-bold text-foreground/70">
              MOD-{module.id.slice(0, 8).toUpperCase()}
            </span>
            {done ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-success">
                <CheckCircle2 className="h-3 w-3" /> Selesai
              </span>
            ) : enrollment ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-blue-700">
                <Clock className="h-3 w-3" /> Terdaftar
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-navy">
            {module.title}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {module.summary}
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground/80">
              <Clock className="h-3.5 w-3.5 text-marine" /> {module.hours} Jam Belajar
            </span>
            {module.topic && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground/80">
                <Layers className="h-3.5 w-3.5 text-marine" /> {module.topic}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground/80">
              <User className="h-3.5 w-3.5 text-marine" /> {module.trainer.name}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground/80">
              <FileText className="h-3.5 w-3.5 text-marine" /> {module.language}
            </span>
          </div>

          {/* Action Button Banner inside hero */}
          <div className="mt-6 pt-5 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {enrollment ? (
                <span>Status: <strong className="text-navy font-semibold">Anda telah terdaftar di modul ini.</strong></span>
              ) : (
                <span>Akses seluruh materi video, handbook modul, slide tayang, dan kuis kelulusan.</span>
              )}
            </div>

            {enrollment ? (
              <Link
                to="/academy/learn/$id"
                params={{ id: module.id }}
                className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-sm"
              >
                <PlayCircle className="h-4 w-4" /> Lanjutkan Belajar di Ruang Belajar →
              </Link>
            ) : (
              <button
                onClick={handleEnroll}
                className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-sm"
              >
                {isAuthenticated ? "Enroll Course" : "Sign In to Enroll"} <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Learning Objectives */}
        {module.learningObjectives.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-marine/10 text-marine">
                <Target className="h-4 w-4" />
              </span>
              <h2 className="font-display text-base font-bold text-navy">Tujuan &amp; Capaian Pembelajaran</h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {module.learningObjectives.map((obj, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-foreground/85">
                  <CheckCircle2 className="h-4 w-4 text-marine shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Syllabus / Module Structure Preview */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-marine/10 text-marine">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-navy">Silabus &amp; Struktur Ruang Belajar</h2>
              <p className="text-xs text-muted-foreground">Aktivitas pembelajaran yang akan diselesaikan peserta di Ruang Belajar:</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Video className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-navy">1. Video Pembelajaran</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paparan interaktif dan telaah substansi utama oleh instruktur.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-navy">2. Modul Pembelajaran</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ringkasan modul, dokumen lengkap, dan pedoman teknis resmi.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <Presentation className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-navy">3. Slide Presentasi PPT</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Slide tayang ringkas untuk penelaahan mandiri dan presentasi.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <ListChecks className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-navy">4. Kuis Kelulusan Modul</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Evaluasi pemahaman dengan passing grade {module.passingScore}%.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AcademyShell>
  );
}

// ─── 2. OVERVIEW MASTER MODULE (M-01 .. M-13) ──────────────────────────────────
function MasterModuleOverview({
  master,
  lms: lmsModule,
}: {
  master: NonNullable<ReturnType<typeof lookupMaster>>;
  lms: LmsModule | undefined;
}) {
  const navigate = useNavigate();
  const { authState } = useHomeExperience();
  const { get, isCompleted } = useShortCourses();
  const isAuthenticated = authState === "authenticated";
  const enrollment = isAuthenticated ? get(master.code) : undefined;
  const done = isAuthenticated ? isCompleted(master.code) : false;
  const instructor = instructorBySlug[master.instructorSlug];

  const handleEnroll = () => {
    if (!isAuthenticated) {
      void navigate({
        to: "/auth",
        search: {
          mode: "signin",
          redirect: `/academy/self-paced/${master.code}`,
        },
      });
      return;
    }
    enrollShortCourse(master.code, {
      title: master.title,
      hours: master.hours,
      instructor: master.instructorSlug,
      category: master.subCategory,
    });
    barunaToast("Berhasil mendaftar! Mengalihkan ke Ruang Belajar...");
    navigate({ to: "/academy/learn/$id", params: { id: master.code } });
  };

  const aside = (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[0.65rem] font-bold text-foreground/70">
            {master.code}
          </span>
          {done ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-success">
              <CheckCircle2 className="h-3 w-3" /> Selesai 100%
            </span>
          ) : enrollment ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-marine/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-marine">
              <Sparkles className="h-3 w-3" /> Aktif Belajar
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-eco-community/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-eco-community">
              Master Module
            </span>
          )}
        </div>

        <h3 className="mt-3 font-display text-base font-bold text-navy">Informasi Modul</h3>
        <ul className="mt-3 space-y-2 text-xs">
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Durasi</span>
            <span className="font-semibold text-navy">{master.hours}h ({master.jp} JP)</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Level</span>
            <span className="font-semibold text-navy">{master.level}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Instruktur</span>
            <span className="font-semibold text-navy">{instructor?.name ?? master.instructorSlug}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Sertifikat</span>
            <span className="font-semibold text-navy">Certificate of Completion</span>
          </li>
        </ul>

        <div className="mt-5 space-y-2.5">
          {!enrollment && !done ? (
            <button
              onClick={handleEnroll}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-marine py-3 text-sm font-bold text-white shadow-sm hover:bg-marine/90 transition"
            >
              {isAuthenticated ? "Enroll Course" : "Sign In to Enroll"} <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/academy/learn/$id"
              params={{ id: master.code }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-marine py-3 text-sm font-bold text-white shadow-sm hover:bg-marine/90 transition"
            >
              <PlayCircle className="h-4 w-4" />
              {done ? "Tinjau di Ruang Belajar" : "Lanjutkan Belajar →"}
            </Link>
          )}

          <Link
            to="/academy/learn"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 py-2 text-xs font-semibold text-foreground/80 hover:bg-muted transition"
          >
            ← Buka Dashboard My Learning
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <AcademyShell active="self-paced" aside={aside}>
      <Toaster />
      <div className="space-y-6">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/programs" className="font-medium text-foreground/70 hover:text-marine">Program &amp; Modul</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">{master.code} · {master.title}</span>
        </nav>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-marine/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
              Master Module · No. {master.no}
            </span>
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-[0.65rem] font-bold text-foreground/70">
              {master.code}
            </span>
            {done && (
              <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-success">
                <CheckCircle2 className="h-3 w-3" /> Selesai
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-navy sm:text-3xl">{master.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{master.summary}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <Clock className="h-3.5 w-3.5" /> {master.hours}h · {master.jp} JP
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <Layers className="h-3.5 w-3.5" /> {master.subCategory}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <User className="h-3.5 w-3.5" /> {instructor?.name ?? master.instructorSlug}
            </span>
          </div>

          <div className="mt-6 pt-5 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {enrollment ? "Modul aktif di akun pembelajaran Anda." : "Daftar secara gratis untuk mulai belajar."}
            </span>
            {enrollment ? (
              <Link
                to="/academy/learn/$id"
                params={{ id: master.code }}
                className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-sm"
              >
                <PlayCircle className="h-4 w-4" /> Lanjutkan Belajar di Ruang Belajar →
              </Link>
            ) : (
              <button
                onClick={handleEnroll}
                className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 transition shadow-sm"
              >
                {isAuthenticated ? "Enroll Course" : "Sign In to Enroll"} <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Learning objectives */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-marine/10 text-marine">
              <Target className="h-4 w-4" />
            </span>
            <h2 className="font-display text-base font-bold text-navy">Tujuan Pembelajaran</h2>
          </div>
          <ul className="mt-4 space-y-2">
            {master.objectives.map((o: string) => (
              <li key={o} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
                <span className="text-foreground/80">{o}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AcademyShell>
  );
}

// ─── 3. OVERVIEW STANDALONE PROGRAM ──────────────────────────────────────────
function StandaloneProgramDetail({ program }: { program: Program }) {
  return (
    <AcademyShell active="self-paced">
      <div className="space-y-6">
        <Link
          to="/academy/programs"
          className="inline-flex items-center gap-1 text-sm font-semibold text-marine hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Katalog Program
        </Link>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="relative aspect-[21/9] w-full bg-muted">
            <img
              src={program.image}
              alt={program.title}
              className="h-full w-full object-cover"
              loading="eager"
            />
            <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold uppercase tracking-wide text-marine shadow-sm ring-1 ring-marine/20">
              Self-Paced Course
            </span>
          </div>
          <div className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-marine">{program.category}</p>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-navy sm:text-3xl">
              {program.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{program.description}</p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground/80">
                <Clock className="h-3.5 w-3.5 text-marine" /> {program.duration}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground/80">
                <BookOpen className="h-3.5 w-3.5 text-marine" /> {program.level}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground/80">
                <FileText className="h-3.5 w-3.5 text-marine" /> {program.language}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AcademyShell>
  );
}
