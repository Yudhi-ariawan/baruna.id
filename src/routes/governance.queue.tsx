import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyReviewQueue } from "@/lib/governance/governance.functions";

export const Route = createFileRoute("/governance/queue")({
  component: QueuePage,
});

function QueuePage() {
  const fn = useServerFn(listMyReviewQueue);
  const q = useQuery({ queryKey: ["governance", "queue"], queryFn: () => fn() });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading queue…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const rows = q.data ?? [];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">My Review Queue</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assignments.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const s = Array.isArray(r.review_subjects) ? r.review_subjects[0] : r.review_subjects;
            return (
              <li key={r.id} className="rounded border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{s?.kind}</p>
                    <p className="font-medium">{s?.title ?? "(subject)"}</p>
                    <p className="text-xs text-muted-foreground">
                      Assignment status: {r.status}
                      {r.conflict_of_interest_declared ? ` · COI: ${r.conflict_of_interest_reason ?? "declared"}` : ""}
                    </p>
                  </div>
                  <Link
                    to="/governance/subject/$id"
                    params={{ id: r.subject_id }}
                    className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                  >
                    Open
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
