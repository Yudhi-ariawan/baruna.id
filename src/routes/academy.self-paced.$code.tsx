import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
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
  Image as ImageIcon,
  Layers,
  ListChecks,
  PlayCircle,
  Presentation,
  Sparkles,
  Target,
  Trophy,
  User,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { ModuleQuiz } from "@/components/baruna/academy/ModuleQuiz";
import { Toaster } from "@/components/baruna/Toaster";
import { masterByCode, MINUTES_PER_JP } from "@/data/masterModules";
import { LMS_MODULES, type LmsModule, type ResourceKind } from "@/data/lms";
import { hasQuizBank, QUIZ_PASS_PERCENT } from "@/data/quizzes";
import { instructorBySlug } from "@/data/instructors";
import { programs, type Program } from "@/data/programs";
import {
  useApplication,
  getLms,
  getQuizRecord,
  isModuleCompleteInApp,
  updateLms,
  getOrCreateSelfPacedApp,
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
    const publishedModule = await getPublishedModuleDetail({ data: { moduleId: params.code } });
    if (publishedModule) {
      return { kind: "dynamic", module: publishedModule };
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
    <AcademyShell active="self-paced" aside={aside}>
      <Toaster />
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/self-paced" className="font-medium text-foreground/70 hover:text-marine">
            Self-Paced Courses
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">{master.code}</span>
        </nav>

        {/* Context banner — same page, different pathway */}
        <div className="flex items-center gap-2 rounded-xl border border-marine/30 bg-marine/5 px-4 py-2 text-xs font-semibold text-marine">
          <Sparkles className="h-3.5 w-3.5" />
          SELF-PACED COURSE — you are accessing the same Master Module page used inside the Full
          Training Program.
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
            to="/academy/self-paced"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-navy hover:border-marine/40"
          >
            <ArrowLeft className="h-4 w-4" /> All Self-Paced Courses
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

function DynamicModuleWorkspace({ module }: { module: PublishedModuleDetail }) {
  const { get, isCompleted } = useShortCourses();
  const enrollment = get(module.id);
  const done = isCompleted(module.id);
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});

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

        <h3 className="mt-3 font-display text-base font-bold text-navy">Informasi Modul</h3>
        <ul className="mt-3 space-y-2.5 text-sm">
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
    <AcademyShell active="self-paced" aside={aside}>
      <Toaster />
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/self-paced" className="font-medium text-foreground/70 hover:text-marine">
            Self-Paced Courses
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy truncate max-w-xs">{module.title}</span>
        </nav>

        {/* Verification banner */}
        <div className="flex items-center gap-2 rounded-xl border border-marine/30 bg-marine/5 px-4 py-2 text-xs font-semibold text-marine">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>
            MODUL AJAR TERVERIFIKASI — Modul pelatihan ini disusun oleh Trainer BARUNA tersertifikasi dan telah lolos evaluasi kurikulum serta penjaminan mutu.
          </span>
        </div>

        {/* Course Cover Banner if uploaded */}
        {coverDoc?.downloadUrl && (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-900 shadow-soft max-h-72">
            <img
              src={coverDoc.downloadUrl}
              alt={module.title}
              className="w-full h-full max-h-72 object-cover object-center"
            />
          </div>
        )}

        {/* Hero */}
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
            to="/academy/self-paced"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-navy hover:border-marine/40"
          >
            <ArrowLeft className="h-4 w-4" /> Semua Kursus Mandiri
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

