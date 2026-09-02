// ============================================================================
// BARUNA — Training application store (client-side, localStorage)
// ----------------------------------------------------------------------------
// Powers the end-to-end enrollment workflow for Academy training programs:
//   Eligibility → Application → Documents → Review → Submitted → Dashboard →
//   Acceptance → Pre-Course Learning → Travel & Visa → Post-Course → Certificate
// No backend required — applications persist in the browser and are shared
// across the dashboard, application-detail and learning pages.
// ============================================================================

import { useEffect, useState } from "react";
import { LMS_MODULES, LMS_ASSIGNMENTS } from "@/data/lms";
import { QUIZ_PASS_PERCENT, hasQuizBank } from "@/data/quizzes";

const STORE_KEY = "baruna:applications";
const EVENT = "baruna:applications";

export const APP_STATUSES = ["Submitted", "Under Review", "Shortlisted", "Accepted"] as const;
/** Terminal rejection state — not part of the linear progression tracker. */
export const REJECTED_STATUS = "Rejected" as const;
export type AppStatus = (typeof APP_STATUSES)[number] | typeof REJECTED_STATUS;

export const ENGLISH_LEVELS = ["Basic", "Intermediate", "Advanced"] as const;
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];

export type DocField = { key: string; label: string; accept: string; hint: string };

export const DOCUMENT_FIELDS: DocField[] = [
  { key: "passport", label: "Passport Copy", accept: ".pdf,.jpg,.jpeg,.png", hint: "PDF or JPG" },
  { key: "cv", label: "Curriculum Vitae (CV)", accept: ".pdf,.doc,.docx", hint: "PDF or DOC" },
  {
    key: "nomination",
    label: "Nomination Letter",
    accept: ".pdf,.jpg,.jpeg,.png",
    hint: "PDF or JPG",
  },
  { key: "motivation", label: "Motivation Letter", accept: ".pdf,.doc,.docx", hint: "PDF or DOC" },
  { key: "photo", label: "Recent Passport Photo", accept: ".jpg,.jpeg,.png", hint: "JPG or PNG" },
];

export const LEARNING_SECTIONS: { key: string; label: string; desc: string }[] = [
  {
    key: "welcome",
    label: "Welcome Video",
    desc: "Introduction to the program, instructors, and learning journey.",
  },
  {
    key: "guide",
    label: "Program Guide",
    desc: "Download the participant handbook and program logistics.",
  },
  {
    key: "country",
    label: "Country Assignment",
    desc: "Prepare your country fisheries profile presentation.",
  },
  {
    key: "pretest",
    label: "Pre-Test",
    desc: "Baseline knowledge assessment before the in-person training.",
  },
  {
    key: "modules",
    label: "E-Learning Modules",
    desc: "Complete the 13 self-paced pre-course modules.",
  },
];

export const POSTCOURSE_FIELDS: DocField[] = [
  {
    key: "actionPlan",
    label: "Action Plan Submission",
    accept: ".pdf,.doc,.docx",
    hint: "PDF or DOC",
  },
  { key: "reflection", label: "Reflection Paper", accept: ".pdf,.doc,.docx", hint: "PDF or DOC" },
  {
    key: "knowledge",
    label: "Knowledge Sharing Report",
    accept: ".pdf,.doc,.docx",
    hint: "PDF or DOC",
  },
];

export type DocumentMeta = { name: string; size: number; uploadedAt: string };

export type PersonalInfo = {
  fullName: string;
  gender: string;
  nationality: string;
  dob: string;
  passportNumber: string;
  email: string;
  phone: string;
};

export type ProfessionalInfo = {
  organization: string;
  position: string;
  country: string;
  experience: string;
  sector: string;
};

export type Application = {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  status: AppStatus;
  personal: PersonalInfo;
  professional: ProfessionalInfo;
  english: EnglishLevel;
  motivation: string;
  documents: Record<string, DocumentMeta | null>;
  participationConfirmed: boolean;
  learning: Record<string, boolean>;
  postCourse: Record<string, DocumentMeta | null>;
  lms: LmsProgress;
  travel: TravelPrep;
  inPerson: InPersonPrep;
};

// ── LMS progress ─────────────────────────────────────────────────────────────
export type ModuleProgress = {
  video: boolean;
  pdf: boolean;
  ppt: boolean;
  reading: boolean;
  quiz: boolean;
};

// A single recorded quiz attempt, saved permanently in the learner record.
export type QuizAttempt = {
  attempt: number;
  correct: number;
  total: number;
  score: number; // percentage 0–100
  passed: boolean;
  takenAt: string;
};

export type QuizRecord = {
  attempts: QuizAttempt[];
  passed: boolean;
  bestScore: number;
};

// ── Action Plan & Reflection Paper states ──────────────────────────────────
export const ACTION_PLAN_STATUSES = ["Not Submitted", "Submitted", "Reviewed", "Approved"] as const;
export type ActionPlanStatus = (typeof ACTION_PLAN_STATUSES)[number];

export const REFLECTION_STATUSES = ["Draft", "Submitted"] as const;
export type ReflectionStatus = (typeof REFLECTION_STATUSES)[number];

export type ActionPlanState = { meta: DocumentMeta | null; status: ActionPlanStatus };
export type ReflectionState = {
  text: string;
  status: ReflectionStatus;
  submittedAt: string | null;
};

export type LmsProgress = {
  preTest: boolean;
  postTest: boolean;
  finalExam: boolean;
  modules: Record<string, ModuleProgress>;
  assignments: Record<string, DocumentMeta | null>;
  /** Per-module quiz results, keyed by LMS module id (also "preTest"/"postTest"/"finalExam"). */
  quizzes: Record<string, QuizRecord>;
  actionPlan: ActionPlanState;
  reflection: ReflectionState;
  knowledgeSharing: ActionPlanState;
};

export function emptyModuleProgress(): ModuleProgress {
  return { video: false, pdf: false, ppt: false, reading: false, quiz: false };
}

export function defaultActionPlan(): ActionPlanState {
  return { meta: null, status: "Not Submitted" };
}

export function defaultReflection(): ReflectionState {
  return { text: "", status: "Draft", submittedAt: null };
}

export function defaultLms(): LmsProgress {
  return {
    preTest: false,
    postTest: false,
    finalExam: false,
    modules: Object.fromEntries(LMS_MODULES.map((m) => [m.id, emptyModuleProgress()])),
    assignments: Object.fromEntries(LMS_ASSIGNMENTS.map((a) => [a.key, null])),
    quizzes: {},
    actionPlan: defaultActionPlan(),
    reflection: defaultReflection(),
    knowledgeSharing: defaultActionPlan(),
  };
}

/** Returns a fully-populated LMS progress object, filling any missing keys. */
export function getLms(app: Application): LmsProgress {
  const base = defaultLms();
  const stored = app.lms;
  if (!stored) return base;
  return {
    preTest: stored.preTest ?? base.preTest,
    postTest: stored.postTest ?? base.postTest,
    finalExam: stored.finalExam ?? base.finalExam,
    modules: Object.fromEntries(
      LMS_MODULES.map((m) => [m.id, { ...base.modules[m.id], ...(stored.modules?.[m.id] ?? {}) }]),
    ),
    assignments: Object.fromEntries(
      LMS_ASSIGNMENTS.map((a) => [a.key, stored.assignments?.[a.key] ?? null]),
    ),
    quizzes: stored.quizzes ?? {},
    actionPlan: stored.actionPlan ?? base.actionPlan,
    reflection: stored.reflection ?? base.reflection,
    knowledgeSharing: stored.knowledgeSharing ?? base.knowledgeSharing,
  };
}

export function updateLms(id: string, lms: LmsProgress) {
  updateApplication(id, { lms });
}

/** True when a module's video, pdf, ppt, reading and quiz are all done. */
export function isModuleComplete(mp: ModuleProgress): boolean {
  return mp.video && mp.pdf && mp.ppt && mp.reading && mp.quiz;
}

// ── Quiz records ─────────────────────────────────────────────────────────────
const EMPTY_QUIZ_RECORD: QuizRecord = { attempts: [], passed: false, bestScore: 0 };

/** Returns the saved quiz record for a module (empty if never attempted). */
export function getQuizRecord(app: Application, moduleId: string): QuizRecord {
  return getLms(app).quizzes?.[moduleId] ?? EMPTY_QUIZ_RECORD;
}

/**
 * Records a quiz attempt in the learner record, updates the best score and pass
 * state, and marks the module quiz resource complete when the learner passes.
 * `passPercent` lets callers override the default (e.g. 0 for the no-pass-mark
 * Pre-Test). Returns the saved attempt.
 */
export function recordQuizAttempt(
  id: string,
  moduleId: string,
  correct: number,
  total: number,
  passPercent: number = QUIZ_PASS_PERCENT,
): QuizAttempt | undefined {
  const app = getApplication(id);
  if (!app) return undefined;
  const lms = getLms(app);
  const rec = lms.quizzes[moduleId] ?? EMPTY_QUIZ_RECORD;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = score >= passPercent;
  const attempt: QuizAttempt = {
    attempt: rec.attempts.length + 1,
    correct,
    total,
    score,
    passed,
    takenAt: new Date().toISOString(),
  };
  const newRec: QuizRecord = {
    attempts: [...rec.attempts, attempt],
    passed: rec.passed || passed,
    bestScore: Math.max(rec.bestScore, score),
  };
  const isModule = moduleId in lms.modules;
  updateLms(id, {
    ...lms,
    quizzes: { ...lms.quizzes, [moduleId]: newRec },
    modules: isModule
      ? { ...lms.modules, [moduleId]: { ...lms.modules[moduleId], quiz: newRec.passed } }
      : lms.modules,
    // Keep completion flags in sync for the standalone assessments.
    preTest: moduleId === "preTest" ? lms.preTest || rec.attempts.length + 1 > 0 : lms.preTest,
    postTest: moduleId === "postTest" ? lms.postTest || newRec.passed : lms.postTest,
    finalExam: moduleId === "finalExam" ? lms.finalExam || newRec.passed : lms.finalExam,
  });
  return attempt;
}

/**
 * A module is unlocked when the Pre-Test is complete and every preceding module
 * that has a quiz bank has been passed. Module 1 unlocks once the Pre-Test is done.
 * Credited modules (e.g. previously passed via a Self-Paced Course) count as
 * passed so the learner never has to repeat a Master Module.
 */
export function isModuleUnlocked(app: Application, moduleId: string): boolean {
  const lms = getLms(app);
  const idx = LMS_MODULES.findIndex((m) => m.id === moduleId);
  if (idx < 0) return true;
  if (!lms.preTest) return false; // Pre-Test gates all modules
  if (idx === 0) return true;
  const credited = creditedLmsIds();
  for (let i = 0; i < idx; i++) {
    const prev = LMS_MODULES[i];
    if (
      hasQuizBank(prev.id) &&
      !lms.quizzes?.[prev.id]?.passed &&
      !credited.has(prev.id)
    ) return false;
  }
  return true;
}

/**
 * Cross-application scan: every LMS module id where any application (including
 * the synthetic Self-Paced app) has passed the module quiz. This is what makes
 * completions synchronize between Self-Paced Courses and Full Training Programs
 * — the completion identity is (learner, master module), not (learner, program).
 */
export function creditedLmsIds(): Set<string> {
  const ids = new Set<string>();
  for (const app of loadApplications()) {
    const quizzes = app.lms?.quizzes ?? {};
    for (const [mid, rec] of Object.entries(quizzes)) {
      if ((rec as QuizRecord | null)?.passed) ids.add(mid);
    }
  }
  return ids;
}

/** True when the given LMS module id has been passed in any application. */
export function isLmsModuleCredited(moduleId: string): boolean {
  return creditedLmsIds().has(moduleId);
}

// ── Course completion ────────────────────────────────────────────────────────
/** Number of module quizzes passed — credited modules count as passed. */
export function moduleQuizzesPassed(app: Application): number {
  const lms = getLms(app);
  const credited = creditedLmsIds();
  return LMS_MODULES.filter(
    (m) => lms.quizzes?.[m.id]?.passed || credited.has(m.id),
  ).length;
}

/** True when every module quiz has been passed (or credited). */
export function allModuleQuizzesPassed(app: Application): boolean {
  return moduleQuizzesPassed(app) === LMS_MODULES.length;
}

/** True when the module's resources are done OR credit has been recognised. */
export function isModuleCompleteInApp(app: Application, moduleId: string): boolean {
  const lms = getLms(app);
  if (creditedLmsIds().has(moduleId)) return true;
  const mp = lms.modules[moduleId];
  return !!mp && isModuleComplete(mp);
}

/** True when the Action Plan has been submitted (any status beyond Not Submitted). */
export function actionPlanSubmitted(app: Application): boolean {
  return getLms(app).actionPlan.status !== "Not Submitted";
}

/** True when the Reflection Paper has been submitted. */
export function reflectionSubmitted(app: Application): boolean {
  return getLms(app).reflection.status === "Submitted";
}

/** True when the Knowledge Sharing Report has been submitted. */
export function knowledgeSharingSubmitted(app: Application): boolean {
  return getLms(app).knowledgeSharing.status !== "Not Submitted";
}

/**
 * A participant has completed the course only when all modules are complete
 * (or credited), all module quizzes are passed (or credited), the Post-Test
 * and Final Examination are passed, and the Action Plan, Reflection Paper
 * and Knowledge Sharing Report are submitted.
 */
export function isCourseComplete(app: Application): boolean {
  const lms = getLms(app);
  const modulesComplete = LMS_MODULES.every((m) => isModuleCompleteInApp(app, m.id));
  return (
    modulesComplete &&
    allModuleQuizzesPassed(app) &&
    lms.postTest &&
    lms.finalExam &&
    actionPlanSubmitted(app) &&
    reflectionSubmitted(app) &&
    knowledgeSharingSubmitted(app)
  );
}

// ============================================================================
// In-Person Training — face-to-face component in Bali
// ----------------------------------------------------------------------------
// Unlocks after all e-learning requirements are met. Captures attendance
// confirmation, daily attendance tracking, action-plan presentation,
// training evaluation and overall in-person completion. Static reference
// data (schedule, participant directory, groups, field visit) is shared
// across the dashboard and the In-Person Training component.
// ============================================================================

export const INPERSON_PHASE_STATUSES = [
  "Eligible for In-Person Training",
  "Attendance Confirmed",
  "In-Person Training Completed",
] as const;
export type InPersonPhaseStatus = (typeof INPERSON_PHASE_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["Pending", "Present", "Absent"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const INPERSON_ACTION_PLAN_STATUSES = [
  "Not Started",
  "Draft Submitted",
  "Presented",
  "Approved",
] as const;
export type InPersonActionPlanStatus = (typeof INPERSON_ACTION_PLAN_STATUSES)[number];

export type TrainingDay = { day: number; label: string; date: string; sessions: string[] };

export const TRAINING_DAYS: TrainingDay[] = [
  {
    day: 1,
    label: "Day 1",
    date: "21 Sep 2026",
    sessions: [
      "Opening Ceremony",
      "Country Presentations",
      "Overview of Indonesian Fisheries Sector",
      "Program Orientation",
    ],
  },
  {
    day: 2,
    label: "Day 2",
    date: "22 Sep 2026",
    sessions: [
      "Biofloc Preparation",
      "Catfish Hatchery",
      "Catfish Culture",
      "Feed from Maggot Practice",
    ],
  },
  {
    day: 3,
    label: "Day 3",
    date: "23 Sep 2026",
    sessions: ["Tilapia Hatchery", "Tilapia Culture", "Fish Health", "Vaccination Practice"],
  },
  {
    day: 4,
    label: "Day 4",
    date: "24 Sep 2026",
    sessions: ["Making Catfish Floss", "Fish Bone Cookies", "Fish Processing Practice"],
  },
  {
    day: 5,
    label: "Day 5",
    date: "25 Sep 2026",
    sessions: ["Fish Stick Cheese", "Fish Bone Churros", "Value-Added Products"],
  },
  {
    day: 6,
    label: "Day 6",
    date: "26 Sep 2026",
    sessions: ["Field Visit", "Action Plan Presentation", "Post-Test", "Closing Ceremony"],
  },
];

export const TRAINING_INFO = {
  venue: "Research Station for Tuna Fisheries",
  location: "Denpasar, Bali, Indonesia",
  dates: "21–26 September 2026",
  duration: "6 Days",
  language: "English",
  participants: "20 Fisheries Professionals from Africa",
};

export type DirectoryEntry = { name: string; country: string; organization: string };

export const PARTICIPANT_DIRECTORY: DirectoryEntry[] = [
  { name: "Kwame Mensah", country: "Ghana", organization: "Fisheries Commission of Ghana" },
  { name: "Amina Yusuf", country: "Nigeria", organization: "Federal Department of Fisheries" },
  { name: "Joseph Otieno", country: "Kenya", organization: "Kenya Fisheries Service" },
  {
    name: "Fatima Diallo",
    country: "Senegal",
    organization: "Ministère des Pêches et de l'Économie Maritime",
  },
  {
    name: "Tendai Moyo",
    country: "Zimbabwe",
    organization: "Department of Fisheries & Aquaculture",
  },
  { name: "Samuel Banda", country: "Zambia", organization: "Department of Fisheries" },
  {
    name: "Grace Achieng",
    country: "Tanzania",
    organization: "Tanzania Fisheries Research Institute",
  },
  {
    name: "Ibrahim Sesay",
    country: "Sierra Leone",
    organization: "Ministry of Fisheries & Marine Resources",
  },
  { name: "Mariam Traoré", country: "Mali", organization: "Direction Nationale de la Pêche" },
  {
    name: "Daniel Mwangi",
    country: "Kenya",
    organization: "Kenya Marine & Fisheries Research Institute",
  },
  {
    name: "Aisha Abubakar",
    country: "Nigeria",
    organization: "Nigerian Institute for Oceanography",
  },
  { name: "Emmanuel Osei", country: "Ghana", organization: "Water Research Institute (CSIR)" },
  { name: "Lindiwe Dlamini", country: "Eswatini", organization: "Department of Fisheries" },
  {
    name: "Yohannes Tesfaye",
    country: "Ethiopia",
    organization: "Ethiopian Fisheries & Aquatic Life Research",
  },
  { name: "Chidi Okeke", country: "Nigeria", organization: "African Regional Aquaculture Centre" },
  {
    name: "Rose Nakato",
    country: "Uganda",
    organization: "National Fisheries Resources Research Institute",
  },
  {
    name: "Pascal Niyonzima",
    country: "Rwanda",
    organization: "Rwanda Agriculture & Animal Resources Board",
  },
  {
    name: "Halima Hassan",
    country: "Somalia",
    organization: "Ministry of Fisheries & Marine Resources",
  },
  { name: "Thabo Molefe", country: "Lesotho", organization: "Department of Fisheries" },
  {
    name: "Nadia Benali",
    country: "Morocco",
    organization: "Institut National de Recherche Halieutique",
  },
];

export type GroupAssignment = {
  group: string;
  facilitator: string;
  topic: string;
  members: string[];
};

export const GROUP_ASSIGNMENTS: GroupAssignment[] = [
  {
    group: "Group 1",
    facilitator: "Dr. Achmad Suhermanto",
    topic: "Sustainable Biofloc Catfish Production for African Smallholders",
    members: ["Kwame Mensah", "Amina Yusuf", "Joseph Otieno", "Fatima Diallo", "Tendai Moyo"],
  },
  {
    group: "Group 2",
    facilitator: "Sri Astutik, M.Si",
    topic: "Tilapia Hatchery Management & Disease Prevention",
    members: ["Samuel Banda", "Grace Achieng", "Ibrahim Sesay", "Mariam Traoré", "Daniel Mwangi"],
  },
  {
    group: "Group 3",
    facilitator: "Emi Wati, M.P",
    topic: "Value-Added Fish Processing & Market Access",
    members: [
      "Aisha Abubakar",
      "Emmanuel Osei",
      "Lindiwe Dlamini",
      "Yohannes Tesfaye",
      "Chidi Okeke",
    ],
  },
  {
    group: "Group 4",
    facilitator: "I Putu Suarma, M.Si",
    topic: "Fish Feed Innovation from Maggot & Local Resources",
    members: ["Rose Nakato", "Pascal Niyonzima", "Halima Hassan", "Thabo Molefe", "Nadia Benali"],
  },
];

export const FIELD_VISIT = {
  location: "BBRBLPP Gondol",
  date: "26 September 2026",
  departure: "08:00 WITA",
  meetingPoint: "Research Station Lobby",
  contactPerson: "Mr. Iman Setya Dwi Ardani (+62 812 0000 1111)",
};

export const INPERSON_EVALUATIONS = [
  {
    key: "course",
    label: "Course Evaluation",
    desc: "Rate the overall training content and delivery.",
  },
  {
    key: "instructor",
    label: "Instructor Evaluation",
    desc: "Rate the facilitators and resource persons.",
  },
  { key: "venue", label: "Venue Evaluation", desc: "Rate the training facilities and logistics." },
] as const;

export type InPersonPrep = {
  attendanceConfirmed: "" | "Confirmed" | "Unable to Attend";
  attendance: Record<string, AttendanceStatus>;
  actionPlan: { meta: DocumentMeta | null; status: InPersonActionPlanStatus };
  evaluations: { course: number; instructor: number; venue: number };
};

export function defaultInPerson(): InPersonPrep {
  return {
    attendanceConfirmed: "",
    attendance: Object.fromEntries(
      TRAINING_DAYS.map((d) => [`day${d.day}`, "Pending" as AttendanceStatus]),
    ),
    actionPlan: { meta: null, status: "Not Started" },
    evaluations: { course: 0, instructor: 0, venue: 0 },
  };
}

/** Returns a fully-populated in-person record, filling any missing keys. */
export function getInPerson(app: Application): InPersonPrep {
  const base = defaultInPerson();
  const s = app.inPerson;
  if (!s) return base;
  return {
    attendanceConfirmed: s.attendanceConfirmed ?? base.attendanceConfirmed,
    attendance: Object.fromEntries(
      TRAINING_DAYS.map((d) => [`day${d.day}`, s.attendance?.[`day${d.day}`] ?? "Pending"]),
    ),
    actionPlan: s.actionPlan ?? base.actionPlan,
    evaluations: { ...base.evaluations, ...s.evaluations },
  };
}

export function updateInPerson(id: string, inPerson: InPersonPrep) {
  updateApplication(id, { inPerson });
}

/**
 * E-learning is complete when all 13 modules are complete, and the Pre-Test,
 * Post-Test and Final Examination are all done/passed. Gates the In-Person phase.
 */
export function eLearningComplete(app: Application): boolean {
  const lms = getLms(app);
  const modulesComplete = LMS_MODULES.every((m) => isModuleCompleteInApp(app, m.id));
  return modulesComplete && lms.preTest && lms.postTest && lms.finalExam;
}

/** Number of days marked Present. */
export function attendancePresentCount(app: Application): number {
  const ip = getInPerson(app);
  return TRAINING_DAYS.filter((d) => ip.attendance[`day${d.day}`] === "Present").length;
}

export function attendanceComplete(app: Application): boolean {
  return attendancePresentCount(app) === TRAINING_DAYS.length;
}

export function inPersonActionPlanPresented(app: Application): boolean {
  const s = getInPerson(app).actionPlan.status;
  return s === "Presented" || s === "Approved";
}

export function trainingEvaluationComplete(app: Application): boolean {
  const e = getInPerson(app).evaluations;
  return e.course > 0 && e.instructor > 0 && e.venue > 0;
}

/** True when attendance, action plan presentation and evaluations are all done. */
export function inPersonComplete(app: Application): boolean {
  return (
    attendanceComplete(app) && inPersonActionPlanPresented(app) && trainingEvaluationComplete(app)
  );
}

/** Current phase status badge for the In-Person Training header. */
export function inPersonPhaseStatus(app: Application): InPersonPhaseStatus {
  if (inPersonComplete(app)) return "In-Person Training Completed";
  if (getInPerson(app).attendanceConfirmed === "Confirmed") return "Attendance Confirmed";
  return "Eligible for In-Person Training";
}

// Travel & Visa Preparation — participant pre-arrival logistics
// ----------------------------------------------------------------------------
// Captures the full international fellowship preparation flow: visa support,
// travel & arrival details, airport transfer, accommodation, departure,
// training-kit sizing, health, dietary and emergency-contact information.
// Program-assigned details (driver, hotel) are surfaced read-only.
// ============================================================================

export const VISA_STATUSES = [
  "Visa Not Started",
  "Visa Application Submitted",
  "Visa Approved",
  "Visa Rejected",
  "Visa Received",
] as const;
export type VisaStatus = (typeof VISA_STATUSES)[number];

export const PICKUP_STATUSES = [
  "Waiting for Information",
  "Scheduled",
  "Driver Assigned",
  "Completed",
] as const;
export type PickupStatus = (typeof PICKUP_STATUSES)[number];

export const ARRIVAL_AIRPORTS = [
  { value: "DPS", label: "Ngurah Rai International Airport (DPS) – Bali" },
  { value: "CGK", label: "Soekarno-Hatta International Airport (CGK) – Jakarta" },
  { value: "Other", label: "Other Airport" },
] as const;

export const SPECIAL_REQUESTS = [
  "Quiet Room",
  "Ground Floor",
  "Near Elevator",
  "Non-Smoking Room",
] as const;
export const MEDICAL_CONDITIONS = [
  "Hypertension",
  "Diabetes",
  "Asthma",
  "Heart Disease",
  "Other",
] as const;
export const DIETARY_PREFERENCES = [
  "No Restriction",
  "Halal",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
] as const;
export const FOOD_ALLERGIES = [
  "Seafood",
  "Fish",
  "Shellfish",
  "Shrimp",
  "Crab",
  "Peanut",
  "Milk",
  "Egg",
  "Soy",
  "Gluten",
  "Other",
] as const;
export const FIT_PREFERENCES = ["Slim Fit", "Regular Fit", "Relaxed Fit"] as const;

export type VisaInfo = {
  status: VisaStatus;
  embassy: string;
  applicationDate: string;
  approvalDate: string;
  visaNumber: string;
  visaCopy: DocumentMeta | null;
};

export type TravelInfo = {
  arrivalAirport: "DPS" | "CGK" | "Other";
  otherAirportName: string;
  otherAirportCity: string;
  otherAirportCountry: string;
  airline: string;
  flightNumber: string;
  arrivalDate: string;
  arrivalTime: string;
  transitAirport: string;
  transitFlightNumber: string;
  eTicket: DocumentMeta | null;
};

export type TransferInfo = {
  pickupRequired: "" | "Yes" | "No";
  pickupLocation: "" | "Ngurah Rai Airport" | "Hotel in Bali" | "Other Location";
  arrivalDate: string;
  arrivalTime: string;
  luggageCount: string;
  whatsapp: string;
  status: PickupStatus;
};

export type AccommodationInfo = {
  preference: "" | "Single Room" | "Twin Sharing Room";
  roommate: string;
  specialRequests: string[];
  status: "Pending" | "Confirmed";
};

export type DepartureInfo = {
  airline: string;
  flightNumber: string;
  departureDate: string;
  departureTime: string;
  departureAirport: string;
  transferRequired: "" | "Yes" | "No";
};

export type KitInfo = {
  tshirtSize: string;
  endekSize: string;
  capSize: string;
  height: string;
  weight: string;
  chest: string;
  fit: "" | "Slim Fit" | "Regular Fit" | "Relaxed Fit";
};

export type HealthInfo = {
  conditions: string[];
  otherCondition: string;
  medication: "" | "Yes" | "No";
  medicationDesc: string;
  emergencyNotes: string;
};

export type FoodInfo = {
  dietary: string;
  allergies: string[];
  otherAllergy: string;
  avoid: string;
};

export type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
  country: string;
  email: string;
};

export type TravelPrep = {
  visa: VisaInfo;
  travel: TravelInfo;
  transfer: TransferInfo;
  accommodation: AccommodationInfo;
  departure: DepartureInfo;
  kit: KitInfo;
  health: HealthInfo;
  food: FoodInfo;
  emergency: EmergencyContact;
};

export function defaultTravel(): TravelPrep {
  return {
    visa: {
      status: "Visa Not Started",
      embassy: "",
      applicationDate: "",
      approvalDate: "",
      visaNumber: "",
      visaCopy: null,
    },
    travel: {
      arrivalAirport: "DPS",
      otherAirportName: "",
      otherAirportCity: "",
      otherAirportCountry: "",
      airline: "",
      flightNumber: "",
      arrivalDate: "",
      arrivalTime: "",
      transitAirport: "",
      transitFlightNumber: "",
      eTicket: null,
    },
    transfer: {
      pickupRequired: "",
      pickupLocation: "",
      arrivalDate: "",
      arrivalTime: "",
      luggageCount: "",
      whatsapp: "",
      status: "Waiting for Information",
    },
    accommodation: { preference: "", roommate: "", specialRequests: [], status: "Pending" },
    departure: {
      airline: "",
      flightNumber: "",
      departureDate: "",
      departureTime: "",
      departureAirport: "",
      transferRequired: "",
    },
    kit: { tshirtSize: "", endekSize: "", capSize: "", height: "", weight: "", chest: "", fit: "" },
    health: {
      conditions: [],
      otherCondition: "",
      medication: "",
      medicationDesc: "",
      emergencyNotes: "",
    },
    food: { dietary: "", allergies: [], otherAllergy: "", avoid: "" },
    emergency: { name: "", relationship: "", phone: "", country: "", email: "" },
  };
}

/** Returns a fully-populated travel prep object, filling any missing keys. */
export function getTravel(app: Application): TravelPrep {
  const base = defaultTravel();
  const s = app.travel;
  if (!s) return base;
  return {
    visa: { ...base.visa, ...s.visa },
    travel: { ...base.travel, ...s.travel },
    transfer: { ...base.transfer, ...s.transfer },
    accommodation: { ...base.accommodation, ...s.accommodation },
    departure: { ...base.departure, ...s.departure },
    kit: { ...base.kit, ...s.kit },
    health: { ...base.health, ...s.health },
    food: { ...base.food, ...s.food },
    emergency: { ...base.emergency, ...s.emergency },
  };
}

export function updateTravel(id: string, travel: TravelPrep) {
  updateApplication(id, { travel });
}

// ── Preparation dashboard ───────────────────────────────────────────────────
export type PrepStep = { key: string; label: string; done: boolean };

/** Computes the 8-step participant preparation checklist and completion %. */
export function prepSteps(app: Application): PrepStep[] {
  const t = getTravel(app);
  const docsApproved = DOCUMENT_FIELDS.every((d) => app.documents[d.key]);
  return [
    { key: "application", label: "Application Completed", done: true },
    { key: "documents", label: "Documents Approved", done: docsApproved },
    {
      key: "visa",
      label: "Visa Submitted",
      done: t.visa.status !== "Visa Not Started",
    },
    {
      key: "travel",
      label: "Travel Information Submitted",
      done: Boolean(t.travel.airline && t.travel.flightNumber && t.travel.arrivalDate),
    },
    {
      key: "accommodation",
      label: "Accommodation Confirmed",
      done: t.accommodation.status === "Confirmed",
    },
    {
      key: "kit",
      label: "Training Kit Selected",
      done: Boolean(t.kit.tshirtSize && t.kit.height && t.kit.weight && t.kit.chest),
    },
    {
      key: "health",
      label: "Health Information Submitted",
      done: Boolean(t.health.medication && t.food.dietary),
    },
    {
      key: "arrival",
      label: "Arrival Information Submitted",
      done: Boolean(t.transfer.pickupRequired && t.emergency.name && t.emergency.phone),
    },
  ];
}

export function prepProgress(app: Application): number {
  const steps = prepSteps(app);
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}

export const emptyPersonal: PersonalInfo = {
  fullName: "",
  gender: "",
  nationality: "",
  dob: "",
  passportNumber: "",
  email: "",
  phone: "",
};

export const emptyProfessional: ProfessionalInfo = {
  organization: "",
  position: "",
  country: "",
  experience: "",
  sector: "",
};

// ── Persistence ─────────────────────────────────────────────────────────────
export function loadApplications(): Application[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Application[]) : [];
  } catch {
    return [];
  }
}

function persist(list: Application[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function generateApplicationId(): string {
  // Sequential, human-readable IDs: BARUNA-AFRICA-2026-0001, 0002, ...
  const existing = loadApplications();
  let max = 0;
  for (const a of existing) {
    const m = /BARUNA-AFRICA-2026-(\d+)/.exec(a.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `BARUNA-AFRICA-2026-${String(max + 1).padStart(4, "0")}`;
}

export function createApplication(
  data: Omit<
    Application,
    | "id"
    | "createdAt"
    | "status"
    | "participationConfirmed"
    | "learning"
    | "postCourse"
    | "lms"
    | "travel"
    | "inPerson"
  >,
): Application {
  const app: Application = {
    ...data,
    id: generateApplicationId(),
    createdAt: new Date().toISOString(),
    status: "Submitted",
    participationConfirmed: false,
    learning: Object.fromEntries(LEARNING_SECTIONS.map((s) => [s.key, false])),
    postCourse: Object.fromEntries(POSTCOURSE_FIELDS.map((f) => [f.key, null])),
    lms: defaultLms(),
    travel: defaultTravel(),
    inPerson: defaultInPerson(),
  };
  persist([app, ...loadApplications()]);
  return app;
}

export function updateApplication(id: string, patch: Partial<Application>) {
  const list = loadApplications().map((a) => (a.id === id ? { ...a, ...patch } : a));
  persist(list);
}

export function getApplication(id: string): Application | undefined {
  return loadApplications().find((a) => a.id === id);
}

export function advanceStatus(id: string) {
  const app = getApplication(id);
  if (!app) return;
  const i = (APP_STATUSES as readonly string[]).indexOf(app.status);
  if (i >= 0 && i < APP_STATUSES.length - 1) updateApplication(id, { status: APP_STATUSES[i + 1] });
}

// ── React hooks ─────────────────────────────────────────────────────────────
export function useApplications(): Application[] {
  const [list, setList] = useState<Application[]>(() => loadApplications());
  useEffect(() => {
    const refresh = () => setList(loadApplications());
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  // The synthetic Self-Paced learner record is internal — never surface it in
  // "My Applications" / "My Learning" listings.
  return list.filter((a) => a.id !== SELF_PACED_APP_ID);
}

export function useApplication(id: string): Application | undefined {
  const [app, setApp] = useState<Application | undefined>(() => getApplication(id));
  useEffect(() => {
    const refresh = () => setApp(getApplication(id));
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [id]);
  return app;
}

/**
 * The single Self-Paced learner record. Self-Paced Course enrollments write
 * their quiz results here so they use the exact same quiz engine and progress
 * tracking as Full Training Programs, and completions surface automatically as
 * credit inside any Full Training Program via {@link creditedLmsIds}.
 */
export const SELF_PACED_APP_ID = "BARUNA-SELF-PACED";

export function getOrCreateSelfPacedApp(): Application {
  const existing = getApplication(SELF_PACED_APP_ID);
  if (existing) return existing;
  const app: Application = {
    id: SELF_PACED_APP_ID,
    slug: "self-paced",
    title: "Self-Paced Learning",
    createdAt: new Date().toISOString(),
    status: "Accepted",
    personal: { ...emptyPersonal },
    professional: { ...emptyProfessional },
    english: "Intermediate",
    motivation: "",
    documents: {},
    participationConfirmed: true,
    learning: {},
    postCourse: {},
    // Self-Paced skips Pre-Test gating — every module is directly available.
    lms: { ...defaultLms(), preTest: true },
    travel: defaultTravel(),
    inPerson: defaultInPerson(),
  };
  persist([app, ...loadApplications()]);
  return app;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
