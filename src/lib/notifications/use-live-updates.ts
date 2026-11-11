// Live updates (Slide 13: every status change notifies; CATATAN_PERBAIKAN 2ay).
// Subscribes through Supabase Realtime to the rows the decisions write
// (course_enrollment_applications, course_completions; migration 20261111030000) and
// refreshes the cached notifications, dashboard and learning data as soon as one
// changes. Realtime applies the tables' RLS, so a participant only receives their own
// rows; a decider receives every application (approval queue).
// Before the migration, or when the connection drops, nothing arrives and the
// periodic refresh of the bell (LIVE_FALLBACK_MS) still picks the change up.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Fallback refresh for notification lists when no live event arrives. */
export const LIVE_FALLBACK_MS = 60_000;

const PARTICIPANT_KEYS = [["notifications"], ["dashboard"], ["learning"], ["course-enrollment-status"]];

function useSignedInUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => { if (alive) setUserId(data.session?.user.id ?? null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user.id ?? null));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return userId;
}

function useRealtimeRefresh(name: string, tables: Array<{ table: string; filter?: string }> | null, keys: string[][]) {
  const qc = useQueryClient();
  const spec = tables ? JSON.stringify(tables) : null;
  useEffect(() => {
    if (!spec) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Several rows change in one decision: refresh once.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { for (const queryKey of keys) void qc.invalidateQueries({ queryKey }); }, 400);
    };
    let channel = supabase.channel(`${name}-${Math.random().toString(36).slice(2, 10)}`);
    for (const t of JSON.parse(spec) as Array<{ table: string; filter?: string }>) {
      for (const event of ["INSERT", "UPDATE"] as const) {
        channel = channel.on("postgres_changes", { event, schema: "public", table: t.table, ...(t.filter ? { filter: t.filter } : {}) }, refresh);
      }
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
    // keys is a constant per caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, qc, spec]);
}

/** Participant side: decisions on my applications and completions. Mounted once in the navbar. */
export function useLiveLearningUpdates() {
  const userId = useSignedInUserId();
  useRealtimeRefresh(
    "learning-live",
    userId
      ? [
          { table: "course_enrollment_applications", filter: `user_id=eq.${userId}` },
          { table: "course_completions", filter: `user_id=eq.${userId}` },
        ]
      : null,
    PARTICIPANT_KEYS,
  );
}

/** Approval queue (Persetujuan Peserta): new and resubmitted applications appear without reloading. */
export function useLiveEnrollmentQueue() {
  const userId = useSignedInUserId();
  useRealtimeRefresh("enrollment-queue-live", userId ? [{ table: "course_enrollment_applications" }] : null, [["admin", "course-enrollments"]]);
}
