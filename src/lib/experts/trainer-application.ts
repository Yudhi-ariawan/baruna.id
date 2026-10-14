import { z } from "zod";
import { MB } from "@/lib/storage/upload-limits";

/**
 * Trainer qualification application (Slide 39 "Become a BARUNA Trainer").
 * Shared by the applicant form, the server function, and the admin review so
 * the three can never disagree on what a complete application is.
 */

export const TRAINER_APPLICATION_BUCKET = "expert-applications";
export const TRAINER_APPLICATION_FILE_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx";
export const TRAINER_APPLICATION_FILE_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx"];
/** expert-applications bucket hard limit (migration 20261014010000). */
export const TRAINER_APPLICATION_MAX_BYTES = 10 * MB;

export function trainerApplicationFilePrefix(userId: string) {
  return `users/${userId}/trainer-application/`;
}

export const TRAINER_ROLES = [
  "Lead Trainer",
  "Co-Trainer",
  "Technical Instructor",
  "Facilitator",
  "Resource Person",
  "Subject Matter Expert",
  "Reviewer",
  "Mentor",
  "Module Author",
] as const;

export const TRAINER_LEVELS = ["certified", "advanced", "senior", "master"] as const;
export type TrainerLevel = (typeof TRAINER_LEVELS)[number];

const SampleFile = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(TRAINER_APPLICATION_MAX_BYTES),
  type: z.string().max(160),
  path: z.string().min(1).max(512),
  bucket: z.literal(TRAINER_APPLICATION_BUCKET),
});
export type TrainerApplicationFile = z.infer<typeof SampleFile>;

export const TrainerApplicationSchema = z.object({
  proposedRoles: z.array(z.enum(TRAINER_ROLES)).min(1, "Pilih minimal satu peran.").max(TRAINER_ROLES.length),
  trainingExperience: z.string().trim().min(50, "Pengalaman melatih minimal 50 karakter.").max(4000),
  teachingEvidence: z.string().trim().min(20, "Bukti kompetensi mengajar minimal 20 karakter.").max(4000),
  materialDevelopment: z.string().trim().max(4000).default(""),
  proposedModuleTopic: z.string().trim().min(5, "Topik modul minimal 5 karakter.").max(240),
  targetParticipants: z.string().trim().min(3, "Target peserta wajib diisi.").max(500),
  instructionalHours: z.number().int().min(1, "Jam pembelajaran minimal 1.").max(500),
  learningOutcomes: z.string().trim().min(20, "Capaian pembelajaran minimal 20 karakter.").max(4000),
  sampleMaterialUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Tautan harus diawali http:// atau https://")
    .default(""),
  sampleMaterial: SampleFile.nullable().default(null),
  declarations: z.object({
    originality: z.literal(true, { errorMap: () => ({ message: "Pernyataan orisinalitas wajib disetujui." }) }),
    copyright: z.literal(true, { errorMap: () => ({ message: "Pernyataan hak cipta wajib disetujui." }) }),
    conflictOfInterest: z.literal(true, { errorMap: () => ({ message: "Pernyataan konflik kepentingan wajib disetujui." }) }),
    codeOfConduct: z.literal(true, { errorMap: () => ({ message: "Kode etik BARUNA wajib disetujui." }) }),
  }),
}).refine((v) => v.sampleMaterial !== null || v.sampleMaterialUrl !== "", {
  message: "Lampirkan contoh materi ajar (berkas atau tautan).",
  path: ["sampleMaterial"],
});

export type TrainerApplicationPayload = z.infer<typeof TrainerApplicationSchema>;

/** The sample file must be a real upload in the applicant's own folder. */
export function assertTrainerApplicationFile(payload: TrainerApplicationPayload, userId: string) {
  const file = payload.sampleMaterial;
  if (!file) return;
  if (!file.path.startsWith(trainerApplicationFilePrefix(userId)) || file.path.includes("..")) {
    throw new Error("Berkas contoh materi tidak valid: unggah ulang dari akun Anda sendiri.");
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!TRAINER_APPLICATION_FILE_EXTENSIONS.includes(ext)) {
    throw new Error("Format berkas contoh materi harus PDF, DOC/DOCX, atau PPT/PPTX.");
  }
}

export type TrainerApplicationSummary = {
  id: string;
  status: "submitted" | "approved" | "rejected" | "withdrawn";
  payload: TrainerApplicationPayload;
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  grantedLevel: string | null;
};

export type MyTrainerApplicationState =
  | { eligibility: "not_expert" }
  | {
      eligibility: "eligible" | "active_trainer";
      expertId: string;
      trainerStatus: string;
      trainerLevel: string | null;
      latestApplication: TrainerApplicationSummary | null;
    };
