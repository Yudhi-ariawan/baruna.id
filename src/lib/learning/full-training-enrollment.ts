// ============================================================================
// Full Training Program ↔ server enrollment (PB-ACA-03).
// ----------------------------------------------------------------------------
// A Full Training application form still lives in browser storage, but the
// decision does not: the program's slug is its course id in
// course_enrollment_applications, and an administrator approves it in
// /admin/enrollments like any other course. The browser copy of the status is
// display data only and never opens the learning room.
// ============================================================================
import type { AppStatus } from "@/lib/application";
import type { CourseEnrollmentStatus } from "./enrollment-application.functions";

/** Legacy shortcut ids that always meant the African Countries program. */
const AFRICA_PROGRAM_SLUG = "international-training-fisheries-african-countries";
const LEGACY_PROGRAM_IDS: Record<string, string> = {
  demo: AFRICA_PROGRAM_SLUG,
  "africa-fisheries-2026": AFRICA_PROGRAM_SLUG,
};

/** Server course id for a Full Training program: its slug. */
export function fullTrainingCourseId(programSlug: string): string {
  return programSlug;
}

/**
 * The program slug behind a learning-room id: the stored application's slug, or
 * the program a legacy shortcut id stands for. Null when neither is known.
 */
export function resolveFullTrainingSlug(id: string, appSlug: string | undefined): string | null {
  return appSlug ?? LEGACY_PROGRAM_IDS[id] ?? null;
}

/**
 * Status shown to the applicant. Accepted and Rejected come only from the
 * administrator's decision on the server; the browser's own progression is
 * capped below them.
 */
export function effectiveApplicationStatus(
  localStatus: AppStatus,
  serverStatus: CourseEnrollmentStatus | undefined,
): AppStatus {
  if (serverStatus === "approved") return "Accepted";
  if (serverStatus === "rejected") return "Rejected";
  if (localStatus === "Accepted" || localStatus === "Rejected" || localStatus === "Shortlisted") {
    return "Under Review";
  }
  return localStatus;
}
