// ============================================================================
// BARUNA Learning Architecture — Server functions (Phase 1 backend)
// ----------------------------------------------------------------------------
// All authoritative learning data lives on the backend and is scoped to the
// authenticated user via RLS. Certificates are issued only after server-side
// eligibility validation.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getModuleStorageSignedUrl(
  supabaseAdmin: any,
  storagePath: string,
  expiresIn = 86400,
  bucket?: string,
): Promise<string | null> {
  if (!storagePath) return null;

  // If a public Supabase URL was saved (e.g. from getPublicUrl), extract bucket and path to sign it properly
  if (storagePath.includes("/storage/v1/object/public/")) {
    const parts = storagePath.split("/storage/v1/object/public/")[1];
    if (parts) {
      const slashIdx = parts.indexOf("/");
      if (slashIdx !== -1) {
        const extractedBucket = parts.slice(0, slashIdx);
        const extractedPath = parts.slice(slashIdx + 1);
        return getModuleStorageSignedUrl(supabaseAdmin, extractedPath, expiresIn, extractedBucket);
      }
    }
  }

  // Already a signed URL or external absolute URL
  if (storagePath.includes("/storage/v1/object/sign/") || (storagePath.startsWith("http") && !storagePath.includes("supabase.co/storage/"))) {
    return storagePath;
  }

  const primaryBucket =
    bucket || (storagePath.includes("/modules/") ? "expert-applications" : "module-attachments");
  try {
    const { data: signed, error } = await supabaseAdmin.storage
      .from(primaryBucket)
      .createSignedUrl(storagePath, expiresIn);
    if (!error && signed?.signedUrl) {
      return signed.signedUrl;
    }
    const altBucket =
      primaryBucket === "module-attachments" ? "expert-applications" : "module-attachments";
    const { data: altSigned } = await supabaseAdmin.storage
      .from(altBucket)
      .createSignedUrl(storagePath, expiresIn);
    return altSigned?.signedUrl ?? null;
  } catch {
    return null;
  }
}

// ─── Public reads (no auth required) ───────────────────────────────────────

export const listOfferings = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await supabase
    .from("course_offerings")
    .select(
      "id, offering_code, offering_title, master_course_id, learning_engine_version, legacy_learn_path, shared_learn_path, status, cohort_name, year, master_courses(course_code, title, description, legacy_course_id)",
    );
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getOfferingByCode = createServerFn({ method: "GET" })
  .validator((d) => z.object({ code: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: offering, error } = await supabase
      .from("course_offerings")
      .select(
        "id, offering_code, offering_title, master_course_id, learning_engine_version, legacy_learn_path, shared_learn_path, status, cohort_name, year, access_mode, master_courses(id, course_code, title, description, legacy_course_id, learning_template_id)",
      )
      .eq("offering_code", data.code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!offering) return null;
    const { data: modules } = await supabase
      .from("master_modules")
      .select("id, module_code, title, sequence, learning_hours")
      .eq("master_course_id", offering.master_course_id)
      .order("sequence");
    const mc = Array.isArray(offering.master_courses)
      ? offering.master_courses[0]
      : offering.master_courses;
    return { ...offering, master_courses: mc, modules: modules ?? [] };
  });

// Safe route resolver — enforces feature-flag gating.
export const resolveOfferingRoute = createServerFn({ method: "GET" })
  .validator((d) => z.object({ code: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: offering } = await supabase
      .from("course_offerings")
      .select("id, offering_code, learning_engine_version, legacy_learn_path, shared_learn_path")
      .eq("offering_code", data.code)
      .maybeSingle();
    if (!offering) return { engine: "legacy" as const, path: null };
    const { data: flag } = await supabase
      .from("learning_feature_flags")
      .select("engine_version, enabled")
      .eq("course_offering_id", offering.id)
      .maybeSingle();
    // Missing flag defaults safely to legacy
    const engine = flag?.enabled && flag.engine_version === "shared_v1" ? "shared_v1" : "legacy";
    const path =
      engine === "shared_v1"
        ? offering.shared_learn_path ?? `/academy/course/${offering.offering_code}`
        : offering.legacy_learn_path ?? null;
    return { engine, path, offeringCode: offering.offering_code };
  });

// ─── Authenticated participant operations ─────────────────────────────────

export const listMyEnrolments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("enrolments")
      .select(
        "id, course_offering_id, enrolment_status, completion_status, enrolment_date, updated_at, course_offerings(offering_code, offering_title, learning_engine_version, legacy_learn_path, shared_learn_path, master_courses(course_code, title))",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const LEARNING_ERRORS: Record<string, string> = {
  approval_required:
    "Kursus ini memerlukan persetujuan admin. Ajukan pendaftaran terlebih dahulu dan tunggu persetujuan.",
  offering_not_found: "Kursus tidak ditemukan.",
  offering_closed: "Pendaftaran kursus ini sudah ditutup.",
  enrolment_window_closed: "Saat ini di luar periode pendaftaran kursus ini.",
  enrolment_not_found: "Data pendaftaran kursus tidak ditemukan.",
  enrolment_not_active: "Pendaftaran kursus ini sudah tidak aktif.",
  activity_not_in_course: "Aktivitas ini bukan bagian dari kursus.",
  invalid_evaluation_type: "Jenis evaluasi tidak valid.",
  response_too_large: "Jawaban evaluasi terlalu besar.",
  invalid_certificate_type: "Jenis sertifikat tidak valid.",
};
const ELIGIBILITY_REASONS: Record<string, string> = {
  modules_incomplete: "Selesaikan semua modul terlebih dahulu.",
  evaluation_missing: "Isi evaluasi kursus terlebih dahulu.",
  no_modules_configured: "Kursus ini belum memiliki modul.",
  enrolment_not_active: "Pendaftaran kursus ini sudah tidak aktif.",
};

/** Learning writes go through SECURITY DEFINER RPCs (migration 20261020010000). */
function toFriendlyLearningError(message: string | undefined | null): string {
  if (!message) return "Terjadi kesalahan. Coba lagi.";
  if (/Could not find the function|schema cache/.test(message)) {
    return "Fitur ini membutuhkan migrasi database 20261020010000. Jalankan supabase/check_migrations.sql.";
  }
  const notEligible = message.match(/not_eligible:(\w+)/);
  if (notEligible) {
    return `Belum memenuhi syarat sertifikat: ${ELIGIBILITY_REASONS[notEligible[1]] ?? notEligible[1]}`;
  }
  for (const [code, friendly] of Object.entries(LEARNING_ERRORS)) {
    if (message.includes(code)) return friendly;
  }
  return message;
}

async function callLearningRpc<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { supabase: any },
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await context.supabase.rpc(fn, args);
  if (error) throw new Error(toFriendlyLearningError(error.message));
  return data as T;
}

type EnrolmentRow = { id: string; enrolment_status: string; completion_status: string };

/**
 * Open/registered offerings may be self-enrolled; approval-required ones only after
 * an admin approved the application (the database decides, so the SDK cannot skip it).
 */
export const enrolInOffering = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ offeringCode: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const row = await callLearningRpc<EnrolmentRow & { created: boolean }>(context, "learning_enrol", {
      _offering_code: data.offeringCode,
    });
    return { id: row.id, enrolment_status: row.enrolment_status, completion_status: row.completion_status };
  });

export const getEnrolmentDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ offeringCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: offering } = await context.supabase
      .from("course_offerings")
      .select("id")
      .eq("offering_code", data.offeringCode)
      .maybeSingle();
    if (!offering) return null;
    const { data: enrolment } = await context.supabase
      .from("enrolments")
      .select("id, enrolment_status, completion_status, enrolment_date")
      .eq("course_offering_id", offering.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!enrolment) return null;
    const [{ data: progress }, { data: evaluations }, { data: certificates }] = await Promise.all([
      context.supabase
        .from("progress_records")
        .select("learning_activity_id, status, progress_value, completed_at")
        .eq("enrolment_id", enrolment.id),
      context.supabase
        .from("evaluations")
        .select("evaluation_type, submitted_at, completion_status")
        .eq("enrolment_id", enrolment.id),
      context.supabase
        .from("certificates")
        .select("id, certificate_type, certificate_number, issue_date, verification_reference")
        .eq("enrolment_id", enrolment.id),
    ]);
    return { enrolment, progress: progress ?? [], evaluations: evaluations ?? [], certificates: certificates ?? [] };
  });

export const markActivityComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        enrolmentId: z.string().uuid(),
        activityId: z.string().min(1).max(200),
        status: z.enum(["in-progress", "completed"]).default("completed"),
        progressValue: z.number().min(0).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // The RPC checks ownership, an active enrolment and that the activity is a module of the course.
    return callLearningRpc<{ id: string; status: string }>(context, "learning_progress_mark", {
      _enrolment_id: data.enrolmentId,
      _activity_id: data.activityId,
      _status: data.status,
      _progress: data.progressValue ?? null,
    });
  });

export const submitEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        enrolmentId: z.string().uuid(),
        evaluationType: z.string().min(1).max(60),
        responseData: z.record(z.unknown()).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    return callLearningRpc<{ id: string; evaluation_type: string }>(context, "learning_evaluation_submit", {
      _enrolment_id: data.enrolmentId,
      _evaluation_type: data.evaluationType,
      _response: data.responseData,
    });
  });

export const checkEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ enrolmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("check_certificate_eligibility", {
      _enrolment_id: data.enrolmentId,
    });
    if (error) throw new Error(error.message);
    return result as { eligible: boolean; reason?: string; completed?: number; required?: number };
  });

type IssuedCertificate = {
  id: string;
  certificate_number: string;
  verification_reference: string;
  certificate_type: string;
  issue_date: string;
};

/**
 * Eligibility, the unique server-generated number and the insert happen in one
 * transaction locked on the enrolment, so a double click returns the same certificate.
 */
export const issueCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        enrolmentId: z.string().uuid(),
        certificateType: z.enum([
          "completion",
          "participation",
          "program",
          "applied-achievement",
          "competency",
          "statement-of-result",
        ]).default("completion"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const cert = await callLearningRpc<IssuedCertificate & { created: boolean }>(context, "issue_my_certificate", {
      _enrolment_id: data.enrolmentId,
      _certificate_type: data.certificateType,
    });
    return {
      id: cert.id,
      certificate_number: cert.certificate_number,
      verification_reference: cert.verification_reference,
      certificate_type: cert.certificate_type,
      issue_date: cert.issue_date,
    };
  });

export type CertificateVerification =
  | { found: false }
  | {
      found: true;
      certificate_number: string;
      status: string;
      certificate_type: string;
      issue_date: string;
      program: string;
      holder: string;
    };

/** Public lookup of one exact certificate number (no login). The holder name is masked. */
export const verifyCertificate = createServerFn({ method: "GET" })
  .validator((d) => z.object({ number: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data }): Promise<CertificateVerification> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("verify_certificate", { _number: data.number });
    if (error) throw new Error(toFriendlyLearningError(error.message));
    return (result ?? { found: false }) as unknown as CertificateVerification;
  });

export const listMyCertificates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("certificates")
      .select(
        "id, certificate_type, certificate_number, issue_date, verification_reference, course_offerings(offering_code, offering_title)",
      )
      .order("issue_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Per-user rollback: switch the current user's local pilot back to the legacy
// experience by marking their enrolment withdrawn. Server data is preserved.
export const rollbackOwnEnrolment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ enrolmentId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await callLearningRpc(context, "learning_enrolment_withdraw", {
      _enrolment_id: data.enrolmentId,
      _reason: data.reason ?? null,
    });
    return { ok: true };
  });

export type PublishedModuleDocument = {
  type: string;
  name: string;
  size: number;
  fileType: string | null;
  downloadUrl: string | null;
};

export type PublishedModuleTrainer = {
  name: string;
  headline: string | null;
  institution: string | null;
  avatarUrl: string | null;
  slug: string | null;
};

export type CustomQuizQuestion = {
  id: number | string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
};

export type PublishedModuleDetail = {
  id: string;
  title: string;
  summary: string;
  moduleType: string;
  language: string;
  hours: number;
  targetParticipants: string | null;
  learningObjectives: string[];
  competencyOutcomes: string | null;
  topic: string;
  competency: string;
  assessmentMethod: string;
  passingScore: number;
  trainer: PublishedModuleTrainer;
  documents: PublishedModuleDocument[];
  publishedAt: string;
  /** Questions only — answer keys never leave the server (see gradePublishedModuleQuiz). */
  quizQuestions?: PublicQuizQuestion[];
};

export type PublicQuizQuestion = Omit<CustomQuizQuestion, "correctAnswer" | "explanation">;

type ParsedQuizQuestion = PublicQuizQuestion & { rawIndex: number };

/** Valid questions plus their position in the stored array (answer keys are stored by that position). */
function parseQuizQuestions(raw: unknown): ParsedQuizQuestion[] | undefined {
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

export const getPublishedModuleDetail = createServerFn({ method: "GET" })
  .validator((d) => z.object({ moduleId: z.string() }).parse(d))
  .handler(async ({ data }): Promise<PublishedModuleDetail | null> => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.moduleId);
    if (!isUuid) return null;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { resolvePublicAvatarUrl } = await import("@/lib/experts/publishing.server");

      const { data: mod, error: mErr } = await supabaseAdmin
        .from("module_registry")
        .select("*")
        .eq("id", data.moduleId)
        .maybeSingle();

      if (mErr) {
        console.error("Error querying module_registry:", mErr);
      }

      if (mod && (mod.current_status !== "published" || mod.visibility !== "public")) {
        return null;
      }

      if (!mod) {
        // Fallback: Check if it's an expert module submission (draft or under review)
        const { data: subData } = await (supabaseAdmin as any)
          .from("expert_module_submissions")
          .select("*")
          .eq("id", data.moduleId)
          .maybeSingle();

        const sub = subData as Record<string, any> | null;
        if (!sub) return null;

        const subPayload = (sub.payload as Record<string, any>) ?? {};
        const subMeta = (subPayload.metadata as Record<string, any>) ?? {};
        const subOutline = (subPayload.content_outline as Record<string, any>) ?? {};
        const subAssessment = (subPayload.assessment_approach as Record<string, any>) ?? {};

        let subTrainer: PublishedModuleTrainer = {
          name: "BARUNA Trainer",
          headline: null,
          institution: null,
          avatarUrl: null,
          slug: null,
        };

        if (sub.expert_id) {
          const { data: exp } = await supabaseAdmin
            .from("experts_directory_v")
            .select("id, display_name, headline, institution, avatar_url, slug")
            .eq("id", sub.expert_id)
            .maybeSingle();

          if (exp) {
            subTrainer = {
              name: exp.display_name || "BARUNA Trainer",
              headline: exp.headline || null,
              institution: exp.institution || null,
              avatarUrl: await resolvePublicAvatarUrl(exp.avatar_url, exp.id),
              slug: exp.slug || null,
            };
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawAttachedSub: Array<Record<string, any>> = Array.isArray(subMeta.attached_resources)
          ? subMeta.attached_resources
          : Array.isArray(subPayload.documents)
          ? subPayload.documents
          : [];

        const subDocs: PublishedModuleDocument[] = await Promise.all(
          rawAttachedSub.map(async (doc) => {
            const type = String(doc.type || doc.category || "Dokumen Pendukung");
            const name = String(doc.fileName || doc.name || "Berkas");
            const size = Number(doc.fileSize || doc.size || 0);
            const fileType = typeof doc.fileType === "string" ? doc.fileType : (typeof doc.type === "string" ? doc.type : null);
            const storagePath = typeof doc.path === "string" ? doc.path : null;
            let downloadUrl: string | null = null;

            if (storagePath) {
              downloadUrl = await getModuleStorageSignedUrl(
                supabaseAdmin,
                storagePath,
                86400,
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
          id: String(sub.id),
          title: String(subPayload.title || sub.title || "Modul Pelatihan"),
          summary: String(subPayload.summary || ""),
          moduleType: String(subPayload.module_type || sub.module_type || "technical"),
          language: String(subPayload.language || "English"),
          hours: Number(subPayload.estimated_learning_hours || 2),
          targetParticipants: (subPayload.target_participants as string | null) ?? null,
          learningObjectives: Array.isArray(subPayload.learning_objectives)
            ? (subPayload.learning_objectives as string[])
            : [],
          competencyOutcomes:
            (typeof subPayload.competency_outcomes === "string" && subPayload.competency_outcomes) ||
            (typeof subMeta.competency_outcomes === "string" && subMeta.competency_outcomes) ||
            null,
          topic: String(subOutline.topic || subMeta.topic || ""),
          competency: String(subOutline.competency || subMeta.competency || ""),
          assessmentMethod: String(subAssessment.method || "Evaluasi Mandiri & Kuis Pemahaman"),
          passingScore: Number(subAssessment.passing_score ?? 70),
          trainer: subTrainer,
          documents: subDocs,
          publishedAt: String(sub.created_at),
          quizQuestions: toPublicQuiz(parseQuizQuestions(
            subMeta.quiz_questions ||
            subAssessment.quiz_questions ||
            subPayload.quiz_questions ||
            (subMeta.assessment_approach as Record<string, unknown> | undefined)?.quiz_questions
          )),
        };
      }

    let trainerInfo: PublishedModuleTrainer = {
      name: "BARUNA Trainer",
      headline: null,
      institution: null,
      avatarUrl: null,
      slug: null,
    };

    if (mod.author_expert_id) {
      // Query experts_directory_v for curated profile and institution
      const { data: exp } = await supabaseAdmin
        .from("experts_directory_v")
        .select("id, display_name, headline, institution, avatar_url, slug")
        .eq("id", mod.author_expert_id)
        .maybeSingle();

      if (exp) {
        trainerInfo = {
          name: exp.display_name || "BARUNA Trainer",
          headline: exp.headline || null,
          institution: exp.institution || null,
          avatarUrl: await resolvePublicAvatarUrl(exp.avatar_url, exp.id),
          slug: exp.slug || null,
        };
      } else {
        const { data: rawExp } = await supabaseAdmin
          .from("experts")
          .select("id, display_name, headline, avatar_url, slug")
          .eq("id", mod.author_expert_id)
          .maybeSingle();
        if (rawExp) {
          trainerInfo = {
            name: rawExp.display_name || "BARUNA Trainer",
            headline: rawExp.headline || null,
            institution: null,
            avatarUrl: await resolvePublicAvatarUrl(rawExp.avatar_url, rawExp.id),
            slug: rawExp.slug || null,
          };
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentOutline = (mod.content_outline as Record<string, any>) ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assessmentApproach = (mod.assessment_approach as Record<string, any>) ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (mod.metadata as Record<string, any>) ?? {};

    const topic = String(contentOutline.topic || meta.topic || "");
    const competency = String(contentOutline.competency || meta.competency || "");
    const assessmentMethod = String(assessmentApproach.method || "Evaluasi Mandiri & Kuis Pemahaman");
    const passingScore = Number(assessmentApproach.passing_score ?? 70);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawAttached: Array<Record<string, any>> = Array.isArray(meta.attached_resources)
      ? meta.attached_resources
      : Array.isArray(meta.documents)
      ? meta.documents
      : [];

    const documentsWithUrls: PublishedModuleDocument[] = await Promise.all(
      rawAttached.map(async (doc) => {
        const type = String(doc.type || doc.category || "Dokumen Pendukung");
        const name = String(doc.fileName || doc.name || "Berkas");
        const size = Number(doc.fileSize || doc.size || 0);
        const fileType = typeof doc.fileType === "string" ? doc.fileType : (typeof doc.type === "string" ? doc.type : null);
        const storagePath = typeof doc.path === "string" ? doc.path : null;
        let downloadUrl: string | null = null;

        if (storagePath) {
          downloadUrl = await getModuleStorageSignedUrl(
            supabaseAdmin,
            storagePath,
            86400,
            typeof doc.bucket === "string" ? doc.bucket : undefined,
          );
        } else if (typeof doc.url === "string" && (doc.url.startsWith("http://") || doc.url.startsWith("https://"))) {
          downloadUrl = doc.url;
        } else if (name.startsWith("http://") || name.startsWith("https://")) {
          downloadUrl = name;
        }

        return {
          type,
          name,
          size,
          fileType,
          downloadUrl,
        };
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
      learningObjectives: Array.isArray(mod.learning_objectives)
        ? (mod.learning_objectives as string[])
        : [],
      competencyOutcomes:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (typeof (mod as any).competency_outcomes === "string" && (mod as any).competency_outcomes) ||
        (typeof meta.competency_outcomes === "string" && meta.competency_outcomes) ||
        null,
      topic,
      competency,
      assessmentMethod,
      passingScore,
      trainer: trainerInfo,
      documents: documentsWithUrls,
      publishedAt: String(mod.publication_date || mod.created_at),
      quizQuestions: toPublicQuiz(parseQuizQuestions(publishedQuizSource(mod))),
    };
  } catch (err) {
    console.error("Error in getPublishedModuleDetail:", err);
    return null;
  }
});

/** Same source order getPublishedModuleDetail uses, so indexes line up with the stored keys. */
function publishedQuizSource(mod: Record<string, unknown>): unknown {
  const meta = (mod.metadata as Record<string, unknown>) ?? {};
  const assessment = (mod.assessment_approach as Record<string, unknown>) ?? {};
  return meta.quiz_questions || assessment.quiz_questions || mod.quiz_questions;
}

export type QuizGradeResult = {
  score: number;
  passed: boolean;
  passingScore: number;
  results: Array<{ correct: boolean; correctAnswer: number; explanation: string | null }>;
};

/**
 * Grades a published module quiz on the server. Answer keys live in
 * module_quiz_answer_keys (service role only), so they are revealed per question
 * only after the participant has submitted a full set of answers.
 */
export const gradePublishedModuleQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        moduleId: z.string().uuid(),
        answers: z.array(z.number().int().min(0).max(100)).min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<QuizGradeResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mod, error: modErr } = await supabaseAdmin
      .from("module_registry")
      .select("id, current_status, visibility, metadata, assessment_approach")
      .eq("id", data.moduleId)
      .maybeSingle();
    if (modErr) throw new Error(`Gagal memuat modul: ${modErr.message}`);
    if (!mod || mod.current_status !== "published" || mod.visibility !== "public") {
      throw new Error("Modul tidak ditemukan atau tidak sedang tayang.");
    }

    const questions = parseQuizQuestions(publishedQuizSource(mod as unknown as Record<string, unknown>));
    if (!questions?.length) throw new Error("Modul ini tidak memiliki kuis.");
    if (data.answers.length !== questions.length) {
      throw new Error("Jawab semua pertanyaan kuis sebelum mengirim.");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: keyRow, error: keyErr } = await (supabaseAdmin as any)
      .from("module_quiz_answer_keys")
      .select("questions")
      .eq("module_id", data.moduleId)
      .maybeSingle();
    if (keyErr) throw new Error(`Gagal memuat kunci jawaban: ${keyErr.message}`);
    const keys = Array.isArray(keyRow?.questions) ? (keyRow.questions as Array<Record<string, unknown>>) : [];
    const keyAt = new Map(keys.map((k) => [Number(k.index), k]));

    const results = questions.map((q, i) => {
      const key = keyAt.get(q.rawIndex);
      const rawCorrect = Number(key?.correctAnswer);
      // A missing key must not silently grade every question against option A.
      if (!key || !Number.isInteger(rawCorrect)) {
        throw new Error("Kunci jawaban kuis modul ini belum tersedia. Hubungi admin BARUNA.");
      }
      const correctAnswer = Math.max(0, Math.min(q.options.length - 1, rawCorrect));
      return {
        correct: data.answers[i] === correctAnswer,
        correctAnswer,
        explanation: typeof key.explanation === "string" && key.explanation.trim() ? key.explanation.trim() : null,
      };
    });

    const assessment = (mod.assessment_approach as Record<string, unknown>) ?? {};
    const passingScore = Number(assessment.passing_score ?? 70);
    const score = Math.round((results.filter((r) => r.correct).length / results.length) * 100);
    return { score, passed: score >= passingScore, passingScore, results };
  });

export type PublishedCatalogModule = {
  id: string;
  title: string;
  summary: string;
  language: string;
  estimated_learning_hours: number;
  created_at: string;
  author_expert_id: string | null;
  authorName: string;
  authorAvatar: string | null;
  authorSlug: string | null;
  coverUrl: string | null;
  topic: string;
  competency: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
};

export const getPublishedModulesCatalog = createServerFn({ method: "GET" })
  .handler(async (): Promise<PublishedCatalogModule[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { resolvePublicAvatarUrl } = await import("@/lib/experts/publishing.server");
      const { data: dbMods, error } = await supabaseAdmin
        .from("module_registry")
        .select("id, title, summary, language, estimated_learning_hours, created_at, author_expert_id, metadata, content_outline, current_status, visibility")
        .eq("current_status", "published")
        .eq("visibility", "public")
        .order("created_at", { ascending: false });

      if (error || !dbMods || dbMods.length === 0) return [];

      const expertIds = Array.from(new Set(dbMods.map((m) => m.author_expert_id).filter(Boolean))) as string[];
      let expertMap: Record<string, { name: string; avatarUrl: string | null; slug: string | null }> = {};
      if (expertIds.length > 0) {
        const { data: expList } = await supabaseAdmin
          .from("experts_directory_v")
          .select("id, display_name, avatar_url, slug")
          .in("id", expertIds);
        if (expList && expList.length > 0) {
          const resolvedExpList = await Promise.all(
            expList.map(async (e) => [
              e.id,
              {
                name: e.display_name || "BARUNA Trainer",
                avatarUrl: await resolvePublicAvatarUrl(e.avatar_url, e.id),
                slug: e.slug,
              },
            ] as const),
          );
          expertMap = Object.fromEntries(resolvedExpList);
        } else {
          const { data: profList } = await supabaseAdmin
            .from("profiles")
            .select("id, display_name")
            .in("id", expertIds);
          if (profList) {
            for (const p of profList) {
              if (p.display_name) {
                expertMap[p.id] = { name: p.display_name, avatarUrl: null, slug: null };
              }
            }
          }
        }
      }

      // Concurrently sign cover URLs
      const catalog: PublishedCatalogModule[] = await Promise.all(
        dbMods.map(async (m) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const meta = ((m.metadata as Record<string, any>) || {}) as Record<string, any>;
          const outline = ((m.content_outline as Record<string, any>) || {}) as Record<string, any>;
          let coverUrl: string | null = null;

          // 1. Direct cover_image_url
          if (typeof meta.cover_image_url === "string" && meta.cover_image_url.trim()) {
            const url = meta.cover_image_url.trim();
            coverUrl = await getModuleStorageSignedUrl(supabaseAdmin, url, 86400);
          }

          // 2. Extract from attached_resources or documents
          if (!coverUrl) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const attached: Array<Record<string, any>> = Array.isArray(meta.attached_resources)
              ? meta.attached_resources
              : Array.isArray(meta.documents)
              ? meta.documents
              : [];

            const coverDoc = attached.find((item) => {
              const type = String(item.type || item.category || "").toLowerCase();
              const name = String(item.name || item.fileName || "").toLowerCase();
              const isImageExt = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name);
              return (
                type.includes("cover") ||
                (type.includes("image") && isImageExt) ||
                (isImageExt && !type.includes("doc") && !type.includes("slide") && !type.includes("pdf"))
              );
            });

            if (coverDoc) {
              const directUrl = typeof coverDoc.url === "string" ? coverDoc.url : "";
              const storagePath = typeof coverDoc.path === "string" ? coverDoc.path : "";

              if (directUrl && (directUrl.startsWith("http://") || directUrl.startsWith("https://"))) {
                coverUrl = directUrl;
              } else if (storagePath) {
                coverUrl = await getModuleStorageSignedUrl(
                  supabaseAdmin,
                  storagePath,
                  86400,
                  typeof coverDoc.bucket === "string" ? coverDoc.bucket : undefined,
                );
              }
            }
          }

          const exp = m.author_expert_id ? expertMap[m.author_expert_id] : null;
          return {
            id: String(m.id),
            title: String(m.title),
            summary: String(m.summary || ""),
            language: String(m.language || "English"),
            estimated_learning_hours: Number(m.estimated_learning_hours || 2),
            created_at: String(m.created_at),
            author_expert_id: m.author_expert_id ? String(m.author_expert_id) : null,
            authorName: exp?.name || "BARUNA Trainer",
            authorAvatar: exp?.avatarUrl || null,
            authorSlug: exp?.slug || null,
            coverUrl,
            topic: typeof outline.topic === "string" ? outline.topic : "",
            competency: typeof outline.competency === "string" ? outline.competency : "",
            metadata: meta,
          };
        })
      );

      return catalog;
    } catch (err) {
      console.error("Error in getPublishedModulesCatalog:", err);
      return [];
    }
  });


