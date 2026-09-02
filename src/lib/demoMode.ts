// ============================================================================
// BARUNA — Demo Mode (temporary presentation toggle)
// ----------------------------------------------------------------------------
// A safe, reversible presentation switch for demonstrating the full participant
// journey without completing prerequisites. When ON, navigation locks across the
// application phases (My Learning, Travel, In-Person, Post-Course, Certificate)
// are bypassed for DEMONSTRATION ONLY.
//
// DATA SAFETY: Demo Mode never mutates participant progress. It does not mark
// modules complete, change quiz results, confirm participation, or issue
// certificates. It only relaxes navigation restrictions in the UI. Turning it
// OFF restores every original rule exactly.
// ============================================================================

import { useEffect, useState } from "react";

const STORE_KEY = "baruna:demo-mode";
const EVENT = "baruna:demo-mode";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setDemoMode(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) localStorage.setItem(STORE_KEY, "on");
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Reactive Demo Mode flag, synced across tabs and components. */
export function useDemoMode(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => isDemoMode());
  useEffect(() => {
    const refresh = () => setOn(isDemoMode());
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return [on, setDemoMode];
}

// ============================================================================
// Presentation Mode — the SINGLE global flag for the whole BARUNA Academy.
// ----------------------------------------------------------------------------
// "Presentation Mode" and "Demo Mode" are the SAME flag (one configuration
// switch, as required). These aliases give the global presentation feature a
// clear name while preserving every existing Demo Mode call-site.
//
// When ON, the system NEVER writes to the database / localStorage stores,
// never changes participant progress, quiz results, assignments, uploaded
// documents, certificates or enrollment status. Everything is simulated with
// realistic demo data. Turning it OFF restores normal production behaviour and
// all restrictions immediately.
// ============================================================================

/** Synchronous read of the global Presentation Mode flag. */
export const isPresentationMode = isDemoMode;
/** Toggle the global Presentation Mode flag. */
export const setPresentationMode = setDemoMode;
/** Reactive Presentation Mode flag (alias of useDemoMode). */
export const usePresentationMode = useDemoMode;

/**
 * Generates a realistic, presentation-only tracking number.
 *   presentationReference("TR")  -> "TR-2026-001245"
 *   presentationReference("SPK") -> "SPK-2026-00087"
 * Numbers are simulated and never written to any store.
 */
export function presentationReference(prefix: string, digits = 6): string {
  const year = new Date().getFullYear();
  const max = Math.pow(10, digits) - 1;
  const seq = 1 + Math.floor(Math.random() * Math.min(max, 9999));
  return `${prefix.toUpperCase()}-${year}-${String(seq).padStart(digits, "0")}`;
}

/** Realistic sample uploaded files shown on every upload area during a demo. */
export const DEMO_UPLOAD_FILES = [
  "Passport.pdf",
  "CV.pdf",
  "Nomination Letter.pdf",
  "Motivation Letter.pdf",
  "Flight Ticket.pdf",
  "Action Plan.pdf",
  "Reflection Paper.pdf",
  "Knowledge Sharing Report.pdf",
] as const;

/** Standard "no data saved" message shown after any simulated submission. */
export const PRESENTATION_SUBMIT_MESSAGE =
  "Your request has been submitted successfully. Presentation Mode is enabled. No data has been saved.";
