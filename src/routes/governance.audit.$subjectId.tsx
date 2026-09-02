import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  exportGovernanceAuditCsv,
  listGovernanceAudit,
} from "@/lib/governance/governance.functions";

export const Route = createFileRoute("/governance/audit/$subjectId")({
  component: AuditPage,
});

function AuditPage() {
  const { subjectId } = Route.useParams();
  const fn = useServerFn(listGovernanceAudit);
  const exportFn = useServerFn(exportGovernanceAuditCsv);
  const q = useQuery({
    queryKey: ["governance", "audit", subjectId],
    queryFn: () => fn({ data: { subjectId } }),
  });

  const exportM = useMutation({
    mutationFn: () => exportFn({ data: { subjectId } }),
    onSuccess: ({ csv }) => {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `governance-audit-${subjectId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const rows = q.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Governance Audit Trail</h2>
        <button
          onClick={() => exportM.mutate()}
          disabled={exportM.isPending}
          className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
        >
          {exportM.isPending ? "Exporting…" : "Download CSV"}
        </button>
      </div>
      {exportM.error ? (
        <p className="text-xs text-destructive">{(exportM.error as Error).message}</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit entries yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="rounded border border-border p-3">
              <p className="text-xs uppercase text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              <p className="font-medium">{r.event_type}</p>
              <p className="text-xs text-muted-foreground">
                actor {r.actor_id?.slice(0, 8)}… · entity {r.entity_type}:{r.entity_id?.slice(0, 8)}
              </p>
              {r.after ? (
                <pre className="mt-1 overflow-x-auto text-[10px] text-muted-foreground">
                  {JSON.stringify(r.after, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
