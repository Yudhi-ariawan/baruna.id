import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  ChevronRight as ChevronRightIcon,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Layers,
  Lock,
  MessageSquare,
  Play,
  Target,
  Upload,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import {
  AZA_META,
  AZA_MODULES,
  AZA_PASS_MARK,
  AZA_POSTTEST,
  AZA_PROJECT_UPLOADS,
  AZA_EVALUATION_ITEMS,
  AZA_LEARN_ID,
  type AzaModule,
  type AzaQuizQuestion,
} from "@/data/aza";
import {
  useAza,
  enroll,
  setProfile,
  scoreQuiz,
  submitQuiz,
  submitPretest,
  saveAssignment,
  uploadProjectFile,
  submitProject,
  advanceReview,
  submitPosttest,
  saveEvaluation,
  issueCertificate,
  moduleUnlocked,
  projectUnlocked,
  postTestUnlocked,
  computeFinalScore,
  overallProgress,
  accessDaysRemaining,
  certificateEligible,
  type AzaState,
} from "@/lib/aza";

export const Route = createFileRoute("/academy/learn/allocated-zones-for-aquaculture")({
  head: () => ({
    meta: [
      { title: `Learn — ${AZA_META.title} — BARUNA Academy` },
      { name: "description", content: `Self-paced learning workspace for ${AZA_META.title}.` },
      { property: "og:title", content: `Learn — ${AZA_META.title} — BARUNA Academy` },
      { property: "og:description", content: AZA_META.shortDescription },
    ],
  }),
  component: AzaLearnPage,
});

type Tab =
  | "journey"
  | "modules"
  | "assignments"
  | "project"
  | "posttest"
  | "evaluation"
  | "certificate"
  | "notifications";

function AzaLearnPage() {
  const [state, update] = useAza();
  const [tab, setTab] = useState<Tab>("journey");

  if (!state.enrolled) {
    return (
      <AcademyShell active="my-learning">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <Play className="mx-auto h-10 w-10 text-marine" />
          <h1 className="mt-3 font-display text-2xl font-extrabold text-navy">
            Enroll in {AZA_META.title}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Enrollment is open. You'll receive 30 days of access starting today.
          </p>
          <button
            onClick={() => update(enroll)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground shadow-soft hover:bg-marine/90"
          >
            <Play className="h-4 w-4" /> Start Learning
          </button>
          <Link
            to="/academy/training/allocated-zones-for-aquaculture"
            className="mt-3 inline-block text-xs font-semibold text-marine hover:text-navy"
          >
            ← Back to course details
          </Link>
        </div>
      </AcademyShell>
    );
  }

  const progress = overallProgress(state);
  const finalScore = computeFinalScore(state);
  const daysLeft = accessDaysRemaining(state);
  const eligible = certificateEligible(state);

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "journey", label: "Journey", icon: BookOpen },
    { key: "modules", label: "Modules", icon: ClipboardCheck },
    { key: "assignments", label: "Assignments", icon: FileText },
    { key: "project", label: "Final Project", icon: Upload },
    { key: "posttest", label: "Post-Test", icon: ClipboardCheck },
    { key: "evaluation", label: "Evaluation", icon: MessageSquare },
    { key: "certificate", label: "Certificate", icon: Award },
    { key: "notifications", label: "Notifications", icon: Bell },
  ];

  const totalHours = AZA_MODULES.reduce((n, m) => n + m.hours, 0);
  const totalModules = AZA_MODULES.filter((m) => m.no > 0).length;
  const completedModules = AZA_MODULES.filter(
    (m) => m.no > 0 && (state.quizzes[m.no]?.percent ?? 0) >= AZA_PASS_MARK,
  ).length;
  const remainingModules = totalModules - completedModules;

  // Assessment journey — matches the flow specified for AZA
  const projectSubmitted =
    state.project.status !== "Not Started" && state.project.status !== "In Progress";
  const completenessPassed = [
    "Under Expert Review",
    "Revision Required",
    "Resubmitted",
    "Approved",
    "Certificate Eligible",
  ].includes(state.project.status);
  const expertReviewStarted = completenessPassed;
  const revisionStep =
    state.project.status === "Revision Required" || state.project.status === "Resubmitted";
  const approved =
    state.project.status === "Approved" || state.project.status === "Certificate Eligible";
  const allAssignmentsSaved = AZA_MODULES.filter((m) => m.assignment).every(
    (m) => !!state.assignments[m.assignment!.key],
  );
  const modulesAllPassed = completedModules === totalModules;

  const journey: { label: string; done: boolean }[] = [
    { label: "Course Orientation", done: state.profileCompleted },
    { label: "Pre-Test", done: !!state.pretest },
    { label: "Modules 1–10", done: modulesAllPassed },
    { label: "Assignments", done: allAssignmentsSaved },
    { label: "Final Project", done: projectSubmitted },
    { label: "Post-Test", done: !!state.posttest },
    { label: "Completeness Check", done: completenessPassed },
    { label: "Expert Review", done: expertReviewStarted },
    { label: "Revision", done: revisionStep || approved },
    { label: "Final Approval", done: approved },
    { label: "Evaluation", done: state.reflectionCompleted },
    { label: "Certificate", done: state.certificate.status === "Issued" },
  ];
  const currentIdx = journey.findIndex((s) => !s.done);

  const currentModule =
    AZA_MODULES.filter((m) => m.no > 0).find(
      (m) => (state.quizzes[m.no]?.percent ?? 0) < AZA_PASS_MARK,
    ) ?? null;
  const nextAction = currentIdx >= 0 ? journey[currentIdx].label : "Course complete";

  return (
    <AcademyShell active="my-learning">
      <div className="space-y-6">
        {/* DashHeader — mirrors the Africa Training learning dashboard */}
        <nav
          className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">
            Academy
          </Link>
          <ChevronRightIcon className="h-3.5 w-3.5" />
          <Link to="/academy/learn" className="font-medium text-foreground/70 hover:text-marine">
            My Learning
          </Link>
          <ChevronRightIcon className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">{AZA_META.title}</span>
        </nav>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-marine">
                Learning Dashboard
              </p>
              <h1 className="font-display text-xl font-bold text-navy">{AZA_META.title}</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Course code AZA-SP · Enrolled{" "}
                {state.enrolledAt ? new Date(state.enrolledAt).toLocaleDateString() : "—"} · Access
                expires{" "}
                {state.accessExpiresAt
                  ? new Date(state.accessExpiresAt).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>
          <Link
            to="/academy/training/allocated-zones-for-aquaculture"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-marine hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to course details
          </Link>
        </div>

        {/* Progress summary — same layout as Africa dashboard */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="lg:w-72">
              <div className="flex items-end justify-between">
                <p className="font-display text-sm font-bold text-navy">Overall Progress</p>
                <span className="font-display text-2xl font-extrabold text-marine">{progress}%</span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-marine transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Current: <span className="font-semibold text-navy">
                  {currentModule ? `Module ${currentModule.no} — ${currentModule.title}` : "All modules complete"}
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Next action: <span className="font-semibold text-marine">{nextAction}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Status: <span className="font-semibold text-navy">{state.certificate.status === "Issued" ? "Completed" : "In Progress"}</span>
              </p>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-4">
              {[
                { icon: Layers, label: "Completed Modules", value: `${completedModules}/${totalModules}` },
                { icon: Target, label: "Remaining Modules", value: `${remainingModules}` },
                { icon: Clock, label: "Estimated Hours", value: `${totalHours}h` },
                {
                  icon: Award,
                  label: "Access Left",
                  value: daysLeft !== null ? `${daysLeft} days` : "—",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                >
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

        {/* Assessment Journey tracker — done=green, current=blue, locked=grey */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-navy">Assessment Journey</h2>
            <span className="text-sm font-semibold text-marine">{progress}% complete</span>
          </div>
          <div className="mt-4 flex flex-wrap items-start gap-y-4">
            {journey.map((s, i) => {
              const isCurrent = i === currentIdx;
              return (
                <div key={s.label} className="flex items-start">
                  <div className="flex w-20 flex-col items-center text-center sm:w-24">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${
                        s.done
                          ? "bg-badge-training/15 text-badge-training"
                          : isCurrent
                            ? "bg-marine/10 text-marine"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : isCurrent ? (
                        i + 1
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </span>
                    <p
                      className={`mt-2 text-[0.65rem] font-semibold leading-tight ${
                        s.done || isCurrent ? "text-navy" : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </p>
                  </div>
                  {i < journey.length - 1 && (
                    <ChevronRightIcon className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                tab === key
                  ? "border-marine bg-marine text-marine-foreground"
                  : "border-border bg-card text-navy hover:border-marine/40"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Panels */}
        {tab === "journey" && <JourneyPanel state={state} update={update} />}
        {tab === "modules" && <ModulesPanel state={state} update={update} />}
        {tab === "assignments" && <AssignmentsPanel state={state} update={update} />}
        {tab === "project" && <ProjectPanel state={state} update={update} />}
        {tab === "posttest" && <PostTestPanel state={state} update={update} />}
        {tab === "evaluation" && <EvaluationPanel state={state} update={update} />}
        {tab === "certificate" && (
          <CertificatePanel state={state} update={update} eligible={eligible} finalScore={finalScore} />
        )}
        {tab === "notifications" && <NotificationsPanel state={state} />}
      </div>
    </AcademyShell>
  );
}

// ---------- Small primitives ------------------------------------------------

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber";
}) {
  return (
    <div
      className={`rounded-xl border p-2 text-center ${
        tone === "amber" ? "border-amber-300 bg-amber-50" : "border-border bg-muted/30"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-display text-sm font-bold ${tone === "amber" ? "text-amber-700" : "text-navy"}`}>
        {value}
      </p>
    </div>
  );
}

function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold text-navy">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

type Update = (fn: (s: AzaState) => AzaState) => void;

// ---------- Journey panel ---------------------------------------------------

function JourneyPanel({ state, update }: { state: AzaState; update: Update }) {
  const steps: { label: string; done: boolean; action?: () => void; hint?: string }[] = [
    { label: "Enrolled", done: state.enrolled },
    {
      label: "Participant profile & case selection",
      done: state.profileCompleted,
      hint: state.profileCompleted
        ? `Case: ${state.caseOption === "A" ? "BARUNA Simulation" : "Own Area"}`
        : "Choose Option A (BARUNA Simulation) or Option B (Your Own Area).",
    },
    { label: "Pre-test (diagnostic)", done: !!state.pretest },
    ...AZA_MODULES.filter((m) => m.no > 0).map((m) => ({
      label: `Module ${m.no}: ${m.title}`,
      done: (state.quizzes[m.no]?.percent ?? 0) >= AZA_PASS_MARK,
    })),
    { label: "Final project submitted", done: state.project.status !== "Not Started" && state.project.status !== "In Progress" },
    { label: "Post-test", done: !!state.posttest },
    { label: "Project approved", done: state.project.status === "Approved" || state.project.status === "Certificate Eligible" },
    { label: "Course evaluation", done: state.reflectionCompleted },
    { label: "Certificate issued", done: state.certificate.status === "Issued" },
  ];

  return (
    <Card title="My Training Journey">
      <div className="mb-4">
        <p className="text-sm font-semibold text-navy">Enrollment</p>
        <p className="text-xs text-muted-foreground">
          Enrolled {state.enrolledAt ? new Date(state.enrolledAt).toLocaleDateString() : "—"} ·
          Access expires{" "}
          {state.accessExpiresAt ? new Date(state.accessExpiresAt).toLocaleDateString() : "—"}
        </p>
      </div>

      {!state.profileCompleted && (
        <div className="mb-4 rounded-xl border border-marine/30 bg-marine/5 p-4">
          <p className="font-semibold text-navy">Complete your participant profile</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose the learning case you'll work on throughout the course.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => update((s) => setProfile(s, "A"))}
              className="rounded-lg bg-marine px-4 py-2 text-xs font-semibold text-marine-foreground hover:bg-marine/90"
            >
              Use BARUNA Simulation Case
            </button>
            <button
              onClick={() => update((s) => setProfile(s, "B"))}
              className="rounded-lg border border-marine/40 bg-card px-4 py-2 text-xs font-semibold text-navy hover:bg-marine/5"
            >
              Use My Own Area
            </button>
          </div>
        </div>
      )}

      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className={`flex items-start gap-3 rounded-xl border p-3 ${
              s.done ? "border-marine/30 bg-marine/5" : "border-border bg-muted/20"
            }`}
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                s.done ? "bg-marine text-marine-foreground" : "bg-muted text-foreground/60"
              }`}
            >
              {s.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${s.done ? "font-semibold text-navy" : "text-foreground/80"}`}>
                {s.label}
              </p>
              {s.hint && <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ---------- Modules panel ---------------------------------------------------

function ModulesPanel({ state, update }: { state: AzaState; update: Update }) {
  return (
    <div className="space-y-3">
      {AZA_MODULES.map((m) => (
        <ModuleCard key={m.no} module={m} state={state} update={update} />
      ))}
    </div>
  );
}

function ModuleCard({
  module,
  state,
  update,
}: {
  module: AzaModule;
  state: AzaState;
  update: Update;
}) {
  const unlocked = moduleUnlocked(state, module.no);
  const attempt = state.quizzes[module.no];
  const passed = (attempt?.percent ?? 0) >= AZA_PASS_MARK;
  const isPretest = module.no === 0;
  const pretest = state.pretest;

  const [answers, setAnswers] = useState<number[]>(Array(module.quiz.length).fill(-1));
  const [showResult, setShowResult] = useState(false);
  const [openContent, setOpenContent] = useState(false);

  return (
    <div
      className={`rounded-2xl border p-5 shadow-soft ${
        unlocked ? "border-border bg-card" : "border-dashed border-border bg-muted/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${
            passed || (isPretest && pretest)
              ? "bg-marine text-marine-foreground"
              : unlocked
                ? "bg-marine/15 text-marine"
                : "bg-muted text-foreground/50"
          }`}
        >
          {unlocked ? module.no : <Lock className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-bold text-navy">{module.title}</h3>
            <span className="rounded-full bg-marine/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-marine">
              {module.code}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground/70">
              <Clock className="mr-1 inline h-3 w-3" />
              {module.hours}h
            </span>
            {attempt && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  passed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                Best: {attempt.percent}%
              </span>
            )}
            {isPretest && pretest && (
              <span className="rounded-full bg-marine/15 px-2 py-0.5 text-[10px] font-semibold text-marine">
                Pre-test: {pretest.percent}% (diagnostic)
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{module.summary}</p>
        </div>
      </div>

      {!unlocked && (
        <p className="mt-3 text-xs text-muted-foreground">
          Complete the previous module quiz with at least {AZA_PASS_MARK}% to unlock.
        </p>
      )}

      {unlocked && (
        <>
          <button
            onClick={() => setOpenContent((v) => !v)}
            className="mt-3 text-xs font-semibold text-marine hover:text-navy"
          >
            {openContent ? "Hide" : "Show"} lesson content
          </button>
          {openContent && (
            <ul className="mt-2 space-y-1 rounded-xl bg-muted/30 p-3 text-xs">
              {module.content.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marine" />
                  {c}
                </li>
              ))}
              {module.activity && (
                <li className="mt-2 rounded-lg bg-marine/5 p-2 text-foreground/80">
                  <span className="font-semibold text-navy">Activity: </span>
                  {module.activity}
                </li>
              )}
            </ul>
          )}

          {/* Quiz */}
          <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-bold uppercase text-marine">
              {isPretest ? "Pre-test (diagnostic)" : `Module ${module.no} quiz`}
            </p>
            <ol className="mt-2 space-y-3">
              {module.quiz.map((q, qi) => (
                <li key={qi}>
                  <p className="text-sm font-medium text-navy">
                    {qi + 1}. {q.q}
                  </p>
                  <div className="mt-1 space-y-1">
                    {q.choices.map((c, ci) => (
                      <label
                        key={ci}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs ${
                          answers[qi] === ci
                            ? "border-marine bg-marine/5"
                            : "border-border bg-card hover:border-marine/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`m${module.no}q${qi}`}
                          checked={answers[qi] === ci}
                          onChange={() => {
                            const next = [...answers];
                            next[qi] = ci;
                            setAnswers(next);
                            setShowResult(false);
                          }}
                          className="h-3.5 w-3.5"
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                disabled={answers.some((a) => a === -1)}
                onClick={() => {
                  const a = scoreQuiz(module.quiz, answers);
                  setShowResult(true);
                  if (isPretest) update((s) => submitPretest(s, a));
                  else update((s) => submitQuiz(s, module.no, a));
                }}
                className="rounded-lg bg-marine px-4 py-2 text-xs font-semibold text-marine-foreground disabled:opacity-50 hover:bg-marine/90"
              >
                Submit
              </button>
              {showResult && (
                <span className="text-xs text-foreground/80">
                  Scored {scoreQuiz(module.quiz, answers).percent}%
                </span>
              )}
              {!isPretest && attempt && !passed && (
                <span className="text-xs text-amber-700">
                  Retake to reach {AZA_PASS_MARK}% and unlock the next module.
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ---------- Assignments panel -----------------------------------------------

function AssignmentsPanel({ state, update }: { state: AzaState; update: Update }) {
  const assignments = AZA_MODULES.filter((m) => m.assignment).map((m) => m.assignment!);
  return (
    <div className="space-y-3">
      {assignments.map((a) => {
        const saved = state.assignments[a.key] ?? "";
        return (
          <AssignmentForm
            key={a.key}
            title={a.title}
            instructions={a.instructions}
            fields={a.fields.map((f) => f.label)}
            initial={saved}
            onSave={(text) => update((s) => saveAssignment(s, a.key, text))}
            done={!!saved}
          />
        );
      })}
    </div>
  );
}

function AssignmentForm({
  title,
  instructions,
  fields,
  initial,
  onSave,
  done,
}: {
  title: string;
  instructions: string;
  fields: string[];
  initial: string;
  onSave: (text: string) => void;
  done: boolean;
}) {
  const [text, setText] = useState(initial);
  return (
    <Card
      title={title}
      right={
        done && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            Saved
          </span>
        )
      }
    >
      <p className="text-xs text-muted-foreground">{instructions}</p>
      <p className="mt-2 text-xs font-semibold text-navy">Fields to complete:</p>
      <ul className="mt-1 flex flex-wrap gap-1">
        {fields.map((f) => (
          <li
            key={f}
            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/70"
          >
            {f}
          </li>
        ))}
      </ul>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter your assignment response here (rows per field: institution — jurisdiction — role …)"
        rows={6}
        className="mt-3 w-full rounded-lg border border-border bg-card p-3 text-xs outline-none focus:border-marine"
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={() => onSave(text)}
          disabled={!text.trim()}
          className="rounded-lg bg-marine px-4 py-2 text-xs font-semibold text-marine-foreground disabled:opacity-50 hover:bg-marine/90"
        >
          Save Assignment
        </button>
      </div>
    </Card>
  );
}

// ---------- Project panel ---------------------------------------------------

function ProjectPanel({ state, update }: { state: AzaState; update: Update }) {
  const unlocked = projectUnlocked(state);
  const canSubmit = AZA_PROJECT_UPLOADS.filter((u) => u.required).every(
    (u) => !!state.project.files[u.key],
  );

  return (
    <Card
      title="Final Individual Project"
      right={
        <span className="rounded-full bg-marine/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-marine">
          {state.project.status}
        </span>
      }
    >
      {!unlocked ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Complete all learning modules (quizzes at ≥ {AZA_PASS_MARK}%) to unlock the final
          project.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Upload the required files below, then submit for expert review.
          </p>
          <div className="mt-3 space-y-2">
            {AZA_PROJECT_UPLOADS.map((u) => {
              const file = state.project.files[u.key];
              return (
                <div
                  key={u.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-navy">
                      {u.label}
                      {!u.required && (
                        <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                          (optional)
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : "No file yet"}
                    </p>
                  </div>
                  <label className="cursor-pointer rounded-lg border border-marine/30 bg-card px-3 py-1.5 text-xs font-semibold text-marine hover:bg-marine/5">
                    {file ? "Replace" : "Upload"}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) update((s) => uploadProjectFile(s, u.key, f));
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              disabled={!canSubmit || state.project.status === "Approved"}
              onClick={() => update(submitProject)}
              className="rounded-lg bg-marine px-4 py-2 text-xs font-semibold text-marine-foreground disabled:opacity-50 hover:bg-marine/90"
            >
              {state.project.status === "Not Started" || state.project.status === "In Progress"
                ? "Submit Project"
                : "Resubmit"}
            </button>
            {/* Simulated reviewer actions for individual demo/testing */}
            {state.project.status === "Submitted" && (
              <button
                onClick={() =>
                  update((s) =>
                    advanceReview(
                      s,
                      "Under Expert Review",
                      "Your submission passed the completeness check and is now with an expert reviewer.",
                    ),
                  )
                }
                className="rounded-lg border border-marine/40 bg-card px-3 py-2 text-xs font-semibold text-navy hover:bg-marine/5"
              >
                Simulate: completeness passed
              </button>
            )}
            {state.project.status === "Under Expert Review" && (
              <>
                <button
                  onClick={() =>
                    update((s) =>
                      advanceReview(
                        s,
                        "Revision Required",
                        "Please strengthen the criteria weighting justification and expand the monitoring plan for the offshore sub-zone.",
                      ),
                    )
                  }
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Simulate: request revision
                </button>
                <button
                  onClick={() =>
                    update((s) =>
                      advanceReview(
                        s,
                        "Approved",
                        "Solid preliminary AZA proposal — approved for certification.",
                      ),
                    )
                  }
                  className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                >
                  Simulate: approve
                </button>
              </>
            )}
            {state.project.status === "Revision Required" && (
              <button
                onClick={() => update((s) => advanceReview(s, "Resubmitted"))}
                className="rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-marine-foreground hover:bg-marine/90"
              >
                Mark as resubmitted
              </button>
            )}
          </div>

          {state.project.expertNote && (
            <div className="mt-4 rounded-xl border border-marine/20 bg-marine/5 p-3">
              <p className="text-xs font-semibold text-navy">Written feedback</p>
              <p className="mt-1 text-xs text-foreground/80">{state.project.expertNote}</p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ---------- Post-test panel -------------------------------------------------

function PostTestPanel({ state, update }: { state: AzaState; update: Update }) {
  const unlocked = postTestUnlocked(state);
  const [answers, setAnswers] = useState<number[]>(Array(AZA_POSTTEST.length).fill(-1));
  const [showResult, setShowResult] = useState<number | null>(null);

  if (!unlocked) {
    return (
      <Card title="Post-Test">
        <p className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          The post-test unlocks after the final project has been submitted.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Post-Test"
      right={
        state.posttest && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            Best: {state.posttest.percent}%
          </span>
        )
      }
    >
      <ol className="space-y-3">
        {AZA_POSTTEST.map((q: AzaQuizQuestion, qi) => (
          <li key={qi}>
            <p className="text-sm font-medium text-navy">
              {qi + 1}. {q.q}
            </p>
            <div className="mt-1 space-y-1">
              {q.choices.map((c, ci) => (
                <label
                  key={ci}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs ${
                    answers[qi] === ci
                      ? "border-marine bg-marine/5"
                      : "border-border bg-card hover:border-marine/30"
                  }`}
                >
                  <input
                    type="radio"
                    name={`post${qi}`}
                    checked={answers[qi] === ci}
                    onChange={() => {
                      const next = [...answers];
                      next[qi] = ci;
                      setAnswers(next);
                    }}
                    className="h-3.5 w-3.5"
                  />
                  {c}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-3">
        <button
          disabled={answers.some((a) => a === -1)}
          onClick={() => {
            const a = scoreQuiz(AZA_POSTTEST, answers);
            setShowResult(a.percent);
            update((s) => submitPosttest(s, a));
          }}
          className="rounded-lg bg-marine px-4 py-2 text-xs font-semibold text-marine-foreground disabled:opacity-50 hover:bg-marine/90"
        >
          Submit Post-Test
        </button>
        {showResult !== null && (
          <span className="text-xs text-foreground/80">Scored {showResult}%</span>
        )}
      </div>
    </Card>
  );
}

// ---------- Evaluation panel ------------------------------------------------

function EvaluationPanel({ state, update }: { state: AzaState; update: Update }) {
  const [ratings, setRatings] = useState<Record<string, number>>(state.evaluation);
  return (
    <Card
      title="Course Evaluation"
      right={
        state.reflectionCompleted && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            Submitted
          </span>
        )
      }
    >
      <p className="text-xs text-muted-foreground">Rate each item from 1 (strongly disagree) to 5 (strongly agree).</p>
      <div className="mt-3 space-y-2">
        {AZA_EVALUATION_ITEMS.map((item) => (
          <div
            key={item}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 p-2"
          >
            <p className="min-w-0 flex-1 text-xs text-foreground/80">{item}</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRatings({ ...ratings, [item]: n })}
                  className={`h-7 w-7 rounded-md text-xs font-semibold ${
                    ratings[item] === n
                      ? "bg-marine text-marine-foreground"
                      : "bg-card text-navy hover:bg-marine/10"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          disabled={AZA_EVALUATION_ITEMS.some((i) => !ratings[i])}
          onClick={() => update((s) => saveEvaluation(s, ratings))}
          className="rounded-lg bg-marine px-4 py-2 text-xs font-semibold text-marine-foreground disabled:opacity-50 hover:bg-marine/90"
        >
          Submit Evaluation
        </button>
      </div>
    </Card>
  );
}

// ---------- Certificate panel -----------------------------------------------

function CertificatePanel({
  state,
  update,
  eligible,
  finalScore,
}: {
  state: AzaState;
  update: Update;
  eligible: boolean;
  finalScore: number;
}) {
  const status = state.certificate.status;
  return (
    <Card
      title="Digital Certificate"
      right={
        <span className="rounded-full bg-marine/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-marine">
          {status}
        </span>
      }
    >
      <p className="text-xs text-muted-foreground">{AZA_META.certificate} — {AZA_META.fullTitle}.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
        <Stat label="Final score" value={`${finalScore}/100`} />
        <Stat label="Passing grade" value={`${AZA_PASS_MARK}/100`} />
        <Stat label="Eligible" value={eligible ? "Yes" : "Not yet"} />
      </div>
      {state.certificate.status === "Issued" ? (
        <div className="mt-4 rounded-2xl border-2 border-marine bg-gradient-to-br from-marine/5 via-card to-accent/5 p-6 text-center">
          <Award className="mx-auto h-8 w-8 text-marine" />
          <p className="mt-2 text-xs font-semibold uppercase text-marine">
            BARUNA Digital Certificate of Completion
          </p>
          <h3 className="mt-1 font-display text-lg font-extrabold text-navy">
            {AZA_META.fullTitle}
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">Learning format: {AZA_META.format} · {AZA_META.hours}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Completion date:{" "}
            {state.certificate.issuedAt
              ? new Date(state.certificate.issuedAt).toLocaleDateString()
              : "—"}
          </p>
          <p className="mt-2 font-mono text-xs text-navy">Certificate No. {state.certificate.number}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Verify at /verify/{state.certificate.number}
          </p>
        </div>
      ) : (
        <button
          disabled={!eligible}
          onClick={() => update(issueCertificate)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-marine px-4 py-2 text-xs font-semibold text-marine-foreground disabled:opacity-50 hover:bg-marine/90"
        >
          <Award className="h-3.5 w-3.5" /> Issue My Certificate
        </button>
      )}
      {!eligible && (
        <p className="mt-2 text-xs text-muted-foreground">
          Complete every module (≥{AZA_PASS_MARK}%), submit and get approval on the final project,
          take the post-test, complete the evaluation, and reach a final score of {AZA_PASS_MARK}
          /100 to unlock certification.
        </p>
      )}
    </Card>
  );
}

// ---------- Notifications panel ---------------------------------------------

function NotificationsPanel({ state }: { state: AzaState }) {
  if (state.notifications.length === 0) {
    return (
      <Card title="Notifications">
        <p className="text-xs text-muted-foreground">No notifications yet.</p>
      </Card>
    );
  }
  return (
    <Card title="Notifications">
      <ul className="space-y-2">
        {state.notifications.map((n) => (
          <li
            key={n.id}
            className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs"
          >
            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marine" />
            <div className="min-w-0">
              <p className="text-foreground/80">{n.text}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {new Date(n.at).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
        <ArrowRight className="h-3 w-3" /> Access-expiry reminders trigger at 14, 7, 3 and 1 day
        remaining.
      </p>
    </Card>
  );
}

// Keep the imported constant referenced so tree-shaking preserves the route.
export const _learnId = AZA_LEARN_ID;
