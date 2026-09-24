import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, FileSearch, Stamp } from "lucide-react";
import { useState } from "react";
import { ModuleReviewPacket } from "@/components/governance/ModuleReviewPacket";
import { getModuleReviewPacket, listManualModuleReviewQueue } from "@/lib/governance/governance.functions";

export const Route = createFileRoute("/admin/reviews")({ component: AdminModuleReviews });

function AdminModuleReviews() {
  const list = useServerFn(listManualModuleReviewQueue);
  const q = useQuery({ queryKey: ["admin", "module-reviews"], queryFn: () => list() });
  return <div className="space-y-6">
    <div><h2 className="font-display text-2xl font-bold text-navy">Module Review Queue</h2><p className="mt-1 text-sm text-muted-foreground">Manual curation only. Submission never approves or publishes a module automatically.</p></div>
    {q.isLoading ? <p className="text-sm text-muted-foreground">Loading review queue…</p> : q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : (q.data ?? []).length ? <div className="space-y-3">{q.data!.map((item) => <ReviewQueueItem key={item.id} item={item} />)}</div> : <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center"><ClipboardCheck className="mx-auto h-8 w-8 text-marine"/><p className="mt-3 font-semibold text-navy">No modules awaiting manual review</p></div>}
  </div>;
}

type QueueItem = {
  id: string;
  title: string;
  current_status: string;
  required_recommendations: number;
  updated_at: string;
  submitted_recommendations: number;
};

function ReviewQueueItem({ item }: { item: QueueItem }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const getPacket = useServerFn(getModuleReviewPacket);
  const packet = useQuery({ queryKey: ["admin", "module-review-packet", item.id], queryFn: () => getPacket({ data: { subjectId: item.id } }), enabled: showEvidence });
  return <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-marine">{item.current_status.replaceAll("_", " ")}</p><h3 className="mt-1 font-display text-lg font-bold text-navy">{item.title}</h3><p className="text-xs text-muted-foreground">Submitted {new Date(item.updated_at).toLocaleString()} · {item.submitted_recommendations}/{item.required_recommendations} recommendations</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setShowEvidence((value) => !value)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-navy hover:bg-muted"><FileSearch className="h-4 w-4"/>{showEvidence ? "Hide evidence" : "Review evidence"}</button><Link to="/governance/subject/$id" params={{id:item.id}} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-navy hover:bg-muted">Write evaluation</Link>{item.current_status==="decision_pending"?<Link to="/governance/decisions" className="inline-flex items-center gap-1 rounded-lg bg-marine px-3 py-2 text-xs font-semibold text-white"><Stamp className="h-4 w-4"/>Approve / Reject</Link>:null}</div></div>
    {showEvidence ? <div className="mt-4 border-t border-border pt-4">{packet.isLoading ? <p className="text-xs text-muted-foreground">Preparing secure document links…</p> : packet.isError ? <p className="text-xs text-destructive">{(packet.error as Error).message}</p> : <ModuleReviewPacket packet={packet.data} />}</div> : null}
  </section>;
}
