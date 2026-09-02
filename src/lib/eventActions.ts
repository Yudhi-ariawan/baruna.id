import { useCallback, useEffect, useState } from "react";
import type { BarunaEvent } from "@/data/events";

const SAVED_KEY = "baruna:saved-events";
const REG_KEY = "baruna:registered-events";

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function write(key: string, value: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("baruna:storage", { detail: { key } }));
}

function useStored(key: string) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    setItems(read(key));
    const sync = () => setItems(read(key));
    window.addEventListener("baruna:storage", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("baruna:storage", sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);

  const toggle = useCallback(
    (slug: string) => {
      const current = read(key);
      const next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug];
      write(key, next);
      setItems(next);
    },
    [key],
  );

  const has = useCallback((slug: string) => items.includes(slug), [items]);

  return { items, has, toggle };
}

export function useSavedEvents() {
  return useStored(SAVED_KEY);
}

export function useRegisteredEvents() {
  return useStored(REG_KEY);
}

const FOLLOW_KEY = "baruna:following-organizers";

export function useFollowing() {
  return useStored(FOLLOW_KEY);
}

// ── Add to calendar (.ics download) ─────────────────────────────────────────
function toICSDate(iso: string): string {
  return iso.replace(/-/g, "") ;
}

export function downloadICS(event: BarunaEvent) {
  if (typeof window === "undefined") return;
  const end = new Date(event.endISO);
  end.setDate(end.getDate() + 1); // DTEND is exclusive for all-day events
  const dtEnd = end.toISOString().slice(0, 10).replace(/-/g, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BARUNA//Events//EN",
    "BEGIN:VEVENT",
    `UID:${event.slug}@baruna.events`,
    `DTSTART;VALUE=DATE:${toICSDate(event.startISO)}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.location}`,
    `DESCRIPTION:${event.description.replace(/\n/g, " ")}${event.website ? " — " + event.website : ""}`,
    event.website ? `URL:${event.website}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.slug}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareEvent(event: BarunaEvent) {
  if (typeof window === "undefined") return;
  const url = `${window.location.origin}/events/${event.slug}`;
  const data = { title: event.title, text: event.description, url };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch {
      /* user cancelled */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    window.dispatchEvent(
      new CustomEvent("baruna:toast", { detail: { message: "Event link copied to clipboard" } }),
    );
  } catch {
    /* ignore */
  }
}
