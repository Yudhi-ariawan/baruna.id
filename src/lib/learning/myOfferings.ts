// Types and helpers for My Learning's Course Offering section (CATATAN_PERBAIKAN 2aq).
type Course = { title: string } | { title: string }[] | null;
export type Offering = {
  offering_code: string;
  offering_title: string;
  learning_engine_version?: string | null;
  master_courses?: Course;
} | null;

export type MyEnrolment = {
  id: string;
  enrolment_status: string;
  completion_status: string;
  enrolment_date: string;
  /** Completion review (pending_review, remedial, approved), or null before the requirements are met. */
  review_status?: string | null;
  course_offerings: Offering | Offering[];
};
export type MyCertificate = {
  id: string;
  certificate_number: string;
  issue_date: string;
  verification_reference: string;
  course_offerings: Offering | Offering[];
};

export const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
export const courseTitle = (o: Offering) => one(o?.master_courses ?? null)?.title ?? o?.offering_title ?? "-";

/** Only offerings that run on the shared engine; legacy programs keep their own sections. */
export function sharedEnrolments(rows: MyEnrolment[] | undefined): MyEnrolment[] {
  return (rows ?? []).filter((e) => {
    const o = one(e.course_offerings);
    return e.enrolment_status !== "withdrawn" && o && o.learning_engine_version === "shared_v1";
  });
}
