// Shared components of the "My Training Requests" pages (PB-ACA-06).
import { Clock, AlertTriangle } from "lucide-react";
import {
  STAGE_LABEL_EN,
  STAGE_STYLE,
  formatHoursEn,
  type StageKey,
  type WorkflowStage,
} from "@/lib/training-requests/workflow";
import { formatDateTime } from "./view-model";

export function StageBadge({ stage }: { stage: StageKey }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${STAGE_STYLE[stage]}`}>
      {STAGE_LABEL_EN[stage]}
    </span>
  );
}

/** Target response time of the current step (Slide 13: every step may have an SLA). */
export function SlaNote({ stage }: { stage: WorkflowStage }) {
  if (stage.key === "revision_requested") {
    return <p className="text-xs text-muted-foreground">Waiting for your revision.</p>;
  }
  if (!stage.sla) return null;
  return stage.sla.overdue ? (
    <p className="flex items-start gap-1.5 text-xs text-amber-700">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      This step is taking longer than its target of {formatHoursEn(stage.sla.targetHours)} (due{" "}
      {formatDateTime(stage.sla.dueAt)}). The BARUNA team has been reminded.
    </p>
  ) : (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      Target for this step: {formatHoursEn(stage.sla.targetHours)}, by {formatDateTime(stage.sla.dueAt)}.
    </p>
  );
}
