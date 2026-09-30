import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { getReviewSubjectFull } from "@/lib/governance/governance-ops.functions";
import { recordFinalDecision } from "@/lib/governance/governance.functions";
import { AssignmentPanel } from "@/components/governance/AssignmentPanel";

export const Route = createFileRoute("/governance/subjects/$id")({
  component: SubjectDetail,
});

function SubjectDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fn = useServerFn(getReviewSubjectFull);
  const decideFn = useServerFn(recordFinalDecision);
  const [rationale, setRationale] = useState("");
  const [decisionNotice, setDecisionNotice] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["governance", "subjects", "detail", id],
    queryFn: () => fn({ data: { id } }),
  });

  const decideM = useMutation({
    mutationFn: (decision: "approve" | "reject" | "return_for_revision") =>
      decideFn({ data: { subjectId: id, decision, rationale: rationale.trim() || undefined } }),
    onSuccess: (_, decision) => {
      const labels = {
        approve: "Persetujuan (Approve) berhasil! Expert/Modul telah disetujui & dipublikasikan.",
        reject: "Pengajuan telah ditolak (Reject).",
        return_for_revision: "Pengajuan dikembalikan untuk perbaikan (Return for revision).",
      };
      setDecisionNotice(labels[decision] ?? `Keputusan disimpan: ${decision}`);
      qc.invalidateQueries({ queryKey: ["governance", "subjects", "detail", id] });
      qc.invalidateQueries({ queryKey: ["governance", "subjects"] });
      qc.invalidateQueries({ queryKey: ["governance", "decisions"] });
    },
    onError: (err: Error) => setDecisionNotice(`Error: ${err.message}`),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  if (!q.data) return <p className="text-sm">Subject not found.</p>;

  const { subject, revisions, assignments, records, decisions, drafts } = q.data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/governance/subjects" className="text-xs text-primary hover:underline">
          ← All subjects
        </Link>
        <h2 className="mt-2 text-xl font-semibold">{subject.title}</h2>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {subject.kind} · {subject.current_status} · required recommendations:{" "}
          {subject.required_recommendations}
        </p>
        {subject.description ? <p className="mt-3 text-sm">{subject.description}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Submitted by <span className="font-mono">{subject.submitted_by.slice(0, 8)}…</span> ·
          created {new Date(subject.created_at).toLocaleString()}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/governance/audit/$subjectId"
            params={{ subjectId: subject.id }}
            className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            View audit trail
          </Link>
          <Link
            to="/governance/decisions"
            className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Decision workspace
          </Link>
        </div>
      </div>

      {/* Admin Action Decision Card */}
      <section className="rounded-xl border border-marine/20 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-marine" />
            <h3 className="text-base font-bold text-navy">Keputusan Admin / Administrative Decision</h3>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              subject.current_status === "approved"
                ? "bg-emerald-100 text-emerald-800"
                : subject.current_status === "rejected"
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            Status: {subject.current_status}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-foreground/80">
            Catatan Keputusan / Rationale (opsional):
          </label>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Tuliskan catatan alasan persetujuan, revisi, atau penolakan..."
            className="w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus:border-marine"
            rows={2}
          />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              disabled={decideM.isPending}
              onClick={() => decideM.mutate("approve")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Setujui (Approve)
            </button>
            <button
              disabled={decideM.isPending}
              onClick={() => decideM.mutate("return_for_revision")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Minta Revisi
            </button>
            <button
              disabled={decideM.isPending}
              onClick={() => decideM.mutate("reject")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Tolak (Reject)
            </button>
            {decideM.isPending && (
              <span className="text-xs font-medium text-muted-foreground animate-pulse">
                Memproses keputusan...
              </span>
            )}
          </div>

          {decisionNotice && (
            <p className="mt-2 rounded-lg bg-slate-100 p-2.5 text-xs font-semibold text-navy">
              {decisionNotice}
            </p>
          )}
        </div>
      </section>

      <Section title={`Revisions (${revisions.length})`}>
        {revisions.length === 0 ? (
          <Empty>No revisions submitted yet.</Empty>
        ) : (
          <ul className="space-y-1 text-xs">
            {revisions.map((r) => (
              <li key={r.id} className="rounded bg-muted/40 p-2">
                Rev {r.revision} · {new Date(r.submitted_at).toLocaleString()} · hash{" "}
                <span className="font-mono">{r.content_hash.slice(0, 12)}…</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Assignments (${assignments.length})`}>
        <AssignmentPanel
          subjectId={subject.id}
          subjectKind={subject.kind as "expert" | "module" | "knowledge_resource" | "training_need"}
          requiredRecommendations={subject.required_recommendations}
          assignments={assignments}
          onChanged={() => q.refetch()}
        />
      </Section>


      <Section title={`Recommendations (${records.length})`}>
        {records.length === 0 ? (
          <Empty>No recommendations yet.</Empty>
        ) : (
          <ul className="space-y-1 text-xs">
            {records.map((r) => (
              <li key={r.id} className="rounded bg-muted/40 p-2">
                <strong>{r.recommendation}</strong> · {r.status} · reviewer{" "}
                <span className="font-mono">{r.reviewer_id.slice(0, 8)}…</span>
                {r.submitted_at
                  ? ` · submitted ${new Date(r.submitted_at).toLocaleString()}`
                  : ""}
                {r.rationale ? (
                  <p className="mt-1 text-muted-foreground">{r.rationale}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Decisions (${decisions.length})`}>
        {decisions.length === 0 ? (
          <Empty>No decisions recorded.</Empty>
        ) : (
          <ul className="space-y-1 text-xs">
            {decisions.map((d) => (
              <li key={d.id} className="rounded bg-muted/40 p-2">
                <strong>{d.decision}</strong> · by{" "}
                <span className="font-mono">{d.decided_by.slice(0, 8)}…</span> ·{" "}
                {new Date(d.decided_at).toLocaleString()}
                {d.supersedes_decision_id
                  ? ` · supersedes ${d.supersedes_decision_id.slice(0, 8)}…`
                  : ""}
                {d.rationale ? (
                  <p className="mt-1 text-muted-foreground">{d.rationale}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Linked drafts (${drafts.length})`}>
        {drafts.length === 0 ? (
          <Empty>No submitter drafts linked to this subject.</Empty>
        ) : (
          <ul className="space-y-1 text-xs">
            {drafts.map((d) => (
              <li key={d.id} className="rounded bg-muted/40 p-2">
                <span className="font-mono">{d.id.slice(0, 8)}…</span> · {d.status} · submitter{" "}
                <span className="font-mono">{d.submitter_id.slice(0, 8)}…</span> · updated{" "}
                {new Date(d.updated_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-border p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
