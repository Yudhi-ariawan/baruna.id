// ============================================================================
// BARUNA Learning Architecture — Data Model Types (§24)
// ----------------------------------------------------------------------------
// Master Course = reusable academic content only.
// Course Offering / Cohort = actual delivery instance with schedule, access,
// trainer, dates, review + certificate rules.
// ============================================================================

import type { LearningTemplateId, HumanInterventionLevel, MenuItemId } from "./templates";
import type { DeliveryModeId } from "./deliveryModes";

// ─── IDs (nominal string types for clarity) ────────────────────────────────
export type MasterCourseId = string;
export type MasterModuleRef = string;
export type CourseOfferingId = string;
export type EnrolmentId = string;
export type LearnerId = string;

// ─── Master Course ─────────────────────────────────────────────────────────
export interface MasterCourseModule {
  id: MasterModuleRef;
  no: number;
  title: string;
  summary?: string;
  estimatedMinutes?: number;
  /** Optional link into the existing masterModules registry so we do not
   * duplicate content when a course reuses a Knowledge Hub module. */
  masterModuleCode?: string;
}

export type ProjectBuilderFieldType =
  | "short-text"
  | "long-text"
  | "number"
  | "date"
  | "select"
  | "multi-select"
  | "checkbox"
  | "table"
  | "matrix"
  | "file";

export interface ProjectBuilderField {
  id: string;
  label: string;
  type: ProjectBuilderFieldType;
  required?: boolean;
  minLength?: number;
  options?: string[];
  helper?: string;
}

export interface ProjectBuilderSection {
  id: string;
  title: string;
  instruction?: string;
  example?: string;
  fields: ProjectBuilderField[];
}

export interface ProjectBuilderConfig {
  sections: ProjectBuilderSection[];
}

export type CertificateType =
  | "completion"
  | "participation"
  | "program"
  | "applied-achievement"
  | "competency"
  | "statement-of-result";

export interface CertificateRule {
  type: CertificateType;
  label: string;
  /** If true, this certificate depends on human review (§17). */
  requiresReview?: boolean;
}

export interface CompletionRules {
  requireAllModules?: boolean;
  quizPassPercent?: number;
  requireProject?: boolean;
  requireEvaluation?: boolean;
  requireAttendancePercent?: number;
}

export interface MasterCourse {
  id: MasterCourseId;
  code: string;
  title: string;
  subtitle?: string;
  description: string;
  objectives?: string[];
  targetParticipants?: string;
  competencyLevel?: "Beginner" | "Intermediate" | "Advanced" | "Mixed";
  estimatedHours?: number;
  language?: string;
  template: LearningTemplateId;
  modules: MasterCourseModule[];
  projectBuilder?: ProjectBuilderConfig;
  completionRules: CompletionRules;
  certificates: CertificateRule[];
  /** Optional deep link to an existing (already-built) learn route. Used by
   * the migration adapters — when set, "Continue Learning" from the shared
   * dashboard may hand off to the legacy route. */
  legacyLearnPath?: string;
}

// ─── Course Offering / Cohort ─────────────────────────────────────────────
export type AccessModel =
  | "open"
  | "application-required"
  | "admin-approval"
  | "invitation-only"
  | "access-code"
  | "cohort-password-plus-account"
  | "org-sponsored"
  | "manual-admin";

export interface ScheduleItem {
  id: string;
  title: string;
  description?: string;
  activityType:
    | "self-learning"
    | "live-virtual"
    | "trainer-session"
    | "group-discussion"
    | "assignment"
    | "guided-practice"
    | "quiz"
    | "assessment"
    | "in-person"
    | "laboratory"
    | "field-visit"
    | "travel"
    | "evaluation"
    | "ceremony";
  /** ISO datetime in organiser timezone. */
  start: string;
  end?: string;
  organiserTimezone: string;
  location?: string;
  meetingLink?: string;
  trainer?: string;
  mandatory?: boolean;
  relatedModuleRef?: MasterModuleRef;
  status?: "scheduled" | "cancelled" | "completed" | "changed";
}

export interface CourseOffering {
  id: CourseOfferingId;
  masterCourseId: MasterCourseId;
  offeringTitle: string;
  cohortName?: string;
  year?: number;
  countryOrRegion?: string;
  deliveryMode: DeliveryModeId;
  access: AccessModel;
  openingDate?: string;
  closingDate?: string;
  applicationOpens?: string;
  applicationCloses?: string;
  accessExpiresAfterDays?: number;
  maxParticipants?: number;
  trainer?: string;
  facilitator?: string;
  reviewer?: string;
  assessor?: string;
  location?: string;
  schedule?: ScheduleItem[];
  humanIntervention?: HumanInterventionLevel;
  /** Menu items to force-enable for this offering (in addition to
   * template.defaultMenu + deliveryMode.extraMenu). */
  extraMenu?: MenuItemId[];
  /** Menu items to hide for this offering. */
  hideMenu?: MenuItemId[];
  status?: "draft" | "published" | "closed" | "completed";
  /** Where to route "Continue Learning" for participants in this offering.
   * Defaults to the shared dashboard `/academy/course/{id}`. */
  legacyLearnPath?: string;
}

// ─── Enrolment + Progress ─────────────────────────────────────────────────
export type EnrolmentStatus =
  | "draft"
  | "submitted"
  | "under-review"
  | "additional-info"
  | "approved"
  | "waitlisted"
  | "rejected"
  | "invitation-sent"
  | "enrolled"
  | "withdrawn";

export interface Enrolment {
  id: EnrolmentId;
  learnerId: LearnerId;
  offeringId: CourseOfferingId;
  status: EnrolmentStatus;
  createdAt: string;
  updatedAt: string;
  enrolledAt?: string;
  accessExpiresAt?: string;
}

export interface CertificateRecord {
  id: string;
  learnerId: LearnerId;
  offeringId: CourseOfferingId;
  type: CertificateType;
  issuedAt: string;
  serial: string;
}
