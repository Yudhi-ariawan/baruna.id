import { FileText, GraduationCap, Upload, ShieldCheck } from "lucide-react";

export const RESOURCES = [
  "Complete module document (PDF)",
  "Presentation slides (PDF or PPT)",
  "Learning video (optional but strongly encouraged)",
  "Quiz / assessment with answer key",
  "Trainer guide",
  "Evaluation form",
  "Course cover image",
  "Practical exercise (if applicable)",
];

// Mirrors the module-attachments bucket allowed_mime_types.
export const MODULE_ATTACHMENT_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx", "jpg", "jpeg", "png", "webp", "mp4", "webm", "mov"];
export const MODULE_ATTACHMENT_ACCEPT = MODULE_ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export const DECLARATIONS = [
  "This is my own original work.",
  "I hold or have cleared all copyrights for included content.",
  "I have no undisclosed conflict of interest.",
  "I accept the BARUNA Code of Conduct and reviewer feedback process.",
];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ExistingResource = {
  type: string;
  name?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  path?: string;
  bucket?: string;
  uploadedAt?: string;
};

export type ModuleResource = {
  type: string;
  name: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  path?: string;
  bucket?: string;
  uploadedAt: string;
};

export type ModuleFormFields = {
  title: string;
  topic: string;
  competency: string;
  deliveryFormat: string;
  hours: number;
  level: string;
  language: string;
  summary: string;
  targetParticipants: string;
  objectives: string;
  outcomes: string;
  assessment: string;
  passingScore: number;
  copyrightHolder: string;
  licensing: string;
};

export type UpdateField = (key: keyof ModuleFormFields, val: string | number) => void;

export const STEPS = [
  {
    n: 1,
    titleEn: "Info & Target",
    titleId: "Informasi & Target",
    descEn: "Basic module metadata",
    descId: "Metadata dasar modul",
    icon: FileText,
  },
  {
    n: 2,
    titleEn: "Syllabus & Evaluation",
    titleId: "Silabus & Evaluasi",
    descEn: "Objectives and passing score",
    descId: "Tujuan & passing score",
    icon: GraduationCap,
  },
  {
    n: 3,
    titleEn: "Files & Media",
    titleId: "Berkas & Media",
    descEn: "Videos, slides and documents",
    descId: "Video, slide, & dokumen",
    icon: Upload,
  },
  {
    n: 4,
    titleEn: "Ethics & Review",
    titleId: "Etika & Finalisasi",
    descEn: "Copyright, ethics & submit",
    descId: "Hak cipta, etika & kirim",
    icon: ShieldCheck,
  },
];
