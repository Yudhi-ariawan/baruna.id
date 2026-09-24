import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpenCheck } from "lucide-react";
import { listApprovedModulesForPublication, publishApprovedModule } from "@/lib/governance/governance.functions";

export const Route = createFileRoute("/governance/publications")({ component: PublicationQueue });

function PublicationQueue() {
  const list = useServerFn(listApprovedModulesForPublication);
  const publish = useServerFn(publishApprovedModule);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["governance", "publication-queue"], queryFn: () => list() });
  const mutation = useMutation({ mutationFn: (item: { subjectId: string; decisionId: string }) => publish({ data: item }), onSuccess: () => client.invalidateQueries({ queryKey: ["governance", "publication-queue"] }) });
  return <div className="space-y-4"><div><h2 className="text-lg font-semibold">Publication Queue</h2><p className="text-sm text-muted-foreground">Only approved modules appear here. Publication is an explicit, audited action.</p></div>
    {query.isLoading ? <p className="text-sm text-muted-foreground">Loading approved modules…</p> : query.isError ? <p className="text-sm text-destructive">{(query.error as Error).message}</p> : query.data?.length ? <div className="space-y-3">{query.data.map((item) => <section key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"><div><h3 className="font-semibold text-navy">{item.title}</h3><p className="text-xs text-muted-foreground">Approved {new Date(item.approvedAt).toLocaleString()}</p>{item.rationale ? <p className="mt-1 text-sm text-foreground/75">{item.rationale}</p> : null}</div><button disabled={mutation.isPending} onClick={() => mutation.mutate({ subjectId: item.id, decisionId: item.decisionId })} className="rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Publish to Catalog</button></section>)}</div> : <div className="rounded-lg border border-dashed border-border p-10 text-center"><BookOpenCheck className="mx-auto h-8 w-8 text-marine"/><p className="mt-2 font-semibold text-navy">No approved modules awaiting publication</p></div>}
    {mutation.error ? <p className="text-sm text-destructive">{(mutation.error as Error).message}</p> : null}
  </div>;
}
