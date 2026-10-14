import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clock, MessageSquareReply, Paperclip, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { REQUEST_PIPELINE, REQUEST_TYPE_CONFIG, formatDate } from "@/lib/experts";
import {
  CLOSED_SERVICE_REQUEST_STATUSES,
  REQUESTER_CANCELLABLE_STATUSES,
  latestInfoRequest,
  requestStatusLabel,
  serviceRequestStatusText,
  type ServiceRequest,
} from "@/lib/experts/portal-services.types";
import { cancelMyServiceRequest, replyToServiceRequest } from "@/lib/experts/service-requests.functions";
import { getServiceRequestFileUrl } from "@/lib/experts/service-request-files.functions";
import { ServiceRequestTimeline } from "./ServiceRequestTimeline";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-foreground/70",
  information_requested: "bg-amber-100 text-amber-800",
  confirmed: "bg-accent/20 text-accent-foreground",
  scheduled: "bg-marine/15 text-marine",
  completed: "bg-eco-community/15 text-eco-community",
  declined: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-foreground/60",
};

export function MyServiceRequestCard({
  request: r,
  onDelete,
  onChanged,
}: {
  request: ServiceRequest;
  onDelete: () => void;
  onChanged: () => Promise<void>;
}) {
  const reply = useServerFn(replyToServiceRequest);
  const cancel = useServerFn(cancelMyServiceRequest);
  const openFile = useServerFn(getServiceRequestFileUrl);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const values = r.payload.values ?? {};
  const title = values.eventName || values.trainingTitle || values.subjectArea || values.objective || values.technicalIssue || "Expert request";
  const closed = CLOSED_SERVICE_REQUEST_STATUSES.has(r.status);
  const reached = REQUEST_PIPELINE.indexOf(requestStatusLabel(r.status));
  const question = r.status === "information_requested" ? latestInfoRequest(r.events) : null;
  const files = Object.entries(r.payload.files ?? {});

  const run = async (fn: () => Promise<unknown>, success: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      setMessage("");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal memproses permintaan.");
    } finally {
      inFlight.current = false;
      setBusy(false);
      await onChanged();
    }
  };

  const sendReply = () => {
    if (message.trim().length < 5) {
      toast.error("Tuliskan jawaban minimal 5 karakter.");
      return;
    }
    void run(() => reply({ data: { requestId: r.id, message: message.trim() } }), "Jawaban terkirim.");
  };

  const cancelRequest = () => {
    const reason = window.prompt("Alasan pembatalan (opsional):", "");
    if (reason === null) return;
    void run(() => cancel({ data: { requestId: r.id, reason: reason.trim() || undefined } }), "Permintaan dibatalkan.");
  };

  const open = async (fileKey: string) => {
    try {
      const { url } = await openFile({ data: { requestId: r.id, fileKey } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal membuka berkas.");
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-marine">{REQUEST_TYPE_CONFIG[r.type].label} · {r.requestNumber}</p>
          <h3 className="mt-1 break-words font-display text-base font-bold text-navy">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{values.organization || "—"}{values.country ? ` · ${values.country}` : ""}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[r.status] ?? "bg-badge-workshop/15 text-badge-workshop"}`}>
          <Clock className="h-3.5 w-3.5" /> {serviceRequestStatusText(r.status)}
        </span>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Created {formatDate(r.createdAt)} · Assigned Expert: <strong className="text-navy">{r.assignedExpert || "To be matched by BARUNA"}</strong>
      </div>

      {r.status !== "draft" && !closed && (
        <div className="mt-3 flex items-center gap-1">
          {REQUEST_PIPELINE.map((stage, i) => (
            <div key={stage} className={`h-2 flex-1 rounded-full ${i <= reached ? "bg-marine" : "bg-muted"}`} title={stage} />
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map(([key, file]) => (
            <button key={key} type="button" onClick={() => void open(key)} disabled={!file.path} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-marine hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
              <Paperclip className="h-3 w-3" /> {file.name}
            </button>
          ))}
        </div>
      )}

      {r.status === "information_requested" && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Information requested</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-amber-900">
            {question?.message || "The reviewer needs more information about this request."}
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Write your answer…"
            className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[0.7rem] text-amber-800">{message.length}/2000</span>
            <button type="button" onClick={sendReply} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
              <MessageSquareReply className="h-3.5 w-3.5" /> {busy ? "Sending…" : "Send Answer"}
            </button>
          </div>
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-marine">Activity log</summary>
        <ServiceRequestTimeline events={r.events} />
      </details>

      <div className="mt-4 flex flex-wrap gap-2">
        {r.status === "draft" && (
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Delete Draft
          </button>
        )}
        {REQUESTER_CANCELLABLE_STATUSES.has(r.status) && (
          <button type="button" onClick={cancelRequest} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-muted disabled:opacity-60">
            <XCircle className="h-3.5 w-3.5" /> Cancel Request
          </button>
        )}
      </div>
    </article>
  );
}
