// ============================================================================
// BARUNA Learning Architecture — Learning Templates
// ----------------------------------------------------------------------------
// Five official templates. A template defines HOW participants learn and what
// activities are available. It does NOT define delivery logistics (schedule,
// trainer assignments, cohort access) — those live in the Delivery Mode and
// Course Offering layers.
// ============================================================================

export type LearningTemplateId =
  | "knowledge"
  | "technical-practice"
  | "project-based"
  | "certification"
  | "webinar-workshop";

/** Possible dashboard menu items. Only items enabled by the resolved
 * (template × delivery mode × offering) triple render — no placeholders. */
export type MenuItemId =
  | "overview"
  | "journey"
  | "orientation"
  | "schedule"
  | "announcements"
  | "pre-test"
  | "modules"
  | "phases"
  | "guided-practice"
  | "live-sessions"
  | "assignments"
  | "evidence"
  | "project"
  | "discussion"
  | "post-test"
  | "final-assessment"
  | "in-person"
  | "travel"
  | "expert-review"
  | "assessor-review"
  | "resources"
  | "evaluation"
  | "certificate"
  | "alumni"
  | "faq";

/** §16 — Configurable Human Intervention Levels. */
export type HumanInterventionLevel = 1 | 2 | 3 | 4 | 5;

export interface LearningTemplate {
  id: LearningTemplateId;
  name: string;
  description: string;
  /** Ordered dashboard flow shown to participants. */
  flow: ReadonlyArray<MenuItemId>;
  /** Default menu items. Delivery mode + offering config can enable more. */
  defaultMenu: ReadonlyArray<MenuItemId>;
  /** Default human-intervention level for this template. */
  defaultIntervention: HumanInterventionLevel;
}

export const LEARNING_TEMPLATES: Record<LearningTemplateId, LearningTemplate> = {
  knowledge: {
    id: "knowledge",
    name: "Knowledge Course",
    description:
      "Conceptual, policy, regulatory, awareness and knowledge-based courses. Fully automated.",
    flow: [
      "orientation",
      "pre-test",
      "modules",
      "post-test",
      "evaluation",
      "certificate",
    ],
    defaultMenu: [
      "overview",
      "orientation",
      "pre-test",
      "modules",
      "post-test",
      "resources",
      "evaluation",
      "certificate",
    ],
    defaultIntervention: 1,
  },
  "technical-practice": {
    id: "technical-practice",
    name: "Technical Practice Course",
    description:
      "Practical and technical learning with demonstration, guided practice, and practice evidence. Exception-based review.",
    flow: [
      "orientation",
      "modules",
      "guided-practice",
      "evidence",
      "final-assessment",
      "evaluation",
      "certificate",
    ],
    defaultMenu: [
      "overview",
      "journey",
      "orientation",
      "modules",
      "guided-practice",
      "assignments",
      "evidence",
      "final-assessment",
      "resources",
      "evaluation",
      "certificate",
    ],
    defaultIntervention: 2,
  },
  "project-based": {
    id: "project-based",
    name: "Project-Based Course",
    description:
      "Planning, policy, analysis, strategy, design and proposal-development courses with a Project Builder. Optional expert review.",
    flow: [
      "orientation",
      "pre-test",
      "phases",
      "guided-practice",
      "project",
      "evaluation",
      "certificate",
    ],
    defaultMenu: [
      "overview",
      "journey",
      "orientation",
      "pre-test",
      "phases",
      "guided-practice",
      "project",
      "resources",
      "evaluation",
      "certificate",
      "expert-review",
    ],
    defaultIntervention: 3,
  },
  certification: {
    id: "certification",
    name: "Certification Course",
    description:
      "Formal competency assessment or professional qualification. Mandatory assessor review.",
    flow: [
      "orientation",
      "modules",
      "guided-practice",
      "final-assessment",
      "evidence",
      "assessor-review",
      "certificate",
    ],
    defaultMenu: [
      "overview",
      "orientation",
      "modules",
      "guided-practice",
      "assignments",
      "final-assessment",
      "evidence",
      "assessor-review",
      "resources",
      "certificate",
    ],
    defaultIntervention: 5,
  },
  "webinar-workshop": {
    id: "webinar-workshop",
    name: "Webinar or Workshop Course",
    description:
      "Live webinars, recorded webinars, seminars and short workshops. Attendance-based.",
    flow: [
      "schedule",
      "live-sessions",
      "resources",
      "evaluation",
      "certificate",
    ],
    defaultMenu: [
      "overview",
      "schedule",
      "live-sessions",
      "resources",
      "evaluation",
      "certificate",
    ],
    defaultIntervention: 1,
  },
};

export function getTemplate(id: LearningTemplateId): LearningTemplate {
  return LEARNING_TEMPLATES[id];
}
