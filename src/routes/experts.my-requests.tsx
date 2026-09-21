import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, Trash2, UserPlus, Clock } from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { REQUEST_PIPELINE, REQUEST_STATUS_STYLES, REQUEST_TYPE_CONFIG, formatDate } from "@/lib/experts";
import { deleteExpertServiceRequestDraft, listMyExpertServiceRequests } from "@/lib/experts/portal-services.functions";
import { requestStatusLabel, type ServiceRequest } from "@/lib/experts/portal-services.types";

export const Route = createFileRoute("/experts/my-requests")({ head: () => ({ meta: [{ title: "My Requests — BARUNA Experts" }, { name: "description", content: "Track your BARUNA expert service requests." }] }), component: MyRequestsPage });

function MyRequestsPage() {
  const list = useServerFn(listMyExpertServiceRequests);
  const remove = useServerFn(deleteExpertServiceRequestDraft);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["experts", "my-service-requests"], queryFn: () => list(), retry: false });
  const requests = query.data ?? [];
  const removeDraft = async (id: string) => { if (!confirm("Delete this draft request? This cannot be undone.")) return; await remove({ data: { requestId: id } }); await client.invalidateQueries({ queryKey: ["experts", "my-service-requests"] }); };
  const counts = { total: requests.length, active: requests.filter((r) => !["draft", "completed", "declined", "cancelled"].includes(r.status)).length, confirmed: requests.filter((r) => ["confirmed", "scheduled", "completed"].includes(r.status)).length, drafts: requests.filter((r) => r.status === "draft").length };
  return <div className="min-h-screen bg-background"><Navbar /><main className="mx-auto max-w-4xl px-4 py-8 sm:px-6"><Link to="/experts" className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine"><ArrowLeft className="h-4 w-4" /> Experts</Link><div className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-3xl font-extrabold text-navy">My Requests</h1><p className="mt-2 text-sm text-muted-foreground">Track requests stored in your secure BARUNA account.</p></div><Link to="/experts/request" className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Request an Expert</Link></div>
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(counts).map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-4 text-center shadow-soft"><p className="font-display text-2xl font-extrabold text-navy">{value}</p><p className="text-xs capitalize text-muted-foreground">{label}</p></div>)}</div>
    <div className="mt-6 space-y-4">{query.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading requests…</p> : query.isError ? <p className="rounded-xl bg-destructive/10 p-5 text-sm text-destructive">Unable to load your requests. Please sign in again.</p> : requests.length ? requests.map((r) => <RequestCard key={r.id} request={r} onDelete={() => void removeDraft(r.id)} />) : <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><UserPlus className="mx-auto h-8 w-8 text-marine" /><p className="mt-3 font-display text-lg font-bold text-navy">No requests yet</p><Link to="/experts/request" className="mt-5 inline-flex rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-white">Create your first request</Link></div>}</div>
  </main></div>;
}

function RequestCard({ request: r, onDelete }: { request: ServiceRequest; onDelete: () => void }) {
  const status = requestStatusLabel(r.status); const values = r.payload.values ?? {}; const title = values.eventName || values.trainingTitle || values.subjectArea || values.objective || values.technicalIssue || "Expert request";
  const reached = REQUEST_PIPELINE.indexOf(status);
  return <article className="rounded-2xl border border-border bg-card p-5 shadow-soft"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[0.65rem] font-bold uppercase tracking-wide text-marine">{REQUEST_TYPE_CONFIG[r.type].label} · {r.requestNumber}</p><h3 className="mt-1 font-display text-base font-bold text-navy">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{values.organization || "—"}{values.country ? ` · ${values.country}` : ""}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${REQUEST_STATUS_STYLES[status]}`}><Clock className="h-3.5 w-3.5" /> {status}</span></div><div className="mt-3 text-xs text-muted-foreground">Created {formatDate(r.createdAt)} · Assigned Expert: <strong className="text-navy">{r.assignedExpert || "To be matched"}</strong></div>{status !== "Draft" && <div className="mt-3 flex items-center gap-1">{REQUEST_PIPELINE.map((stage, i) => <div key={stage} className={`h-2 flex-1 rounded-full ${i <= reached ? "bg-marine" : "bg-muted"}`} title={stage} />)}</div>}{r.status === "draft" && <button type="button" onClick={onDelete} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete Draft</button>}</article>;
}
