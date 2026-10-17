// ============================================================================
// Learning-room access — server only.
// ----------------------------------------------------------------------------
// The single rule for opening course material: a learner-capable role and an
// approved row in course_enrollment_applications (PB-ACA-03). Browser storage
// and Demo Mode are never evidence of access.
// ============================================================================
import { checkUserHasParticipantRole } from "./enrollment-application.functions";
import { toFriendlyEnrollmentError } from "./enrollment-errors";

export const COURSE_ACCESS_DENIED_MESSAGE =
  "Ruang belajar hanya tersedia bagi peserta yang pendaftarannya telah disetujui Administrator.";

export async function hasApprovedCourseAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const [hasRole, { data: record, error }] = await Promise.all([
    checkUserHasParticipantRole(supabaseAdmin, userId),
    supabaseAdmin
      .from("course_enrollment_applications")
      .select("status")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle(),
  ]);
  if (error) throw new Error(toFriendlyEnrollmentError(error.message));
  return hasRole && record?.status === "approved";
}

export async function assertApprovedCourseAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  userId: string,
  courseId: string,
): Promise<void> {
  if (!(await hasApprovedCourseAccess(supabaseAdmin, userId, courseId))) {
    throw new Error(COURSE_ACCESS_DENIED_MESSAGE);
  }
}
