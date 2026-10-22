// View-model helpers of the "My Training Requests" pages (PB-ACA-06).
import type {
  MyTrainingRequestDetail,
  MyTrainingRequestSummary,
} from "@/lib/training-requests/my-requests.functions";
import type { StageKey } from "@/lib/training-requests/workflow";
import type { RequestStatus, TrainingRequest } from "@/lib/trainingRequests";

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

// ── Presentation Mode ───────────────────────────────────────────────────────
// Demo requests never reach the backend; they are shown through the same view
// model so the pages have a single rendering path.
const LOCAL_STAGE: Record<RequestStatus, StageKey> = {
  Submitted: "pending",
  "Under Review": "under_review",
  "Needs Clarification": "revision_requested",
  Approved: "approved",
  Scheduled: "approved",
  Completed: "approved",
  Closed: "rejected",
};

export function localToSummary(r: TrainingRequest): MyTrainingRequestSummary {
  const key = LOCAL_STAGE[r.status] ?? "pending";
  return {
    id: r.id,
    reference: r.reference,
    title: r.trainingTopic,
    category: r.trainingCategory,
    organization: r.organization,
    country: r.country,
    submittedAt: r.createdAt,
    updatedAt: r.updatedAt,
    stage: { key, since: r.updatedAt, open: ["pending", "under_review"].includes(key), sla: null },
  };
}

export function localToDetail(r: TrainingRequest): MyTrainingRequestDetail {
  const { id: _id, reference: _ref, status: _status, createdAt: _c, updatedAt: _u, ...form } = r;
  return {
    ...localToSummary(r),
    form,
    timeline: [{ id: "rev-1", at: r.createdAt, kind: "submitted", note: null, revision: 1 }],
    revisionNote: null,
    revisionCount: 1,
    canWithdraw: false,
    canRevise: false,
  };
}
