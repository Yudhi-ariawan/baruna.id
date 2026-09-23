export const MODULE_ATTACHMENTS_BUCKET = "module-attachments";

export type ModuleAttachmentKey =
  | "module_document"
  | "presentation_slides"
  | "learning_video"
  | "assessment"
  | "trainer_guide"
  | "evaluation_form"
  | "cover_image"
  | "practical_exercise";

export type ModuleAttachment = {
  category: ModuleAttachmentKey;
  bucket: typeof MODULE_ATTACHMENTS_BUCKET;
  path: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
};

export type ModuleAttachmentDefinition = {
  key: ModuleAttachmentKey;
  label: string;
  accept: string;
  allowedTypes: readonly string[];
  maxBytes: number;
};

const DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
const SLIDE_TYPES = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const MODULE_ATTACHMENT_DEFINITIONS: readonly ModuleAttachmentDefinition[] = [
  { key: "module_document", label: "Complete module document (PDF)", accept: ".pdf,application/pdf", allowedTypes: ["application/pdf"], maxBytes: 20 * 1024 * 1024 },
  { key: "presentation_slides", label: "Presentation slides (PDF or PPT)", accept: ".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation", allowedTypes: SLIDE_TYPES, maxBytes: 30 * 1024 * 1024 },
  { key: "learning_video", label: "Learning video (optional but strongly encouraged)", accept: ".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime", allowedTypes: ["video/mp4", "video/webm", "video/quicktime"], maxBytes: 100 * 1024 * 1024 },
  { key: "assessment", label: "Quiz / assessment with answer key", accept: ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document", allowedTypes: DOCUMENT_TYPES, maxBytes: 20 * 1024 * 1024 },
  { key: "trainer_guide", label: "Trainer guide", accept: ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document", allowedTypes: DOCUMENT_TYPES, maxBytes: 20 * 1024 * 1024 },
  { key: "evaluation_form", label: "Evaluation form", accept: ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document", allowedTypes: DOCUMENT_TYPES, maxBytes: 20 * 1024 * 1024 },
  { key: "cover_image", label: "Course cover image", accept: ".jpg,.jpeg,.png,image/jpeg,image/png", allowedTypes: ["image/jpeg", "image/png"], maxBytes: 5 * 1024 * 1024 },
  { key: "practical_exercise", label: "Practical exercise (if applicable)", accept: ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document", allowedTypes: DOCUMENT_TYPES, maxBytes: 20 * 1024 * 1024 },
] as const;
