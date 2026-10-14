import { MessageSquare } from "lucide-react";
import { formatDate } from "@/lib/experts";
import { serviceRequestStatusText, type ServiceRequestEvent } from "@/lib/experts/portal-services.types";

const ACTOR_LABEL: Record<ServiceRequestEvent["actorRole"], string> = {
  requester: "Requester",
  expert: "Expert",
  admin: "BARUNA Admin",
};

const ACTION_LABEL: Record<string, string> = {
  submit: "Submitted the request",
  review: "Started the review",
  matching: "Started expert matching",
  assign: "Assigned an expert",
  accept: "Accepted the request",
  request_info: "Asked for more information",
  reply: "Replied with information",
  schedule: "Scheduled the activity",
  complete: "Marked as completed",
  decline: "Declined the request",
  cancel: "Cancelled the request",
};

/** Read-only activity log of a service request, shared by requester, trainer and admin views. */
export function ServiceRequestTimeline({ events }: { events: ServiceRequestEvent[] | undefined }) {
  if (!events?.length) return null;
  return (
    <ol className="mt-3 space-y-2 border-l-2 border-border pl-4">
      {events.map((ev) => (
        <li key={ev.id} className="relative text-xs">
          <span className="absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full bg-marine" />
          <p className="text-foreground/80">
            <strong className="text-navy">{ACTOR_LABEL[ev.actorRole] ?? ev.actorRole}</strong>{" "}
            {ACTION_LABEL[ev.action] ?? ev.action.replaceAll("_", " ")}
            {ev.toStatus && <span className="text-muted-foreground"> → {serviceRequestStatusText(ev.toStatus)}</span>}
            <span className="text-muted-foreground"> · {formatDate(ev.createdAt)}</span>
          </p>
          {ev.message && (
            <p className="mt-1 flex gap-1.5 whitespace-pre-wrap rounded-lg bg-muted/60 px-3 py-2 text-foreground/80">
              <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-marine" />
              <span className="min-w-0 break-words">{ev.message}</span>
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
