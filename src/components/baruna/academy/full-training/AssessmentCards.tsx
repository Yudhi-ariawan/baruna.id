import { Lock, CheckCircle2, Circle, TrendingUp, type LucideIcon } from "lucide-react";
import type { AssessmentConfig } from "@/data/quizzes";
import type { QuizRecord } from "@/lib/application";

export function AssessmentCard({
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

export function ImprovementPanel({ pre, post }: { pre: number; post: number }) {
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
