import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getAdminBadges, getConsoleBadges } from "@/lib/governance/console-badges.functions";

// Sidebar badge counts. Refreshed every 30 s, when the tab regains focus, and on
// every page change (a decision on one page lowers the count right away).
const REFRESH = { staleTime: 15_000, gcTime: 5 * 60_000, refetchInterval: 30_000, refetchOnWindowFocus: true } as const;

function useRefetchOnNavigate(refetch: () => unknown, enabled: boolean) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (enabled) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, enabled]);
}

/** Curation queues (/governance); only menus the account may open are counted. */
export function useCurationBadges(enabled: boolean) {
  const fn = useServerFn(getConsoleBadges);
  const q = useQuery({ queryKey: ["governance", "console-badges"], queryFn: () => fn(), enabled, retry: false, ...REFRESH });
  useRefetchOnNavigate(q.refetch, enabled);
  return q.data;
}

/** Admin Portal queues (/admin); admins only. Key sits under the access-request
 *  queue so deciding a request refreshes it too. */
export function useAdminBadges(enabled: boolean) {
  const fn = useServerFn(getAdminBadges);
  const q = useQuery({ queryKey: ["admin", "access-requests", "badges"], queryFn: () => fn(), enabled, retry: false, ...REFRESH });
  useRefetchOnNavigate(q.refetch, enabled);
  return q.data;
}

/** Sum of the given counts (undefined counts are skipped). */
export function badgeTotal(values: Array<number | undefined>): number {
  return values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
}
