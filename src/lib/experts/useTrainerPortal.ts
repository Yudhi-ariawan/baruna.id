import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getActiveUserId } from "@/lib/authSession";
import { getTrainerPortalBootstrap } from "./portal-services.functions";

/**
 * Single cache entry for the Trainer Portal bootstrap, shared by the
 * /experts/portal access guard and every portal page. The bootstrap costs ~6 DB
 * queries, so the guard and the child page must not each fetch their own copy.
 * Resolves to null when there is no signed-in user (the guard redirects).
 */
export function useTrainerPortal() {
  const load = useServerFn(getTrainerPortalBootstrap);
  const userId = getActiveUserId();
  return useQuery({
    queryKey: ["experts", "trainer-portal-dashboard", userId ?? "guest"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      return load();
    },
    retry: false,
    // Writes (submit-module, etc.) invalidate this key explicitly, so a short
    // stale window is safe and avoids a refetch on every portal navigation.
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}
