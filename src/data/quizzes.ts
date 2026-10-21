// ============================================================================
// BARUNA Academy — Module quiz banks
// ----------------------------------------------------------------------------
// End-of-module multiple-choice quizzes for the training program
// "International Training on Fisheries for African Countries".
//
// Each bank is keyed by its LMS module id (see src/data/lms.ts) and holds a
// pool of multiple-choice questions. At runtime the quiz engine randomizes both
// the question order and the answer order, presents QUIZ_QUESTION_COUNT
// questions, scores against QUIZ_PASS_PERCENT and limits learners to
// QUIZ_MAX_ATTEMPTS. Add new banks here (or extend existing ones) to expand the
// question pool — no other code changes are required.
// ============================================================================

export const QUIZ_PASS_PERCENT = 70;
export const QUIZ_MAX_ATTEMPTS = 3;
/** Number of questions presented per attempt (drawn from the bank). */
export const QUIZ_QUESTION_COUNT = 10;

/**
 * Per-assessment runtime configuration. Module quizzes use the defaults; the
 * standalone Pre-Test, Post-Test and Final Examination override count, attempts,
 * pass mark and (for the exam) a time limit.
 */
export type AssessmentConfig = {
  /** Questions presented per attempt. */
  count: number;
  /** Maximum attempts allowed. */
  maxAttempts: number;
  /** Pass mark percentage (0 = no pass mark, e.g. the Pre-Test). */
  passPercent: number;
  /** Optional time limit in minutes (auto-submits when it reaches zero). */
  timeLimitMin?: number;
  /** Hide PASS/FAIL and show "Completed" instead (Pre-Test). */
  noPassMark?: boolean;
  /** Header label shown in the quiz modal. */
  label?: string;
};

export const ASSESSMENT_CONFIG: Record<string, AssessmentConfig> = {
  preTest: { count: 20, maxAttempts: 1, passPercent: 0, noPassMark: true, label: "Pre-Test" },
  postTest: { count: 20, maxAttempts: 3, passPercent: 70, label: "Post-Test" },
  finalExam: { count: 30, maxAttempts: 2, passPercent: 70, timeLimitMin: 45, label: "Final Examination" },
};

/** Returns the runtime config for an assessment/module id (module default if none). */
export function getAssessmentConfig(id: string): AssessmentConfig {
  return (
    ASSESSMENT_CONFIG[id] ?? {
      count: QUIZ_QUESTION_COUNT,
      maxAttempts: QUIZ_MAX_ATTEMPTS,
      passPercent: QUIZ_PASS_PERCENT,
    }
  );
}

export type QuizQuestion = {
  id: string;
  prompt: string;
  /** Answer choices. The correct one is options[correctIndex]. */
  options: string[];
  correctIndex: number;
};

export type QuizBank = {
  /** LMS module id this bank belongs to (e.g. "m1"). */
  moduleId: string;
  title: string;
  questions: QuizQuestion[];
};

/** Modules that have a quiz bank. The banks themselves (with the answer keys) are
 *  server-only: src/data/quiz-banks.server.ts, served by module-quiz.functions.ts. */
export const QUIZ_BANK_IDS: readonly string[] = ["preTest", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12", "m13", "postTest", "finalExam"];

/** True when a module has a quiz bank available. */
export function hasQuizBank(moduleId: string): boolean {
  return QUIZ_BANK_IDS.includes(moduleId);
}

/** A question as the browser receives it: no answer key. */
export type RunQuestion = {
  id: string;
  prompt: string;
  choices: string[];
};
