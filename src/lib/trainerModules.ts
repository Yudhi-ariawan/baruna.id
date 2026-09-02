// ============================================================================
// BARUNA Experts — Trainer, Module Review & Recognition Engine
// ----------------------------------------------------------------------------
// Extends the Experts module with strict role separation, module review
// pipeline, tiered trainer recognition, and Certificate of Training Delivery.
//
// KEY PRINCIPLES (enforced in code):
//  1. Verified Expert ≠ BARUNA Trainer. Trainer status requires a separate
//     approval workflow.
//  2. A newly Approved Trainer may submit ONE initial module. Additional
//     modules unlock only after approval + recognition level thresholds.
//  3. Recognition levels are NEVER awarded automatically — the engine surfaces
//     "Eligible for Level Review" only. Admin action promotes.
//  4. "Participant Learning Hours Generated" = Instructional Hours × Unique
//     Successful Participants. NEVER labelled as "Teaching Hours".
// ============================================================================

import { useEffect, useState } from "react";
import { isPresentationMode } from "./demoMode";

// ── Roles (spec §Official Terminology) ───────────────────────────────────────
export const TRAINING_ROLES = [
  "Lead Trainer",
  "Co-Trainer",
  "Technical Instructor",
  "Facilitator",
  "Resource Person",
  "Subject Matter Expert",
  "Reviewer",
  "Mentor",
  "Module Author",
] as const;
export type TrainingRole = (typeof TRAINING_ROLES)[number];

export const EXPERT_CATEGORIES = [
  "Fisheries Management",
  "Aquaculture",
  "Marine Conservation",
  "Blue Economy",
  "Climate Change",
  "Ocean Governance",
  "Marine Spatial Planning",
  "Fisheries Surveillance",
  "Fish Processing and Value Addition",
  "Capacity Development",
  "Public Administration",
  "Digital Learning",
  "Training Management",
  "Monitoring and Evaluation",
  "International Cooperation",
] as const;
export type ExpertCategory = (typeof EXPERT_CATEGORIES)[number];

// ── Trainer application status pipeline ──────────────────────────────────────
export const TRAINER_APP_STATUSES = [
  "Draft",
  "Submitted",
  "Administrative Review",
  "Technical Review",
  "Teaching Competency Review",
  "Interview or Demonstration Required",
  "Revision Required",
  "Approved",
  "Rejected",
  "Suspended",
] as const;
export type TrainerAppStatus = (typeof TRAINER_APP_STATUSES)[number];

// ── Module review pipeline (spec §MODULE REVIEW WORKFLOW) ────────────────────
export const MODULE_STATUSES = [
  "Draft",
  "Submitted",
  "Administrative Review",
  "Academic Review",
  "Quality Assurance Review",
  "Digital Learning Review",
  "Revision Required",
  "Resubmitted",
  "Approved",
  "Rejected",
  "Published",
  "Temporarily Unpublished",
  "Archived",
] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export const MODULE_STATUS_STYLES: Record<ModuleStatus, string> = {
  Draft: "bg-muted text-foreground/70",
  Submitted: "bg-badge-course/15 text-badge-course",
  "Administrative Review": "bg-badge-workshop/15 text-badge-workshop",
  "Academic Review": "bg-marine/15 text-marine",
  "Quality Assurance Review": "bg-accent/20 text-accent-foreground",
  "Digital Learning Review": "bg-navy/10 text-navy",
  "Revision Required": "bg-destructive/15 text-destructive",
  Resubmitted: "bg-badge-course/15 text-badge-course",
  Approved: "bg-success/15 text-success",
  Rejected: "bg-destructive/15 text-destructive",
  Published: "bg-eco-community/15 text-eco-community",
  "Temporarily Unpublished": "bg-muted text-foreground/70",
  Archived: "bg-muted text-foreground/60",
};

/** Ordered review pipeline (excluding terminal branches). */
export const MODULE_REVIEW_PIPELINE: ModuleStatus[] = [
  "Draft",
  "Submitted",
  "Administrative Review",
  "Academic Review",
  "Quality Assurance Review",
  "Digital Learning Review",
  "Approved",
  "Published",
];

// ── Trainer recognition levels (spec §TRAINER RECOGNITION LEVELS) ────────────
export const TRAINER_LEVELS = ["none", "certified", "advanced", "senior", "master"] as const;
export type TrainerLevel = (typeof TRAINER_LEVELS)[number];

export const LEVEL_LABEL: Record<TrainerLevel, string> = {
  none: "Not Yet Certified",
  certified: "BARUNA Certified Trainer",
  advanced: "BARUNA Advanced Trainer",
  senior: "BARUNA Senior Trainer",
  master: "BARUNA Master Trainer",
};

export const LEVEL_THRESHOLD: Record<TrainerLevel, number> = {
  none: 0,
  certified: 30,
  advanced: 100,
  senior: 1000,
  master: 10001, // "more than 10,000"
};

export const LEVEL_MODULE_LIMIT: Record<TrainerLevel, number> = {
  none: 0,
  certified: 2,
  advanced: 5,
  senior: 10,
  master: 999, // subject to strategic curriculum approval
};

export const LEVEL_RATIONALE: Record<TrainerLevel, string> = {
  none: "",
  certified: "Represents one complete and credible training cohort.",
  advanced: "Represents consistency across several cohorts or course periods.",
  senior: "Represents large-scale and sustained learning reach.",
  master: "Represents exceptional ecosystem-level learning impact.",
};

// Quality safeguards (spec §QUALITY SAFEGUARDS)
export const QUALITY_GATES = {
  minCompletionRate: 60,
  minAverageRating: 4.0,
} as const;

export type QualityGate = {
  label: string;
  passed: boolean;
  detail: string;
};

export type RecognitionAssessment = {
  currentLevel: TrainerLevel;
  awardedLevel: TrainerLevel; // level actually awarded by admin (never auto)
  nextLevel: TrainerLevel | null;
  usp: number;
  requiredForNext: number;
  progressPct: number;
  eligibleForReview: boolean;
  qualityGates: QualityGate[];
};

export type RecognitionInput = {
  usp: number;
  completionRatePct: number;
  averageRating: number;
  hasUnresolvedComplaint: boolean;
  moduleCurrent: boolean;
  awardedLevel: TrainerLevel;
};

/**
 * Computes trainer recognition state.
 *
 * IMPORTANT: This NEVER promotes the trainer. It only reports what level the
 * numerical evidence supports and which quality gates still fail. Actual
 * promotion is an administrative decision recorded via the audit trail.
 */
export function computeRecognition(input: RecognitionInput): RecognitionAssessment {
  const { usp, completionRatePct, averageRating, hasUnresolvedComplaint, moduleCurrent } = input;

  let numericalLevel: TrainerLevel = "none";
  if (usp > 10000) numericalLevel = "master";
  else if (usp >= 1000) numericalLevel = "senior";
  else if (usp >= 100) numericalLevel = "advanced";
  else if (usp >= 30) numericalLevel = "certified";

  const nextLevel: TrainerLevel | null =
    input.awardedLevel === "master"
      ? null
      : input.awardedLevel === "senior"
      ? "master"
      : input.awardedLevel === "advanced"
      ? "senior"
      : input.awardedLevel === "certified"
      ? "advanced"
      : "certified";

  const requiredForNext = nextLevel ? LEVEL_THRESHOLD[nextLevel] : usp;
  const progressPct = nextLevel
    ? Math.min(100, Math.round((usp / requiredForNext) * 100))
    : 100;

  const qualityGates: QualityGate[] = [
    {
      label: "Completion rate ≥ 60%",
      passed: completionRatePct >= QUALITY_GATES.minCompletionRate,
      detail: `${Math.round(completionRatePct)}% observed`,
    },
    {
      label: "Average rating ≥ 4.0",
      passed: averageRating >= QUALITY_GATES.minAverageRating,
      detail: `${averageRating.toFixed(1)} / 5 observed`,
    },
    {
      label: "No unresolved complaints",
      passed: !hasUnresolvedComplaint,
      detail: hasUnresolvedComplaint ? "1 open complaint" : "None",
    },
    {
      label: "Module status: Approved and Current",
      passed: moduleCurrent,
      detail: moduleCurrent ? "Current" : "Requires update",
    },
  ];

  const numericalReached =
    nextLevel !== null && TRAINER_LEVELS.indexOf(numericalLevel) > TRAINER_LEVELS.indexOf(input.awardedLevel);
  const qualityOK = qualityGates.every((g) => g.passed);
  const eligibleForReview = numericalReached && qualityOK;

  return {
    currentLevel: numericalLevel,
    awardedLevel: input.awardedLevel,
    nextLevel,
    usp,
    requiredForNext,
    progressPct,
    eligibleForReview,
    qualityGates,
  };
}

// ── Trainer module submission types ──────────────────────────────────────────
export type ModuleResource = { label: string; provided: boolean; note?: string };

export type TrainerModule = {
  id: string;
  trainerId: string;
  // Metadata (spec §MODULE SUBMISSION)
  title: string;
  code: string;
  topic: string;
  competency: string;
  description: string;
  rationale: string;
  targetParticipants: string;
  entryRequirements: string;
  learningObjectives: string;
  competencyOutcomes: string;
  instructionalHours: number;
  independentStudyHours: number;
  deliveryFormat: "Self-paced" | "Scheduled" | "Blended";
  language: string;
  level: "Introductory" | "Intermediate" | "Advanced";
  assessmentMethod: string;
  passingScore: number;
  version: string;
  copyrightHolder: string;
  licensing: string;
  originalityConfirmed: boolean;
  copyrightConfirmed: boolean;
  resources: ModuleResource[];
  // Workflow
  status: ModuleStatus;
  reviewHistory: ReviewEntry[];
  publishedCourseSlug?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewEntry = {
  ts: string;
  reviewerRole:
    | "Administrative Reviewer"
    | "Academic Reviewer"
    | "Subject Matter Reviewer"
    | "Quality Assurance Reviewer"
    | "Digital Learning Reviewer"
    | "Final Approver";
  reviewer: string;
  decision: "Passed" | "Revision Required" | "Rejected" | "Approved";
  comment: string;
};

export type TrainerRecord = {
  trainerId: string;
  fullName: string;
  title: string;
  organization: string;
  country: string;
  photo?: string;
  expertCategories: ExpertCategory[];
  trainingRoles: TrainingRole[];
  languages: string[];
  awardedLevel: TrainerLevel;
  approvedAt: string;
  status: TrainerAppStatus;
  // Aggregate teaching stats (spec §TEACHING PORTFOLIO)
  approvedModules: number;
  publishedShortCourses: number;
  fullProgramsSupported: number;
  instructionalHours: number;
  uniqueSuccessfulParticipants: number;
  completionRatePct: number;
  averageRating: number;
  hasUnresolvedComplaint: boolean;
  moduleCurrent: boolean;
};

/** Participant Learning Hours Generated = IH × USP (spec §TEACHING HOURS AND PARTICIPANT HOURS). */
export function participantLearningHoursGenerated(ih: number, usp: number): number {
  return ih * usp;
}

/** Whether a trainer may submit an additional module now. */
export function canSubmitAdditionalModule(
  trainer: TrainerRecord,
  currentActiveModules: number,
): { allowed: boolean; reason?: string } {
  if (trainer.status !== "Approved")
    return { allowed: false, reason: "Trainer application not yet approved." };
  if (trainer.awardedLevel === "none")
    return {
      allowed: false,
      reason: "You may submit your first initial module. Additional modules unlock after review + BARUNA Certified Trainer recognition.",
    };
  const limit = LEVEL_MODULE_LIMIT[trainer.awardedLevel];
  if (currentActiveModules >= limit)
    return { allowed: false, reason: `Level limit reached (${limit} active modules).` };
  return { allowed: true };
}

// ============================================================================
// SEED — Demo trainer + module used across the Trainer Portal.
// Real writes are gated by isPresentationMode() and localStorage flag.
// ============================================================================
export const DEMO_TRAINER: TrainerRecord = {
  trainerId: "TRAINER-DEMO-001",
  fullName: "Dr. Sri Astutik, S.Pi., M.Si.",
  title: "Senior Aquaculture Specialist",
  organization: "BARUNA — Directorate of Marine and Fisheries Training",
  country: "Indonesia",
  expertCategories: ["Aquaculture", "Capacity Development", "Fisheries Management"],
  trainingRoles: ["Lead Trainer", "Module Author", "Subject Matter Expert"],
  languages: ["Indonesian", "English"],
  awardedLevel: "advanced",
  approvedAt: "2024-11-15",
  status: "Approved",
  approvedModules: 1,
  publishedShortCourses: 1,
  fullProgramsSupported: 2,
  instructionalHours: 6,
  uniqueSuccessfulParticipants: 142,
  completionRatePct: 72,
  averageRating: 4.4,
  hasUnresolvedComplaint: false,
  moduleCurrent: true,
};

export const DEMO_MODULE: TrainerModule = {
  id: "TM-DEMO-001",
  trainerId: DEMO_TRAINER.trainerId,
  title: "Tilapia Cultivation Using Biofloc System",
  code: "FISH-M07",
  topic: "Aquaculture",
  competency: "Sustainable Freshwater Aquaculture",
  description:
    "A practical short course on operating tilapia grow-out ponds using biofloc technology, targeting smallholder farmers and extension officers.",
  rationale:
    "Biofloc adoption reduces feed costs and water use — a strategic capacity gap identified in the 2024 Africa cohort action plans.",
  targetParticipants: "Fisheries extension officers, aquaculture technicians",
  entryRequirements: "Basic aquaculture literacy",
  learningObjectives:
    "Prepare biofloc media; manage C:N ratio; monitor water quality; harvest and record production.",
  competencyOutcomes: "Learners can independently operate a small biofloc tilapia unit.",
  instructionalHours: 6,
  independentStudyHours: 2,
  deliveryFormat: "Self-paced",
  language: "English",
  level: "Intermediate",
  assessmentMethod: "Multiple-choice quiz + submission of a pond monitoring log",
  passingScore: 70,
  version: "v1.0",
  copyrightHolder: "BARUNA — Republic of Indonesia",
  licensing: "CC BY-NC-SA 4.0",
  originalityConfirmed: true,
  copyrightConfirmed: true,
  resources: [
    { label: "Complete module document (PDF)", provided: true },
    { label: "Presentation slides", provided: true },
    { label: "Learning video", provided: true },
    { label: "Quiz + answer key", provided: true },
    { label: "Trainer guide", provided: true },
    { label: "Evaluation form", provided: true },
    { label: "Course cover image", provided: true },
    { label: "Practical exercise", provided: true, note: "Field pond log" },
  ],
  status: "Published",
  reviewHistory: [
    {
      ts: "2024-10-02",
      reviewerRole: "Administrative Reviewer",
      reviewer: "BARUNA Secretariat",
      decision: "Passed",
      comment: "All required files present. Metadata complete.",
    },
    {
      ts: "2024-10-14",
      reviewerRole: "Academic Reviewer",
      reviewer: "Dr. Bima Kartanegara",
      decision: "Passed",
      comment: "Content accurate; objectives well aligned.",
    },
    {
      ts: "2024-10-22",
      reviewerRole: "Quality Assurance Reviewer",
      reviewer: "Dr. A. Rita Tisiana",
      decision: "Passed",
      comment: "Assessment validity confirmed. Workload appropriate for 6 IH.",
    },
    {
      ts: "2024-11-02",
      reviewerRole: "Digital Learning Reviewer",
      reviewer: "Digital Learning Team",
      decision: "Passed",
      comment: "Mobile-ready. Progress tracking configured.",
    },
    {
      ts: "2024-11-15",
      reviewerRole: "Final Approver",
      reviewer: "Head of Agency",
      decision: "Approved",
      comment: "Approved for publication as a BARUNA Short Course.",
    },
  ],
  publishedCourseSlug: "FISH-M07",
  createdAt: "2024-09-20",
  updatedAt: "2024-11-15",
};

// ── Access hook for the demo trainer ─────────────────────────────────────────
const TRAINER_ENABLED_KEY = "baruna:trainer-portal-enabled";
const TRAINER_EVENT = "baruna:trainer-portal";

export function isTrainerPortalUnlocked(): boolean {
  if (isPresentationMode()) return true;
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TRAINER_ENABLED_KEY) === "1";
}

export function setTrainerPortalUnlocked(v: boolean) {
  if (typeof window === "undefined") return;
  if (v) localStorage.setItem(TRAINER_ENABLED_KEY, "1");
  else localStorage.removeItem(TRAINER_ENABLED_KEY);
  window.dispatchEvent(new CustomEvent(TRAINER_EVENT));
}

export function useTrainerPortalUnlocked(): boolean {
  const [v, setV] = useState<boolean>(() => isTrainerPortalUnlocked());
  useEffect(() => {
    const refresh = () => setV(isTrainerPortalUnlocked());
    window.addEventListener(TRAINER_EVENT, refresh);
    window.addEventListener("baruna:presentation-mode", refresh);
    return () => {
      window.removeEventListener(TRAINER_EVENT, refresh);
      window.removeEventListener("baruna:presentation-mode", refresh);
    };
  }, []);
  return v;
}

// ── Formatting helpers ───────────────────────────────────────────────────────
export function formatUsp(n: number): string {
  return n.toLocaleString("en-US");
}
