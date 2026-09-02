// ============================================================================
// BARUNA Learning Architecture — Master Course + Course Offering Registry
// ----------------------------------------------------------------------------
// Central in-memory registry (single source of truth for course configuration
// in this Phase 1/2 pass). Existing courses (AZA, Africa Training) are
// registered here so the shared dashboard can render them, but their legacy
// routes are preserved via `legacyLearnPath` — nothing existing breaks.
// ============================================================================

import type {
  CourseOffering,
  CourseOfferingId,
  MasterCourse,
  MasterCourseId,
} from "./types";

const masterCourses: MasterCourse[] = [
  // ── Pilot: Knowledge Course × Open Self-Paced ────────────────────────────
  // Simple example used to validate the shared dashboard end-to-end without
  // touching AZA or Africa Training.
  {
    id: "mc-ocean-literacy",
    code: "BARUNA-KC-OL-001",
    title: "Ocean Literacy Foundations",
    subtitle: "Understanding the ocean's influence on us and our influence on the ocean",
    description:
      "A short, fully-automated introduction to ocean literacy. Delivered as an Open Self-Paced Knowledge Course using the shared BARUNA Learning Architecture.",
    objectives: [
      "Understand the seven Essential Ocean Literacy Principles.",
      "Recognise the ocean's role in climate, weather and human wellbeing.",
      "Communicate ocean issues to non-specialist audiences.",
    ],
    targetParticipants: "General public, educators, early-career researchers.",
    competencyLevel: "Beginner",
    estimatedHours: 3,
    language: "English",
    template: "knowledge",
    modules: [
      { id: "ol-1", no: 1, title: "The Blue Planet", estimatedMinutes: 25 },
      { id: "ol-2", no: 2, title: "Ocean & Climate", estimatedMinutes: 30 },
      { id: "ol-3", no: 3, title: "Life in the Ocean", estimatedMinutes: 30 },
      { id: "ol-4", no: 4, title: "People & the Ocean", estimatedMinutes: 25 },
      { id: "ol-5", no: 5, title: "Communicating the Ocean", estimatedMinutes: 30 },
    ],
    completionRules: {
      requireAllModules: true,
      quizPassPercent: 70,
      requireEvaluation: true,
    },
    certificates: [
      { type: "completion", label: "Certificate of Completion" },
    ],
  },

  // ── AZA (registered but keeps legacy dashboard for now) ─────────────────
  {
    id: "mc-aza",
    code: "BARUNA-PBC-AZA-001",
    title: "Allocated Zones for Aquaculture",
    subtitle: "Planning Sustainable Aquaculture through Marine Spatial Planning",
    description:
      "Project-Based individual learning based on the FAO–GFCM AZA approach.",
    competencyLevel: "Intermediate",
    estimatedHours: 40,
    language: "English",
    template: "project-based",
    modules: [], // sourced from src/data/aza.ts in the legacy view
    completionRules: {
      requireAllModules: true,
      quizPassPercent: 70,
      requireProject: true,
      requireEvaluation: true,
    },
    certificates: [
      { type: "completion", label: "Certificate of Completion" },
      { type: "applied-achievement", label: "Certificate of Applied Achievement", requiresReview: true },
    ],
    legacyLearnPath: "/academy/learn/allocated-zones-for-aquaculture",
  },

  // ── Africa Training (registered but keeps legacy dashboard for now) ─────
  {
    id: "mc-africa-fisheries",
    code: "BARUNA-TPC-AFRICA-001",
    title: "International Training on Fisheries for African Countries",
    subtitle: "Technical Practice — Blended Cohort",
    description:
      "13-module blended-cohort training combining online, live and in-person phases.",
    competencyLevel: "Intermediate",
    estimatedHours: 120,
    language: "English",
    template: "technical-practice",
    modules: [],
    completionRules: {
      requireAllModules: true,
      quizPassPercent: 70,
      requireAttendancePercent: 80,
      requireEvaluation: true,
    },
    certificates: [{ type: "program", label: "Program Certificate" }],
    legacyLearnPath: "/academy/applications", // resolved per-application
  },
];

const courseOfferings: CourseOffering[] = [
  {
    id: "of-ocean-literacy-open-2026",
    masterCourseId: "mc-ocean-literacy",
    offeringTitle: "Ocean Literacy Foundations — Global Open 2026",
    year: 2026,
    countryOrRegion: "Global",
    deliveryMode: "open-self-paced",
    access: "open",
    openingDate: "2026-01-01",
    accessExpiresAfterDays: 180,
    humanIntervention: 1,
    status: "published",
  },
  {
    id: "of-aza-open-2026",
    masterCourseId: "mc-aza",
    offeringTitle: "Allocated Zones for Aquaculture — Global Open 2026",
    year: 2026,
    countryOrRegion: "Global",
    deliveryMode: "open-self-paced",
    access: "open",
    humanIntervention: 3,
    status: "published",
    legacyLearnPath: "/academy/learn/allocated-zones-for-aquaculture",
  },
  {
    id: "of-africa-2024",
    masterCourseId: "mc-africa-fisheries",
    offeringTitle: "Africa Fisheries Training 2024",
    cohortName: "Cohort 2024",
    year: 2024,
    countryOrRegion: "Africa",
    deliveryMode: "blended-cohort",
    access: "application-required",
    humanIntervention: 2,
    status: "completed",
    legacyLearnPath: "/academy/edition-2024",
  },
  {
    id: "of-africa-2026",
    masterCourseId: "mc-africa-fisheries",
    offeringTitle: "Africa Fisheries Training 2026",
    cohortName: "Cohort 2026",
    year: 2026,
    countryOrRegion: "Africa",
    deliveryMode: "blended-cohort",
    access: "application-required",
    humanIntervention: 2,
    status: "published",
  },
];

// ─── Read API ───────────────────────────────────────────────────────────────
export function getMasterCourse(id: MasterCourseId): MasterCourse | undefined {
  return masterCourses.find((c) => c.id === id);
}

export function getCourseOffering(id: CourseOfferingId): CourseOffering | undefined {
  return courseOfferings.find((o) => o.id === id);
}

export function listCourseOfferings(): CourseOffering[] {
  return courseOfferings.slice();
}

export function listMasterCourses(): MasterCourse[] {
  return masterCourses.slice();
}

export function offeringsForMasterCourse(masterCourseId: MasterCourseId): CourseOffering[] {
  return courseOfferings.filter((o) => o.masterCourseId === masterCourseId);
}
