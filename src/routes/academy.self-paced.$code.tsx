import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Play,
  PlayCircle,
  Presentation,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  User,
  Video,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { ModuleQuiz } from "@/components/baruna/academy/ModuleQuiz";
import { Toaster } from "@/components/baruna/Toaster";
import { masterByCode, MINUTES_PER_JP } from "@/data/masterModules";
import { LMS_MODULES, type LmsModule, type ResourceKind } from "@/data/lms";
import { hasQuizBank, QUIZ_PASS_PERCENT } from "@/data/quizzes";
import { instructorBySlug } from "@/data/instructors";
import { programs, type Program } from "@/data/programs";
import { downloadCertificatePdf } from "@/lib/certificate";
import {
  useApplication,
  getLms,
  getQuizRecord,
  isModuleCompleteInApp,
  updateLms,
  getOrCreateSelfPacedApp,
  getOrCreateDemoFullTrainingApp,
  SELF_PACED_APP_ID,
} from "@/lib/application";
import {
  useShortCourses,
  enrollShortCourse,
  completeShortCourse,
} from "@/lib/shortCourses";
import { barunaToast } from "@/lib/downloads";
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
            content: `Self-Paced access to the ${m.title} Master Module. Same content and quiz as the Full Training Program — completion earns credit in both pathways.`,
          },
          { property: "og:title", content: `${m.title} — Self-Paced Course` },
          { property: "og:description", content: m.summary },
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
          { property: "og:title", content: `${mod.title} — Self-Paced Course` },
          { property: "og:description", content: mod.summary || "BARUNA self-paced course." },
        ],
        links: [{ rel: "canonical", href: `/academy/self-paced/${mod.id}` }],
      };
    }
    const p = loaderData.program;
    return {
      meta: [
        { title: `${p.title} — Self-Paced Course — BARUNA Academy` },
        { name: "description", content: p.description },
        { property: "og:title", content: `${p.title} — Self-Paced Course` },
        { property: "og:description", content: p.description },
      ],
      links: [{ rel: "canonical", href: `/academy/self-paced/${p.id}` }],
    };
  },
  notFoundComponent: () => (
    <AcademyShell active="self-paced">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Self-Paced Course not found</h1>
        <Link
          to="/academy/self-paced"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground"
        >
          Back to Self-Paced Courses <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AcademyShell>
  ),
  errorComponent: ({ error }) => (
    <AcademyShell active="self-paced">
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load Self-Paced Course: {String(error)}
      </div>
    </AcademyShell>
  ),
  component: SelfPacedDetail,
});

function SelfPacedDetail() {
  const data = Route.useLoaderData();
  if (data.kind === "dynamic") return <DynamicModuleWorkspace module={data.module} />;
  if (data.kind === "program") return <StandaloneProgramDetail program={data.program} />;
  return <MasterModuleWorkspace master={data.master} lms={data.lms} />;
}


// ============================================================================
// Master Module workspace — the SHARED learning page for Self-Paced and Full
// Training. It is driven by the same LMS_MODULES resources, the same quiz bank
// and the same <ModuleQuiz> engine as used inside the Full Training Program.
// Passing the quiz records the completion against the (learner, Master Module)
// pair via a synthetic Self-Paced application, and mirrors credit into the
// Self-Paced enrollment store so the two pathways stay in sync automatically.
// ============================================================================
function MasterModuleWorkspace({
  master,
  lms: lmsModule,
}: {
  master: NonNullable<ReturnType<typeof lookupMaster>>;
  lms: LmsModule | undefined;
}) {
  const navigate = useNavigate();
  const { get, isCompleted, priorLearning } = useShortCourses();
  const enrollment = get(master.code);
  const done = isCompleted(master.code);
  const priorFromTraining = priorLearning(master.code);
  const app = useApplication(SELF_PACED_APP_ID);
  const [quizOpen, setQuizOpen] = useState(false);

  const handleEnroll = () => {
    getOrCreateSelfPacedApp();
    enrollShortCourse(master.code);
    barunaToast("Enrolled — you now have access to the Master Module workspace");
  };

  const instructor = instructorBySlug[master.instructorSlug];
  const quizRec = app && lmsModule ? getQuizRecord(app, lmsModule.id) : undefined;
  const moduleProgress = app && lmsModule ? getLms(app).modules[lmsModule.id] : undefined;
  const resourcesDone = moduleProgress
    ? RESOURCE_ORDER.filter((k) => moduleProgress[k]).length
    : 0;
  const isWorkspaceComplete = app && lmsModule
    ? isModuleCompleteInApp(app, lmsModule.id)
    : done;

  // When the module quiz is passed inside the shared workspace, mirror the
  // completion into the Self-Paced enrollment store so the catalogue, learner
  // dashboard, analytics and certificate all update immediately.
  useEffect(() => {
    if (quizRec?.passed && !enrollment?.completed) {
      completeShortCourse(master.code, quizRec.bestScore, "self-paced");
    }
  }, [quizRec?.passed, quizRec?.bestScore, master.code, enrollment?.completed]);

  const toggleResource = (kind: ResourceKind) => {
    if (!app || !lmsModule) return;
    const lms = getLms(app);
    const mp = lms.modules[lmsModule.id];
    updateLms(app.id, {
      ...lms,
      modules: { ...lms.modules, [lmsModule.id]: { ...mp, [kind]: !mp[kind] } },
    });
  };

  const aside = (
    <>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[0.65rem] font-bold text-foreground/70">
            {master.code}
          </span>
          {isWorkspaceComplete && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-success">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </span>
          )}
        </div>
        <h3 className="mt-3 font-display text-base font-bold text-navy">Master Module details</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-semibold text-navy">{master.hours}h</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">JP (1 JP = {MINUTES_PER_JP} min)</span>
            <span className="font-semibold text-navy">{master.jp} JP</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Level</span>
            <span className="font-semibold text-navy">{master.level}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Trainer</span>
            <span className="font-semibold text-navy">{instructor?.name ?? master.instructorSlug}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Certificate</span>
            <span className="font-semibold text-navy">Certificate of Completion</span>
          </li>
        </ul>

        {!enrollment && !isWorkspaceComplete && (
          <button
            onClick={handleEnroll}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-marine py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
          >
            Enrol — Free <ArrowRight className="h-4 w-4" />
          </button>
        )}
        {isWorkspaceComplete && (
          <div className="mt-4 rounded-xl border border-success/40 bg-success/5 p-3 text-xs text-success">
            <p className="flex items-center gap-1.5 font-bold">
              <Award className="h-3.5 w-3.5" /> Master Module completed
            </p>
            <p className="mt-1 text-success/80">
              Certificate of Completion issued. This module is recognised as credit inside every Full
              Training Program that includes it.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-marine/30 bg-marine/5 p-5">
        <p className="font-display text-sm font-bold text-navy">Same Master Module as</p>
        <Link
          to="/academy/training/$slug"
          params={{ slug: "international-training-fisheries-african-countries" }}
          className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 transition-colors hover:border-marine/40"
        >
          <span className="text-sm font-semibold text-navy">
            International Training on Fisheries for African Countries
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-marine" />
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">
          Complete here or there — the Master Module has one shared quiz, passing mark and completion
          record.
        </p>
      </div>
    </>
  );

  return (
    <AcademyShell active={enrollment ? "my-learning" : "self-paced"} aside={aside}>
      <Toaster />
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          {enrollment ? (
            <>
              <Link to="/academy/learn" className="font-medium text-foreground/70 hover:text-marine">
                My Learning
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-navy">{master.code} · {master.title}</span>
            </>
          ) : (
            <>
              <Link to="/academy/self-paced" className="font-medium text-foreground/70 hover:text-marine">
                Self-Paced Courses
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-navy">{master.code}</span>
            </>
          )}
        </nav>

        {/* Context banner — same page, different pathway */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-marine/30 bg-marine/5 px-4 py-2.5 text-xs text-marine">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 shrink-0 text-marine" />
            <span>
              {enrollment
                ? "Ruang Belajar Modul Mandiri (Self-Paced Learning Workspace) — Akses materi, bacaan, dan kuis modul."
                : "SELF-PACED COURSE — Akses Master Module mandiri resmi BARUNA Academy."}
            </span>
          </div>
          {enrollment && (
            <Link to="/academy/learn" className="font-semibold hover:underline text-navy shrink-0">
              ← Kembali ke My Learning
            </Link>
          )}
        </div>

        {/* LMS 5-Tab Switcher Banner */}
        <div className="rounded-2xl border-2 border-marine/30 bg-gradient-to-r from-marine/10 via-card to-marine/5 p-4 shadow-soft">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marine text-white shadow-xs">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div>
                <span className="rounded-md bg-marine/15 px-2 py-0.5 text-[10px] font-bold text-marine uppercase tracking-wider">
                  Mencari LMS 5-Tab Sesuai Slide 23 PB-ACA-04?
                </span>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Halaman saat ini adalah <strong>Modul Pelatihan Mandiri (Self-Paced)</strong>. Untuk melihat alur LMS Program Pelatihan Terstruktur dengan 5 Tab Lengkap (Welcome, 13 Modul, Assessments, Assignments, Sertifikat), klik tombol berikut:
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const app = getOrCreateDemoFullTrainingApp();
                navigate({ to: "/academy/learn/$id", params: { id: app.id } });
              }}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-xs font-bold text-white hover:bg-navy/90 shadow-sm transition-all hover:scale-102"
            >
              <PlayCircle className="h-4 w-4" /> Buka LMS 5-Tab Sekarang
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-marine/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
              Master Module · No. {master.no}
            </span>
            <span className="rounded-md bg-muted px-2 py-1 font-mono text-[0.65rem] font-bold text-foreground/70">
              {master.code}
            </span>
            {isWorkspaceComplete && (
              <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-success">
                <CheckCircle2 className="h-3 w-3" /> Completed
              </span>
            )}
            {priorFromTraining && !enrollment?.completed && (
              <span className="inline-flex items-center gap-1 rounded-md bg-marine/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
                <Award className="h-3 w-3" /> Completed via Full Training Program
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-navy">{master.title}</h1>
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" /> {master.version}
            </span>
          </div>
        </div>

        {/* Learning objectives — shared */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-marine/10 text-marine">
              <Target className="h-4 w-4" />
            </span>
            <h2 className="font-display text-base font-bold text-navy">Learning Objectives</h2>
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

        {/* Learning materials + quiz — locked until enrolled */}
        {!enrollment && !isWorkspaceComplete ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-soft">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-marine/10 text-marine">
              <BookOpen className="h-6 w-6" />
            </span>
            <p className="mt-3 font-display text-base font-bold text-navy">
              Enrol to open the Master Module workspace
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Enrolment is free. You will access the same video, PDF handbook, PowerPoint, additional
              reading and quiz used inside the Full Training Program.
            </p>
            <button
              onClick={handleEnroll}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground hover:bg-marine/90"
            >
              Enrol now <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          lmsModule && app && moduleProgress && (
            <>
              {/* Progress */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-sm font-bold text-navy">Your progress</p>
                    <p className="text-xs text-muted-foreground">
                      {resourcesDone}/{RESOURCE_ORDER.length} steps done
                      {quizRec?.passed && ` · quiz best score ${quizRec.bestScore}%`}
                    </p>
                  </div>
                  {isWorkspaceComplete && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">
                      <Trophy className="h-3.5 w-3.5" /> Certificate available
                    </span>
                  )}
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-marine transition-all"
                    style={{
                      width: `${Math.round((resourcesDone / RESOURCE_ORDER.length) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Resources — same materials, same layout as Full Training */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="font-display text-base font-bold text-navy">Course Resources</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Identical materials to the Full Training Program — no duplicate content.
                </p>
                <div className="mt-4 space-y-2.5">
                  {RESOURCE_ORDER.map((kind) => {
                    const res = lmsModule.resources[kind];
                    const Icon = RESOURCE_ICONS[kind];
                    const isDone = moduleProgress[kind];
                    const bank = hasQuizBank(lmsModule.id);

                    if (kind === "quiz") {
                      const attempts = quizRec?.attempts.length ?? 0;
                      const meta = bank
                        ? `${res.meta} · pass mark ${QUIZ_PASS_PERCENT}%${
                            attempts ? ` · best ${quizRec?.bestScore ?? 0}%` : ""
                          }`
                        : `${res.meta} · uploading soon`;
                      return (
                        <div
                          key={kind}
                          className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                                quizRec?.passed
                                  ? "bg-badge-training/15 text-badge-training"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-navy">{res.title}</p>
                              <p className="text-[0.7rem] text-muted-foreground">{meta}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {quizRec?.passed && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-badge-training/10 px-2 py-1 text-[0.65rem] font-bold uppercase text-badge-training">
                                <CheckCircle2 className="h-3 w-3" /> Passed
                              </span>
                            )}
                            <button
                              onClick={() => setQuizOpen(true)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                                quizRec?.passed
                                  ? "border-marine bg-card text-marine hover:bg-marine hover:text-marine-foreground"
                                  : "border-marine bg-marine text-marine-foreground hover:bg-marine/90"
                              }`}
                            >
                              {!bank
                                ? "View quiz"
                                : quizRec?.passed
                                  ? "Review quiz"
                                  : attempts > 0
                                    ? "Continue quiz"
                                    : "Take quiz"}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={kind}
                        className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                              isDone ? "bg-marine/10 text-marine" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-navy">{res.title}</p>
                            <p className="text-[0.7rem] text-muted-foreground">{res.meta}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {res.url ? (
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-marine bg-card px-3 py-2 text-xs font-semibold text-marine hover:bg-marine hover:text-marine-foreground"
                            >
                              {kind === "pdf" ? "Open PDF" : "Open"}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                              Coming soon
                            </span>
                          )}
                          <button
                            onClick={() => toggleResource(kind)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                              isDone
                                ? "border-marine bg-marine text-marine-foreground"
                                : "border-marine bg-card text-marine hover:bg-marine hover:text-marine-foreground"
                            }`}
                          >
                            {isDone ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Done
                              </>
                            ) : (
                              "Mark done"
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={enrollment ? "/academy/learn" : "/academy/self-paced"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-navy hover:border-marine/40"
          >
            <ArrowLeft className="h-4 w-4" /> {enrollment ? "Kembali ke My Learning" : "All Self-Paced Courses"}
          </Link>
          {isWorkspaceComplete && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-4 py-2 text-sm font-bold text-success">
              <CheckCircle2 className="h-4 w-4" /> Master Module completed · Credit earned
            </span>
          )}
        </div>
      </div>

      {quizOpen && lmsModule && app && (
        <ModuleQuiz
          app={app}
          module={lmsModule}
          onClose={() => setQuizOpen(false)}
        />
      )}
    </AcademyShell>
  );
}

const RESOURCE_ICONS: Record<ResourceKind, typeof PlayCircle> = {
  video: PlayCircle,
  pdf: FileText,
  ppt: Presentation,
  reading: BookOpen,
  quiz: ListChecks,
};
const RESOURCE_ORDER: ResourceKind[] = ["video", "pdf", "ppt", "reading", "quiz"];

function StandaloneProgramDetail({ program }: { program: Program }) {
  return (
    <AcademyShell active="self-paced">
      <div className="space-y-6">
        <Link
          to="/academy/self-paced"
          className="inline-flex items-center gap-1 text-sm font-semibold text-marine hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Self-Paced Courses
        </Link>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="relative aspect-[21/9] w-full bg-muted">
            <img
              src={program.image}
              alt={program.title}
              className="h-full w-full object-cover"
              loading="eager"
              width={1600}
              height={686}
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
              <span className="rounded-full bg-marine/10 px-3 py-1 font-semibold text-marine">
                by {program.instructor}
              </span>
            </div>

            <div className="mt-6 rounded-xl border border-marine/20 bg-marine/5 p-4 text-sm text-navy">
              <p className="font-display font-bold">About this course</p>
              <p className="mt-1 text-muted-foreground">
                This standalone Self-Paced Course runs entirely online. Enrolments and progress are managed
                inside the BARUNA Academy learner dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AcademyShell>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DYNAMIC_QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "Under the 1982 United Nations Convention on the Law of the Sea (UNCLOS), what does 'EEZ' designate?",
    options: [
      "Exclusive Economic Zone (extending up to 200 nautical miles from baseline)",
      "Ecological Environmental Zone for conservation research only",
      "Eastern European Zone under bilateral shipping agreements",
      "Economic Enterprise Zone reserved solely for artisanal fishermen",
    ],
    correctAnswer: 0,
    explanation: "Under Article 57 of UNCLOS, the Exclusive Economic Zone (EEZ) may extend up to 200 nautical miles from the baseline.",
  },
  {
    id: 2,
    question: "Which acronym is globally recognized to describe illicit, unreported, or non-compliant fishing activities?",
    options: [
      "TAC (Total Allowable Catch)",
      "IUU Fishing (Illegal, Unreported, and Unregulated Fishing)",
      "VMS (Vessel Monitoring System)",
      "RFMO (Regional Fisheries Management Organization)",
    ],
    correctAnswer: 1,
    explanation: "IUU Fishing refers to illegal, unreported, and unregulated fishing that threatens marine biodiversity and sustainable yields.",
  },
  {
    id: 3,
    question: "In international fisheries agreements, what does 'MSY' stand for?",
    options: [
      "Maximum Sustainable Yield",
      "Maritime Security Yard",
      "Marine Science Yearbook",
      "Minimum Stock Yield",
    ],
    correctAnswer: 0,
    explanation: "Maximum Sustainable Yield (MSY) represents the largest average catch that can be continuously taken from a stock under existing environmental conditions.",
  },
  {
    id: 4,
    question: "According to UNCLOS, what is the maximum standard breadth of a coastal state's Territorial Sea?",
    options: [
      "3 Nautical Miles",
      "12 Nautical Miles",
      "24 Nautical Miles",
      "200 Nautical Miles",
    ],
    correctAnswer: 1,
    explanation: "Article 3 of UNCLOS establishes that every State has the right to establish the breadth of its territorial sea up to a limit not exceeding 12 nautical miles.",
  },
  {
    id: 5,
    question: "When presenting Indonesia's official stance in international bilateral maritime talks, which diplomatic phrasing is standard to register a formal reservation?",
    options: [
      "'Our delegation formally registers a reservation regarding Article 4.'",
      "'We do not care about Article 4, do whatever you want.'",
      "'Article 4 is canceled because we dislike it.'",
      "'Please ignore our laws during this negotiation.'",
    ],
    correctAnswer: 0,
    explanation: "Formal diplomatic communication requires respectful, structured legal phrasing such as 'registering a formal reservation'.",
  },
];

const DYNAMIC_SLIDES = [
  {
    title: "1. Maritime Terminology & Official Briefings",
    subtitle: "Overview of international maritime terminology in bilateral and multilateral forums.",
    bullets: [
      "UNCLOS 1982 terminology: Baseline, Internal Waters, Territorial Sea (12 NM), Contiguous Zone (24 NM), and Exclusive Economic Zone (200 NM).",
      "Sovereignty vs Sovereign Rights: Differentiating coastal state jurisdictions over marine resources.",
      "High Seas & The Area: Common heritage of mankind and international seabed authority.",
    ],
    badge: "Module Fundamentals",
  },
  {
    title: "2. Fisheries Governance & IUU Combat Framework",
    subtitle: "Language and protocols for countering Illegal, Unreported, and Unregulated Fishing.",
    bullets: [
      "PSMA (Port State Measures Agreement): Inspecting foreign flagged vessels and port denial protocols.",
      "VMS / AIS data sharing lexicon: Translating surveillance telemetry into legal diplomatic notices.",
      "Bycatch mitigation and CITES appendix classifications for endangered marine species.",
    ],
    badge: "Fisheries Governance",
  },
  {
    title: "3. Maximum Sustainable Yield & Quota Negotiations",
    subtitle: "Scientific and economic terminology in international fisheries commissions.",
    bullets: [
      "Translating MSY (Maximum Sustainable Yield) and TAC (Total Allowable Catch) into formal quota allocations.",
      "Scientific Committee communications: Presenting acoustic biomass surveys and CPUE (Catch Per Unit Effort).",
      "RFMO negotiations (WCPFC, IOTC, CCSBT): Drafting country positions on shared straddling stocks.",
    ],
    badge: "Scientific Diplomacy",
  },
  {
    title: "4. Official Diplomatic Correspondence & Demarches",
    subtitle: "Standard diplomatic phrasing for maritime incidents and bilateral communique.",
    bullets: [
      "Diplomatic Notes Verbales: Registering formal protests on unauthorized fishing vessel incursions.",
      "Bilateral MoUs: Standard drafting templates for fisheries cooperation, capacity building, and joint surveillance.",
      "Agreed Minutes & Declarations: Crafting legally sound closing statements in international workshops.",
    ],
    badge: "Diplomatic Drafting",
  },
  {
    title: "5. Practical Case Study: Bilateral Fisheries Summit",
    subtitle: "Role-play and evaluation scenario for ministerial delegations.",
    bullets: [
      "Scenario: Coastal patrol intercepting an unauthorized industrial longliner in the EEZ border region.",
      "Drafting immediate communique to the flag state requesting verification of fishing license and catch logbook.",
      "Oral briefing simulation to senior ministerial leadership and the international press corps.",
    ],
    badge: "Practical Simulation",
  },
];

function DynamicModuleWorkspace({ module }: { module: PublishedModuleDetail }) {
  const navigate = useNavigate();
  const { get, isCompleted } = useShortCourses();
  const enrollment = get(module.id);
  const done = isCompleted(module.id);
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});

  // LMS Tab State
  const [activeTab, setActiveTab] = useState<"video" | "pdf" | "ppt" | "quiz" | "certificate">("video");
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({
    video: false,
    pdf: false,
    ppt: false,
  });

  // Video State
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Slide State
  const [currentSlide, setCurrentSlide] = useState(0);

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const handleEnroll = () => {
    enrollShortCourse(module.id, {
      title: module.title,
      hours: module.hours,
      instructor: module.trainer.name,
      category: module.topic || "Fisheries Management",
    });
    barunaToast("Berhasil terdaftar! Modul kini aktif di Ruang Belajar Anda.");
  };

  const handleMarkComplete = () => {
    completeShortCourse(module.id, 100, "self-paced");
    barunaToast("Selamat! Anda telah menyelesaikan modul pembelajaran ini.");
  };

  const handleToggleStep = (step: "video" | "pdf" | "ppt") => {
    setCompletedSteps((prev) => {
      const next = { ...prev, [step]: !prev[step] };
      barunaToast(next[step] ? `Langkah ${step.toUpperCase()} selesai!` : `Status ${step.toUpperCase()} diubah.`);
      return next;
    });
  };

  const handleSubmitQuiz = () => {
    let correct = 0;
    DYNAMIC_QUIZ_QUESTIONS.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctAnswer) {
        correct++;
      }
    });

    const score = Math.round((correct / DYNAMIC_QUIZ_QUESTIONS.length) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);

    if (score >= module.passingScore) {
      completeShortCourse(module.id, score, "self-paced");
      setCompletedSteps((prev) => ({ ...prev, quiz: true }));
      barunaToast(`🎉 Selamat! Anda LULUS dengan nilai ${score}% (Passing Grade: ${module.passingScore}%). Sertifikat terbuka!`);
    } else {
      barunaToast(`Nilai Anda ${score}%. Belum memenuhi passing grade ${module.passingScore}%. Silakan coba lagi.`);
    }
  };

  const handleRetakeQuiz = () => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
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

  const toggleItemDone = (key: string) => {
    setCompletedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const topic = module.topic;
  const competency = module.competency;
  const passingScore = module.passingScore;
  const assessmentMethod = module.assessmentMethod;
  const coverDoc = module.documents.find(
    (d) =>
      d.type.toLowerCase().includes("cover") ||
      d.fileType?.includes("image") ||
      d.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/),
  );

  const pdfDoc = module.documents.find(
    (d) => d.fileType?.includes("pdf") || d.name.toLowerCase().endsWith(".pdf"),
  );
  const pptDoc = module.documents.find(
    (d) => d.fileType?.includes("presentation") || d.name.toLowerCase().match(/\.(ppt|pptx)$/),
  );
  const vidDoc = module.documents.find(
    (d) => d.fileType?.includes("video") || d.name.toLowerCase().match(/\.(mp4|webm|mov)$/),
  );

  const stepsDoneCount =
    (completedSteps.video ? 1 : 0) +
    (completedSteps.pdf ? 1 : 0) +
    (completedSteps.ppt ? 1 : 0) +
    (done || completedSteps.quiz ? 1 : 0);
  const totalSteps = 4;
  const progressPct = Math.round((stepsDoneCount / totalSteps) * 100);

  const aside = (
    <div className="space-y-5">
      {/* Module Overview Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[0.65rem] font-bold text-foreground/70">
            MOD-{module.id.slice(0, 8).toUpperCase()}
          </span>
          {done ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-success">
              <CheckCircle2 className="h-3 w-3" /> Selesai
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

        <h3 className="mt-3 font-display text-base font-bold text-navy">Progres Modul Mandiri</h3>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{stepsDoneCount} dari {totalSteps} Aktivitas Selesai</span>
            <span className="font-bold text-marine">{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-marine transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Step List in Sidebar */}
        <div className="mt-4 space-y-1.5 text-xs">
          <button
            onClick={() => setActiveTab("video")}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
              activeTab === "video" ? "bg-marine/10 font-bold text-marine" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Video className="h-3.5 w-3.5" /> 1. Video Materi
            </span>
            {completedSteps.video ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Belum</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("pdf")}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
              activeTab === "pdf" ? "bg-marine/10 font-bold text-marine" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> 2. Modul PDF
            </span>
            {completedSteps.pdf ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Belum</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("ppt")}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
              activeTab === "ppt" ? "bg-marine/10 font-bold text-marine" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Presentation className="h-3.5 w-3.5" /> 3. Slide PPT
            </span>
            {completedSteps.ppt ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Belum</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("quiz")}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
              activeTab === "quiz" ? "bg-marine/10 font-bold text-marine" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5" /> 4. Kuis Kelulusan
            </span>
            {done || completedSteps.quiz ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Min {passingScore}%</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("certificate")}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
              activeTab === "certificate" ? "bg-amber-500/10 font-bold text-amber-700 dark:text-amber-400" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Award className="h-3.5 w-3.5" /> 5. Sertifikat
            </span>
            {done ? (
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Terkunci</span>
            )}
          </button>
        </div>

        <h3 className="mt-5 font-display text-sm font-bold text-navy">Informasi Modul</h3>
        <ul className="mt-2.5 space-y-2 text-xs">
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Durasi Belajar</span>
            <span className="font-semibold text-navy">{module.hours} Jam (JP)</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Format</span>
            <span className="font-semibold text-navy">Self-Paced (Mandiri)</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Bahasa Pengantar</span>
            <span className="font-semibold text-navy">{module.language}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Passing Grade</span>
            <span className="font-semibold text-navy">{passingScore}%</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Sertifikat</span>
            <span className="font-semibold text-navy">Certificate of Completion</span>
          </li>
        </ul>

        {!enrollment && !done ? (
          <button
            onClick={handleEnroll}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-marine py-2.5 text-sm font-semibold text-marine-foreground shadow-sm transition hover:bg-marine/90"
          >
            Daftar Pelatihan Sekarang (Gratis) <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="mt-5 space-y-2.5">
            {done ? (
              <div className="rounded-xl border border-success/40 bg-success/5 p-3 text-xs text-success">
                <p className="flex items-center gap-1.5 font-bold">
                  <Award className="h-4 w-4" /> Modul Telah Selesai
                </p>
                <p className="mt-1 text-success/80">
                  Selamat! Anda telah menuntaskan seluruh materi modul ini. Rekam kelulusan tersimpan di ruang belajar Anda.
                </p>
                <button
                  onClick={handleDownloadCertificate}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  <Download className="h-3.5 w-3.5" /> Unduh Sertifikat (PDF)
                </button>
              </div>
            ) : (
              <button
                onClick={handleMarkComplete}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-marine bg-marine/10 py-2.5 text-xs font-bold text-marine transition hover:bg-marine hover:text-white"
              >
                <CheckCircle2 className="h-4 w-4" /> Tandai Selesai &amp; Rekam Kredit
              </button>
            )}
            <Link
              to="/academy/learn"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 py-2 text-xs font-semibold text-foreground/80 hover:bg-muted"
            >
              Buka Ruang Belajar Saya <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Trainer Profile Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
          Instruktur &amp; Pengampu
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

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-marine">
            <Award className="h-3.5 w-3.5" /> BARUNA Verified Trainer
          </span>
          {module.trainer.slug && (
            <Link
              to="/experts/$slug"
              params={{ slug: module.trainer.slug }}
              className="inline-flex items-center gap-1 font-semibold text-marine hover:underline"
            >
              Profil Pakar <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <AcademyShell active={enrollment ? "my-learning" : "self-paced"} aside={aside}>
      <Toaster />
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          {enrollment ? (
            <>
              <Link to="/academy/learn" className="font-medium text-foreground/70 hover:text-marine">
                My Learning
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-navy truncate max-w-xs">{module.title}</span>
            </>
          ) : (
            <>
              <Link to="/academy/self-paced" className="font-medium text-foreground/70 hover:text-marine">
                Self-Paced Courses
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-navy truncate max-w-xs">{module.title}</span>
            </>
          )}
        </nav>

        {/* Verification banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-marine/30 bg-marine/5 px-4 py-2.5 text-xs text-marine">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 shrink-0 text-marine" />
            <span>
              {enrollment
                ? `Ruang Belajar LMS Mandiri: ${module.title} — Disusun oleh ${module.trainer.name}.`
                : "MODUL AJAR TERVERIFIKASI — Modul pelatihan ini disusun oleh Trainer BARUNA tersertifikasi dan telah lolos evaluasi kurikulum serta penjaminan mutu."}
            </span>
          </div>
          {enrollment && (
            <Link to="/academy/learn" className="font-semibold hover:underline text-navy shrink-0">
              ← Kembali ke My Learning
            </Link>
          )}
        </div>

        {/* Course Cover Banner if uploaded */}
        {coverDoc?.downloadUrl && (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-900 shadow-soft max-h-64">
            <img
              src={coverDoc.downloadUrl}
              alt={module.title}
              className="w-full h-full max-h-64 object-cover object-center"
            />
          </div>
        )}

        {/* Hero */}
        {/* Hero Header */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-marine/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
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
              <span className="inline-flex items-center gap-1 rounded-md bg-marine/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
                <Sparkles className="h-3 w-3" /> Sedang Dipelajari
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
            {topic && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground/80">
                <Layers className="h-3.5 w-3.5 text-marine" /> {topic}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground/80">
              <User className="h-3.5 w-3.5 text-marine" /> {module.trainer.name}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-foreground/80">
              <FileText className="h-3.5 w-3.5 text-marine" /> {module.language}
            </span>
          </div>
        </div>

        {/* 5-TAB INTERACTIVE LMS PLAYER NAVIGATION */}
        <div className="rounded-2xl border border-border bg-card p-2 shadow-soft">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            <button
              onClick={() => setActiveTab("video")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                activeTab === "video"
                  ? "bg-marine text-white shadow-xs"
                  : "bg-muted/40 text-foreground/80 hover:bg-muted"
              }`}
            >
              <Video className="h-4 w-4 shrink-0" />
              <span>1. Video Materi</span>
              {completedSteps.video && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 ml-1" />}
            </button>

            <button
              onClick={() => setActiveTab("pdf")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                activeTab === "pdf"
                  ? "bg-marine text-white shadow-xs"
                  : "bg-muted/40 text-foreground/80 hover:bg-muted"
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>2. Modul PDF</span>
              {completedSteps.pdf && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 ml-1" />}
            </button>

            <button
              onClick={() => setActiveTab("ppt")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                activeTab === "ppt"
                  ? "bg-marine text-white shadow-xs"
                  : "bg-muted/40 text-foreground/80 hover:bg-muted"
              }`}
            >
              <Presentation className="h-4 w-4 shrink-0" />
              <span>3. Slide PPT</span>
              {completedSteps.ppt && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 ml-1" />}
            </button>

            <button
              onClick={() => setActiveTab("quiz")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                activeTab === "quiz"
                  ? "bg-marine text-white shadow-xs"
                  : "bg-muted/40 text-foreground/80 hover:bg-muted"
              }`}
            >
              <ListChecks className="h-4 w-4 shrink-0" />
              <span>4. Kuis Kelulusan</span>
              {(done || completedSteps.quiz) && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 ml-1" />}
            </button>

            <button
              onClick={() => setActiveTab("certificate")}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all col-span-2 sm:col-span-1 ${
                activeTab === "certificate"
                  ? "bg-amber-600 text-white shadow-xs"
                  : done
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                  : "bg-muted/40 text-foreground/60 hover:bg-muted"
              }`}
            >
              <Award className="h-4 w-4 shrink-0" />
              <span>5. Sertifikat</span>
              {done && <Trophy className="h-3.5 w-3.5 text-amber-300 shrink-0 ml-1" />}
            </button>
          </div>
        </div>

        {/* TAB 1: VIDEO PEMBELAJARAN */}
        {activeTab === "video" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="rounded-md bg-marine/10 px-2 py-0.5 text-[10px] font-bold text-marine uppercase tracking-wider">
                  Materi Video Pembelajaran Interaktif
                </span>
                <h2 className="mt-1 font-display text-lg font-bold text-navy">
                  Sesi Kuliah &amp; Pengenalan Modul oleh Instruktur
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Pemateri: {module.trainer.name} ({module.trainer.institution || "Kementerian Kelautan dan Perikanan"})
                </p>
              </div>

              <button
                onClick={() => handleToggleStep("video")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  completedSteps.video
                    ? "bg-success/15 text-success border border-success/30"
                    : "bg-marine text-white hover:bg-marine/90 shadow-xs"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {completedSteps.video ? "Sudah Ditonton (Selesai)" : "Tandai Telah Menonton Video"}
              </button>
            </div>

            {/* Video Player Display */}
            {vidDoc?.downloadUrl ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-soft">
                <video
                  src={vidDoc.downloadUrl}
                  controls
                  className="w-full aspect-video max-h-[480px] mx-auto"
                />
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 via-navy to-slate-950 p-6 sm:p-10 text-white shadow-xl">
                <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
                  <div className="relative">
                    <button
                      onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                      className="grid h-20 w-20 place-items-center rounded-full bg-marine text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
                    >
                      {isVideoPlaying ? (
                        <span className="h-6 w-6 font-mono text-xl font-bold">❚❚</span>
                      ) : (
                        <Play className="h-8 w-8 ml-1" />
                      )}
                    </button>
                    {isVideoPlaying && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display text-lg sm:text-xl font-bold">
                      {module.title} — Lecture Session 01
                    </h3>
                    <p className="mt-1 text-xs text-slate-300 max-w-lg mx-auto">
                      {isVideoPlaying
                        ? "Memutar audio/video simulasi: Pengenalan struktur komunikasi maritim internasional dan protokol negosiasi perikanan."
                        : "Klik tombol putar untuk memulai video pembelajaran interaktif materi ini."}
                    </p>
                  </div>

                  {/* Video Control Bar Simulation */}
                  <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur rounded-xl p-3 border border-slate-700">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5 font-mono">
                      <span>{isVideoPlaying ? "04:28" : "00:00"}</span>
                      <span className="text-marine font-semibold">1080p HD · 60fps</span>
                      <span>18:45</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden cursor-pointer">
                      <div
                        className="h-full bg-marine transition-all"
                        style={{ width: isVideoPlaying ? "24%" : "0%" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Video Chapter Outline */}
            <div className="rounded-xl border border-border bg-background p-4 space-y-3">
              <h4 className="font-display text-xs font-bold text-navy uppercase tracking-wider">
                Silabus &amp; Bab Pembahasan Video
              </h4>
              <div className="grid gap-2.5 sm:grid-cols-3 text-xs">
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="font-bold text-marine">Bab 1 · 00:00 - 05:20</span>
                  <p className="mt-1 font-semibold text-navy">Overview &amp; Baseline Terminology</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Prinsip hukum laut internasional UNCLOS 1982 dan batas yurisdiksi.</p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="font-bold text-marine">Bab 2 · 05:20 - 12:15</span>
                  <p className="mt-1 font-semibold text-navy">Fisheries Lexicon &amp; IUU Framework</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Terminologi penegakan hukum IUU fishing, kuota tangkap MSY dan TAC.</p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="font-bold text-marine">Bab 3 · 12:15 - 18:45</span>
                  <p className="mt-1 font-semibold text-navy">Bilateral Diplomacy Simulation</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Simulasi penyusunan nota diplomatik dan negosiasi batas zona perikanan.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setCompletedSteps((prev) => ({ ...prev, video: true }));
                  setActiveTab("pdf");
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-bold text-white hover:bg-navy/90 shadow-sm"
              >
                Lanjut ke Modul PDF <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: DOKUMEN MODUL PDF */}
        {activeTab === "pdf" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="rounded-md bg-marine/10 px-2 py-0.5 text-[10px] font-bold text-marine uppercase tracking-wider">
                  Bahan Ajar &amp; Buku Panduan (Handbook)
                </span>
                <h2 className="mt-1 font-display text-lg font-bold text-navy">
                  Dokumen Modul Lengkap (Facilitator &amp; Participant Handbook)
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Bacaan komprehensif yang diunggah langsung oleh instruktur untuk modul ini.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {pdfDoc?.downloadUrl && (
                  <a
                    href={pdfDoc.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-marine bg-marine/10 px-4 py-2 text-xs font-bold text-marine hover:bg-marine hover:text-white transition-colors"
                  >
                    <Download className="h-4 w-4" /> Unduh PDF
                  </a>
                )}
                <button
                  onClick={() => handleToggleStep("pdf")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    completedSteps.pdf
                      ? "bg-success/15 text-success border border-success/30"
                      : "bg-marine text-white hover:bg-marine/90 shadow-xs"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {completedSteps.pdf ? "Sudah Dibaca (Selesai)" : "Tandai Telah Membaca Modul"}
                </button>
              </div>
            </div>

            {/* Embedded PDF Simulation / Viewer Card */}
            <div className="rounded-2xl border border-border bg-background p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between border-b border-border pb-4 gap-2">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marine/15 text-marine">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-bold text-navy">
                      {pdfDoc?.name || "Comprehensive Facilitator Handbook - English for Marine & Fisheries.pdf"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {pdfDoc?.size ? formatBytes(pdfDoc.size) : "2.4 MB"} · PDF Dokumen Terverifikasi BARUNA
                    </p>
                  </div>
                </div>

                {pdfDoc?.downloadUrl && (
                  <a
                    href={pdfDoc.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-marine hover:underline"
                  >
                    Buka di Tab Baru <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Reader Document Mockup */}
              <div className="rounded-xl border border-border/70 bg-card p-6 sm:p-8 space-y-4 font-serif text-foreground/90 leading-relaxed text-sm shadow-inner max-h-[500px] overflow-y-auto">
                <div className="text-center border-b border-border pb-4 font-sans">
                  <span className="rounded-full bg-marine/10 px-3 py-1 text-[10px] font-bold text-marine uppercase tracking-wider">
                    BARUNA ACADEMY · OFFICIAL HANDBOOK
                  </span>
                  <h4 className="mt-2 font-display text-lg sm:text-xl font-extrabold text-navy">
                    {module.title}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Instruktur: {module.trainer.name} · Kementerian Kelautan dan Perikanan
                  </p>
                </div>

                <div className="space-y-3 font-sans text-xs">
                  <h5 className="font-bold text-navy uppercase text-[11px] tracking-wide">
                    Ringkasan Modul &amp; Cakupan Kurikulum
                  </h5>
                  <p className="text-muted-foreground leading-relaxed">
                    {module.summary}
                  </p>
                </div>

                {module.learningObjectives && module.learningObjectives.length > 0 && (
                  <div className="space-y-2 font-sans text-xs pt-2">
                    <h5 className="font-bold text-navy uppercase text-[11px] tracking-wide">
                      Target Kompetensi Pembelajaran
                    </h5>
                    <ul className="space-y-1.5 pl-4 list-disc text-muted-foreground">
                      {module.learningObjectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2 font-sans text-xs pt-2 border-t border-border">
                  <h5 className="font-bold text-navy uppercase text-[11px] tracking-wide">
                    Struktur Bab &amp; Bahan Bacaan
                  </h5>
                  <div className="space-y-2 text-muted-foreground">
                    <p><strong>Bab I: Kerangka Hukum Laut Internasional (UNCLOS 1982)</strong> — Membahas terminologi resmi wilayah perairan, Zona Ekonomi Eksklusif (ZEE 200 mil laut), dan batas landas kontinen.</p>
                    <p><strong>Bab II: Terminologi Pengelolaan Sumber Daya Perikanan</strong> — Definisi teknis Maximum Sustainable Yield (MSY), Total Allowable Catch (TAC), dan kuota penangkapan terukur.</p>
                    <p><strong>Bab III: Protokol Komunikasi Pemberantasan IUU Fishing</strong> — Kosakata diplomasi maritim, mekanisme Port State Measures Agreement (PSMA), dan pelaporan lintas batas.</p>
                    <p><strong>Bab IV: Format Korespondensi Diplomatik &amp; Nota Verbal</strong> — Panduan penyusunan communique resmi delegasi perikanan Republik Indonesia di forum internasional.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setActiveTab("video")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-navy hover:bg-muted"
              >
                ← Kembali ke Video
              </button>
              <button
                onClick={() => {
                  setCompletedSteps((prev) => ({ ...prev, pdf: true }));
                  setActiveTab("ppt");
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-bold text-white hover:bg-navy/90 shadow-sm"
              >
                Lanjut ke Slide PPT <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: SLIDE PRESENTASI PPT */}
        {activeTab === "ppt" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="rounded-md bg-marine/10 px-2 py-0.5 text-[10px] font-bold text-marine uppercase tracking-wider">
                  Slide Presentasi Interaktif
                </span>
                <h2 className="mt-1 font-display text-lg font-bold text-navy">
                  Slide Paparan Materi Kuliah (Presentation Deck)
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Gunakan tombol panah untuk menelusuri slide paparan materi.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {pptDoc?.downloadUrl && (
                  <a
                    href={pptDoc.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-marine bg-marine/10 px-4 py-2 text-xs font-bold text-marine hover:bg-marine hover:text-white transition-colors"
                  >
                    <Download className="h-4 w-4" /> Unduh PPTX
                  </a>
                )}
                <button
                  onClick={() => handleToggleStep("ppt")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    completedSteps.ppt
                      ? "bg-success/15 text-success border border-success/30"
                      : "bg-marine text-white hover:bg-marine/90 shadow-xs"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {completedSteps.ppt ? "Sudah Dipelajari (Selesai)" : "Tandai Telah Mempelajari Slide"}
                </button>
              </div>
            </div>

            {/* Interactive Slide Viewer Canvas */}
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-navy via-slate-900 to-slate-950 p-6 sm:p-10 text-white shadow-xl min-h-[360px] flex flex-col justify-between">
              {/* Slide Top Bar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="rounded-md bg-marine/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-marine-light">
                  {DYNAMIC_SLIDES[currentSlide].badge}
                </span>
                <span className="font-mono text-xs text-slate-300">
                  Slide {currentSlide + 1} dari {DYNAMIC_SLIDES.length}
                </span>
              </div>

              {/* Slide Body */}
              <div className="my-6 space-y-4">
                <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                  {DYNAMIC_SLIDES[currentSlide].title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  {DYNAMIC_SLIDES[currentSlide].subtitle}
                </p>

                <div className="space-y-3 pt-2">
                  {DYNAMIC_SLIDES[currentSlide].bullets.map((bullet, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-200">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-marine text-white text-[10px] font-bold mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slide Bottom Bar & Navigation */}
              <div className="flex flex-wrap items-center justify-between border-t border-white/10 pt-4 gap-3">
                <div className="text-[11px] text-slate-400">
                  BARUNA ACADEMY · Instruktur: {module.trainer.name}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={currentSlide === 0}
                    onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="h-4 w-4" /> Sebelumnya
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {DYNAMIC_SLIDES.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentSlide(i)}
                        className={`h-2 rounded-full transition-all ${
                          currentSlide === i ? "w-6 bg-marine" : "w-2 bg-white/30 hover:bg-white/50"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    disabled={currentSlide === DYNAMIC_SLIDES.length - 1}
                    onClick={() => setCurrentSlide((prev) => Math.min(DYNAMIC_SLIDES.length - 1, prev + 1))}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    Selanjutnya <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setActiveTab("pdf")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-navy hover:bg-muted"
              >
                ← Kembali ke Modul PDF
              </button>
              <button
                onClick={() => {
                  setCompletedSteps((prev) => ({ ...prev, ppt: true }));
                  setActiveTab("quiz");
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-bold text-white hover:bg-navy/90 shadow-sm"
              >
                Lanjut ke Kuis Evaluasi <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: KUIS KELULUSAN & EVALUASI */}
        {activeTab === "quiz" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="rounded-md bg-marine/10 px-2 py-0.5 text-[10px] font-bold text-marine uppercase tracking-wider">
                  Evaluasi Mandiri &amp; Kuis Kelulusan
                </span>
                <h2 className="mt-1 font-display text-lg font-bold text-navy">
                  Kuis Pemahaman Modul: {module.title}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Passing Grade: <strong className="text-navy">{passingScore}%</strong> · {DYNAMIC_QUIZ_QUESTIONS.length} Soal Pilihan Ganda
                </p>
              </div>

              {quizSubmitted && (
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                      (quizScore ?? 0) >= passingScore
                        ? "bg-success/15 text-success border border-success/30"
                        : "bg-destructive/15 text-destructive border border-destructive/30"
                    }`}
                  >
                    Skor: {quizScore}% ({(quizScore ?? 0) >= passingScore ? "LULUS" : "BELUM LULUS"})
                  </span>
                  <button
                    onClick={handleRetakeQuiz}
                    className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    <RotateCcw className="h-3 w-3" /> Ulangi Kuis
                  </button>
                </div>
              )}
            </div>

            {/* Quiz Result Celebration Banner if passed */}
            {quizSubmitted && (quizScore ?? 0) >= passingScore && (
              <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-5 shadow-soft">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                      <Trophy className="h-6 w-6" />
                    </span>
                    <div>
                      <h4 className="font-display text-base font-bold text-emerald-950 dark:text-emerald-100">
                        🎉 Selamat! Anda LULUS Evaluasi Modul ({quizScore}%)
                      </h4>
                      <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80">
                        Nilai Anda telah melampaui passing grade ({passingScore}%). Rekam kelulusan tersimpan otomatis dan sertifikat Anda kini telah diterbitkan!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("certificate")}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                  >
                    <Award className="h-4 w-4" /> Buka &amp; Unduh Sertifikat
                  </button>
                </div>
              </div>
            )}

            {/* Quiz Questions Form */}
            <div className="space-y-6">
              {DYNAMIC_QUIZ_QUESTIONS.map((q, qIdx) => {
                const selectedOpt = quizAnswers[qIdx];
                const isCorrect = selectedOpt === q.correctAnswer;

                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border p-5 transition-colors ${
                      quizSubmitted
                        ? isCorrect
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-destructive/40 bg-destructive/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-display text-sm font-bold text-navy flex items-start gap-2">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-marine/15 text-xs text-marine">
                          {qIdx + 1}
                        </span>
                        <span className="mt-0.5">{q.question}</span>
                      </h4>

                      {quizSubmitted && (
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            isCorrect ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {isCorrect ? <CheckCircle2 className="h-3 w-3" /> : "✕"}
                          {isCorrect ? "Benar" : "Salah"}
                        </span>
                      )}
                    </div>

                    {/* Options */}
                    <div className="mt-4 space-y-2">
                      {q.options.map((opt, optIdx) => {
                        const isChosen = selectedOpt === optIdx;
                        const isRightAnswer = q.correctAnswer === optIdx;

                        return (
                          <label
                            key={optIdx}
                            className={`flex items-start gap-3 rounded-xl border p-3 text-xs cursor-pointer transition-all ${
                              quizSubmitted
                                ? isRightAnswer
                                  ? "border-emerald-500 bg-emerald-500/15 font-semibold text-emerald-950 dark:text-emerald-100"
                                  : isChosen
                                  ? "border-destructive bg-destructive/15 text-destructive font-medium"
                                  : "border-border/60 opacity-60"
                                : isChosen
                                ? "border-marine bg-marine/10 font-semibold text-navy shadow-xs"
                                : "border-border bg-card hover:border-marine/40 text-foreground/80"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${qIdx}`}
                              checked={isChosen}
                              disabled={quizSubmitted}
                              onChange={() =>
                                setQuizAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))
                              }
                              className="mt-0.5 h-3.5 w-3.5 text-marine focus:ring-marine"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <div className="mt-3 rounded-lg bg-muted/60 p-2.5 text-[11px] text-muted-foreground">
                        <strong className="text-foreground">Penjelasan:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quiz Submit Bar */}
            {!quizSubmitted ? (
              <div className="flex flex-wrap items-center justify-between border-t border-border pt-4 gap-3">
                <p className="text-xs text-muted-foreground">
                  Terjawab: <strong>{Object.keys(quizAnswers).length}</strong> dari {DYNAMIC_QUIZ_QUESTIONS.length} pertanyaan
                </p>
                <button
                  onClick={handleSubmitQuiz}
                  disabled={Object.keys(quizAnswers).length < DYNAMIC_QUIZ_QUESTIONS.length}
                  className="inline-flex items-center gap-2 rounded-xl bg-marine px-6 py-2.5 text-xs font-bold text-white hover:bg-marine/90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <CheckCircle2 className="h-4 w-4" /> Kirim Jawaban Kuis
                </button>
              </div>
            ) : (
              <div className="flex justify-between items-center border-t border-border pt-4">
                <button
                  onClick={() => setActiveTab("ppt")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-navy hover:bg-muted"
                >
                  ← Kembali ke Slide PPT
                </button>
                <button
                  onClick={() => setActiveTab("certificate")}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                >
                  Lihat Sertifikat Kelulusan <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SERTIFIKAT KELULUSAN */}
        {activeTab === "certificate" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-6">
            <div>
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                E-Certificate of Completion
              </span>
              <h2 className="mt-1 font-display text-lg font-bold text-navy">
                Sertifikat Kelulusan Resmi BARUNA Academy
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sertifikat diterbitkan setelah menuntaskan materi dan evaluasi kuis kelulusan.
              </p>
            </div>

            {done || (quizScore ?? 0) >= passingScore ? (
              <div className="space-y-6">
                {/* Certificate Card Preview */}
                <div className="relative overflow-hidden rounded-2xl border-4 border-amber-500/30 bg-gradient-to-b from-card via-amber-500/5 to-card p-8 sm:p-12 text-center shadow-lg">
                  <div className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Resmi Terverifikasi
                  </div>

                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 shadow-sm">
                    <GraduationCap className="h-8 w-8" />
                  </div>

                  <p className="mt-4 font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    KEMENTERIAN KELAUTAN DAN PERIKANAN REPUBLIK INDONESIA
                  </p>
                  <h3 className="mt-1 font-display text-xl sm:text-2xl font-black text-navy uppercase tracking-wider">
                    CERTIFICATE OF COMPLETION
                  </h3>

                  <p className="mt-4 text-xs text-muted-foreground">Diberikan dengan bangga kepada:</p>
                  <p className="mt-1 font-display text-lg sm:text-xl font-extrabold text-navy">
                    Peserta BARUNA
                  </p>

                  <p className="mx-auto mt-4 max-w-lg text-xs leading-relaxed text-foreground/85">
                    Atas keberhasilannya menyelesaikan seluruh rangkaian pembelajaran mandiri dan evaluasi kelulusan pada modul pelatihan:
                  </p>
                  <p className="mt-2 font-display text-base font-bold text-marine max-w-xl mx-auto">
                    &ldquo;{module.title}&rdquo;
                  </p>

                  <div className="mx-auto mt-6 flex max-w-md flex-wrap items-center justify-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground">Instruktur Pengampu</span>
                      <strong className="text-navy">{module.trainer.name}</strong>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground">Nilai Kelulusan</span>
                      <strong className="text-emerald-600">{quizScore ?? 100}% (Lulus)</strong>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground">Beban Belajar</span>
                      <strong className="text-navy">{module.hours} Jam Pelatihan</strong>
                    </div>
                  </div>

                  <p className="mt-5 font-mono text-[10px] text-muted-foreground">
                    Nomor Sertifikat: BARUNA-MOD-{module.id.slice(0, 8).toUpperCase()}-2026
                  </p>
                </div>

                {/* Download Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={handleDownloadCertificate}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition hover:scale-102"
                  >
                    <Download className="h-4 w-4" /> Unduh Sertifikat Resmi (PDF)
                  </button>
                  <Link
                    to="/academy/learn"
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-navy hover:bg-muted"
                  >
                    Kembali ke My Learning <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-8 sm:p-12 text-center space-y-4">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <Award className="h-8 w-8" />
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-navy">
                    Sertifikat Masih Terkunci
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground leading-relaxed">
                    Untuk membuka dan mengunduh sertifikat kelulusan resmi, Anda harus menyelesaikan pembelajaran modul dan lulus Kuis Evaluasi dengan nilai minimal <strong>{passingScore}%</strong>.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("quiz")}
                  className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-xs font-bold text-white hover:bg-marine/90 shadow-sm"
                >
                  <ListChecks className="h-4 w-4" /> Buka Kuis Evaluasi Sekarang
                </button>
              </div>
            )}
          </div>
        )}

        {/* Learning Objectives */}
        {module.learningObjectives && module.learningObjectives.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-marine/10 text-marine">
                <Target className="h-4 w-4" />
              </span>
              <h2 className="font-display text-base font-bold text-navy">Tujuan Pembelajaran</h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {module.learningObjectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
                  <span className="text-foreground/85 leading-relaxed">{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Target Participants & Outcomes */}
        {(module.targetParticipants || module.competencyOutcomes || competency) && (
          <div className="grid gap-5 md:grid-cols-2">
            {module.targetParticipants && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="font-display text-sm font-bold text-navy flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-marine" /> Target Profil Peserta
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {module.targetParticipants}
                </p>
              </div>
            )}
            {(module.competencyOutcomes || competency) && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="font-display text-sm font-bold text-navy flex items-center gap-2">
                  <Award className="h-4 w-4 text-marine" /> Capaian Kompetensi
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {module.competencyOutcomes || competency}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Handouts & Materials */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-navy">Materi &amp; Berkas Pembelajaran</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Unduh slide materi, dokumen panduan, dan instrumen pelatihan yang disediakan oleh Trainer.
              </p>
            </div>
            <span className="rounded-full bg-marine/10 px-3 py-1 text-xs font-bold text-marine">
              {module.documents.length} Berkas Tersedia
            </span>
          </div>

          {module.documents.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
              Materi modul sedang dalam persiapan sinkronisasi berkas oleh instruktur.
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {module.documents.map((doc, idx) => {
                const isPdf = doc.fileType?.includes("pdf") || doc.name.toLowerCase().endsWith(".pdf");
                const isPpt = doc.fileType?.includes("presentation") || doc.name.toLowerCase().match(/\.(ppt|pptx)$/);
                const isVid = doc.fileType?.includes("video") || doc.name.toLowerCase().match(/\.(mp4|webm|mov)$/);
                const isImg = doc.fileType?.includes("image") || doc.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/);
                const Icon = isPdf ? FileText : isPpt ? Presentation : isVid ? PlayCircle : isImg ? ImageIcon : BookOpen;
                const isItemDone = completedItems[String(idx)];

                return (
                  <div
                    key={idx}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:border-marine/30"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy truncate">{doc.name}</p>
                        <p className="text-[0.7rem] text-muted-foreground">
                          {doc.type} {doc.size > 0 && `· ${formatBytes(doc.size)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {doc.downloadUrl ? (
                        <a
                          href={doc.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-marine bg-card px-3 py-1.5 text-xs font-semibold text-marine hover:bg-marine hover:text-marine-foreground transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {isPdf ? "Buka PDF" : "Unduh Berkas"}
                          {isPdf ? "Buka PDF" : isVid ? "Tonton Video" : isImg ? "Buka Gambar" : "Unduh Berkas"}
                        </a>
                      ) : (
                        <span className="rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                          Tersedia di Portal
                        </span>
                      )}

                      {enrollment && (
                        <button
                          onClick={() => toggleItemDone(String(idx))}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            isItemDone
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-border bg-card text-muted-foreground hover:border-marine/40 hover:text-marine"
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isItemDone ? "Selesai" : "Tandai"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Assessment Section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-marine/10 text-marine">
              <ListChecks className="h-4 w-4" />
            </span>
            <h2 className="font-display text-base font-bold text-navy">Evaluasi &amp; Penilaian Kelulusan</h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-4">
              <span className="text-[0.7rem] uppercase tracking-wider font-bold text-muted-foreground">
                Metode Penilaian
              </span>
              <p className="mt-1 text-sm font-semibold text-navy">{assessmentMethod}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <span className="text-[0.7rem] uppercase tracking-wider font-bold text-muted-foreground">
                Standar Kelulusan Minimum
              </span>
              <p className="mt-1 text-sm font-semibold text-navy">{passingScore}% Nilai Kelulusan</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Menyelesaikan seluruh materi modul dan evaluasi akan otomatis mencatatkan kelulusan Anda serta mengaktifkan sertifikat di profil pembelajar Anda.
          </p>
        </div>

        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            to={enrollment ? "/academy/learn" : "/academy/self-paced"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-navy hover:border-marine/40"
          >
            <ArrowLeft className="h-4 w-4" /> {enrollment ? "Kembali ke Ruang Belajar (My Learning)" : "Semua Kursus Mandiri"}
          </Link>
          <Link
            to="/academy/programs"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-navy hover:border-marine/40"
          >
            Katalog Program <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </AcademyShell>
  );
}

