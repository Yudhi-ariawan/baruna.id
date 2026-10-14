import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, Calendar, MapPin, CheckCircle2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { REQUEST_TYPE_CONFIG } from "@/lib/experts";
import { listTrainerServiceRequests, respondToTrainerServiceRequest } from "@/lib/experts/portal-services.functions";
import { getServiceRequestFileUrl } from "@/lib/experts/service-request-files.functions";
import type { ServiceRequest } from "@/lib/experts/portal-services.types";

import { getActiveUserId } from "@/lib/authSession";

export const Route = createFileRoute("/experts/portal/service-requests")({ head: () => ({ meta: [{ title: "Service Requests — Trainer Portal" }, { name: "description", content: "Incoming Expert Service requests directed to you." }] }), component: ServiceRequestsPortal });

const STYLES: Record<string, string> = { confirmed: "bg-eco-community/15 text-eco-community", scheduled: "bg-marine/15 text-marine", under_review: "bg-badge-workshop/15 text-badge-workshop", expert_contacted: "bg-accent/25 text-accent-foreground", declined: "bg-destructive/10 text-destructive" };

// Must match the states trainer_service_request_respond accepts.
const RESPONDABLE = new Set(["submitted", "under_review", "expert_matching", "expert_contacted", "information_requested"]);

type Action = "accept" | "request_info" | "decline";

function ServiceRequestsPortal() {
  const list = useServerFn(listTrainerServiceRequests);
  const respond = useServerFn(respondToTrainerServiceRequest);
  const client = useQueryClient();
  const userId = getActiveUserId();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["experts", "trainer-service-requests", userId ?? "guest"],
    queryFn: () => list(),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const act = async (requestId: string, action: Action) => {
    if (pendingId) return;
    setPendingId(requestId);
    try {
      await respond({ data: { requestId, action } });
      toast.success(action === "accept" ? "Permintaan diterima." : action === "decline" ? "Permintaan ditolak." : "Permintaan informasi tambahan dikirim.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal memproses permintaan.");
    } finally {
      setPendingId(null);
      await client.invalidateQueries({ queryKey: ["experts", "trainer-service-requests"] });
      await client.invalidateQueries({ queryKey: ["experts", "my-service-requests"] });
    }
  };
  return <PageShell sidebar={{ ...EXPERTS_SIDEBAR_META, title: "Trainer Portal", subtitle: "Incoming Expert Services.", sections: trainerPortalNav("/experts/portal/service-requests") }} cta={{ icon: Inbox, title: "Secure request workflow", description: "Every response is recorded in the audit trail.", button: "Back to Dashboard", href: "/experts/portal" }}><div className="space-y-6"><div><h1 className="font-display text-3xl font-extrabold text-navy">Service Requests</h1><p className="mt-2 text-sm text-muted-foreground">Requests submitted directly to your canonical expert profile.</p></div>{query.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading service requests…</p> : query.isError ? <p className="rounded-xl bg-destructive/10 p-5 text-sm text-destructive">Unable to load trainer service requests.</p> : query.data?.length ? <ul className="space-y-3">{query.data.map((r) => <RequestItem key={r.id} request={r} busy={pendingId === r.id} disabled={pendingId !== null} onAction={act} />)}</ul> : <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><Inbox className="mx-auto h-8 w-8 text-marine" /><p className="mt-3 font-display text-lg font-bold text-navy">No incoming requests</p><p className="mt-1 text-sm text-muted-foreground">Directed service requests will appear here.</p></div>}</div></PageShell>;
}

function RequestItem({ request: r, busy, disabled, onAction }: { request: ServiceRequest; busy: boolean; disabled: boolean; onAction: (id: string, action: Action) => Promise<void> }) {
  const openFile = useServerFn(getServiceRequestFileUrl);
  const values = r.payload.values ?? {}; const topic = values.eventName || values.trainingTitle || values.subjectArea || values.objective || values.technicalIssue || "Expert service request"; const date = values.eventDate || values.trainingDates || values.completionDate || values.timeline || "Date to be agreed"; const place = values.eventFormat || values.deliveryMode || values.country || "To be agreed";
  const files = Object.entries(r.payload.files ?? {});
  const open = async (fileKey: string) => {
    try {
      const { url } = await openFile({ data: { requestId: r.id, fileKey } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal membuka berkas.");
    }
  };
  return (
    <li className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{r.requestNumber} · {REQUEST_TYPE_CONFIG[r.type].label}</p>
          <p className="mt-0.5 font-display text-base font-bold text-navy">{topic}</p>
          <p className="mt-1 text-xs text-foreground/70">{values.organization || "Organization not provided"}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-[0.7rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {date}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {place}</span>
          </div>
          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {files.map(([key, file]) => (
                <button key={key} type="button" onClick={() => void open(key)} disabled={!file.path} title={file.path ? "Buka berkas" : "Berkas lama: hanya nama yang tersimpan"} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-marine hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                  <Paperclip className="h-3 w-3" /> {file.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-bold capitalize ${STYLES[r.status] ?? "bg-muted text-foreground/70"}`}><CheckCircle2 className="h-3 w-3" /> {r.status.replaceAll("_", " ")}</span>
      </div>
      {RESPONDABLE.has(r.status) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={disabled} onClick={() => void onAction(r.id, "accept")} className="rounded-lg bg-marine px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Processing…" : "Accept"}</button>
          <button disabled={disabled} onClick={() => void onAction(r.id, "request_info")} className="rounded-lg border border-border px-4 py-1.5 text-xs font-semibold text-navy disabled:opacity-60">Request info</button>
          <button disabled={disabled} onClick={() => void onAction(r.id, "decline")} className="rounded-lg border border-destructive/40 px-4 py-1.5 text-xs font-semibold text-destructive disabled:opacity-60">Decline</button>
        </div>
      )}
    </li>
  );
}
