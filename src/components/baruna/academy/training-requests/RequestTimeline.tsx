// Status history of a training request (Slide 13: "riwayat dapat dilihat pada
// halaman status proses"), built from server records only.
import {
  CheckCircle2,
  FileText,
  RotateCcw,
  Search,
  Hourglass,
  XCircle,
  Undo2,
  Archive,
  type LucideIcon,
} from "lucide-react";
import type {
  MyTrainingRequestDetail,
  TrainingRequestTimelineEvent,
} from "@/lib/training-requests/my-requests.functions";
import { STAGE_LABEL_EN } from "@/lib/training-requests/workflow";
import { SlaNote } from "./shared";
import { formatDateTime } from "./view-model";

const EVENT: Record<
  TrainingRequestTimelineEvent["kind"],
  { label: string; detail?: string; icon: LucideIcon; tone: string }
> = {
  submitted: { label: "Request submitted", icon: FileText, tone: "bg-marine/15 text-marine" },
  resubmitted: { label: "Revised request resubmitted", icon: RotateCcw, tone: "bg-marine/15 text-marine" },
  review_started: {
    label: "Review started",
    detail: "A reviewer from the BARUNA team is assessing your request.",
    icon: Search,
    tone: "bg-badge-workshop/15 text-badge-workshop",
  },
  review_completed: {
    label: "Review completed",
    detail: "The recommendation is in; your request is awaiting the final decision.",
    icon: Hourglass,
    tone: "bg-badge-workshop/15 text-badge-workshop",
  },
  revision_requested: { label: "Revision requested", icon: RotateCcw, tone: "bg-destructive/15 text-destructive" },
  approved: { label: "Approved", icon: CheckCircle2, tone: "bg-eco-community/15 text-eco-community" },
  rejected: { label: "Not approved", icon: XCircle, tone: "bg-muted text-foreground/70" },
  withdrawn: { label: "Withdrawn by you", icon: Undo2, tone: "bg-muted text-foreground/70" },
  archived: { label: "Archived", icon: Archive, tone: "bg-muted text-foreground/70" },
};

export function RequestTimeline({ request }: { request: MyTrainingRequestDetail }) {
  const events = [...request.timeline].reverse();
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-bold text-navy">Status History</h2>

      <div className="mt-4 rounded-xl border border-marine/20 bg-marine/5 p-4">
        <p className="text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">Current step</p>
        <p className="mt-1 font-display text-sm font-bold text-navy">
          {STAGE_LABEL_EN[request.stage.key]}
          <span className="font-normal text-muted-foreground"> · since {formatDateTime(request.stage.since)}</span>
        </p>
        <div className="mt-1.5">
          <SlaNote stage={request.stage} />
        </div>
      </div>

      <ol className="mt-5 space-y-0">
        {events.map((e, i) => {
          const meta = EVENT[e.kind];
          const Icon = meta.icon;
          const isLast = i === events.length - 1;
          return (
            <li key={e.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${meta.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {!isLast && <span className="my-1 w-px flex-1 bg-border" style={{ minHeight: "1.5rem" }} />}
              </div>
              <div className={isLast ? "pb-0" : "pb-5"}>
                <p className="font-display text-sm font-bold text-navy">
                  {meta.label}
                  {e.kind === "resubmitted" && e.revision ? ` (revision ${e.revision})` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(e.at)}</p>
                {meta.detail ? <p className="mt-1 text-xs text-foreground/80">{meta.detail}</p> : null}
                {e.note ? (
                  <p className="mt-1.5 whitespace-pre-line rounded-lg bg-muted/60 p-2.5 text-xs text-foreground/90">
                    {e.note}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
