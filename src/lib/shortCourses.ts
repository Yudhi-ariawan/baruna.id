// ============================================================================
// BARUNA Academy — Short Course enrollment & credit recognition
// ----------------------------------------------------------------------------
// Short Courses are standalone offerings of Master Modules. Completing one
// yields a Credit that can bypass the same module inside a Full Training
// Program. Credit is also awarded automatically when the participant passes
// the module quiz inside the Full Training Program (Prior Learning Recognised).
// All state is persisted in localStorage — no backend required.
// ============================================================================

import { useEffect, useState } from "react";
import { MASTER_MODULES, masterByCode, type MasterModule } from "@/data/masterModules";
import { loadApplications } from "@/lib/application";
import {
  getActiveUserId,
  getUserScopedKey,
  subscribeToAuthChange,
} from "@/lib/authSession";
import {
  getMySelfPacedCourses,
  syncMySelfPacedCourses,
  deleteMySelfPacedCourse,
  type SelfPacedEnrollmentPayload,
} from "@/lib/learning/self-paced-sync.functions";

const STORE_PREFIX = "baruna:short-courses";
export const SHORT_COURSES_EVENT = "baruna:short-courses";
const APPS_EVENT = "baruna:applications";

export type ShortCourseEnrollment = {
  code: string;                // Self-Paced / Master Module code or dynamic module id
  enrolledAt: number;
  completed: boolean;
  completedAt?: number;
  /** Score % on the module quiz at the moment of completion. */
  score?: number;
  /** How this credit was earned. */
  source?: "self-paced" | "full-training-program";
  /** Optional metadata for dynamic modules from module_registry */
  title?: string;
  hours?: number | string;
  instructor?: string;
  category?: string;
  completedSteps?: {
    video?: boolean;
    pdf?: boolean;
    ppt?: boolean;
    quiz?: boolean;
  };
  /** Set only by an explicit enrol action or an approved server application. */
  explicitlyEnrolled?: boolean;
};

type Store = Record<string, ShortCourseEnrollment>;

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  // Enrollment is account-owned state. Never expose legacy anonymous data to
  // a signed-out visitor, even if an old `:guest` key remains in localStorage.
  if (!getActiveUserId()) return {};
  try {
    const stored = JSON.parse(localStorage.getItem(getUserScopedKey(STORE_PREFIX)) || "{}") as Store;
    // Historical LMS players created local records merely by being opened.
    // Never render or upload those implicit records as real enrolments.
    return Object.fromEntries(
      Object.entries(stored).filter(([, enrollment]) => enrollment?.explicitlyEnrolled === true),
    );
  } catch {
    return {};
  }
}

/**
 * Pushes the current local store to Supabase cloud in the background.
 */
function triggerDebouncedCloudSync(store: Store) {
  if (typeof window === "undefined" || !getActiveUserId()) return;
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncMySelfPacedCourses({ data: { courses: store as Record<string, SelfPacedEnrollmentPayload> } }).catch((err) => {
      console.warn("[shortCourses] Cloud push sync warning:", err);
    });
  }, 800);
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  if (!getActiveUserId()) return;
  localStorage.setItem(getUserScopedKey(STORE_PREFIX), JSON.stringify(store));
  window.dispatchEvent(new Event(SHORT_COURSES_EVENT));
  triggerDebouncedCloudSync(store);
}

/**
 * Bidirectional cloud synchronization:
 * - Fetches remote courses from Supabase.
 * - Merges with local browser courses (keeping best score and completions).
 * - Pushes any newly found local courses to the cloud.
 * - Updates localStorage and notifies subscribers.
 */
export async function syncWithCloud(): Promise<Store> {
  if (typeof window === "undefined") return {};
  const userId = getActiveUserId();
  if (!userId) return {};

  if (isSyncing) return readStore();
  isSyncing = true;

  try {
    const localStore = readStore();
    const remoteData = await getMySelfPacedCourses();
    const remoteCourses = (remoteData || {}) as Store;

    let hasLocalChangesToUpload = false;
    const merged: Store = { ...remoteCourses };

    for (const [code, localItem] of Object.entries(localStore)) {
      const remoteItem = merged[code];
      if (!remoteItem) {
        merged[code] = localItem;
        hasLocalChangesToUpload = true;
      } else {
        const completed = Boolean(remoteItem.completed || localItem.completed);
        const score = Math.max(remoteItem.score || 0, localItem.score || 0) || undefined;
        const mergedSteps = {
          ...(remoteItem.completedSteps || {}),
          ...(localItem.completedSteps || {}),
        };

        const localHasHigherProgress =
          (!remoteItem.completed && localItem.completed) ||
          (localItem.score || 0) > (remoteItem.score || 0) ||
          JSON.stringify(remoteItem.completedSteps) !== JSON.stringify(mergedSteps);

        if (localHasHigherProgress) {
          hasLocalChangesToUpload = true;
        }

        merged[code] = {
          ...remoteItem,
          ...localItem,
          completed,
          completedAt: completed ? (remoteItem.completedAt || localItem.completedAt || Date.now()) : undefined,
          score,
          completedSteps: mergedSteps,
        };
      }
    }

    // Push upstream if local had courses/progress that remote didn't have yet
    if (hasLocalChangesToUpload) {
      await syncMySelfPacedCourses({ data: { courses: merged as Record<string, SelfPacedEnrollmentPayload> } });
    }

    // Update localStorage if remote had new courses that this device lacked
    const localJson = localStorage.getItem(getUserScopedKey(STORE_PREFIX)) || "{}";
    const mergedJson = JSON.stringify(merged);
    if (localJson !== mergedJson) {
      localStorage.setItem(getUserScopedKey(STORE_PREFIX), mergedJson);
      window.dispatchEvent(new Event(SHORT_COURSES_EVENT));
    }

    return merged;
  } catch (err) {
    console.warn("[shortCourses] syncWithCloud warning:", err);
    return readStore();
  } finally {
    isSyncing = false;
  }
}

// ── Prior-learning recognition ──────────────────────────────────────────────
// Scan every persisted application (real Full Training + the synthetic
// Self-Paced record) for a passed module quiz. Any passed lmsId is treated as
// a completed Master Module and applied as credit against its Self-Paced Course
// counterpart and every other Full Training Program that includes it.
function lmsCompletedIds(): Set<string> {
  const ids = new Set<string>();
  if (typeof window === "undefined") return ids;
  try {
    for (const app of loadApplications()) {
      const quizzes = (app as { lms?: { quizzes?: Record<string, { passed?: boolean }> } })
        .lms?.quizzes ?? {};
      for (const [mid, rec] of Object.entries(quizzes)) {
        if (rec?.passed) ids.add(mid);
      }
    }
  } catch { /* ignore */ }
  return ids;
}

export function getShortCourseEnrollments(): ShortCourseEnrollment[] {
  return Object.values(readStore());
}

export function getShortCourse(code: string): ShortCourseEnrollment | undefined {
  return readStore()[code];
}

export function enrollShortCourse(
  code: string,
  meta?: { title?: string; hours?: number | string; instructor?: string; category?: string },
): ShortCourseEnrollment {
  const store = readStore();
  if (!store[code]) {
    store[code] = {
      code,
      enrolledAt: Date.now(),
      completed: false,
      source: "self-paced",
      title: meta?.title,
      hours: meta?.hours,
      instructor: meta?.instructor,
      category: meta?.category,
      completedSteps: { video: false, pdf: false, ppt: false, quiz: false },
      explicitlyEnrolled: true,
    };
    writeStore(store);
  }
  return store[code];
}

export function updateShortCourseSteps(
  code: string,
  steps: { video?: boolean; pdf?: boolean; ppt?: boolean; quiz?: boolean },
): ShortCourseEnrollment {
  const store = readStore();
  const existing = store[code];
  if (!existing?.explicitlyEnrolled) {
    throw new Error("course_not_enrolled");
  }
  const updatedSteps = {
    ...(existing.completedSteps ?? {}),
    ...steps,
  };
  store[code] = {
    ...existing,
    completedSteps: updatedSteps,
  };
  writeStore(store);
  return store[code];
}

export function completeShortCourse(
  code: string,
  score = 100,
  source: ShortCourseEnrollment["source"] = "self-paced",
): ShortCourseEnrollment {
  const store = readStore();
  const existing =
    store[code] ??
    (source === "full-training-program"
      ? {
          code,
          enrolledAt: Date.now(),
          completed: false,
          source,
          explicitlyEnrolled: true,
        }
      : undefined);
  if (!existing?.explicitlyEnrolled) {
    throw new Error("course_not_enrolled");
  }
  store[code] = {
    ...existing,
    completed: true,
    completedAt: Date.now(),
    score,
    source: existing.source ?? source,
    completedSteps: {
      ...(existing.completedSteps ?? {}),
      video: true,
      pdf: true,
      ppt: true,
      quiz: true,
    },
  };
  writeStore(store);
  return store[code];
}

export function resetShortCourse(code: string) {
  const store = readStore();
  delete store[code];
  writeStore(store);
  if (getActiveUserId()) {
    deleteMySelfPacedCourse({ data: { code } }).catch((err) => {
      console.warn("[shortCourses] cloud delete warning:", err);
    });
  }
}

/** Keep dashboard and homepage progress calculations aligned. */
export function shortCourseProgress(enrollment: ShortCourseEnrollment): number {
  if (enrollment.completed) return 100;
  const steps = enrollment.completedSteps;
  const completedSteps = steps
    ? Number(Boolean(steps.video)) +
      Number(Boolean(steps.pdf)) +
      Number(Boolean(steps.ppt)) +
      Number(Boolean(steps.quiz))
    : 0;
  return completedSteps > 0 ? Math.round((completedSteps / 4) * 100) : 0;
}

/** Is this Master Module already earned as credit via a standalone Short Course
 *  OR by completing the same module inside the Full Training Program? */
export function isModuleCredited(code: string): boolean {
  const master = masterByCode[code];
  if (!master) return false;
  if (readStore()[code]?.completed) return true;
  return lmsCompletedIds().has(master.lmsId);
}

/** Map of LMS module id → credited?  (for use inside Full Training progress). */
export function creditedLmsIds(): Set<string> {
  const store = readStore();
  const lmsIds = new Set<string>();
  for (const m of MASTER_MODULES) {
    if (store[m.code]?.completed) lmsIds.add(m.lmsId);
  }
  // Merge in Pathway 2 credits (LMS-passed modules)
  for (const id of lmsCompletedIds()) lmsIds.add(id);
  return lmsIds;
}

// ── React hook ───────────────────────────────────────────────────────────────
export function useShortCourses() {
  const [store, setStore] = useState<Store>(() => readStore());
  const [lmsIds, setLmsIds] = useState<Set<string>>(() => lmsCompletedIds());

  useEffect(() => {
    let isMounted = true;
    const sync = () => {
      setStore(readStore());
      setLmsIds(lmsCompletedIds());
    };
    window.addEventListener(SHORT_COURSES_EVENT, sync);
    window.addEventListener(APPS_EVENT, sync);
    window.addEventListener("storage", sync);

    const handleAuthOrMount = () => {
      sync();
      syncWithCloud().then((cloudStore) => {
        if (isMounted && cloudStore) {
          setStore(cloudStore);
        }
      });
    };

    const unsubAuth = subscribeToAuthChange(handleAuthOrMount);

    // Initial sync with Supabase cloud on hook mount
    handleAuthOrMount();

    return () => {
      isMounted = false;
      window.removeEventListener(SHORT_COURSES_EVENT, sync);
      window.removeEventListener(APPS_EVENT, sync);
      window.removeEventListener("storage", sync);
      unsubAuth();
    };
  }, []);

  const isCompleted = (code: string) => {
    if (store[code]?.completed) return true;
    const m = masterByCode[code];
    return m ? lmsIds.has(m.lmsId) : false;
  };

  const priorLearning = (code: string) => {
    const m = masterByCode[code];
    return !store[code]?.completed && !!m && lmsIds.has(m.lmsId);
  };

  return {
    enrollments: Object.values(store),
    get: (code: string) => store[code],
    isCompleted,
    priorLearning,
    enroll: enrollShortCourse,
    complete: completeShortCourse,
    reset: resetShortCourse,
    syncWithCloud,
  };
}

// ── Catalog helper ───────────────────────────────────────────────────────────
export type ShortCourseCatalogEntry = MasterModule & {
  enrollment?: ShortCourseEnrollment;
  priorLearningRecognised?: boolean;
};

export function useShortCourseCatalog(): ShortCourseCatalogEntry[] {
  const { enrollments, priorLearning } = useShortCourses();
  const map = new Map(enrollments.map((e) => [e.code, e]));
  return MASTER_MODULES.filter((m) => m.standalone).map((m) => ({
    ...m,
    enrollment: map.get(m.code),
    priorLearningRecognised: priorLearning(m.code),
  }));
}
