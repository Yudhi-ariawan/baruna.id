import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyDrafts } from "@/lib/governance/governance-ops.functions";

export const Route = createFileRoute("/my-submissions/")({
  component: MySubmissionsIndex,
});

function MySubmissionsIndex() {
  const fn = useServerFn(listMyDrafts);
  const q = useQuery({ queryKey: ["my-submissions", "list"], queryFn: () => fn() });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const rows = q.data ?? [];

  if (rows.length === 0) {
    return (
      <div className="rounded border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">You haven't started any submissions yet.</p>
        <Link
          to="/my-submissions/new"
          className="mt-4 inline-block rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Start a new submission
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded border border-border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {r.subject_kind} · {r.status}
              </p>
              <p className="truncate font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                Updated {new Date(r.updated_at).toLocaleString()}
                {r.linked_subject_id ? " · linked to a review subject" : ""}
              </p>
            </div>
            <Link
              to="/my-submissions/$id"
              params={{ id: r.id }}
              className="shrink-0 rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Open
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
