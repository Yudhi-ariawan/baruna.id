import type { ExpertApplicationDraft } from "@/lib/experts";

export const EXPERT_APPLICATION_BUCKET = "expert-applications";

export type ExpertDocumentCategory = "cv" | "photo" | "certifications" | "supporting";

export type ExpertApplicationDocument = {
  category: ExpertDocumentCategory;
  path: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
};

export type ExpertDraftPayload = ExpertApplicationDraft & {
  documents: ExpertApplicationDocument[];
  schemaVersion: 1;
};

export type ExpertApplicationStatus = {
  draftId: string;
  subjectId: string | null;
  title: string;
  draftStatus: string;
  reviewStatus: string | null;
  createdAt: string;
  updatedAt: string;
  payload: ExpertDraftPayload;
  latestDecision?: {
    id: string;
    decision: string;
    rationale: string | null;
    createdAt: string;
  } | null;
  /** The owner is preparing an update of the published profile (not sent yet). */
  updateOpen?: boolean;
  /** The published profile stays in the directory while a revision/update is reviewed. */
  liveVersionKept?: boolean;
};

/** Update of a published expert profile (PB-EXP-01 versioning, migration 20261022030000). */
export type ExpertProfileUpdateState = {
  subjectId: string;
  /** none: may open an update; drafting: unsent update; in_review: sent and waiting;
   *  revision_requested: the verifier asked for changes. */
  state: "none" | "drafting" | "in_review" | "revision_requested";
  lastUpdateRejected: boolean;
  rejectionNote: string | null;
};

export type ExpertApplicationBootstrap = {
  userId: string;
  profile: {
    fullName: string;
    email: string;
    institution: string;
    title: string;
    phone: string;
  };
  isAlreadyExpert: boolean;
  expertSlug?: string | null;
  expertName?: string | null;
  pendingApplication: ExpertApplicationStatus | null;
  editableDraft: ExpertApplicationStatus | null;
  /** Present for an approved expert whose profile is published. */
  profileUpdate?: ExpertProfileUpdateState | null;
};
