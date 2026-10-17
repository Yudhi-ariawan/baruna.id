import {
  ChevronRight,
  Lock,
  CheckCircle2,
  Circle,
  ListChecks,
  ClipboardCheck,
  FlaskConical,
  Timer,
  Sparkles,
  Video,
  FileDown,
  Map,
  BookMarked,
  type LucideIcon,
} from "lucide-react";
import { barunaToast } from "@/lib/downloads";
import { LMS_MODULES, WELCOME_ITEMS, PRE_TEST, POST_TEST, FINAL_EXAM } from "@/data/lms";
import { getAssessmentConfig } from "@/data/quizzes";
import {
  allModuleQuizzesPassed,
  actionPlanSubmitted,
  reflectionSubmitted,
  knowledgeSharingSubmitted,
  type getLms,
  type Application,
  type QuizRecord,
} from "@/lib/application";
import type { CertificateData, TranscriptScores } from "@/lib/certificate";
import { SectionIntro } from "./DashboardChrome";
import { AssessmentCard, ImprovementPanel } from "./AssessmentCards";
import { CompletionPanel, RequirementCard } from "./CompletionPanel";
import type { AssessmentId } from "./shared";

type LmsState = ReturnType<typeof getLms>;

const welcomeIcons: Record<string, LucideIcon> = {
  video: Video,
  guide: FileDown,
  journey: Map,
  handbook: BookMarked,
};

export function WelcomeTab() {
  return (
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
  );
}

export function AssessmentTab({
  lms,
  preRec,
  postRec,
  finalRec,
  quizzesPassed,
  totalModules,
  postUnlocked,
  finalUnlocked,
  onOpen,
}: {
  lms: LmsState;
  preRec: QuizRecord;
  postRec: QuizRecord;
  finalRec: QuizRecord;
  quizzesPassed: number;
  totalModules: number;
  postUnlocked: boolean;
  finalUnlocked: boolean;
  onOpen: (which: AssessmentId) => void;
}) {
  return (
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
        onOpen={() => onOpen("preTest")}
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
        onOpen={() => onOpen("postTest")}
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
        onOpen={() => onOpen("finalExam")}
      />
    </div>
  );
}

export function CompletionTab({
  app,
  lms,
  courseComplete,
  completedModules,
  totalModules,
  quizzesPassed,
  getCertData,
  transcript,
}: {
  app: Application;
  lms: LmsState;
  courseComplete: boolean;
  completedModules: number;
  totalModules: number;
  quizzesPassed: number;
  getCertData: () => CertificateData;
  transcript: TranscriptScores;
}) {
  if (courseComplete) {
    return <CompletionPanel data={getCertData()} transcript={transcript} />;
  }
  return (
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
  );
}
