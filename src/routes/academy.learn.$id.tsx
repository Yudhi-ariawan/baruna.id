import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ChevronRight,
  ArrowLeft,
  Lock,
  PlayCircle,
  FileText,
  Presentation,
  BookOpen,
  ListChecks,
  CheckCircle2,
  Circle,
  ChevronDown,
  Award,
  GraduationCap,
  Clock,
  Layers,
  Target,
  ClipboardCheck,
  FolderUp,
  ExternalLink,
  Sparkles,
  Video,
  FileDown,
  Map,
  BookMarked,
  FlaskConical,
  TrendingUp,
  Timer,
  PenLine,
  Send,
  BadgeCheck,
  Download,
  Medal,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { Toaster } from "@/components/baruna/Toaster";
import { DocumentUploadRow } from "@/components/baruna/academy/DocumentUploadRow";
import { ModuleQuiz } from "@/components/baruna/academy/ModuleQuiz";
import { barunaToast } from "@/lib/downloads";
import {
  downloadCertificatePdf,
  downloadBadgePng,
  downloadTranscriptPdf,
  type CertificateData,
  type TranscriptScores,
} from "@/lib/certificate";
import {
  LMS_MODULES,
  LMS_TOTAL_HOURS,
  TRAINING_DATES,
  WELCOME_ITEMS,
  PRE_TEST,
  POST_TEST,
  FINAL_EXAM,
  type ResourceKind,
  type LmsModule,
} from "@/data/lms";
import {
  hasQuizBank,
  getQuizBank,
  getAssessmentConfig,
  QUIZ_PASS_PERCENT,
  type AssessmentConfig,
} from "@/data/quizzes";
import {
  useApplication,
  getLms,
  updateLms,
  isModuleComplete,
  isModuleCompleteInApp,
  isModuleUnlocked,
  getQuizRecord,
  allModuleQuizzesPassed,
  moduleQuizzesPassed,
  actionPlanSubmitted,
  reflectionSubmitted,
  knowledgeSharingSubmitted,
  isCourseComplete,
  creditedLmsIds,
  type ModuleProgress,
  type QuizRecord,
  type DocumentMeta,
} from "@/lib/application";
import { codeForLmsId } from "@/data/masterModules";
import { completeShortCourse } from "@/lib/shortCourses";
import { useDemoMode } from "@/lib/demoMode";
import { DemoModeBar } from "@/components/baruna/academy/DemoModeBar";

export const Route = createFileRoute("/academy/learn/$id")({
  loader: ({ params }) => ({ id: params.id }),
  head: () => ({
    meta: [
      { title: "My Learning — Academy — BARUNA" },
      { name: "description", content: "Your dedicated learning dashboard for the International Training on Fisheries for African Countries." },
    ],
  }),
  notFoundComponent: () => (
    <AcademyShell active="my-learning">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Learning dashboard not found</h1>
        <Link to="/academy/applications" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground">
          Back to My Applications
        </Link>
      </div>
    </AcademyShell>
  ),
  component: LearningDashboard,
});

const TABS = ["Welcome", "Modules", "Assessment", "Assignments", "Completion"] as const;
type Tab = (typeof TABS)[number];

type AssessmentId = "preTest" | "postTest" | "finalExam";

// Synthetic modules used to drive the standalone assessments through the shared
// quiz engine. Only id/no/title are read by ModuleQuiz.
function assessmentModule(id: AssessmentId, title: string): LmsModule {
  return {
    id,
    no: 0,
    title,
    category: "Assessment",
    summary: "",
    hours: 0,
    objectives: [],
    resources: {},
  } as unknown as LmsModule;
}

const resourceMeta: Record<ResourceKind, { icon: LucideIcon; label: string }> = {
  video: { icon: PlayCircle, label: "Video" },
  pdf: { icon: FileText, label: "PDF Module" },
  ppt: { icon: Presentation, label: "PowerPoint" },
  reading: { icon: BookOpen, label: "Additional Reading" },
  quiz: { icon: ListChecks, label: "Quiz" },
};

const RESOURCE_ORDER: ResourceKind[] = ["video", "pdf", "ppt", "reading", "quiz"];

const welcomeIcons: Record<string, LucideIcon> = {
  video: Video,
  guide: FileDown,
  journey: Map,
  handbook: BookMarked,
};

function LearningDashboard() {
  const { id } = Route.useLoaderData() as { id: string };
  const app = useApplication(id);
  const [tab, setTab] = useState<Tab>("Welcome");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [quizModuleId, setQuizModuleId] = useState<string | null>(null);
  const [assessmentOpen, setAssessmentOpen] = useState<AssessmentId | null>(null);

  const [demo] = useDemoMode();

  if (!app) throw notFound();

  // Demo Mode relaxes navigation locks only; stored progress is never changed.
  const confirmed = app.participationConfirmed || demo;
  const lms = getLms(app);

  // ── progress math ──────────────────────────────────────────────────────────
  const credited = creditedLmsIds();
  const completedModules = LMS_MODULES.filter((m) => isModuleCompleteInApp(app, m.id)).length;
  const totalModules = LMS_MODULES.length;
  const remainingModules = totalModules - completedModules;
  const quizzesPassed = moduleQuizzesPassed(app);

  const preRec = getQuizRecord(app, "preTest");
  const postRec = getQuizRecord(app, "postTest");
  const finalRec = getQuizRecord(app, "finalExam");

  // Journey gating (Demo Mode unlocks every step for presentation only)
  const modulesStepDone = completedModules === totalModules && allModuleQuizzesPassed(app);
  const postUnlocked = allModuleQuizzesPassed(app) || demo;
  const finalUnlocked = lms.postTest || demo;
  const actionUnlocked = lms.finalExam || demo;
  const reflectionUnlocked = actionPlanSubmitted(app) || demo;
  const knowledgeUnlocked = reflectionSubmitted(app) || demo;
  const courseComplete = isCourseComplete(app);

  const journey: { label: string; done: boolean; unlocked: boolean }[] = [
    { label: "Pre-Test", done: lms.preTest, unlocked: true },
    { label: "Modules", done: modulesStepDone, unlocked: lms.preTest || demo },
    { label: "Post-Test", done: lms.postTest, unlocked: postUnlocked },
    { label: "Final Examination", done: lms.finalExam, unlocked: finalUnlocked },
    { label: "Action Plan", done: actionPlanSubmitted(app), unlocked: actionUnlocked },
    { label: "Reflection Paper", done: reflectionSubmitted(app), unlocked: reflectionUnlocked },
    { label: "Knowledge Sharing Report", done: knowledgeSharingSubmitted(app), unlocked: knowledgeUnlocked },
    { label: "Certificate", done: courseComplete, unlocked: courseComplete || demo },
  ];
  const journeyDone = journey.filter((s) => s.done).length;
  const overall = Math.round((journeyDone / journey.length) * 100);

  const certificateUnlocked = courseComplete || demo;

  // ── mutations ──────────────────────────────────────────────────────────────
  const toggleResource = (moduleId: string, kind: ResourceKind) => {
    const mp = lms.modules[moduleId];
    updateLms(id, {
      ...lms,
      modules: { ...lms.modules, [moduleId]: { ...mp, [kind]: !mp[kind] } },
    });
  };

  const closeAssessment = () => {
    const which = assessmentOpen;
    setAssessmentOpen(null);
    if (!which) return;
    const rec = getQuizRecord(app, which);
    if (which === "preTest" && rec.attempts.length > 0) barunaToast("Pre-Test completed — Module 1 is now unlocked");
    if (which === "postTest" && rec.passed) barunaToast("Post-Test passed — Final Examination unlocked");
    if (which === "finalExam" && rec.passed) barunaToast("Final Examination passed — Action Plan unlocked");
  };

  const onActionPlanFile = (file: File | null) => {
    if (file && file.size > 10 * 1024 * 1024) {
      barunaToast("File too large — the Action Plan must be 10 MB or less");
      return;
    }
    const meta: DocumentMeta | null = file
      ? { name: file.name, size: file.size, uploadedAt: new Date().toISOString() }
      : null;
    updateLms(id, {
      ...lms,
      actionPlan: { meta, status: meta ? "Submitted" : "Not Submitted" },
    });
    if (meta) barunaToast("Action Plan submitted — Reflection Paper unlocked");
  };

  const onReflectionChange = (text: string) => {
    updateLms(id, { ...lms, reflection: { ...lms.reflection, text } });
  };
  const onReflectionSubmit = () => {
    updateLms(id, {
      ...lms,
      reflection: { ...lms.reflection, status: "Submitted", submittedAt: new Date().toISOString() },
    });
    barunaToast("Reflection Paper submitted — Knowledge Sharing Report unlocked");
  };

  const onKnowledgeFile = (file: File | null) => {
    if (file && file.size > 10 * 1024 * 1024) {
      barunaToast("File too large — the Knowledge Sharing Report must be 10 MB or less");
      return;
    }
    const meta: DocumentMeta | null = file
      ? { name: file.name, size: file.size, uploadedAt: new Date().toISOString() }
      : null;
    updateLms(id, {
      ...lms,
      knowledgeSharing: { meta, status: meta ? "Submitted" : "Not Submitted" },
    });
    if (meta) barunaToast("Knowledge Sharing Report submitted");
  };

  // ── certificate / badge / transcript ─────────────────────────────────────────
  const certSuffix = id.match(/(\d+)\s*$/)?.[1] ?? "0001";
  const certNo = `BARUNA-CERT-2026-${certSuffix}`;
  const getCertData = (): CertificateData => ({
    name: app.personal.fullName || "Participant",
    country: app.professional.country || app.personal.nationality || "",
    program: app.title,
    dates: TRAINING_DATES,
    certNo,
    verifyUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/academy/certification?verify=${certNo}`,
  });

  const moduleScores = LMS_MODULES.map((m) => {
    const rec = getQuizRecord(app, m.id);
    return { no: m.no, title: m.title, score: rec.bestScore, passed: rec.passed };
  });
  const overallScoreParts = [
    ...moduleScores.map((m) => m.score),
    postRec.bestScore,
    finalRec.bestScore,
  ];
  const overallScore = Math.round(
    overallScoreParts.reduce((a, b) => a + b, 0) / Math.max(1, overallScoreParts.length),
  );
  const transcript: TranscriptScores = {
    preTest: preRec.attempts.length ? preRec.bestScore : null,
    modules: moduleScores,
    postTest: postRec.attempts.length ? postRec.bestScore : null,
    finalExam: finalRec.attempts.length ? finalRec.bestScore : null,
    overall: overallScore,
  };

  if (!confirmed) {
    return (
      <AcademyShell active="my-learning">
        <DashHeader id={id} title={app.title} />
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold text-navy">Learning is locked</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Your learning dashboard unlocks once you are accepted and confirm your participation.
          </p>
          <Link
            to="/academy/applications/$id"
            params={{ id }}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground hover:bg-marine/90"
          >
            Go to application status
          </Link>
        </div>
      </AcademyShell>
    );
  }

  return (
    <AcademyShell active="my-learning">
      <Toaster />
      <div className="space-y-6">
        <DashHeader id={id} title={app.title} />

        <DemoModeBar />


        {/* Progress summary */}
        <ProgressSummary
          overall={overall}
          completedModules={completedModules}
          remainingModules={remainingModules}
          totalModules={totalModules}
          hours={LMS_TOTAL_HOURS}
        />

        {/* Assessment journey tracker */}
        <JourneyTracker steps={journey} percent={overall} />

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => {
            const locked = t === "Completion" && !certificateUnlocked;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  tab === t ? "border-marine bg-marine/5 text-marine" : "border-border bg-card text-navy hover:border-marine/40"
                }`}
              >
                {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                {t}
              </button>
            );
          })}
        </div>

        {/* ── WELCOME ── */}
        {tab === "Welcome" && (
          <div className="space-y-4">
            <SectionIntro
              title="Welcome to your learning journey"
              desc="Start here to understand how the program works, then complete the Pre-Test to unlock Module 1."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {WELCOME_ITEMS.map((w) => {
                const Icon = welcomeIcons[w.kind] ?? Sparkles;
                return (
                  <div key={w.key} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-base font-bold text-navy">{w.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{w.desc}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span className="text-[0.7rem] font-medium text-muted-foreground">{w.meta}</span>
                      <button
                        onClick={() => barunaToast(`${w.title} will be available here once uploaded`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-marine bg-card px-3 py-1.5 text-xs font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                      >
                        Open <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MODULES ── */}
        {tab === "Modules" && (
          <div className="space-y-4">
            <SectionIntro
              title="Learning Modules"
              desc="13 modules following the approved curriculum. Complete the Pre-Test to unlock Module 1, then pass each module quiz (70%) to unlock the next module."
            />
            {!lms.preTest && !demo && (
              <div className="flex items-center gap-2 rounded-xl border border-marine/30 bg-marine/5 p-4 text-sm font-medium text-marine">
                <Lock className="h-4 w-4" /> Complete the Pre-Test in the Assessment tab to unlock Module 1.
              </div>
            )}
            <div className="space-y-3">
              {LMS_MODULES.map((m) => {
                const unlocked = isModuleUnlocked(app, m.id) || demo;
                const isCredited = credited.has(m.id) && !lms.quizzes?.[m.id]?.passed;
                return (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    progress={lms.modules[m.id]}
                    quizRecord={getQuizRecord(app, m.id)}
                    unlocked={unlocked}
                    credited={isCredited}
                    preTestDone={lms.preTest}
                    open={expanded === m.id}
                    onToggleOpen={() => {
                      if (!unlocked) return;
                      setExpanded(expanded === m.id ? null : m.id);
                    }}
                    onToggleResource={(kind) => toggleResource(m.id, kind)}
                    onTakeQuiz={() => setQuizModuleId(m.id)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── ASSESSMENT ── */}
        {tab === "Assessment" && (
          <div className="space-y-4">
            <SectionIntro
              title="Assessment"
              desc="Complete the Pre-Test, pass each module quiz, then the Post-Test and the timed Final Examination."
            />

            {/* Pre-Test */}
            <AssessmentCard
              icon={FlaskConical}
              item={PRE_TEST}
              record={preRec}
              config={getAssessmentConfig("preTest")}
              onOpen={() => setAssessmentOpen("preTest")}
            />

            {/* Module quizzes summary */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                    <ListChecks className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-base font-bold text-navy">Module Quizzes</p>
                    <p className="mt-1 text-xs text-muted-foreground">One quiz per module · 10 questions · pass mark 70%</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-marine">{quizzesPassed}/{totalModules} passed</span>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {LMS_MODULES.map((m) => {
                  const passed = lms.modules[m.id].quiz;
                  return (
                    <li key={m.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
                      {passed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-badge-training" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-navy">M{m.no}. {m.title}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Open a module to take its quiz.</p>
            </div>

            {/* Post-Test */}
            <AssessmentCard
              icon={ClipboardCheck}
              item={POST_TEST}
              record={postRec}
              config={getAssessmentConfig("postTest")}
              locked={!postUnlocked}
              lockMsg="Pass all 13 module quizzes to unlock the Post-Test."
              onOpen={() => setAssessmentOpen("postTest")}
            />

            {/* Knowledge improvement */}
            {preRec.attempts.length > 0 && postRec.attempts.length > 0 && (
              <ImprovementPanel pre={preRec.bestScore} post={postRec.bestScore} />
            )}

            {/* Final Examination */}
            <AssessmentCard
              icon={Timer}
              item={FINAL_EXAM}
              record={finalRec}
              config={getAssessmentConfig("finalExam")}
              locked={!finalUnlocked}
              lockMsg="Pass the Post-Test to unlock the Final Examination."
              onOpen={() => setAssessmentOpen("finalExam")}
            />
          </div>
        )}

        {/* ── ASSIGNMENTS ── */}
        {tab === "Assignments" && (
          <div className="space-y-4">
            <SectionIntro
              title="Assignments"
              desc="Complete your post-course assignments in order — Action Plan, Reflection Paper, then Knowledge Sharing Report — to unlock your certificate."
            />

            <AssignmentProgress
              done={
                (actionPlanSubmitted(app) ? 1 : 0) +
                (reflectionSubmitted(app) ? 1 : 0) +
                (knowledgeSharingSubmitted(app) ? 1 : 0)
              }
            />

            <ActionPlanCard
              status={lms.actionPlan.status}
              meta={lms.actionPlan.meta}
              locked={!actionUnlocked}
              onChange={onActionPlanFile}
            />

            <ReflectionCard
              text={lms.reflection.text}
              status={lms.reflection.status}
              locked={!reflectionUnlocked}
              onChange={onReflectionChange}
              onSubmit={onReflectionSubmit}
            />

            <KnowledgeSharingCard
              status={lms.knowledgeSharing.status}
              meta={lms.knowledgeSharing.meta}
              locked={!knowledgeUnlocked}
              onChange={onKnowledgeFile}
            />
          </div>
        )}

        {/* ── COMPLETION ── */}
        {tab === "Completion" && (
          courseComplete ? (
            <CompletionPanel
              data={getCertData()}
              transcript={transcript}
            />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-soft">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Lock className="h-7 w-7" />
                </span>
                <h2 className="mt-4 font-display text-lg font-bold text-navy">Certificate locked</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Complete every requirement below to unlock your certificate, badge and transcript.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <RequirementCard label="All Modules" done={completedModules === totalModules} detail={`${completedModules}/${totalModules} complete`} />
                <RequirementCard label="Module Quizzes" done={allModuleQuizzesPassed(app)} detail={`${quizzesPassed}/${totalModules} passed`} />
                <RequirementCard label="Post-Test" done={lms.postTest} detail={lms.postTest ? "Passed" : "Not passed"} />
                <RequirementCard label="Final Examination" done={lms.finalExam} detail={lms.finalExam ? "Passed" : "Not passed"} />
                <RequirementCard label="Action Plan" done={actionPlanSubmitted(app)} detail={lms.actionPlan.status} />
                <RequirementCard label="Reflection Paper" done={reflectionSubmitted(app)} detail={lms.reflection.status} />
                <RequirementCard label="Knowledge Sharing Report" done={knowledgeSharingSubmitted(app)} detail={lms.knowledgeSharing.status} />
              </div>
            </div>
          )
        )}
      </div>

      {quizModuleId && (
        <ModuleQuiz
          app={app}
          module={LMS_MODULES.find((m) => m.id === quizModuleId)!}
          onClose={() => {
            // Mirror any newly-passed Master Module into the Self-Paced credit
            // store so the Master Module is recognised in both pathways.
            const mid = quizModuleId;
            setQuizModuleId(null);
            const rec = getQuizRecord(app, mid);
            const code = codeForLmsId(mid);
            if (rec.passed && code) {
              completeShortCourse(code, rec.bestScore, "full-training-program");
            }
          }}
        />
      )}

      {assessmentOpen && (
        <ModuleQuiz
          app={app}
          module={assessmentModule(
            assessmentOpen,
            assessmentOpen === "preTest"
              ? PRE_TEST.title
              : assessmentOpen === "postTest"
                ? POST_TEST.title
                : FINAL_EXAM.title,
          )}
          config={getAssessmentConfig(assessmentOpen)}
          onClose={closeAssessment}
        />
      )}
    </AcademyShell>
  );
}

/* ---------------- pieces ---------------- */

function DashHeader({ id, title }: { id: string; title: string }) {
  return (
    <>
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/academy/applications" className="font-medium text-foreground/70 hover:text-marine">My Learning</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-navy">{id}</span>
      </nav>
      <div className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-marine">Learning Dashboard</p>
            <h1 className="font-display text-xl font-bold text-navy">{title}</h1>
          </div>
        </div>
        <Link
          to="/academy/applications/$id"
          params={{ id }}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-marine hover:text-navy"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to application status
        </Link>
      </div>
    </>
  );
}

function ProgressSummary({
  overall,
  completedModules,
  remainingModules,
  totalModules,
  hours,
}: {
  overall: number;
  completedModules: number;
  remainingModules: number;
  totalModules: number;
  hours: number;
}) {
  const stats: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Layers, label: "Completed Modules", value: `${completedModules}/${totalModules}` },
    { icon: Target, label: "Remaining Modules", value: `${remainingModules}` },
    { icon: Clock, label: "Estimated Hours", value: `${hours}h` },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="lg:w-72">
          <div className="flex items-end justify-between">
            <p className="font-display text-sm font-bold text-navy">Overall Progress</p>
            <span className="font-display text-2xl font-extrabold text-marine">{overall}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${overall}%` }} />
          </div>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
                <s.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-display text-base font-bold text-navy">{s.value}</p>
                <p className="text-[0.7rem] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JourneyTracker({
  steps,
  percent,
}: {
  steps: { label: string; done: boolean; unlocked: boolean }[];
  percent: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-navy">Assessment Journey</h2>
        <span className="text-sm font-semibold text-marine">{percent}% complete</span>
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-y-4">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-start">
            <div className="flex w-20 flex-col items-center text-center sm:w-24">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  s.done
                    ? "bg-badge-training/15 text-badge-training"
                    : s.unlocked
                      ? "bg-marine/10 text-marine"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {s.done ? <CheckCircle2 className="h-5 w-5" /> : !s.unlocked ? <Lock className="h-4 w-4" /> : i + 1}
              </span>
              <p className={`mt-2 text-[0.65rem] font-semibold leading-tight ${s.done || s.unlocked ? "text-navy" : "text-muted-foreground"}`}>
                {s.label}
              </p>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionIntro({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function ModuleCard({
  module: m,
  progress,
  quizRecord,
  unlocked,
  credited = false,
  preTestDone,
  open,
  onToggleOpen,
  onToggleResource,
  onTakeQuiz,
}: {
  module: LmsModule;
  progress: ModuleProgress;
  quizRecord: QuizRecord;
  unlocked: boolean;
  credited?: boolean;
  preTestDone: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onToggleResource: (kind: ResourceKind) => void;
  onTakeQuiz: () => void;
}) {
  const done = RESOURCE_ORDER.filter((k) => progress[k]).length;
  const complete = isModuleComplete(progress) || credited;
  const moduleHasQuiz = hasQuizBank(m.id);
  const lockedReason =
    m.no === 1 && !preTestDone
      ? "Complete the Pre-Test to unlock this module."
      : "Pass the previous module quiz (70%) to unlock this module.";
  return (
    <div className={`overflow-hidden rounded-2xl border bg-card shadow-soft ${unlocked ? "border-border" : "border-dashed border-border opacity-80"}`}>
      <button
        onClick={onToggleOpen}
        disabled={!unlocked}
        className={`flex w-full items-center gap-4 p-5 text-left ${unlocked ? "" : "cursor-not-allowed"}`}
      >
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-sm font-bold ${!unlocked ? "bg-muted text-muted-foreground" : complete ? "bg-badge-training/15 text-badge-training" : "bg-marine/10 text-marine"}`}>
          {!unlocked ? <Lock className="h-5 w-5" /> : complete ? <CheckCircle2 className="h-5 w-5" /> : m.no}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-bold text-navy">Module {m.no}: {m.title}</p>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">{m.category}</span>
            {!unlocked && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">Locked</span>
            )}
            {moduleHasQuiz && quizRecord.passed && (
              <span className="rounded-md bg-badge-training/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-badge-training">Quiz passed</span>
            )}
            {credited && !quizRecord.passed && (
              <span className="inline-flex items-center gap-1 rounded-md bg-marine/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-marine">
                <Award className="h-3 w-3" /> Credit recognised · Self-Paced
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {unlocked ? m.summary : lockedReason}
          </p>
        </div>
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5 text-marine/70" /> {m.hours}h</span>
          <span className="text-xs font-semibold text-marine">{done}/{RESOURCE_ORDER.length}</span>
        </div>
        {unlocked ? (
          <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        ) : (
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && unlocked && (
        <div className="border-t border-border bg-background/40 p-5">
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-foreground/70">Learning objectives</p>
            <ul className="mt-2 space-y-1.5">
              {m.objectives.map((o) => (
                <li key={o} className="flex items-start gap-2 text-xs text-foreground/80">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marine/70" /> {o}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5">
            {RESOURCE_ORDER.map((kind) => {
              const res = m.resources[kind];
              const Icon = resourceMeta[kind].icon;
              const isDone = progress[kind];
              const hasFile = !!res.url;

              if (kind === "quiz") {
                const bank = getQuizBank(m.id);
                const attempts = quizRecord.attempts.length;
                const meta = bank
                  ? `${Math.min(bank.questions.length, 10)} questions · pass mark ${QUIZ_PASS_PERCENT}%${
                      attempts ? ` · best ${quizRecord.bestScore}%` : ""
                    }`
                  : `${res.meta} · uploading soon`;
                return (
                  <div key={kind} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${quizRecord.passed ? "bg-badge-training/15 text-badge-training" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy">{res.title}</p>
                        <p className="text-[0.7rem] text-muted-foreground">{meta}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {quizRecord.passed && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-badge-training/10 px-2 py-1 text-[0.65rem] font-bold uppercase text-badge-training">
                          <CheckCircle2 className="h-3 w-3" /> Passed
                        </span>
                      )}
                      <button
                        onClick={onTakeQuiz}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                          quizRecord.passed
                            ? "border-marine bg-card text-marine hover:bg-marine hover:text-marine-foreground"
                            : "border-marine bg-marine text-marine-foreground hover:bg-marine/90"
                        }`}
                      >
                        {!bank ? "View quiz" : quizRecord.passed ? "Review quiz" : attempts > 0 ? "Continue quiz" : "Take quiz"}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={kind} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${isDone ? "bg-marine/10 text-marine" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-navy">{res.title}</p>
                      <p className="text-[0.7rem] text-muted-foreground">{res.meta}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {hasFile ? (
                      <a
                        href={res.url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-marine bg-card px-3 py-2 text-xs font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                      >
                        {kind === "pdf" ? "Open PDF" : "Open"} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">Coming soon</span>
                    )}
                    <button
                      onClick={() => onToggleResource(kind)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        isDone
                          ? "border-marine bg-marine text-marine-foreground"
                          : "border-marine bg-card text-marine hover:bg-marine hover:text-marine-foreground"
                      }`}
                    >
                      {isDone ? <><CheckCircle2 className="h-3.5 w-3.5" /> Done</> : "Mark done"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AssessmentCard({
  icon: Icon,
  item,
  record,
  config,
  locked = false,
  lockMsg,
  onOpen,
}: {
  icon: LucideIcon;
  item: { title: string; desc: string; meta: string };
  record: QuizRecord;
  config: AssessmentConfig;
  locked?: boolean;
  lockMsg?: string;
  onOpen: () => void;
}) {
  const attempts = record.attempts.length;
  const attemptsLeft = Math.max(0, config.maxAttempts - attempts);
  const status: { label: string; tone: "ok" | "fail" | "muted" } = config.noPassMark
    ? attempts > 0
      ? { label: "Completed", tone: "ok" }
      : { label: "Not started", tone: "muted" }
    : record.passed
      ? { label: "Passed", tone: "ok" }
      : attempts === 0
        ? { label: "Not started", tone: "muted" }
        : attemptsLeft === 0
          ? { label: "Failed", tone: "fail" }
          : { label: "In progress", tone: "muted" };
  const finished = record.passed || (config.noPassMark && attempts > 0);
  const toneClass =
    status.tone === "ok"
      ? "bg-badge-training/15 text-badge-training"
      : status.tone === "fail"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${finished ? "bg-badge-training/15 text-badge-training" : "bg-marine/10 text-marine"}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-navy">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
            <p className="mt-1 text-[0.7rem] font-medium text-marine">{item.meta}</p>
          </div>
        </div>
        <div className="shrink-0">
          {locked ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3.5 py-2 text-xs font-medium text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Locked
            </span>
          ) : (
            <button
              onClick={onOpen}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
                finished
                  ? "border-marine bg-card text-marine hover:bg-marine hover:text-marine-foreground"
                  : "border-marine bg-marine text-marine-foreground hover:bg-marine/90"
              }`}
            >
              {attempts === 0 ? "Start" : finished ? "Review" : "Retake"}
            </button>
          )}
        </div>
      </div>

      {!locked && attempts > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <div className="rounded-xl border border-border bg-background px-4 py-2 text-center">
            <p className="font-display text-lg font-extrabold text-navy">{record.bestScore}<span className="text-sm text-muted-foreground">/100</span></p>
            <p className="text-[0.65rem] text-muted-foreground">{config.noPassMark ? "Pre-Test Score" : "Best Score"}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${toneClass}`}>
            {status.tone === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : status.tone === "fail" ? <Lock className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            {status.label}
          </span>
          {!config.noPassMark && (
            <span className="text-xs text-muted-foreground">{attemptsLeft}/{config.maxAttempts} attempts left</span>
          )}
        </div>
      )}
      {locked && lockMsg && <p className="mt-3 text-xs text-muted-foreground">{lockMsg}</p>}
    </div>
  );
}

function ImprovementPanel({ pre, post }: { pre: number; post: number }) {
  const delta = post - pre;
  const positive = delta >= 0;
  return (
    <div className="rounded-2xl border border-marine/20 bg-marine/5 p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-marine" />
        <h3 className="font-display text-base font-bold text-navy">Knowledge Improvement</h3>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="font-display text-2xl font-extrabold text-navy">{pre}</p>
          <p className="text-[0.7rem] text-muted-foreground">Pre-Test</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="font-display text-2xl font-extrabold text-navy">{post}</p>
          <p className="text-[0.7rem] text-muted-foreground">Post-Test</p>
        </div>
        <div className={`rounded-xl border p-3 ${positive ? "border-badge-training/30 bg-badge-training/10" : "border-destructive/30 bg-destructive/10"}`}>
          <p className={`font-display text-2xl font-extrabold ${positive ? "text-badge-training" : "text-destructive"}`}>
            {positive ? "+" : ""}{delta}%
          </p>
          <p className="text-[0.7rem] text-muted-foreground">Improvement</p>
        </div>
      </div>
    </div>
  );
}

const ACTION_PLAN_FLOW = ["Not Submitted", "Submitted", "Reviewed", "Approved"] as const;

function AssignmentProgress({ done }: { done: number }) {
  const total = 3;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-navy">Post-Course Progress</p>
        <span className="text-sm font-semibold text-marine">{done}/{total} completed</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}

function KnowledgeSharingCard({
  status,
  meta,
  locked,
  onChange,
}: {
  status: string;
  meta: DocumentMeta | null;
  locked: boolean;
  onChange: (file: File | null) => void;
}) {
  if (locked) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-navy">Knowledge Sharing Report</p>
            <p className="mt-1 text-xs text-muted-foreground">Submit your Reflection Paper to unlock the Knowledge Sharing Report.</p>
          </div>
        </div>
      </div>
    );
  }
  const activeIdx = ACTION_PLAN_FLOW.indexOf(status as (typeof ACTION_PLAN_FLOW)[number]);
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
          <ScrollText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-navy">Knowledge Sharing Report</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Report on how you shared this training's knowledge with your organization or community. PDF or DOCX, maximum 10 MB.
          </p>
        </div>
      </div>

      {/* status stepper */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {ACTION_PLAN_FLOW.map((s, i) => (
          <span
            key={s}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-semibold ${
              i <= activeIdx && activeIdx > 0 ? "bg-badge-training/15 text-badge-training" : "bg-muted text-muted-foreground"
            }`}
          >
            {i <= activeIdx && activeIdx > 0 && <CheckCircle2 className="h-3 w-3" />}
            {s}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <DocumentUploadRow
          field={{ key: "knowledgeSharing", label: "Knowledge Sharing Report", accept: ".pdf,.doc,.docx", hint: "PDF or DOCX · max 10 MB" }}
          meta={meta}
          onChange={onChange}
          uploadedLabel="Submitted"
        />
      </div>
    </div>
  );
}

function ActionPlanCard({
  status,
  meta,
  locked,
  onChange,
}: {
  status: string;
  meta: DocumentMeta | null;
  locked: boolean;
  onChange: (file: File | null) => void;
}) {
  if (locked) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-navy">Action Plan Assignment</p>
            <p className="mt-1 text-xs text-muted-foreground">Pass the Final Examination to unlock the Action Plan submission.</p>
          </div>
        </div>
      </div>
    );
  }
  const activeIdx = ACTION_PLAN_FLOW.indexOf(status as (typeof ACTION_PLAN_FLOW)[number]);
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
          <FolderUp className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-navy">Action Plan for Fisheries Development in My Country</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Submit a practical action plan to apply what you learned back home. PDF or DOCX, maximum 10 MB.
          </p>
        </div>
      </div>

      {/* status stepper */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {ACTION_PLAN_FLOW.map((s, i) => (
          <span
            key={s}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-semibold ${
              i <= activeIdx && activeIdx > 0
                ? "bg-badge-training/15 text-badge-training"
                : i === 0 && activeIdx === 0
                  ? "bg-muted text-muted-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i <= activeIdx && activeIdx > 0 && <CheckCircle2 className="h-3 w-3" />}
            {s}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <DocumentUploadRow
          field={{ key: "actionPlan", label: "Action Plan", accept: ".pdf,.doc,.docx", hint: "PDF or DOCX · max 10 MB" }}
          meta={meta}
          onChange={onChange}
          uploadedLabel="Submitted"
        />
      </div>
    </div>
  );
}

function ReflectionCard({
  text,
  status,
  locked,
  onChange,
  onSubmit,
}: {
  text: string;
  status: string;
  locked: boolean;
  onChange: (text: string) => void;
  onSubmit: () => void;
}) {
  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const valid = words >= 300 && words <= 1000;
  const submitted = status === "Submitted";

  if (locked) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-base font-bold text-navy">Reflection Paper</p>
            <p className="mt-1 text-xs text-muted-foreground">Submit your Action Plan to unlock the Reflection Paper.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${submitted ? "bg-badge-training/15 text-badge-training" : "bg-marine/10 text-marine"}`}>
          <PenLine className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-bold text-navy">Reflection Paper</p>
            <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold ${submitted ? "bg-badge-training/15 text-badge-training" : "bg-muted text-muted-foreground"}`}>
              {status}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            What lessons from this training will you apply in your organization or country?
          </p>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        disabled={submitted}
        rows={8}
        placeholder="Write your reflection here (300–1000 words)…"
        className="mt-4 w-full resize-y rounded-xl border border-border bg-background p-4 text-sm text-foreground outline-none transition-colors focus:border-marine disabled:opacity-70"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs font-medium ${valid || submitted ? "text-badge-training" : "text-muted-foreground"}`}>
          {words} words · minimum 300, maximum 1000
        </span>
        {!submitted && (
          <button
            onClick={onSubmit}
            disabled={!valid}
            className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-xs font-semibold text-marine-foreground transition-colors hover:bg-marine/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> Submit Reflection
          </button>
        )}
        {submitted && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-badge-training">
            <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
          </span>
        )}
      </div>
    </div>
  );
}

function CompletionPanel({ data, transcript }: { data: CertificateData; transcript: TranscriptScores }) {
  const onCertificate = () =>
    downloadCertificatePdf(data)
      .then(() => barunaToast("Certificate downloaded"))
      .catch(() => barunaToast("Could not generate the certificate"));
  const onBadge = () => {
    downloadBadgePng();
    barunaToast("Digital badge downloaded");
  };
  const onTranscript = () => {
    downloadTranscriptPdf(data, transcript);
    barunaToast("Transcript downloaded");
  };

  const rows: { label: string; value: string }[] = [
    { label: "Participant Name", value: data.name },
    { label: "Country", value: data.country || "—" },
    { label: "Program Title", value: data.program },
    { label: "Training Dates", value: data.dates },
    { label: "Certificate Number", value: data.certNo },
    { label: "Overall Score", value: `${transcript.overall}%` },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-badge-training/30 bg-badge-training/5 p-8 text-center shadow-soft sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-badge-training/15 text-badge-training">
          <Award className="h-8 w-8" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold text-navy">Congratulations!</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          You have successfully completed the International Training on Fisheries for African Countries.
          Your certificate, digital badge and learning transcript are ready below.
        </p>
      </div>

      {/* Certificate */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-marine" />
          <h3 className="font-display text-base font-bold text-navy">Digital Certificate</h3>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="rounded-xl border border-border bg-background p-3">
              <dt className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{r.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-navy">{r.value}</dd>
            </div>
          ))}
        </dl>
        <button
          onClick={onCertificate}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-marine px-6 py-3 text-sm font-semibold text-marine-foreground transition-all hover:-translate-y-0.5 hover:bg-marine/90 hover:shadow-hover"
        >
          <Download className="h-4 w-4" /> Download Certificate PDF
        </button>
      </div>

      {/* Badge + Transcript */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-marine" />
            <h3 className="font-display text-base font-bold text-navy">Digital Badge</h3>
          </div>
          <p className="mt-2 flex-1 text-sm text-muted-foreground">
            “International Fisheries Training Graduate” — share your achievement. Downloadable as PNG.
          </p>
          <button
            onClick={onBadge}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-marine bg-card px-5 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
          >
            <Medal className="h-4 w-4" /> Download Badge PNG
          </button>
        </div>

        <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-marine" />
            <h3 className="font-display text-base font-bold text-navy">Learning Transcript</h3>
          </div>
          <p className="mt-2 flex-1 text-sm text-muted-foreground">
            Full record of your Pre-Test, module quizzes, Post-Test, Final Exam and overall score.
          </p>
          <button
            onClick={onTranscript}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-marine bg-card px-5 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
          >
            <Download className="h-4 w-4" /> Download Transcript PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function RequirementCard({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return (
    <div className={`rounded-2xl border p-5 text-center shadow-soft ${done ? "border-badge-training/30 bg-badge-training/5" : "border-border bg-card"}`}>
      <span className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${done ? "bg-badge-training/15 text-badge-training" : "bg-muted text-muted-foreground"}`}>
        {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
      </span>
      <p className="mt-3 font-display text-sm font-bold text-navy">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
