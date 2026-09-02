import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  ListChecks,
  CheckCircle2,
  XCircle,
  Award,
  AlertTriangle,
  RotateCcw,
  Trophy,
  Lock,
  Clock,
} from "lucide-react";
import {
  buildAttempt,
  getQuizBank,
  getAssessmentConfig,
  type AssessmentConfig,
  type RunQuestion,
} from "@/data/quizzes";
import { getQuizRecord, recordQuizAttempt, type Application } from "@/lib/application";
import type { LmsModule } from "@/data/lms";

type Phase = "intro" | "taking" | "result";

/**
 * Full-screen, mobile-responsive quiz engine used for module quizzes and the
 * standalone Pre-Test, Post-Test and Final Examination. Randomizes questions and
 * answers, supports per-assessment question count / attempts / pass mark / time
 * limit, scores immediately, reviews each question and saves results to the
 * learner record.
 */
export function ModuleQuiz({
  app,
  module: m,
  onClose,
  config: configOverride,
}: {
  app: Application;
  module: LmsModule;
  onClose: () => void;
  config?: AssessmentConfig;
}) {
  const config = configOverride ?? getAssessmentConfig(m.id);
  const bank = getQuizBank(m.id);
  const record = getQuizRecord(app, m.id);
  const attemptsUsed = record.attempts.length;
  const attemptsLeft = Math.max(0, config.maxAttempts - attemptsUsed);
  const completedOnce = !!config.noPassMark && attemptsUsed > 0;
  const exhausted = attemptsLeft === 0 && !record.passed;
  const finished = record.passed || completedOnce;

  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<RunQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: number; total: number; score: number; passed: boolean } | null>(null);

  const headerLabel = config.label ?? (m.id === "postTest" ? "Post-Test" : `Module ${m.no} Quiz`);
  const count = bank ? Math.min(bank.questions.length, config.count) : config.count;

  const start = () => {
    if (!bank || exhausted || finished) return;
    setQuestions(buildAttempt(bank, config.count));
    setAnswers({});
    setResult(null);
    setSecondsLeft(config.timeLimitMin ? config.timeLimitMin * 60 : null);
    setPhase("taking");
  };

  const answered = useMemo(() => Object.keys(answers).length, [answers]);
  const allAnswered = questions.length > 0 && answered === questions.length;

  const submit = (auto = false) => {
    let correct = 0;
    for (const q of questions) if (answers[q.id] === q.correctIndex) correct++;
    const total = questions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = config.noPassMark ? true : score >= config.passPercent;
    recordQuizAttempt(app.id, m.id, correct, total, config.passPercent);
    setResult({ correct, total, score, passed });
    setSecondsLeft(null);
    setPhase("result");
    if (auto) {
      /* time ran out — result is shown automatically */
    }
  };

  // Countdown timer for timed assessments (Final Examination).
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (phase !== "taking" || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      submitRef.current(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [phase, secondsLeft]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="my-4 w-full max-w-2xl rounded-2xl border border-border bg-card shadow-hover">
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
              <ListChecks className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-marine">{headerLabel}</p>
              <h2 className="font-display text-base font-bold text-navy">{m.title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {phase === "taking" && secondsLeft !== null && (
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-bold tabular-nums ${secondsLeft <= 60 ? "bg-destructive/10 text-destructive" : "bg-marine/10 text-marine"}`}>
                <Clock className="h-4 w-4" /> {formatTime(secondsLeft)}
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Close quiz"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {!bank ? (
            <IntroEmpty />
          ) : phase === "intro" ? (
            <Intro
              config={config}
              record={record}
              attemptsUsed={attemptsUsed}
              attemptsLeft={attemptsLeft}
              exhausted={exhausted}
              finished={finished}
              count={count}
              onStart={start}
              onClose={onClose}
            />
          ) : phase === "taking" ? (
            <Taking
              questions={questions}
              answers={answers}
              onPick={(qid, idx) => setAnswers((a) => ({ ...a, [qid]: idx }))}
              answered={answered}
              allAnswered={allAnswered}
              onSubmit={() => submit(false)}
            />
          ) : (
            result && (
              <Result
                config={config}
                result={result}
                questions={questions}
                answers={answers}
                attemptsLeft={Math.max(0, config.maxAttempts - (attemptsUsed + 1))}
                onRetry={start}
                onClose={onClose}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function IntroEmpty() {
  return (
    <div className="py-6 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <ListChecks className="h-6 w-6" />
      </span>
      <h3 className="mt-3 font-display text-base font-bold text-navy">Quiz coming soon</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        The question bank for this module is being prepared and will be available here shortly.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-center">
      <p className="font-display text-lg font-extrabold text-navy">{value}</p>
      <p className="text-[0.7rem] text-muted-foreground">{label}</p>
    </div>
  );
}

function Intro({
  config,
  record,
  attemptsUsed,
  attemptsLeft,
  exhausted,
  finished,
  count,
  onStart,
  onClose,
}: {
  config: AssessmentConfig;
  record: { passed: boolean; bestScore: number; attempts: { score: number; passed: boolean }[] };
  attemptsUsed: number;
  attemptsLeft: number;
  exhausted: boolean;
  finished: boolean;
  count: number;
  onStart: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Questions" value={`${count}`} />
        <Stat label="Pass mark" value={config.noPassMark ? "None" : `${config.passPercent}%`} />
        <Stat label={config.maxAttempts === 1 ? "Attempts" : "Attempts left"} value={config.maxAttempts === 1 ? "1" : `${attemptsLeft}/${config.maxAttempts}`} />
        <Stat label={config.timeLimitMin ? "Time limit" : "Best score"} value={config.timeLimitMin ? `${config.timeLimitMin}m` : attemptsUsed ? `${record.bestScore}%` : "—"} />
      </div>

      <ul className="space-y-1.5 rounded-xl border border-border bg-background p-4 text-xs text-foreground/80">
        <li>• 4 answer choices per question, only one is correct.</li>
        <li>• Questions and answers are presented in random order.</li>
        <li>• Your score is shown immediately after you submit.</li>
        {config.noPassMark ? (
          <li>• This is a baseline test — there is no pass mark and it does not affect graduation.</li>
        ) : (
          <li>• You must score at least {config.passPercent}% to pass.</li>
        )}
        {config.timeLimitMin && <li>• You have {config.timeLimitMin} minutes — the test submits automatically when time runs out.</li>}
        <li>• {config.maxAttempts === 1 ? "Only one attempt is allowed." : `Maximum of ${config.maxAttempts} attempts.`}</li>
      </ul>

      {finished ? (
        <div className="flex items-center gap-2 rounded-xl border border-badge-training/30 bg-badge-training/5 p-3 text-sm font-semibold text-badge-training">
          <Trophy className="h-4 w-4" /> {config.noPassMark ? `Completed with a score of ${record.bestScore}%.` : `You already passed with ${record.bestScore}%.`}
        </div>
      ) : exhausted ? (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
          <Lock className="h-4 w-4" /> No attempts remaining. Best score: {record.bestScore}%.
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          onClick={onClose}
          className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-muted"
        >
          Close
        </button>
        <button
          onClick={onStart}
          disabled={finished || exhausted}
          className="rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {attemptsUsed > 0 ? "Retake" : "Start"}
        </button>
      </div>
    </div>
  );
}

function Taking({
  questions,
  answers,
  onPick,
  answered,
  allAnswered,
  onSubmit,
}: {
  questions: RunQuestion[];
  answers: Record<string, number>;
  onPick: (qid: string, idx: number) => void;
  answered: number;
  allAnswered: boolean;
  onSubmit: () => void;
}) {
  const pct = Math.round((answered / questions.length) * 100);
  const letters = ["A", "B", "C", "D", "E", "F"];
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>{answered} of {questions.length} answered</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-marine transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="space-y-4">
        {questions.map((q, qi) => (
          <li key={q.id} className="rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-semibold text-navy">
              <span className="text-marine">{qi + 1}.</span> {q.prompt}
            </p>
            <div className="mt-3 grid gap-2">
              {q.choices.map((c, ci) => {
                const selected = answers[q.id] === ci;
                return (
                  <button
                    key={ci}
                    onClick={() => onPick(q.id, ci)}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      selected
                        ? "border-marine bg-marine/10 text-navy"
                        : "border-border bg-card text-foreground/80 hover:border-marine/40"
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        selected ? "bg-marine text-marine-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {letters[ci]}
                    </span>
                    <span>{c.text}</span>
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {!allAnswered && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" /> Answer all questions to submit.
        </p>
      )}
      <div className="flex justify-end">
        <button
          onClick={onSubmit}
          disabled={!allAnswered}
          className="rounded-xl bg-marine px-6 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function Result({
  config,
  result,
  questions,
  answers,
  attemptsLeft,
  onRetry,
  onClose,
}: {
  config: AssessmentConfig;
  result: { correct: number; total: number; score: number; passed: boolean };
  questions: RunQuestion[];
  answers: Record<string, number>;
  attemptsLeft: number;
  onRetry: () => void;
  onClose: () => void;
}) {
  const letters = ["A", "B", "C", "D", "E", "F"];
  const noPass = config.noPassMark;
  const good = noPass ? true : result.passed;
  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border p-5 text-center ${
          good ? "border-badge-training/30 bg-badge-training/5" : "border-destructive/30 bg-destructive/5"
        }`}
      >
        <span
          className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${
            good ? "bg-badge-training/15 text-badge-training" : "bg-destructive/15 text-destructive"
          }`}
        >
          {good ? <Award className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
        </span>
        <p className={`mt-3 font-display text-2xl font-extrabold ${good ? "text-badge-training" : "text-destructive"}`}>
          {noPass ? "COMPLETED" : result.passed ? "PASS" : "FAIL"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          You scored <span className="font-bold text-navy">{result.score}%</span> ({result.correct}/{result.total} correct)
          {!noPass && ` · pass mark ${config.passPercent}%`}
        </p>
        {noPass ? (
          <p className="mt-1 text-xs font-medium text-badge-training">Your baseline score has been saved to your learner profile.</p>
        ) : result.passed ? (
          <p className="mt-1 text-xs font-medium text-badge-training">This assessment is now complete.</p>
        ) : attemptsLeft > 0 ? (
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} remaining.
          </p>
        ) : (
          <p className="mt-1 text-xs font-medium text-destructive">No attempts remaining.</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground/70">Review answers</p>
        <ol className="space-y-3">
          {questions.map((q, qi) => {
            const picked = answers[q.id];
            const correct = picked === q.correctIndex;
            return (
              <li key={q.id} className="rounded-xl border border-border bg-background p-4">
                <p className="flex items-start gap-2 text-sm font-semibold text-navy">
                  {correct ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-badge-training" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span>{qi + 1}. {q.prompt}</span>
                </p>
                <div className="mt-2 grid gap-1.5">
                  {q.choices.map((c, ci) => {
                    const isCorrect = ci === q.correctIndex;
                    const isPicked = ci === picked;
                    return (
                      <div
                        key={ci}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          isCorrect
                            ? "border-badge-training/40 bg-badge-training/10 text-navy"
                            : isPicked
                              ? "border-destructive/40 bg-destructive/10 text-navy"
                              : "border-border bg-card text-foreground/70"
                        }`}
                      >
                        <span className="text-xs font-bold text-muted-foreground">{letters[ci]}</span>
                        <span className="flex-1">{c.text}</span>
                        {isCorrect && <span className="text-[0.65rem] font-bold uppercase text-badge-training">Correct</span>}
                        {isPicked && !isCorrect && (
                          <span className="text-[0.65rem] font-bold uppercase text-destructive">Your answer</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          onClick={onClose}
          className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-muted"
        >
          Close
        </button>
        {!noPass && !result.passed && attemptsLeft > 0 && (
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
          >
            <RotateCcw className="h-4 w-4" /> Retake
          </button>
        )}
      </div>
    </div>
  );
}
