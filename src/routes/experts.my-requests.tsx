import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/baruna/Navbar";
import { MyServiceRequestCard } from "@/components/baruna/experts/MyServiceRequestCard";
import { getActiveUserId } from "@/lib/authSession";
import { deleteExpertServiceRequestDraft, listMyExpertServiceRequests } from "@/lib/experts/portal-services.functions";
import { CLOSED_SERVICE_REQUEST_STATUSES } from "@/lib/experts/portal-services.types";

export const Route = createFileRoute("/experts/my-requests")({ head: () => ({ meta: [{ title: "My Requests — BARUNA Experts" }, { name: "description", content: "Track your BARUNA expert service requests." }] }), component: MyRequestsPage });

function MyRequestsPage() {
  const list = useServerFn(listMyExpertServiceRequests);
  const remove = useServerFn(deleteExpertServiceRequestDraft);
  const client = useQueryClient();
  const userId = getActiveUserId();
  const query = useQuery({ queryKey: ["experts", "my-service-requests", userId ?? "guest"], queryFn: () => list(), retry: false, staleTime: 15_000 });
  const requests = query.data ?? [];
  const refresh = () => client.invalidateQueries({ queryKey: ["experts", "my-service-requests"] });
  const removeDraft = async (id: string) => {
    if (!confirm("Delete this draft request? This cannot be undone.")) return;
    try {
      await remove({ data: { requestId: id } });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal menghapus draft.");
    }
    await refresh();
  };
  const counts = {
    total: requests.length,
    active: requests.filter((r) => r.status !== "draft" && !CLOSED_SERVICE_REQUEST_STATUSES.has(r.status)).length,
    "needs reply": requests.filter((r) => r.status === "information_requested").length,
    drafts: requests.filter((r) => r.status === "draft").length,
  };
  return <div className="min-h-screen bg-background"><Navbar /><main className="mx-auto max-w-4xl px-4 py-8 sm:px-6"><Link to="/experts" className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine"><ArrowLeft className="h-4 w-4" /> Experts</Link><div className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-3xl font-extrabold text-navy">My Requests</h1><p className="mt-2 text-sm text-muted-foreground">Track requests stored in your secure BARUNA account.</p></div><Link to="/experts/request" className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Request an Expert</Link></div>
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(counts).map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-4 text-center shadow-soft"><p className="font-display text-2xl font-extrabold text-navy">{value}</p><p className="text-xs capitalize text-muted-foreground">{label}</p></div>)}</div>
    <div className="mt-6 space-y-4">{query.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading requests…</p> : query.isError ? <p className="rounded-xl bg-destructive/10 p-5 text-sm text-destructive">Unable to load your requests. Please sign in again.</p> : requests.length ? requests.map((r) => <MyServiceRequestCard key={r.id} request={r} onDelete={() => void removeDraft(r.id)} onChanged={refresh} />) : <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><UserPlus className="mx-auto h-8 w-8 text-marine" /><p className="mt-3 font-display text-lg font-bold text-navy">No requests yet</p><Link to="/experts/request" className="mt-5 inline-flex rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-white">Create your first request</Link></div>}</div>
  </main></div>;
}
