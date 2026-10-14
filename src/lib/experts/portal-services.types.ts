import type { FileMeta, RequestStatus, RequestType } from "@/lib/experts";
import type { Json } from "@/integrations/supabase/types";

export type PortalAccess = "registered_user" | "expert_non_trainer" | "active_trainer";

export type TrainerModule = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  hours: number | null;
  version: number;
  language: string | null;
  moduleType: string;
  targetParticipants: string | null;
  updatedAt: string;
};

export type TrainingHistory = {
  id: string;
  title: string;
  organizer: string | null;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  participants: number | null;
  country: string | null;
};

export type TrainerPortalBootstrap = {
  access: PortalAccess;
  expertName?: string;
  trainerStatus?: string;
  trainer?: {
    expertId: string;
    fullName: string;
    title: string | null;
    organization: string | null;
    country: string | null;
    expertiseAreas: string[];
    languages: string[];
    trainingRoles: string[];
    level: "not_assigned" | "certified" | "advanced" | "senior" | "master";
    status: string;
    approvedAt: string;
    uniqueSuccessfulParticipants: number;
  };
  modules?: TrainerModule[];
  history?: TrainingHistory[];
  moduleDrafts?: Array<{
    id: string; title: string; status: string; subjectId: string | null;
    reviewStatus: string | null; payload: Json;
    createdAt: string; updatedAt: string;
    supersededDraftIds?: string[];
    reviewHistory: Array<{ kind: string; at: string; actor: string; decision: string; comment: string | null }>;
  }>;
  certificates?: Array<{
    id: string; type: string; title: string; subtitle: string | null;
    number: string; issueDate: string; documentUrl: string | null; metadata: Json;
  }>;
  recognitionRules?: Array<{ level: string; minimumParticipants: number; evidenceRequirements: string | null }>;
  analytics?: {
    countries: Array<{ country: string; participants: number }>;
    completionRate: number | null; averageRating: number | null; hasUnresolvedComplaint: boolean | null;
  };
};

export type ServiceRequestEvent = {
  id: string;
  actorRole: "requester" | "expert" | "admin";
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  message: string | null;
  createdAt: string;
};

export type ServiceRequest = {
  id: string;
  requestNumber: string;
  type: RequestType;
  status: string;
  payload: { values?: Record<string, string>; files?: Record<string, FileMeta> };
  createdAt: string;
  updatedAt: string;
  targetExpertId?: string | null;
  assignedExpert?: string | null;
  targetExpertSlug?: string | null;
  completedAt?: string | null;
  events?: ServiceRequestEvent[];
};

/** Pipeline stage for the progress bar. Closed states have no stage. */
const STATUS_MAP: Record<string, RequestStatus> = {
  draft: "Draft", submitted: "Submitted", under_review: "Under Review",
  expert_matching: "Expert Matching", expert_contacted: "Expert Matching",
  information_requested: "Under Review", confirmed: "Confirmed", scheduled: "Confirmed",
  completed: "Completed",
};

export function requestStatusLabel(status: string): RequestStatus {
  return STATUS_MAP[status] ?? "Submitted";
}

/** Exact state shown to people; never collapses declined/cancelled into "Completed". */
export const SERVICE_REQUEST_STATUS_TEXT: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  expert_matching: "Expert Matching",
  expert_contacted: "Waiting for Expert",
  information_requested: "Information Requested",
  confirmed: "Confirmed",
  scheduled: "Scheduled",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const CLOSED_SERVICE_REQUEST_STATUSES = new Set(["completed", "declined", "cancelled"]);
/** Must match expert_service_request_cancel. */
export const REQUESTER_CANCELLABLE_STATUSES = new Set([
  "submitted", "under_review", "expert_matching", "expert_contacted",
  "information_requested", "confirmed", "scheduled",
]);

export function serviceRequestStatusText(status: string): string {
  return SERVICE_REQUEST_STATUS_TEXT[status] ?? status.replaceAll("_", " ");
}

/** Latest information request message (the question the requester must answer). */
export function latestInfoRequest(events: ServiceRequestEvent[] | undefined): ServiceRequestEvent | null {
  const list = events ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].toStatus === "information_requested") return list[i];
  }
  return null;
}
