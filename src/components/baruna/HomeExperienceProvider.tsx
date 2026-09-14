import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedHomeContext, getPublicHomeStats } from "@/lib/home/home.functions";
import { HomeExperienceContext, type HomeExperience } from "./home-experience";

export function HomeExperienceProvider({ children }: { children: ReactNode }) {
  const publicStatsFn = useServerFn(getPublicHomeStats);
  const authenticatedContextFn = useServerFn(getAuthenticatedHomeContext);
  const [sessionUserId, setSessionUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSessionUserId(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user.id ?? null);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const publicQuery = useQuery({
    queryKey: ["home", "public-stats"],
    queryFn: () => publicStatsFn(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const viewerQuery = useQuery({
    queryKey: ["home", "viewer", sessionUserId],
    queryFn: () => authenticatedContextFn(),
    enabled: typeof sessionUserId === "string",
    staleTime: 60 * 1000,
    retry: false,
  });

  const value = useMemo<HomeExperience>(
    () => ({
      authState:
        sessionUserId === undefined
          ? "loading"
          : sessionUserId === null
            ? "public"
            : viewerQuery.data
              ? "authenticated"
              : viewerQuery.isError
                ? "public"
                : "loading",
      viewer: viewerQuery.data ?? null,
      publicStats: publicQuery.data ?? null,
      publicStatsLoading: publicQuery.isLoading,
      signOut: async () => {
        await supabase.auth.signOut();
        setSessionUserId(null);
      },
    }),
    [publicQuery.data, publicQuery.isLoading, sessionUserId, viewerQuery.data, viewerQuery.isError],
  );

  return <HomeExperienceContext.Provider value={value}>{children}</HomeExperienceContext.Provider>;
}
