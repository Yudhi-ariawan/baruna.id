// Where an enrolment application (course_enrollment_applications.course_id) leads
// the participant: a Course Offering page, a module page, or a Full Training
// application. The same id space is shared by all three (PB-ACA-03).
import { programs } from "@/data/programs";
import { trainingBySlug } from "@/data/training";

export type LearningKind = "offering" | "module" | "program";

/** offeringCodes: course ids known to be Course Offering codes. */
export function enrollmentKind(courseId: string, offeringCodes: ReadonlySet<string>): LearningKind {
  if (offeringCodes.has(courseId)) return "offering";
  // Full Training applications use the training slug as course id (fullTrainingCourseId).
  if (trainingBySlug[courseId]) return "program";
  const program = programs.find((p) => p.id === courseId);
  if (program && program.type !== "self-paced") return "program";
  return "module";
}

/** Page where the participant sees the application (and resubmits it after a revision request). */
export function enrollmentPageUrl(courseId: string, kind: LearningKind): string {
  const id = encodeURIComponent(courseId);
  if (kind === "offering") return `/academy/course/${id}`;
  if (kind === "program") return "/academy/applications";
  return `/academy/self-paced/${id}`;
}

/** Learning room after approval. */
export function enrollmentLearnUrl(courseId: string, kind: LearningKind): string {
  if (kind === "offering") return `/academy/course/${encodeURIComponent(courseId)}`;
  return `/academy/learn/${encodeURIComponent(courseId)}`;
}
