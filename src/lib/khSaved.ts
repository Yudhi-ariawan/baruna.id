// Client-side Saved Items for Knowledge Hub resources.
import { useEffect, useState } from "react";

const KEY = "baruna:kh-saved";
const EVT = "baruna:kh-saved";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function write(list: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function toggleSaved(id: string) {
  const list = read();
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  write(next);
  return next.includes(id);
}

export function isSavedSync(id: string) {
  return read().includes(id);
}

export function useSavedIds(): string[] {
  const [ids, setIds] = useState<string[]>(() => read());
  useEffect(() => {
    const refresh = () => setIds(read());
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
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
