import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toFriendlyEnrollmentError } from "@/lib/learning/enrollment-errors";

export type CourseEnrollmentStatus = "none" | "pending" | "approved" | "rejected";

export type MyCourseEnrollmentDetail = {
  isEnrolled: boolean;
  hasParticipantRole: boolean;
  status: CourseEnrollmentStatus;
  appliedAt?: string | null;
  decisionAt?: string | null;
  decisionNotes?: string | null;
  notes?: string | null;
  courseTitle?: string | null;
};

const LEARNER_ROLES = ["participant", "trainer", "expert", "super_admin", "admin"];

/**
 * Whether the user may apply for courses: holds a learner-capable RBAC role or has
 * submitted participant biodata. Never reads auth user_metadata — users can edit
 * their own metadata from the browser, so it is not evidence of anything.
 */
export async function checkUserHasParticipantRole(
  supabaseAdmin: any,
  userId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data: assignments, error: roleErr } = await supabaseAdmin
    .from("rbac_user_roles")
    .select("rbac_roles!inner(code)")
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gt.${now}`)
    .in("rbac_roles.code", LEARNER_ROLES)
    .limit(1);
  if (roleErr) throw new Error(`Gagal memeriksa peran pengguna: ${roleErr.message}`);
  if (assignments && assignments.length > 0) return true;

  const { data: bio, error: bioErr } = await supabaseAdmin
    .from("participant_biodata")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (bioErr) throw new Error(toFriendlyEnrollmentError(bioErr.message));
  return Boolean(bio?.id);
}

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

    const [hasParticipantRole, { data: record, error }] = await Promise.all([
      checkUserHasParticipantRole(supabaseAdmin, context.userId),
      (supabaseAdmin as any)
        .from("course_enrollment_applications")
        .select("status, notes, decision_notes, decision_at, created_at, course_title")
        .eq("user_id", context.userId)
        .eq("course_id", data.courseId)
        .maybeSingle(),
    ]);
    if (error) throw new Error(toFriendlyEnrollmentError(error.message));

    if (!record) return { isEnrolled: false, hasParticipantRole, status: "none" };

    const status = record.status as CourseEnrollmentStatus;
    return {
      isEnrolled: status === "approved",
      hasParticipantRole,
      status,
      appliedAt: record.created_at,
      decisionAt: record.decision_at,
      decisionNotes: record.decision_notes,
      notes: record.notes,
      courseTitle: record.course_title,
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
    // Runs as the caller (RLS + auth.uid()); the RPC is idempotent and never
    // resets an approved application. Any failure surfaces to the user.
    const { data: result, error } = await (context.supabase as any).rpc("course_enrollment_apply", {
      _course_id: data.courseId,
      _course_title: data.courseTitle,
      _notes: data.notes?.trim() || null,
    });
    if (error) throw new Error(toFriendlyEnrollmentError(error.message));

    const status = (result as { status: CourseEnrollmentStatus; changed: boolean }).status;
    const changed = (result as { changed: boolean }).changed;
    const message =
      status === "approved"
        ? "Anda sudah terdaftar dan disetujui di pelatihan ini."
        : changed
          ? "Pendaftaran pelatihan berhasil diajukan dan sedang menunggu persetujuan tim Administrator."
          : "Pendaftaran Anda sudah tercatat dan masih menunggu persetujuan tim Administrator.";
    return { success: true, status, message };
  });
