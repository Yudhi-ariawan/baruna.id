// Full Training Program learning dashboard (e.g. International Training on
// Fisheries for African Countries). Reached only after the server confirms an
// approved enrollment for the program (see academy.learn.$id). Learning
// progress itself still lives in browser storage; moving it to the server is
// part of the certificate work awaiting the mentor (dokumen/MENUNGGU_ARAHAN_MENTOR.md).
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { Toaster } from "@/components/baruna/Toaster";
import { ModuleQuiz } from "@/components/baruna/academy/ModuleQuiz";
import { barunaToast } from "@/lib/downloads";
import type { CertificateData, TranscriptScores } from "@/lib/certificate";
import { getMyParticipantBiodata } from "@/lib/academy/participant-biodata.functions";
import {
  LMS_MODULES,
  LMS_TOTAL_HOURS,
  TRAINING_DATES,
  PRE_TEST,
  POST_TEST,
  FINAL_EXAM,
  type ResourceKind,
} from "@/data/lms";
import { getAssessmentConfig } from "@/data/quizzes";
import {
  useApplication,
  getLms,
  updateLms,
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
  getOrCreateDemoFullTrainingApp,
  type DocumentMeta,
} from "@/lib/application";
import { codeForLmsId } from "@/data/masterModules";
import { completeShortCourse } from "@/lib/shortCourses";
import { DashHeader, ProgressSummary, JourneyTracker, SectionIntro } from "./DashboardChrome";
import { ModuleCard } from "./ModuleCard";
import { AssignmentProgress, ActionPlanCard, ReflectionCard, KnowledgeSharingCard } from "./AssignmentCards";
import { WelcomeTab, AssessmentTab, CompletionTab } from "./FullTrainingTabs";
import { TABS, assessmentModule, type Tab, type AssessmentId } from "./shared";

export function FullTrainingLearningDashboard({ id }: { id: string }) {
  const appFromHook = useApplication(id);
  const app =
    appFromHook ||
    (id === "demo" || id === "africa-fisheries-2026"
      ? getOrCreateDemoFullTrainingApp()
      : undefined);
  const [tab, setTab] = useState<Tab>("Welcome");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [quizModuleId, setQuizModuleId] = useState<string | null>(null);
  const [assessmentOpen, setAssessmentOpen] = useState<AssessmentId | null>(null);

  const { data: myBiodataRes } = useQuery({
    queryKey: ["my-participant-biodata"],
    queryFn: () => getMyParticipantBiodata(),
    staleTime: 5 * 60 * 1000,
  });

  if (!app) {
    return (
      <AcademyShell active="my-learning">
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-navy">Learning Space Not Found</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            No module or training program with ID &quot;{id}&quot; is currently available or it may still be under review.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/academy/learn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-white hover:bg-marine/90"
            >
              Back to My Learning
            </Link>
            <Link
              to="/academy/self-paced"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-navy hover:bg-muted"
            >
              Browse Self-Paced Modules
            </Link>
          </div>
        </div>
      </AcademyShell>
    );
  }

  const confirmed = app.participationConfirmed;
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

  // Journey gating. Demo Mode no longer unlocks steps inside the learning room.
  const modulesStepDone = completedModules === totalModules && allModuleQuizzesPassed(app);
  const postUnlocked = allModuleQuizzesPassed(app);
  const finalUnlocked = lms.postTest;
  const actionUnlocked = lms.finalExam;
  const reflectionUnlocked = actionPlanSubmitted(app);
  const knowledgeUnlocked = reflectionSubmitted(app);
  const courseComplete = isCourseComplete(app);

  const journey: { label: string; done: boolean; unlocked: boolean }[] = [
    { label: "Pre-Test", done: lms.preTest, unlocked: true },
    { label: "Modules", done: modulesStepDone, unlocked: lms.preTest },
    { label: "Post-Test", done: lms.postTest, unlocked: postUnlocked },
    { label: "Final Examination", done: lms.finalExam, unlocked: finalUnlocked },
    { label: "Action Plan", done: actionPlanSubmitted(app), unlocked: actionUnlocked },
    { label: "Reflection Paper", done: reflectionSubmitted(app), unlocked: reflectionUnlocked },
    { label: "Knowledge Sharing Report", done: knowledgeSharingSubmitted(app), unlocked: knowledgeUnlocked },
    { label: "Certificate", done: courseComplete, unlocked: courseComplete },
  ];
  const journeyDone = journey.filter((s) => s.done).length;
  const overall = Math.round((journeyDone / journey.length) * 100);

  const certificateUnlocked = courseComplete;

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
  const getCertData = (): CertificateData => {
    const bio = myBiodataRes?.biodata;
    return {
      name: bio?.nama || app.personal.fullName || "Participant",
      country: app.professional.country || app.personal.nationality || "Indonesia",
      program: app.title,
      dates: TRAINING_DATES,
      certNo: `B.589/BDA/RSDM.510/V/${new Date().getFullYear()}`,
      verifyUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/academy/certification?verify=${certNo}`,
      nip: bio?.nip || null,
      tempatLahir: bio?.tempatLahir || null,
      tanggalLahir: bio?.tanggalLahir || null,
      pangkatGolongan: bio?.pangkatGolongan || null,
      jabatan: bio?.jabatan || app.professional.position || myBiodataRes?.prefill.jabatan || null,
      instansi: bio?.instansiUnitKerja || app.professional.organization || null,
      workUnit: bio?.instansiUnitKerja || app.professional.organization || null,
      photoUrl: bio?.fotoUrl || null,
      learningHours: LMS_TOTAL_HOURS || 40,
    };
  };

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
        {tab === "Welcome" && <WelcomeTab />}

        {/* ── MODULES ── */}
        {tab === "Modules" && (
          <div className="space-y-4">
            <SectionIntro
              title="Learning Modules"
              desc="13 modules following the approved curriculum. Complete the Pre-Test to unlock Module 1, then pass each module quiz (70%) to unlock the next module."
            />
            {!lms.preTest && (
              <div className="flex items-center gap-2 rounded-xl border border-marine/30 bg-marine/5 p-4 text-sm font-medium text-marine">
                <Lock className="h-4 w-4" /> Complete the Pre-Test in the Assessment tab to unlock Module 1.
              </div>
            )}
            <div className="space-y-3">
              {LMS_MODULES.map((m) => {
                const unlocked = isModuleUnlocked(app, m.id);
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
          <AssessmentTab
            lms={lms}
            preRec={preRec}
            postRec={postRec}
            finalRec={finalRec}
            quizzesPassed={quizzesPassed}
            totalModules={totalModules}
            postUnlocked={postUnlocked}
            finalUnlocked={finalUnlocked}
            onOpen={setAssessmentOpen}
          />
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
          <CompletionTab
            app={app}
            lms={lms}
            courseComplete={courseComplete}
            completedModules={completedModules}
            totalModules={totalModules}
            quizzesPassed={quizzesPassed}
            getCertData={getCertData}
            transcript={transcript}
          />
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
