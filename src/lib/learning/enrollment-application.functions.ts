import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toFriendlyEnrollmentError } from "@/lib/learning/enrollment-errors";

export type CourseEnrollmentStatus = "none" | "pending" | "approved" | "rejected" | "revision_requested";

export type MyCourseEnrollmentDetail = {
  isEnrolled: boolean;
  hasParticipantRole: boolean;
  status: CourseEnrollmentStatus;
  appliedAt?: string | null;
  decisionAt?: string | null;
  decisionNotes?: string | null;
  notes?: string | null;
  courseTitle?: string | null;
  /** Documents already attached to this application (Course Offering, migration 20261110020000). */
  documents?: Array<{ id: string; requirement: string; fileName: string; uploadedAt: string }>;
  /** Uploaded on any device but not sent yet (migration 20261111010000). */
  uploads?: Array<{ requirement: string; path: string; fileName: string; uploadedAt: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function myUploads(db: any, userId: string, courseId: string): Promise<NonNullable<MyCourseEnrollmentDetail["uploads"]>> {
  const { data, error } = await db
    .from("course_enrollment_document_uploads")
    .select("requirement, storage_path, file_name, uploaded_at")
    .eq("user_id", userId)
    .eq("offering_code", courseId);
  if (error) return []; // before migration 20261111010000
  return ((data ?? []) as Array<{ requirement: string; storage_path: string; file_name: string; uploaded_at: string }>).map((u) => ({
    requirement: u.requirement, path: u.storage_path, fileName: u.file_name, uploadedAt: u.uploaded_at,
  }));
}

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

    const [hasParticipantRole, { data: record, error }, uploads] = await Promise.all([
      checkUserHasParticipantRole(supabaseAdmin, context.userId),
      (supabaseAdmin as any)
        .from("course_enrollment_applications")
        .select("id, status, notes, decision_notes, decision_at, created_at, course_title")
        .eq("user_id", context.userId)
        .eq("course_id", data.courseId)
        .maybeSingle(),
      myUploads(supabaseAdmin, context.userId, data.courseId),
    ]);
    if (error) throw new Error(toFriendlyEnrollmentError(error.message));

    if (!record) return { isEnrolled: false, hasParticipantRole, status: "none", uploads };

    const status = record.status as CourseEnrollmentStatus;
    // Empty until migration 20261110020000 ran.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: docs } = await (supabaseAdmin as any)
      .from("course_enrollment_documents")
      .select("id, requirement, file_name, uploaded_at")
      .eq("application_id", record.id)
      .eq("user_id", context.userId);
    return {
      documents: ((docs ?? []) as Array<{ id: string; requirement: string; file_name: string; uploaded_at: string }>).map((d) => ({
        id: d.id, requirement: d.requirement, fileName: d.file_name, uploadedAt: d.uploaded_at,
      })),
      uploads,
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
        documents: z
          .array(z.object({ requirement: z.string().min(1).max(120), path: z.string().min(1).max(200), fileName: z.string().max(200) }))
          .max(10)
          .optional(),
        /** Send the documents recorded on the server (uploaded from any device) instead of a list from the page. */
        useUploadedDocuments: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let documents = data.documents;
    if (data.useUploadedDocuments) {
      // Read with the caller's own rights (RLS: own rows only), right before sending.
      const recorded = await myUploads(context.supabase, context.userId, data.courseId);
      const byReq = new Map((documents ?? []).map((d) => [d.requirement, d]));
      for (const u of recorded) byReq.set(u.requirement, { requirement: u.requirement, path: u.path, fileName: u.fileName });
      documents = [...byReq.values()];
    }
    // Runs as the caller (RLS + auth.uid()); the RPC is idempotent and never
    // resets an approved application. Any failure surfaces to the user.
    const { data: result, error } = await (context.supabase as any).rpc("course_enrollment_apply", {
      _course_id: data.courseId,
      _course_title: data.courseTitle,
      _notes: data.notes?.trim() || null,
      // Only sent when there are documents, so modules keep calling the 3-argument form.
      ...(documents?.length
        ? { _documents: documents.map((d) => ({ requirement: d.requirement, path: d.path, file_name: d.fileName })) }
        : {}),
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
