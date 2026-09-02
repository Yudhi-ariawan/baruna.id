import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listReviewSubjects } from "@/lib/governance/governance-ops.functions";

export const Route = createFileRoute("/governance/subjects/")({
  component: SubjectsIndex,
});

type Kind = "expert" | "module" | "knowledge_resource" | "training_need" | "";
type Status =
  | ""
  | "pending"
  | "under_review"
  | "decision_pending"
  | "approved"
  | "rejected"
  | "withdrawn";

function SubjectsIndex() {
  const fn = useServerFn(listReviewSubjects);
  const [kind, setKind] = useState<Kind>("");
  const [status, setStatus] = useState<Status>("");
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["governance", "subjects", kind, status, search],
    queryFn: () =>
      fn({
        data: {
          kind: kind || undefined,
          status: status || undefined,
          search: search || undefined,
        },
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="mr-auto text-lg font-semibold">Review Subjects</h2>
        <label className="text-xs">
          Kind
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="ml-2 rounded border border-border bg-background p-1 text-xs"
          >
            <option value="">All</option>
            <option value="expert">expert</option>
            <option value="module">module</option>
            <option value="knowledge_resource">knowledge_resource</option>
            <option value="training_need">training_need</option>
          </select>
        </label>
        <label className="text-xs">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="ml-2 rounded border border-border bg-background p-1 text-xs"
          >
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="under_review">under_review</option>
            <option value="decision_pending">decision_pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="withdrawn">withdrawn</option>
          </select>
        </label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title…"
          className="rounded border border-border bg-background p-1 text-xs"
        />
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No subjects match.</p>
      ) : (
        <ul className="space-y-2">
          {(q.data ?? []).map((s) => (
            <li key={s.id} className="rounded border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {s.kind} · {s.current_status} · req {s.required_recommendations}
                  </p>
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(s.updated_at).toLocaleString()}
                  </p>
                </div>
                <Link
                  to="/governance/subjects/$id"
                  params={{ id: s.id }}
                  className="shrink-0 rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
