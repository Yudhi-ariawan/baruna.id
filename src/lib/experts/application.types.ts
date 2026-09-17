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
  editableDraft: ExpertApplicationStatus | null;
};
