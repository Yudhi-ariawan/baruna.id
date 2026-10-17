// ============================================================================
// Published module detail — server only.
// ----------------------------------------------------------------------------
// One builder for both views of a published module:
// - "preview": public metadata plus the cover image (course detail pages, SEO).
// - "content": every document link and the quiz questions, returned only by
//   getEnrolledModuleContent after the approved-enrollment check.
// Unpublished modules are never returned in either view.
// ============================================================================
import { getModuleStorageSignedUrl } from "./learning.functions";
import type {
  PublicQuizQuestion,
  PublishedModuleDetail,
  PublishedModuleDocument,
  PublishedModuleTrainer,
} from "./learning.functions";

export type ParsedQuizQuestion = PublicQuizQuestion & { rawIndex: number };

/**
 * Lifetime of the signed links to learning material. Anyone holding a signed
 * link can open the file until it expires, so it is kept short; the learning
 * room fetches fresh links each time it opens. The public cover image keeps a
 * day, as it is shown on public pages anyway.
 */
export const MATERIAL_LINK_TTL_SECONDS = 60 * 60;
const COVER_LINK_TTL_SECONDS = 60 * 60 * 24;

/** Valid questions plus their position in the stored array (answer keys are stored by that position). */
export function parseQuizQuestions(raw: unknown): ParsedQuizQuestion[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const valid: ParsedQuizQuestion[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (item && typeof item === "object") {
      const q = item as Record<string, unknown>;
      const question = typeof q.question === "string" ? q.question.trim() : "";
      const rawOptions = Array.isArray(q.options) ? q.options : [];
      const options = rawOptions.map((o) => String(o ?? "").trim()).filter(Boolean);
      if (question && options.length >= 2) {
        valid.push({ id: (q.id as number | string) ?? (i + 1), question, options, rawIndex: i });
      }
    }
  }
  return valid.length > 0 ? valid : undefined;
}

const toPublicQuiz = (parsed: ParsedQuizQuestion[] | undefined): PublicQuizQuestion[] | undefined =>
  parsed?.map(({ rawIndex: _rawIndex, ...q }) => q);

/** Same source order the stored answer keys use, so indexes line up. */
export function publishedQuizSource(mod: Record<string, unknown>): unknown {
  const meta = (mod.metadata as Record<string, unknown>) ?? {};
  const assessment = (mod.assessment_approach as Record<string, unknown>) ?? {};
  return meta.quiz_questions || assessment.quiz_questions || mod.quiz_questions;
}

/** The cover image the public pages show; the same rule the course pages used before. */
function isCoverDocument(doc: Pick<PublishedModuleDocument, "type" | "name" | "fileType">): boolean {
  return (
    doc.type.toLowerCase().includes("cover") ||
    Boolean(doc.fileType?.includes("image")) ||
    /\.(jpg|jpeg|png|webp)$/.test(doc.name.toLowerCase())
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveTrainer(supabaseAdmin: any, authorExpertId: string | null): Promise<PublishedModuleTrainer> {
  const fallback: PublishedModuleTrainer = {
    name: "BARUNA Trainer",
    headline: null,
    institution: null,
    avatarUrl: null,
    slug: null,
  };
  if (!authorExpertId) return fallback;

  const { resolvePublicAvatarUrl } = await import("@/lib/experts/publishing.server");
  const { data: exp } = await supabaseAdmin
    .from("experts_directory_v")
    .select("id, display_name, headline, institution, avatar_url, slug")
    .eq("id", authorExpertId)
    .maybeSingle();
  if (exp) {
    return {
      name: exp.display_name || "BARUNA Trainer",
      headline: exp.headline || null,
      institution: exp.institution || null,
      avatarUrl: await resolvePublicAvatarUrl(exp.avatar_url, exp.id),
      slug: exp.slug || null,
    };
  }

  const { data: rawExp } = await supabaseAdmin
    .from("experts")
    .select("id, display_name, headline, avatar_url, slug")
    .eq("id", authorExpertId)
    .maybeSingle();
  if (rawExp) {
    return {
      name: rawExp.display_name || "BARUNA Trainer",
      headline: rawExp.headline || null,
      institution: null,
      avatarUrl: await resolvePublicAvatarUrl(rawExp.avatar_url, rawExp.id),
      slug: rawExp.slug || null,
    };
  }
  return fallback;
}

/**
 * Builds the detail of a published, public module. Returns null when the module
 * does not exist or is not published. Throws when the database read fails, so
 * callers can tell "missing" apart from "unavailable".
 */
export async function buildPublishedModuleDetail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  moduleId: string,
  view: "preview" | "content",
): Promise<PublishedModuleDetail | null> {
  const { data: mod, error } = await supabaseAdmin
    .from("module_registry")
    .select("*")
    .eq("id", moduleId)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat modul: ${error.message}`);
  if (!mod || mod.current_status !== "published" || mod.visibility !== "public") return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentOutline = (mod.content_outline as Record<string, any>) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assessmentApproach = (mod.assessment_approach as Record<string, any>) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta = (mod.metadata as Record<string, any>) ?? {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawAttached: Array<Record<string, any>> = Array.isArray(meta.attached_resources)
    ? meta.attached_resources
    : Array.isArray(meta.documents)
      ? meta.documents
      : [];

  const described = rawAttached.map((doc) => ({
    doc,
    type: String(doc.type || doc.category || "Dokumen Pendukung"),
    name: String(doc.fileName || doc.name || "Berkas"),
    size: Number(doc.fileSize || doc.size || 0),
    fileType: typeof doc.fileType === "string" ? doc.fileType : typeof doc.type === "string" ? doc.type : null,
  }));

  // The preview carries only the cover image; learning material stays behind enrollment.
  const selected = view === "content" ? described : described.filter(isCoverDocument).slice(0, 1);

  const documents: PublishedModuleDocument[] = await Promise.all(
    selected.map(async ({ doc, type, name, size, fileType }) => {
      const storagePath = typeof doc.path === "string" ? doc.path : null;
      let downloadUrl: string | null = null;
      if (storagePath) {
        downloadUrl = await getModuleStorageSignedUrl(
          supabaseAdmin,
          storagePath,
          view === "content" ? MATERIAL_LINK_TTL_SECONDS : COVER_LINK_TTL_SECONDS,
          typeof doc.bucket === "string" ? doc.bucket : undefined,
        );
      } else if (typeof doc.url === "string" && (doc.url.startsWith("http://") || doc.url.startsWith("https://"))) {
        downloadUrl = doc.url;
      } else if (name.startsWith("http://") || name.startsWith("https://")) {
        downloadUrl = name;
      }
      return { type, name, size, fileType, downloadUrl };
    }),
  );

  return {
    id: String(mod.id),
    title: String(mod.title),
    summary: String(mod.summary || ""),
    moduleType: String(mod.module_type || "technical"),
    language: String(mod.language || "English"),
    hours: Number(mod.estimated_learning_hours || 2),
    targetParticipants: (mod.target_participants as string | null) ?? null,
    learningObjectives: Array.isArray(mod.learning_objectives) ? (mod.learning_objectives as string[]) : [],
    competencyOutcomes:
      (typeof mod.competency_outcomes === "string" && mod.competency_outcomes) ||
      (typeof meta.competency_outcomes === "string" && meta.competency_outcomes) ||
      null,
    topic: String(contentOutline.topic || meta.topic || ""),
    competency: String(contentOutline.competency || meta.competency || ""),
    assessmentMethod: String(assessmentApproach.method || "Evaluasi Mandiri & Kuis Pemahaman"),
    passingScore: Number(assessmentApproach.passing_score ?? 70),
    trainer: await resolveTrainer(supabaseAdmin, mod.author_expert_id ?? null),
    documents,
    publishedAt: String(mod.publication_date || mod.created_at),
    quizQuestions:
      view === "content" ? toPublicQuiz(parseQuizQuestions(publishedQuizSource(mod))) : undefined,
  };
}
