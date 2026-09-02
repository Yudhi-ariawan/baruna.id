// ============================================================================
// BARUNA Learning Architecture — Enrolment & Progress store
// ----------------------------------------------------------------------------
// Simple localStorage-backed store. De-dup keys enforced:
//   • enrolment  = learnerId + offeringId
//   • certificate = learnerId + offeringId + type
//   • progress   = enrolmentId + activityId
//
// This is deliberately a thin, additive store. Legacy per-course stores
// (application.ts, aza.ts, shortCourses.ts) remain the source of truth for
// their existing courses until Phases 4–5 migrate them.
// ============================================================================

import { useEffect, useState } from "react";
import type {
  CertificateRecord,
  CertificateType,
  CourseOfferingId,
  Enrolment,
  EnrolmentId,
  EnrolmentStatus,
  LearnerId,
} from "./types";
import { getCourseOffering } from "./registry";

const K_ENROLMENTS = "baruna:learning:enrolments";
const K_PROGRESS = "baruna:learning:progress";
const K_CERTS = "baruna:learning:certificates";
const EVT = "baruna:learning:changed";

const DEFAULT_LEARNER: LearnerId = "learner-me";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(EVT));
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

// ─── Enrolment ─────────────────────────────────────────────────────────────
export function listEnrolments(learnerId: LearnerId = DEFAULT_LEARNER): Enrolment[] {
  return read<Enrolment[]>(K_ENROLMENTS, []).filter((e) => e.learnerId === learnerId);
}

export function findEnrolment(
  offeringId: CourseOfferingId,
  learnerId: LearnerId = DEFAULT_LEARNER,
): Enrolment | undefined {
  return read<Enrolment[]>(K_ENROLMENTS, []).find(
    (e) => e.learnerId === learnerId && e.offeringId === offeringId,
  );
}

export function enrolLearner(
  offeringId: CourseOfferingId,
  learnerId: LearnerId = DEFAULT_LEARNER,
  status: EnrolmentStatus = "enrolled",
): Enrolment {
  const existing = findEnrolment(offeringId, learnerId);
  if (existing) return existing;
  const offering = getCourseOffering(offeringId);
  const now = new Date();
  const expiresAt = offering?.accessExpiresAfterDays
    ? new Date(now.getTime() + offering.accessExpiresAfterDays * 86400_000).toISOString()
    : undefined;
  const e: Enrolment = {
    id: newId("en"),
    learnerId,
    offeringId,
    status,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    enrolledAt: status === "enrolled" ? now.toISOString() : undefined,
    accessExpiresAt: expiresAt,
  };
  const all = read<Enrolment[]>(K_ENROLMENTS, []);
  write(K_ENROLMENTS, [e, ...all]);
  return e;
}

export function updateEnrolmentStatus(id: EnrolmentId, status: EnrolmentStatus) {
  const all = read<Enrolment[]>(K_ENROLMENTS, []);
  const next = all.map((e) =>
    e.id === id
      ? {
          ...e,
          status,
          updatedAt: new Date().toISOString(),
          enrolledAt: status === "enrolled" ? new Date().toISOString() : e.enrolledAt,
        }
      : e,
  );
  write(K_ENROLMENTS, next);
}

// ─── Progress ──────────────────────────────────────────────────────────────
type ProgressMap = Record<string, { done: boolean; score?: number; at: string }>;

function progressKey(enrolmentId: EnrolmentId) {
  return `${K_PROGRESS}:${enrolmentId}`;
}

export function getProgress(enrolmentId: EnrolmentId): ProgressMap {
  return read<ProgressMap>(progressKey(enrolmentId), {});
}

export function markActivity(
  enrolmentId: EnrolmentId,
  activityId: string,
  patch: { done?: boolean; score?: number },
) {
  const map = getProgress(enrolmentId);
  map[activityId] = {
    done: patch.done ?? map[activityId]?.done ?? false,
    score: patch.score ?? map[activityId]?.score,
    at: new Date().toISOString(),
  };
  write(progressKey(enrolmentId), map);
}

// ─── Certificates ──────────────────────────────────────────────────────────
export function listCertificates(learnerId: LearnerId = DEFAULT_LEARNER): CertificateRecord[] {
  return read<CertificateRecord[]>(K_CERTS, []).filter((c) => c.learnerId === learnerId);
}

export function issueCertificate(
  learnerId: LearnerId,
  offeringId: CourseOfferingId,
  type: CertificateType,
): CertificateRecord {
  const all = read<CertificateRecord[]>(K_CERTS, []);
  const dedup = all.find(
    (c) => c.learnerId === learnerId && c.offeringId === offeringId && c.type === type,
  );
  if (dedup) return dedup;
  const rec: CertificateRecord = {
    id: newId("cert"),
    learnerId,
    offeringId,
    type,
    issuedAt: new Date().toISOString(),
    serial: `BARUNA-${offeringId.toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`,
  };
  write(K_CERTS, [rec, ...all]);
  return rec;
}

// ─── React helper ──────────────────────────────────────────────────────────
export function useLearningState(learnerId: LearnerId = DEFAULT_LEARNER) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(EVT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(EVT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);
  return {
    tick,
    enrolments: listEnrolments(learnerId),
    certificates: listCertificates(learnerId),
  };
}

export const DEFAULT_LEARNER_ID = DEFAULT_LEARNER;
