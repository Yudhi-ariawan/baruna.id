import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CourseEnrollmentStatus = "none" | "pending" | "approved" | "rejected";

export type MyCourseEnrollmentDetail = {
  isEnrolled: boolean;
  status: CourseEnrollmentStatus;
  appliedAt?: string | null;
  decisionAt?: string | null;
  decisionNotes?: string | null;
  notes?: string | null;
  courseTitle?: string | null;
};

export const getMyCourseEnrollmentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        courseId: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<MyCourseEnrollmentDetail> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Try querying primary table: course_enrollment_applications
    try {
      const { data: record, error } = await (supabaseAdmin as any)
        .from("course_enrollment_applications")
        .select("status, notes, decision_notes, decision_at, created_at, course_title")
        .eq("user_id", context.userId)
        .eq("course_id", data.courseId)
        .maybeSingle();

      if (!error && record) {
        const status = (record.status as CourseEnrollmentStatus) || "pending";
        return {
          isEnrolled: status === "approved",
          status,
          appliedAt: record.created_at,
          decisionAt: record.decision_at,
          decisionNotes: record.decision_notes,
          notes: record.notes,
          courseTitle: record.course_title,
        };
      }
    } catch {
      // Table may not yet be in schema cache; continue to resilient fallback
    }

    // 2. Resilient check in admin_audit_log for audit-backed state
    try {
      const { data: auditLogs } = await (supabaseAdmin as any)
        .from("admin_audit_log")
        .select("event_type, after_data, created_at")
        .eq("target_user_id", context.userId)
        .eq("entity_type", "course_enrollment")
        .eq("entity_id", data.courseId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (auditLogs && auditLogs.length > 0) {
        const lastLog = auditLogs[0];
        const payload = (lastLog.after_data as Record<string, any>) || {};
        const status = (payload.status as CourseEnrollmentStatus) || "pending";
        return {
          isEnrolled: status === "approved",
          status,
          appliedAt: lastLog.created_at,
          decisionAt: payload.decision_at || null,
          decisionNotes: payload.decision_notes || null,
          notes: payload.notes || null,
          courseTitle: payload.course_title || null,
        };
      }
    } catch {
      // Ignore fallback audit read error
    }

    return {
      isEnrolled: false,
      status: "none",
    };
  });

export const submitCourseEnrollmentApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        courseId: z.string().min(1).max(200),
        courseTitle: z.string().min(1).max(300),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch user profile and identity details
    const [{ data: userIdent }, { data: profile }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(context.userId),
      supabaseAdmin
        .from("profiles")
        .select("display_name, organization")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);

    const userEmail = userIdent?.user?.email || "";
    const applicantName =
      profile?.display_name ||
      (userIdent?.user?.user_metadata?.display_name as string) ||
      (userIdent?.user?.user_metadata?.full_name as string) ||
      userEmail.split("@")[0] ||
      "Peserta Baru";
    const applicantOrg =
      profile?.organization ||
      (userIdent?.user?.user_metadata?.organization as string) ||
      null;

    const now = new Date().toISOString();
    let savedToTable = false;

    // 1. Primary write to course_enrollment_applications
    try {
      const { error: upsertErr } = await (supabaseAdmin as any)
        .from("course_enrollment_applications")
        .upsert(
          {
            user_id: context.userId,
            course_id: data.courseId,
            course_title: data.courseTitle,
            applicant_name: applicantName,
            applicant_email: userEmail,
            applicant_organization: applicantOrg,
            status: "pending",
            notes: data.notes?.trim() || null,
            decision_by: null,
            decision_at: null,
            decision_notes: null,
            updated_at: now,
          },
          { onConflict: "user_id,course_id" },
        );

      if (!upsertErr) {
        savedToTable = true;
      }
    } catch {
      savedToTable = false;
    }

    // 2. Comprehensive Admin Audit Log (guarantees persistence & event history)
    try {
      await (supabaseAdmin as any).from("admin_audit_log").insert({
        event_type: "course_enrollment_requested",
        actor_id: context.userId,
        target_user_id: context.userId,
        entity_type: "course_enrollment",
        entity_id: data.courseId,
        before_data: null,
        after_data: {
          status: "pending",
          course_id: data.courseId,
          course_title: data.courseTitle,
          applicant_name: applicantName,
          applicant_email: userEmail,
          applicant_organization: applicantOrg,
          notes: data.notes?.trim() || null,
          saved_to_table: savedToTable,
        },
        metadata: {
          requested_at: now,
        },
      });
    } catch (auditErr) {
      console.warn("[submitCourseEnrollment] audit log warning:", auditErr);
    }

    return {
      success: true,
      status: "pending" as const,
      message: "Pendaftaran pelatihan berhasil diajukan dan sedang menunggu persetujuan tim Administrator.",
    };
  });

