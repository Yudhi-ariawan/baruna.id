import type { FileMeta, RequestStatus, RequestType } from "@/lib/experts";

export type PortalAccess = "registered_user" | "expert_non_trainer" | "active_trainer";

export type TrainerModule = {
  id: string;
  title: string;
  status: string;
  hours: number | null;
  version: number;
  language: string | null;
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
    level: "not_assigned" | "certified" | "advanced" | "senior" | "master";
    status: string;
    approvedAt: string;
    uniqueSuccessfulParticipants: number;
  };
  modules?: TrainerModule[];
  history?: TrainingHistory[];
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
};

const STATUS_MAP: Record<string, RequestStatus> = {
  draft: "Draft", submitted: "Submitted", under_review: "Under Review",
  expert_matching: "Expert Matching", expert_contacted: "Expert Matching",
  information_requested: "Under Review", confirmed: "Confirmed", scheduled: "Confirmed",
  completed: "Completed", declined: "Completed", cancelled: "Completed",
};

export function requestStatusLabel(status: string): RequestStatus {
  return STATUS_MAP[status] ?? "Submitted";
}
