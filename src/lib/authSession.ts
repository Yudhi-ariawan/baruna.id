// ============================================================================
// BARUNA — Active user session & user-scoped storage key resolver
// ----------------------------------------------------------------------------
// Ensures browser localStorage data (enrollments, applications, course progress)
// is strictly isolated per authenticated user account, preventing test or guest
// data from leaking into newly registered user accounts.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

export const AUTH_CHANGE_EVENT = "baruna:auth-changed";

/**
 * Synchronously retrieves the current authenticated user's ID from localStorage,
 * matching Supabase's persisted session format (sb-<ref>-auth-token).
 * Returns null if no user is signed in.
 */
export function getActiveUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const session = JSON.parse(raw);
          const uid = session?.user?.id;
          if (uid && typeof uid === "string") return uid;
        }
      }
    }
  } catch {
    // ignore parsing errors
  }
  return null;
}

/**
 * Returns a storage key scoped to the active user's ID.
 * If signed in: `${prefix}:${userId}`
 * If guest / anonymous: `${prefix}:guest`
 */
export function getUserScopedKey(prefix: string): string {
  const uid = getActiveUserId();
  return uid ? `${prefix}:${uid}` : `${prefix}:guest`;
}

/**
 * Subscribes to auth state changes (sign in, sign out, switch account)
 * and dispatches/notifies callbacks so local stores can re-sync immediately.
 */
export function subscribeToAuthChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => callback();
  window.addEventListener(AUTH_CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);

  const { data: sub } = supabase.auth.onAuthStateChange(() => {
    callback();
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  });

  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
    sub?.subscription?.unsubscribe();
  };
}

