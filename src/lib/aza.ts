// ============================================================================
// BARUNA Academy — Allocated Zones for Aquaculture (client-side store)
// Persists enrollment + progress in localStorage. Same pattern as the wider
// application store, but scoped to this individual self-paced course.
// ============================================================================

import { useEffect, useState } from "react";
import {
  AZA_ACCESS_DAYS,
  AZA_MODULES,
  AZA_PASS_MARK,
  AZA_POSTTEST,
  AZA_PROJECT_UPLOADS,
  AZA_WEIGHTS,
  type AzaQuizQuestion,
} from "@/data/aza";

const KEY = "baruna:aza";
const EVENT = "baruna:aza";

export type QuizAttempt = { score: number; total: number; percent: number; at: string };
export type FileMeta = { name: string; size: number; at: string };
export type ProjectStatus =
  | "Not Started"
  | "In Progress"
  | "Submitted"
  | "Completeness Check"
  | "Under Expert Review"
  | "Revision Required"
  | "Resubmitted"
  | "Approved"
  | "Certificate Eligible";
export type CertStatus =
  | "Locked"
  | "Requirements Incomplete"
  | "Under Review"
  | "Eligible"
  | "Issued";

export type AzaState = {
  enrolled: boolean;
  enrolledAt: string | null;
  accessExpiresAt: string | null;
  caseOption: "A" | "B" | null;
  profileCompleted: boolean;
  saved: boolean;
  pretest: QuizAttempt | null;
  modulesRead: Record<number, boolean>;
  quizzes: Record<number, QuizAttempt>;
  assignments: Record<string, string>; // key → freeform text
  project: {
    status: ProjectStatus;
    files: Record<string, FileMeta | null>;
    submittedAt: string | null;
    expertNote: string | null;
    approvedAt: string | null;
  };
  posttest: QuizAttempt | null;
  evaluation: Record<string, number>;
  reflectionCompleted: boolean;
  certificate: { status: CertStatus; number: string | null; issuedAt: string | null };
  notifications: { id: string; at: string; text: string }[];
};

const EMPTY: AzaState = {
  enrolled: false,
  enrolledAt: null,
  accessExpiresAt: null,
  caseOption: null,
  profileCompleted: false,
  saved: false,
  pretest: null,
  modulesRead: {},
  quizzes: {},
  assignments: {},
  project: {
    status: "Not Started",
    files: {},
    submittedAt: null,
    expertNote: null,
    approvedAt: null,
  },
  posttest: null,
  evaluation: {},
  reflectionCompleted: false,
  certificate: { status: "Locked", number: null, issuedAt: null },
  notifications: [],
};

function read(): AzaState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as AzaState) };
  } catch {
    return EMPTY;
  }
}

function write(state: AzaState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(EVENT));
}

export function useAza(): [AzaState, (fn: (s: AzaState) => AzaState) => void] {
  const [state, setState] = useState<AzaState>(EMPTY);
  useEffect(() => {
    setState(read());
    const onChange = () => setState(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const update = (fn: (s: AzaState) => AzaState) => {
    const next = fn(read());
    write(next);
    setState(next);
  };
  return [state, update];
}

function notify(state: AzaState, text: string): AzaState {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    ...state,
    notifications: [{ id, at: new Date().toISOString(), text }, ...state.notifications].slice(0, 40),
  };
}

// ---------- actions -----------------------------------------------------------

export function enroll(state: AzaState): AzaState {
  if (state.enrolled) return state;
  const now = new Date();
  const expires = new Date(now.getTime() + AZA_ACCESS_DAYS * 24 * 60 * 60 * 1000);
  const s: AzaState = {
    ...state,
    enrolled: true,
    enrolledAt: now.toISOString(),
    accessExpiresAt: expires.toISOString(),
  };
  return notify(notify(s, "Course started — Module 0 is now available."), "Successful enrollment in Allocated Zones for Aquaculture.");
}

export function toggleSaved(state: AzaState): AzaState {
  return { ...state, saved: !state.saved };
}

export function setProfile(state: AzaState, caseOption: "A" | "B"): AzaState {
  return { ...state, profileCompleted: true, caseOption };
}

export function scoreQuiz(qs: AzaQuizQuestion[], answers: number[]): QuizAttempt {
  const correct = qs.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
  return {
    score: correct,
    total: qs.length,
    percent: Math.round((correct / qs.length) * 100),
    at: new Date().toISOString(),
  };
}

export function submitQuiz(state: AzaState, moduleNo: number, attempt: QuizAttempt): AzaState {
  const prev = state.quizzes[moduleNo];
  const best = !prev || attempt.percent > prev.percent ? attempt : prev;
  const s: AzaState = {
    ...state,
    modulesRead: { ...state.modulesRead, [moduleNo]: true },
    quizzes: { ...state.quizzes, [moduleNo]: best },
  };
  const nextModule = moduleNo + 1;
  const hasNext = AZA_MODULES.some((m) => m.no === nextModule);
  return hasNext
    ? notify(s, `Module ${nextModule} unlocked.`)
    : notify(s, "Final project is now available.");
}

export function submitPretest(state: AzaState, attempt: QuizAttempt): AzaState {
  return { ...state, pretest: attempt };
}

export function saveAssignment(state: AzaState, key: string, text: string): AzaState {
  return notify(
    { ...state, assignments: { ...state.assignments, [key]: text } },
    `Assignment saved: ${key.replace(/_/g, " ")}.`,
  );
}

export function uploadProjectFile(state: AzaState, key: string, file: File): AzaState {
  const s: AzaState = {
    ...state,
    project: {
      ...state.project,
      status:
        state.project.status === "Not Started" ? "In Progress" : state.project.status,
      files: {
        ...state.project.files,
        [key]: { name: file.name, size: file.size, at: new Date().toISOString() },
      },
    },
  };
  return s;
}

export function submitProject(state: AzaState): AzaState {
  const now = new Date().toISOString();
  const s: AzaState = {
    ...state,
    project: { ...state.project, status: "Submitted", submittedAt: now },
  };
  return notify(
    notify(s, "Project sent for expert review."),
    "Final project submitted — administrative completeness check in progress.",
  );
}

/** Simulated expert review — moves the project along the review pipeline. */
export function advanceReview(state: AzaState, next: ProjectStatus, note?: string): AzaState {
  const s: AzaState = {
    ...state,
    project: {
      ...state.project,
      status: next,
      expertNote: note ?? state.project.expertNote,
      approvedAt:
        next === "Approved" || next === "Certificate Eligible"
          ? new Date().toISOString()
          : state.project.approvedAt,
    },
  };
  const messages: Partial<Record<ProjectStatus, string>> = {
    "Under Expert Review": "Your project is now under expert review.",
    "Revision Required": "Revision requested — please review the expert's written feedback.",
    Approved: "Final project approved.",
    "Certificate Eligible": "You are now eligible for the digital certificate.",
  };
  return messages[next] ? notify(s, messages[next]!) : s;
}

export function submitPosttest(state: AzaState, attempt: QuizAttempt): AzaState {
  return notify({ ...state, posttest: attempt }, "Post-test completed.");
}

export function saveEvaluation(state: AzaState, ratings: Record<string, number>): AzaState {
  return notify(
    { ...state, evaluation: ratings, reflectionCompleted: true },
    "Course evaluation submitted.",
  );
}

export function issueCertificate(state: AzaState): AzaState {
  if (state.certificate.status === "Issued") return state;
  const number = `BARUNA-AZA-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
  const s: AzaState = {
    ...state,
    certificate: {
      status: "Issued",
      number,
      issuedAt: new Date().toISOString(),
    },
  };
  return notify(s, `Certificate ${number} issued.`);
}

// ---------- derived -----------------------------------------------------------

export function moduleUnlocked(state: AzaState, no: number): boolean {
  if (!state.enrolled) return false;
  if (no === 0) return state.profileCompleted;
  const prev = state.quizzes[no - 1];
  return !!prev && prev.percent >= AZA_PASS_MARK;
}

export function projectUnlocked(state: AzaState): boolean {
  return AZA_MODULES.filter((m) => m.no > 0).every(
    (m) => (state.quizzes[m.no]?.percent ?? 0) >= AZA_PASS_MARK,
  );
}

export function postTestUnlocked(state: AzaState): boolean {
  return state.project.status !== "Not Started" && state.project.status !== "In Progress";
}

export function computeFinalScore(state: AzaState): number {
  // Quizzes portion (modules 1..10, module 0 diagnostic)
  const quizModules = AZA_MODULES.filter((m) => m.no > 0);
  const quizPct =
    quizModules.reduce((sum, m) => sum + (state.quizzes[m.no]?.percent ?? 0), 0) /
    quizModules.length;

  const inst = state.assignments["institutional_map"] ? 1 : 0;
  const stake = state.assignments["stakeholder_matrix"] ? 1 : 0;
  const instStake = (inst + stake) / 2;

  const inv = state.assignments["spatial_inventory"] ? 1 : 0;
  const crit = state.assignments["criteria_matrix"] ? 1 : 0;
  const mon = state.assignments["monitoring_plan"] ? 1 : 0;

  const projectApproved =
    state.project.status === "Approved" || state.project.status === "Certificate Eligible";
  const projectSubmitted = projectApproved
    ? 1
    : state.project.status === "Submitted" ||
        state.project.status === "Under Expert Review" ||
        state.project.status === "Resubmitted"
      ? 0.6
      : 0;

  const post = state.posttest?.percent ? 1 : 0;
  const refl = state.reflectionCompleted ? 1 : 0;

  const score =
    (quizPct / 100) * AZA_WEIGHTS.quizzes +
    instStake * AZA_WEIGHTS.institutionalStakeholder +
    inv * AZA_WEIGHTS.spatialInventory +
    crit * AZA_WEIGHTS.criteriaMatrix +
    mon * AZA_WEIGHTS.monitoringPlan +
    projectSubmitted * AZA_WEIGHTS.finalProject +
    refl * AZA_WEIGHTS.reflection +
    // small credit weighted from post-test
    (post ? 0 : 0);

  return Math.round(score);
}

export function overallProgress(state: AzaState): number {
  const steps: boolean[] = [
    state.enrolled,
    state.profileCompleted,
    !!state.pretest,
    ...AZA_MODULES.filter((m) => m.no > 0).map(
      (m) => (state.quizzes[m.no]?.percent ?? 0) >= AZA_PASS_MARK,
    ),
    !!state.assignments["institutional_map"],
    !!state.assignments["spatial_inventory"],
    !!state.assignments["criteria_matrix"],
    !!state.assignments["stakeholder_matrix"],
    !!state.assignments["monitoring_plan"],
    state.project.status !== "Not Started",
    state.project.status === "Submitted" ||
      state.project.status === "Under Expert Review" ||
      state.project.status === "Approved" ||
      state.project.status === "Certificate Eligible",
    !!state.posttest,
    state.project.status === "Approved" || state.project.status === "Certificate Eligible",
    state.reflectionCompleted,
    state.certificate.status === "Issued",
  ];
  const done = steps.filter(Boolean).length;
  return Math.round((done / steps.length) * 100);
}

export function accessDaysRemaining(state: AzaState): number | null {
  if (!state.accessExpiresAt) return null;
  const ms = new Date(state.accessExpiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function certificateEligible(state: AzaState): boolean {
  const finalScore = computeFinalScore(state);
  return (
    state.enrolled &&
    projectUnlocked(state) &&
    (state.project.status === "Approved" || state.project.status === "Certificate Eligible") &&
    !!state.posttest &&
    state.reflectionCompleted &&
    finalScore >= AZA_PASS_MARK &&
    AZA_PROJECT_UPLOADS.filter((u) => u.required).every((u) => !!state.project.files[u.key])
  );
}

export const AZA_POSTTEST_QUESTIONS = AZA_POSTTEST;
