import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getReviewSubjectFull } from "@/lib/governance/governance-ops.functions";
import { AssignmentPanel } from "@/components/governance/AssignmentPanel";

export const Route = createFileRoute("/governance/subjects/$id")({
  component: SubjectDetail,
});

function SubjectDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getReviewSubjectFull);
  const q = useQuery({
    queryKey: ["governance", "subjects", "detail", id],
    queryFn: () => fn({ data: { id } }),
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
