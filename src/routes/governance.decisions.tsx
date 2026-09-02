import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listPendingDecisions,
  listSubmittedRecommendations,
  recordFinalDecision,
} from "@/lib/governance/governance.functions";

export const Route = createFileRoute("/governance/decisions")({
  component: DecisionsPage,
});

function DecisionsPage() {
  const fn = useServerFn(listPendingDecisions);
  const q = useQuery({ queryKey: ["governance", "decisions"], queryFn: () => fn() });
  const [openId, setOpenId] = useState<string | null>(null);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pending Decisions</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subjects awaiting decision.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.id} className="rounded border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {s.kind} · {s.current_status}
                  </p>
                  <p className="font-medium">{s.title}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOpenId(openId === s.id ? null : s.id)}
                    className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    {openId === s.id ? "Hide" : "Review"}
                  </button>
                  <Link to="/governance/audit/$subjectId" params={{ subjectId: s.id }} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted">
                    Audit
                  </Link>
                </div>
              </div>
              {openId === s.id ? <DecisionPanel subjectId={s.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DecisionPanel({ subjectId }: { subjectId: string }) {
  const qc = useQueryClient();
  const recsFn = useServerFn(listSubmittedRecommendations);
  const decideFn = useServerFn(recordFinalDecision);
  const q = useQuery({
    queryKey: ["governance", "recs", subjectId],
    queryFn: () => recsFn({ data: { subjectId } }),
  });
  const [rationale, setRationale] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (decision: "approve" | "reject" | "return_for_revision") =>
      decideFn({ data: { subjectId, decision, rationale } }),
    onSuccess: (_, decision) => {
      setMsg(`Decision recorded: ${decision}`);
      qc.invalidateQueries({ queryKey: ["governance", "decisions"] });
      qc.invalidateQueries({ queryKey: ["governance", "recs", subjectId] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <h4 className="text-sm font-semibold">Submitted recommendations</h4>
      {q.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">No submitted recommendations yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {(q.data ?? []).map((r) => (
            <li key={r.id} className="rounded bg-muted/40 p-2">
              <p>
                <strong>{r.recommendation}</strong>
                <span className="ml-2 text-xs text-muted-foreground">
                  by {r.reviewer_id.slice(0, 8)}… · {new Date(r.submitted_at ?? "").toLocaleString()}
                </span>
              </p>
              {r.rationale ? <p className="text-xs text-muted-foreground">{r.rationale}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="Decision rationale (optional)"
        className="w-full rounded border border-border bg-background p-2 text-sm"
        rows={3}
      />
      <div className="flex flex-wrap gap-2">
        <button onClick={() => m.mutate("approve")} className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white">
          Approve
        </button>
        <button onClick={() => m.mutate("reject")} className="rounded bg-red-600 px-3 py-1.5 text-sm text-white">
          Reject
        </button>
        <button onClick={() => m.mutate("return_for_revision")} className="rounded border border-border px-3 py-1.5 text-sm">
          Return for revision
        </button>
      </div>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
