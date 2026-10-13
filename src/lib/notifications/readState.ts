import { useEffect, useState } from "react";
import { getUserScopedKey, subscribeToAuthChange } from "@/lib/authSession";

const KEY_PREFIX = "baruna:notif-read";
const EVT = "baruna:notif-read-changed";

function readIdsFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getUserScopedKey(KEY_PREFIX));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeIdsToStorage(ids: string[]) {
  if (typeof window === "undefined") return;
  const unique = Array.from(new Set(ids));
  localStorage.setItem(getUserScopedKey(KEY_PREFIX), JSON.stringify(unique));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function markLocalNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  const current = readIdsFromStorage();
  writeIdsToStorage([...current, ...ids]);
}

export function useReadNotificationIds(): string[] {
  const [ids, setIds] = useState<string[]>(() => readIdsFromStorage());

  useEffect(() => {
    const sync = () => setIds(readIdsFromStorage());
    sync();
    window.addEventListener(EVT, sync);
    const unsubAuth = subscribeToAuthChange(sync);
    return () => {
      window.removeEventListener(EVT, sync);
      unsubAuth();
    };
  }, []);

  return ids;
}

