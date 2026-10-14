import type { CustomQuizQuestion } from "@/lib/learning/learning.functions";
import type {
  ExistingResource,
  ModuleFormFields,
} from "@/components/baruna/experts/submit-module/config";

type DraftLike = { title?: string | null; payload?: unknown };

export type ParsedModuleDraft = {
  fields: ModuleFormFields;
  quiz: CustomQuizQuestion[];
  existingFiles: Record<string, ExistingResource>;
  /** Only set when the draft carries a video link; otherwise keep the current value. */
  videoUrl: string | null;
};

/** Reads a saved module draft payload back into the submit-module form state. */
export function parseModuleDraft(draft: DraftLike, trainerName?: string): ParsedModuleDraft {
  const payload = (draft.payload as Record<string, unknown>) ?? {};
  const meta = (payload.metadata as Record<string, unknown>) ?? {};
  const outline = (payload.content_outline as Record<string, unknown>) ?? {};
  const assessment = (payload.assessment_approach as Record<string, unknown>) ?? {};

  const fields: ModuleFormFields = {
    title: String(payload.title ?? draft.title ?? ""),
    topic: String(outline.topic ?? ""),
    competency: String(outline.competency ?? ""),
    deliveryFormat: String(meta.delivery_format ?? "Self-paced"),
    hours: Number(payload.estimated_learning_hours ?? 8),
    level: String(meta.level ?? "Intermediate"),
    language: String(payload.language ?? "Bahasa Indonesia"),
    summary: String(payload.summary ?? ""),
    targetParticipants: String(payload.target_participants ?? ""),
    objectives: Array.isArray(payload.learning_objectives)
      ? (payload.learning_objectives as string[]).join("\n")
      : "",
    outcomes: String(payload.competency_outcomes ?? ""),
    assessment: String(assessment.method ?? "Kuis Pilihan Ganda & Studi Kasus"),
    passingScore: Number(assessment.passing_score ?? 70),
    copyrightHolder: String(meta.copyright_holder ?? trainerName ?? ""),
    licensing: String(meta.licensing ?? "CC BY-NC-SA 4.0"),
  };

  const quiz = ((Array.isArray(meta.quiz_questions) && meta.quiz_questions) ||
    (Array.isArray(assessment.quiz_questions) && assessment.quiz_questions) ||
    (Array.isArray(payload.quiz_questions) && payload.quiz_questions) ||
    []) as CustomQuizQuestion[];

  const rawAttached = Array.isArray(meta.attached_resources)
    ? (meta.attached_resources as ExistingResource[])
    : Array.isArray(payload.documents)
      ? (payload.documents as ExistingResource[])
      : Array.isArray(payload.attachments)
        ? (payload.attachments as ExistingResource[])
        : [];

  const existingFiles: Record<string, ExistingResource> = {};
  let videoUrl: string | null = null;
  for (const res of rawAttached) {
    if (!res.type) continue;
    existingFiles[res.type] = res;
    if (
      res.type.toLowerCase().includes("video") &&
      (res.path?.startsWith("http") || res.fileName?.startsWith("http"))
    ) {
      videoUrl = res.path || res.fileName || "";
    }
  }
  if (typeof meta.video_url === "string" && meta.video_url) videoUrl = meta.video_url;

  return { fields, quiz, existingFiles, videoUrl };
}
