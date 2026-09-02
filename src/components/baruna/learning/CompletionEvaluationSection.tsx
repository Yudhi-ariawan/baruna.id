// ============================================================================
// Completion Evaluation form (Phase 1.4 Increment 5)
// ----------------------------------------------------------------------------
// End-of-course / end-of-training evaluation. Not a learning assessment, not a
// course review, not a testimonial, and not a complaint channel. Answers never
// affect results, completion, or certificates — only the fact of submission is
// used as a certificate prerequisite.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { barunaToast } from "@/lib/downloads";
import {
  useCompletionEvaluationForm,
  useStartCompletionEvaluation,
  useSaveCompletionEvaluationDraft,
  useSubmitCompletionEvaluation,
} from "@/lib/learning/useCompletionEvaluation";
import type { AnswerMap, AnswerValue } from "@/lib/learning/completionEvaluation.functions";

const CONTEXT_HEADING: Record<string, string> = {
  course: "End-of-Course Evaluation",
  training: "End-of-Training Evaluation",
  webinar: "Webinar Evaluation",
  workshop: "Workshop Evaluation",
  programme: "Programme Evaluation",
};

export function CompletionEvaluationSection({ enrolmentId }: { enrolmentId: string | undefined }) {
  const formQ = useCompletionEvaluationForm(enrolmentId);
  const startMut = useStartCompletionEvaluation();
  const saveMut = useSaveCompletionEvaluationDraft();
  const submitMut = useSubmitCompletionEvaluation();
  const [draft, setDraft] = useState<AnswerMap>({});

  const data = formQ.data;
  const serverAnswers = useMemo(() => data?.answers ?? {}, [data]);

  useEffect(() => {
    setDraft(serverAnswers as AnswerMap);
  }, [serverAnswers]);

  if (!enrolmentId) {
    return (
      <p className="text-sm text-muted-foreground">
        Enrol in this offering to access the completion evaluation.
      </p>
    );
  }
  if (formQ.isLoading) return <p className="text-sm text-muted-foreground">Loading evaluation…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Evaluation unavailable.</p>;

  const state = data.state;
  const heading = CONTEXT_HEADING[state.context ?? "course"] ?? "Completion Evaluation";

  if (state.state === "not_required") {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-xl font-bold text-navy">Completion evaluation</h2>
        <p className="text-sm text-foreground/80">
          No completion evaluation is required for this offering.
        </p>
      </div>
    );
  }

  if (state.state === "submitted") {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-xl font-bold text-navy">{heading}</h2>
        <div className="flex items-start gap-2 rounded-xl bg-eco-community/15 px-3 py-2 text-sm font-semibold text-eco-community">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Evaluation submitted
            {state.submitted_at ? ` on ${new Date(state.submitted_at).toLocaleDateString()}` : ""}.
            Thank you — your responses are recorded and can no longer be edited.
          </span>
        </div>
      </div>
    );
  }

  const submissionId = state.submission_id;
  const version = state.draft_version ?? 1;

  async function handleStart() {
    try {
      await startMut.mutateAsync({ enrolmentId: enrolmentId! });
    } catch (e) {
      barunaToast(e instanceof Error ? e.message : "Could not start the evaluation");
    }
  }

  async function persist(): Promise<boolean> {
    if (!submissionId) return false;
    const changed = Object.fromEntries(
      Object.entries(draft).filter(
        ([k, v]) => JSON.stringify(serverAnswers[k]) !== JSON.stringify(v),
      ),
    ) as AnswerMap;
    if (Object.keys(changed).length === 0) return true;
    await saveMut.mutateAsync({ submissionId, expectedVersion: version, answers: changed });
    return true;
  }

  async function handleSave() {
    try {
      await persist();
      barunaToast("Draft saved.");
    } catch (e) {
      barunaToast(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleSubmit() {
    if (!submissionId) return;
    try {
      await persist();
      await submitMut.mutateAsync({ submissionId });
      barunaToast("Evaluation submitted.");
    } catch (e) {
      barunaToast(e instanceof Error ? e.message : "Submit failed");
    }
  }

  const busy = saveMut.isPending || submitMut.isPending || startMut.isPending;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="font-display text-xl font-bold text-navy">{data.template?.title ?? heading}</h2>
        {data.template?.intro_text ? (
          <p className="text-sm text-foreground/80">{data.template.intro_text}</p>
        ) : null}
        <div className="flex items-start gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This evaluation collects your feedback on the learning experience. It is not an
            assessment: your answers never affect your results, completion, or certificate. Only the
            fact that you submitted it is recorded as a certificate prerequisite.
          </span>
        </div>
      </div>

      {state.state === "not_started" ? (
        <button
          onClick={handleStart}
          disabled={busy}
          className="rounded-xl bg-marine px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-marine/90 disabled:opacity-60"
        >
          {startMut.isPending ? "Opening…" : "Start evaluation"}
        </button>
      ) : (
        <>
          <ol className="space-y-4">
            {data.questions.map((q) => (
              <li key={q.id} className="rounded-xl border border-border bg-background p-4">
                <label className="block text-sm font-semibold text-navy">
                  {q.display_order}. {q.question_text}
                  {q.is_required ? <span className="ml-1 text-destructive">*</span> : null}
                </label>
                {q.help_text ? (
                  <p className="mt-1 text-xs text-muted-foreground">{q.help_text}</p>
                ) : null}
                <div className="mt-3">
                  <QuestionInput
                    question={q}
                    value={draft[q.id]}
                    onChange={(v) => setDraft((d) => ({ ...d, [q.id]: v }))}
                  />
                </div>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={busy}
              className="rounded-xl border border-marine px-4 py-2 text-sm font-semibold text-marine transition hover:bg-marine/10 disabled:opacity-60"
            >
              {saveMut.isPending ? "Saving…" : "Save draft"}
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy}
              className="rounded-xl bg-marine px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-marine/90 disabled:opacity-60"
            >
              {submitMut.isPending ? "Submitting…" : "Submit evaluation"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Once submitted, your evaluation is final and cannot be edited.
          </p>
        </>
      )}
    </div>
  );
}

type Q = {
  id: string;
  question_type: string;
  choices: string[];
  rating_min: number | null;
  rating_max: number | null;
};

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Q;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
}) {
  switch (question.question_type) {
    case "rating_scale": {
      const min = question.rating_min ?? 1;
      const max = question.rating_max ?? 5;
      const opts = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return (
        <div className="flex flex-wrap gap-2">
          {opts.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`h-9 w-9 rounded-lg border text-sm font-semibold transition ${
                value === n
                  ? "border-marine bg-marine text-white"
                  : "border-border bg-background text-navy hover:border-marine"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      );
    }
    case "yes_no":
      return (
        <div className="flex gap-2">
          {[true, false].map((b) => (
            <button
              key={String(b)}
              type="button"
              onClick={() => onChange(b)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                value === b
                  ? "border-marine bg-marine text-white"
                  : "border-border bg-background text-navy hover:border-marine"
              }`}
            >
              {b ? "Yes" : "No"}
            </button>
          ))}
        </div>
      );
    case "single_choice":
      return (
        <div className="flex flex-wrap gap-2">
          {question.choices.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                value === c
                  ? "border-marine bg-marine text-white"
                  : "border-border bg-background text-navy hover:border-marine"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      );
    case "multiple_choice": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2">
          {question.choices.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() =>
                onChange(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c])
              }
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                selected.includes(c)
                  ? "border-marine bg-marine text-white"
                  : "border-border bg-background text-navy hover:border-marine"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      );
    }
    case "short_text":
      return (
        <input
          type="text"
          maxLength={500}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      );
    default:
      return (
        <textarea
          rows={4}
          maxLength={5000}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      );
  }
}
