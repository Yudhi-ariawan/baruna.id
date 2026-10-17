import { Lock, CheckCircle2, ChevronDown, Award, Clock, Target, ExternalLink } from "lucide-react";
import type { LmsModule, ResourceKind } from "@/data/lms";
import { hasQuizBank, getQuizBank, QUIZ_PASS_PERCENT } from "@/data/quizzes";
import { isModuleComplete, type ModuleProgress, type QuizRecord } from "@/lib/application";
import { RESOURCE_ORDER, resourceMeta } from "./shared";

export function ModuleCard({
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
