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
  .inputValidator((d) => z.object({ code: z.string() }).parse(d))
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
  .inputValidator((d) => z.object({ code: z.string() }).parse(d))
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
  .inputValidator((d) => z.object({ offeringCode: z.string() }).parse(d))
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
  .inputValidator((d) => z.object({ offeringCode: z.string() }).parse(d))
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
  .inputValidator((d) =>
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
  .inputValidator((d) =>
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
  .inputValidator((d) => z.object({ enrolmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("check_certificate_eligibility", {
      _enrolment_id: data.enrolmentId,
    });
    if (error) throw new Error(error.message);
    return result as { eligible: boolean; reason?: string; completed?: number; required?: number };
  });

export const issueCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
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
  .inputValidator((d) => z.object({ enrolmentId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
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
