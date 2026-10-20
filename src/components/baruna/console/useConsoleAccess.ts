import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGovernanceConsoleAccess } from "@/lib/governance/console-access.functions";

/**
 * Curation console access of the signed-in account (menus and decision rights).
 * Shared by the /governance layout and its pages through one query key, so a
 * page hides the actions its menu does not allow. The server checks again.
 */
export function useConsoleAccess(enabled = true) {
  const accessFn = useServerFn(getGovernanceConsoleAccess);
  return useQuery({
    queryKey: ["governance", "console-access"],
    queryFn: () => accessFn(),
    enabled,
    retry: false,
    staleTime: 60 * 1000,
  });
}
