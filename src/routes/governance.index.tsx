import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getGovernanceDashboard } from "@/lib/governance/governance-ops.functions";

export const Route = createFileRoute("/governance/")({
  component: GovernanceLanding,
});

function GovernanceLanding() {
  const fn = useServerFn(getGovernanceDashboard);
  const q = useQuery({
    queryKey: ["governance", "dashboard"],
    queryFn: () => fn(),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const { submitter, reviewer, admin } = q.data ?? {
    submitter: {} as Record<string, number>,
    reviewer: null,
    admin: null,
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">Governance workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rollups reflect only what your roles can see. Recommendations are advisory; final decisions rest with
          admin/management.
        </p>
      </section>

      <section className="rounded-lg border border-border p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">My submissions</h3>
          <Link
            to="/my-submissions"
            className="text-xs text-primary hover:underline"
          >
            Open submissions →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Drafts" value={submitter.draft ?? 0} />
          <Stat label="Submitted" value={submitter.submitted ?? 0} />
          <Stat label="Withdrawn" value={submitter.withdrawn ?? 0} />
        </div>
      </section>

      {reviewer ? (
        <section className="rounded-lg border border-border p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">My review queue</h3>
            <Link to="/governance/queue" className="text-xs text-primary hover:underline">
              Open queue →
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Active assignments" value={reviewer.active} />
            <Stat label="Recused" value={reviewer.recused} tone="warn" />
            <Stat label="Draft records" value={reviewer.draftRecords} />
            <Stat label="Submitted" value={reviewer.submittedRecords} tone="ok" />
          </div>
        </section>
      ) : null}

      {admin ? (
        <section className="rounded-lg border border-border p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Subjects &amp; decisions</h3>
            <div className="flex gap-3 text-xs">
              <Link to="/governance/subjects" className="text-primary hover:underline">
                Subjects →
              </Link>
              <Link to="/governance/decisions" className="text-primary hover:underline">
                Decisions →
              </Link>
              <Link to="/governance/templates" className="text-primary hover:underline">
                Templates →
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            <Stat label="Pending" value={admin.pending} />
            <Stat label="Under review" value={admin.underReview} />
            <Stat label="Decision pending" value={admin.decisionPending} tone="warn" />
            <Stat label="Approved" value={admin.approved} tone="ok" />
            <Stat label="Rejected" value={admin.rejected} tone="bad" />
            <Stat label="Active templates" value={admin.templates} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded border border-border bg-muted/30 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</p>
    </div>
  );
}
