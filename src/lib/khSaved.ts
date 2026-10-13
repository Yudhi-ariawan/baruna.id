// Client-side Saved Items for Knowledge Hub resources (scoped per user account).
import { useEffect, useState } from "react";
import { getUserScopedKey, subscribeToAuthChange } from "@/lib/authSession";

const KEY_PREFIX = "baruna:kh-saved";
const EVT = "baruna:kh-saved";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const scopedKey = getUserScopedKey(KEY_PREFIX);
    const rawScoped = localStorage.getItem(scopedKey);
    if (rawScoped !== null) {
      const parsed = JSON.parse(rawScoped);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    }
    // Fallback migration from legacy global key if present
    const rawLegacy = localStorage.getItem(KEY_PREFIX);
    if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy);
      if (Array.isArray(parsed)) {
        localStorage.setItem(scopedKey, JSON.stringify(parsed));
        return parsed as string[];
      }
    }
    return [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  if (typeof window === "undefined") return;
  const scopedKey = getUserScopedKey(KEY_PREFIX);
  localStorage.setItem(scopedKey, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function toggleSaved(id: string) {
  const list = read();
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  write(next);
  return next.includes(id);
}

export function clearAllSaved() {
  write([]);
}

export function isSavedSync(id: string) {
  return read().includes(id);
}

export function useSavedIds(): string[] {
  const [ids, setIds] = useState<string[]>(() => read());
  useEffect(() => {
    const refresh = () => setIds(read());
    refresh();
    window.addEventListener(EVT, refresh);
    const unsubAuth = subscribeToAuthChange(refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      unsubAuth();
    };
  }, []);
  return ids;
}

export function useIsSaved(id: string): boolean {
  return useSavedIds().includes(id);
}

export async function shareResource(title: string, url: string) {
  const full = typeof window !== "undefined" ? new URL(url, window.location.origin).toString() : url;
  if (typeof navigator !== "undefined" && (navigator as unknown as { share?: (d: object) => Promise<void> }).share) {
    try {
      await (navigator as unknown as { share: (d: object) => Promise<void> }).share({ title, url: full });
      return "shared";
    } catch {
      /* fall through to copy */
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(full);
    return "copied";
  }
  return "unavailable";
}
