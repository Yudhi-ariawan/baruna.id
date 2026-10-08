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
async function getModuleStorageSignedUrl(
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

export const enrolInOffering = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ offeringCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: offering, error: offErr } = await context.supabase
      .from("course_offerings")
      .select("id, offering_code, learning_engine_version")
      .eq("offering_code", data.offeringCode)
      .maybeSingle();
    if (offErr || !offering) throw new Error("Invalid course offering");

    // Idempotent: unique(user_id, course_offering_id)
    const { data: existing } = await context.supabase
      .from("enrolments")
      .select("id, enrolment_status, completion_status")
      .eq("course_offering_id", offering.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      await context.supabase.from("learning_audit_log").insert({
        event_type: "enrolment_rejected_duplicate",
        actor_id: context.userId,
        entity_type: "enrolment",
        entity_id: existing.id,
        details: { offering_code: offering.offering_code },
      });
      return existing;
    }

    const { data: created, error: insErr } = await context.supabase
      .from("enrolments")
      .insert({
        user_id: context.userId,
        course_offering_id: offering.id,
        enrolment_status: "enrolled",
        completion_status: "in-progress",
      })
      .select("id, enrolment_status, completion_status")
      .single();
    if (insErr) throw new Error(insErr.message);
    await context.supabase.from("learning_audit_log").insert({
      event_type: "enrolment_created",
      actor_id: context.userId,
      entity_type: "enrolment",
      entity_id: created.id,
      details: { offering_code: offering.offering_code },
    });
    return created;
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
    // RLS ensures enrolment ownership; upsert is idempotent.
    const { data: row, error } = await context.supabase
      .from("progress_records")
      .upsert(
        {
          enrolment_id: data.enrolmentId,
          learning_activity_id: data.activityId,
          status: data.status,
          progress_value: data.progressValue ?? (data.status === "completed" ? 100 : 0),
          completed_at: data.status === "completed" ? new Date().toISOString() : null,
        },
        { onConflict: "enrolment_id,learning_activity_id" },
      )
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    return row;
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
    const { data: row, error } = await context.supabase
      .from("evaluations")
      .upsert(
        {
          enrolment_id: data.enrolmentId,
          evaluation_type: data.evaluationType,
          response_data: data.responseData as never,
          completion_status: "submitted",
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "enrolment_id,evaluation_type" },
      )
      .select("id, evaluation_type")
      .single();
    if (error) throw new Error(error.message);
    return row;
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
    // 1. Verify enrolment belongs to caller.
    const { data: enrolment, error: enrErr } = await context.supabase
      .from("enrolments")
      .select("id, course_offering_id, user_id")
      .eq("id", data.enrolmentId)
      .maybeSingle();
    if (enrErr || !enrolment || enrolment.user_id !== context.userId) {
      throw new Error("Enrolment not found or not owned by caller");
    }

    // 2. Server-side eligibility check.
    const { data: elig, error: eligErr } = await context.supabase.rpc("check_certificate_eligibility", {
      _enrolment_id: data.enrolmentId,
    });
    if (eligErr) throw new Error(eligErr.message);
    const eligibility = elig as { eligible: boolean; reason?: string };
    if (!eligibility.eligible) {
      await context.supabase.from("learning_audit_log").insert({
        event_type: "certificate_issuance_blocked",
        actor_id: context.userId,
        entity_type: "enrolment",
        entity_id: enrolment.id,
        details: eligibility,
      });
      throw new Error(`Not eligible: ${eligibility.reason ?? "unknown"}`);
    }

    // 3. Load admin client only after authorization (unique constraint prevents duplicates).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("certificates")
      .select("id, certificate_number, verification_reference, certificate_type, issue_date")
      .eq("learner_id", context.userId)
      .eq("course_offering_id", enrolment.course_offering_id)
      .eq("certificate_type", data.certificateType)
      .maybeSingle();
    if (existing) return existing;

    const serial = `BARUNA-${data.certificateType.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { data: cert, error: certErr } = await supabaseAdmin
      .from("certificates")
      .insert({
        learner_id: context.userId,
        enrolment_id: enrolment.id,
        course_offering_id: enrolment.course_offering_id,
        certificate_type: data.certificateType,
        certificate_number: serial,
        verification_reference: `https://baruna.org/verify/${serial}`,
        certificate_status: "issued",
        source_system: "shared_v1",
      })
      .select("id, certificate_number, verification_reference, certificate_type, issue_date")
      .single();
    if (certErr) throw new Error(certErr.message);

    await context.supabase.from("learning_audit_log").insert({
      event_type: "certificate_issued",
      actor_id: context.userId,
      entity_type: "certificate",
      entity_id: cert.id,
      details: { serial },
    });
    return cert;
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
    const { error } = await context.supabase
      .from("enrolments")
      .update({ enrolment_status: "withdrawn" })
      .eq("id", data.enrolmentId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await context.supabase.from("learning_audit_log").insert({
      event_type: "rollback_executed",
      actor_id: context.userId,
      entity_type: "enrolment",
      entity_id: data.enrolmentId,
      details: { reason: data.reason ?? "user_requested" },
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
};

export const getPublishedModuleDetail = createServerFn({ method: "GET" })
  .validator((d) => z.object({ moduleId: z.string() }).parse(d))
  .handler(async ({ data }): Promise<PublishedModuleDetail | null> => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.moduleId);
    if (!isUuid) return null;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: mod, error: mErr } = await supabaseAdmin
        .from("module_registry")
        .select("*")
        .eq("id", data.moduleId)
        .maybeSingle();

      if (mErr) {
        console.error("Error querying module_registry:", mErr);
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
              avatarUrl: exp.avatar_url || null,
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
          avatarUrl: exp.avatar_url || null,
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
            avatarUrl: rawExp.avatar_url || null,
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
    };
  } catch (err) {
    console.error("Error in getPublishedModuleDetail:", err);
    return null;
  }
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
          expertMap = Object.fromEntries(
            expList.map((e) => [e.id, { name: e.display_name || "BARUNA Trainer", avatarUrl: e.avatar_url, slug: e.slug }])
          );
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


