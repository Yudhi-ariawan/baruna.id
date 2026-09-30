import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getReviewSubject,
  saveReviewDraft,
  submitReviewRecommendation,
  withdrawReviewRecord,
  declareConflict,
} from "@/lib/governance/governance.functions";
import { ReviewCriteriaForm } from "@/components/governance/ReviewCriteriaForm";

export const Route = createFileRoute("/governance/subject/$id")({
  component: SubjectPage,
});

type Recommendation = "approve" | "reject" | "request_changes";

function SubjectPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fn = useServerFn(getReviewSubject);
  const q = useQuery({
    queryKey: ["governance", "subject", id],
    queryFn: () => fn({ data: { id } }),
  });

  const saveFn = useServerFn(saveReviewDraft);
  const submitFn = useServerFn(submitReviewRecommendation);
  const withdrawFn = useServerFn(withdrawReviewRecord);
  const coiFn = useServerFn(declareConflict);

  const [rec, setRec] = useState<Recommendation>("approve");
  const [rationale, setRationale] = useState("");
  const [criteria, setCriteria] = useState<Record<string, unknown>>({});
  const [coiReason, setCoiReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const saveM = useMutation({
    mutationFn: (payload: { recommendation: Recommendation; rationale: string; criteria: Record<string, unknown> }) => {
      const assignmentId = q.data?.assignment?.id;
      if (!assignmentId) throw new Error("No active assignment for you on this subject.");
      return saveFn({
        data: {
          subjectId: id,
          assignmentId,
          recommendation: payload.recommendation,
          rationale: payload.rationale,
          criteria: payload.criteria,
        },
      });
    },
    onSuccess: () => {
      setMsg("Draft saved.");
      qc.invalidateQueries({ queryKey: ["governance", "subject", id] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const submitM = useMutation({
    mutationFn: async () => {
      // Always persist current draft state (criteria + rationale + recommendation)
      // so the server-side validator sees the latest edits before enforcing the
      // template criteria schema.
      const saved = await saveM.mutateAsync({ recommendation: rec, rationale, criteria });
      return submitFn({ data: { recordId: saved.id } });
    },
    onSuccess: () => {
      setMsg("Recommendation submitted.");
      qc.invalidateQueries({ queryKey: ["governance", "subject", id] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const withdrawM = useMutation({
    mutationFn: () => withdrawFn({ data: { recordId: q.data!.myRecord!.id } }),
    onSuccess: () => {
      setMsg("Record withdrawn.");
      qc.invalidateQueries({ queryKey: ["governance", "subject", id] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const coiM = useMutation({
    mutationFn: () => coiFn({ data: { assignmentId: q.data!.assignment!.id, reason: coiReason } }),
    onSuccess: () => {
      setMsg("Conflict declared; you are recused from this subject.");
      qc.invalidateQueries({ queryKey: ["governance", "subject", id] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  if (!q.data?.subject) return <p className="text-sm">Subject not found or not visible.</p>;

  const { subject, assignment, myRecord } = q.data;
  const submitted = myRecord?.status === "submitted";
  const recused = assignment?.status === "recused";

  return (
    <div className="space-y-6">
      <div>
        <Link to="/governance/queue" className="text-xs text-primary hover:underline">
          ← Back to queue
        </Link>
        <h2 className="mt-2 text-xl font-semibold">{subject.title}</h2>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {subject.kind} · workflow: {subject.current_status}
        </p>
        {subject.description ? <p className="mt-3 text-sm">{subject.description}</p> : null}
      </div>

      {!assignment ? (
        <div className="rounded border border-border bg-muted/30 p-4 text-sm">
          You are not assigned as a reviewer on this subject.
        </div>
      ) : recused ? (
        <div className="rounded border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
          You are recused (COI declared). No further review actions are possible.
        </div>
      ) : (
        <>
          <section className="rounded border border-border p-4">
            <h3 className="text-sm font-semibold">Your recommendation</h3>
            {submitted ? (
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  Submitted: <strong>{myRecord.recommendation}</strong>
                </p>
                {myRecord.rationale ? <p className="text-muted-foreground">{myRecord.rationale}</p> : null}
                <button
                  onClick={() => withdrawM.mutate()}
                  className="mt-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  Withdraw
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  {(["approve", "reject", "request_changes"] as Recommendation[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRec(r)}
                      className={`rounded border px-3 py-1.5 text-xs ${rec === r ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  value={rationale || myRecord?.rationale || ""}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Rationale (optional)"
                  className="w-full rounded border border-border bg-background p-2 text-sm"
                  rows={4}
                />
                <div className="rounded border border-border p-3">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide">Criteria</h4>
                  <ReviewCriteriaForm
                    templateVersionId={assignment?.template_version_id ?? null}
                    initial={(myRecord?.criteria as Record<string, unknown>) ?? {}}
                    onChange={setCriteria}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveM.mutate({ recommendation: rec, rationale, criteria })}
                    className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
                    disabled={saveM.isPending}
                  >
                    Save draft
                  </button>
                  <button
                    onClick={() => submitM.mutate()}
                    className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                    disabled={submitM.isPending}
                  >
                    Submit recommendation
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded border border-border p-4">
            <h3 className="text-sm font-semibold">Declare conflict of interest</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Declaring a COI recuses you from this subject and is logged in the governance audit trail.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={coiReason}
                onChange={(e) => setCoiReason(e.target.value)}
                placeholder="Reason"
                className="flex-1 rounded border border-border bg-background p-2 text-sm"
              />
              <button
                onClick={() => coiM.mutate()}
                disabled={!coiReason || coiM.isPending}
                className="rounded border border-yellow-500/40 px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-500/10"
              >
                Declare COI
              </button>
            </div>
          </section>
        </>
      )}

      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
