import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedHomeContext, getPublicHomeStats } from "@/lib/home/home.functions";
import { HomeExperienceContext, type HomeExperience } from "./home-experience";
import {
  SHORT_COURSES_EVENT,
  isServerVerifiedPass,
  shortCourseProgress,
  useShortCourses,
} from "@/lib/shortCourses";

export function HomeExperienceProvider({ children }: { children: ReactNode }) {
  const publicStatsFn = useServerFn(getPublicHomeStats);
  const authenticatedContextFn = useServerFn(getAuthenticatedHomeContext);
  const queryClient = useQueryClient();
  const { enrollments: shortCourses } = useShortCourses();
  const [sessionUserId, setSessionUserId] = useState<string | null | undefined>(undefined);

  // The account whose data is in the cache. The cache is cleared only on sign-out or a
  // real switch to another account: the first session event of a page load used to
  // clear it too (previous id "undefined"), throwing away every query in flight and
  // fetching the account menu and home figures twice.
  const cachedUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    const apply = (nextId: string | null, event?: string) => {
      const previous = cachedUserIdRef.current;
      const switched = previous !== undefined && previous !== null && nextId !== null && previous !== nextId;
      if (event === "SIGNED_OUT" || event === "USER_UPDATED" || switched) queryClient.clear();
      cachedUserIdRef.current = nextId;
      setSessionUserId(nextId);
    };
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) apply(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      apply(session?.user.id ?? null, event);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

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
    // Role/label changes are rare; the menu keeps showing while it refreshes in the
    // background, and learning changes still invalidate it (SHORT_COURSES_EVENT).
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  useEffect(() => {
    const refreshViewer = () => {
      void queryClient.invalidateQueries({ queryKey: ["home", "viewer"] });
    };
    window.addEventListener(SHORT_COURSES_EVENT, refreshViewer);
    return () => window.removeEventListener(SHORT_COURSES_EVENT, refreshViewer);
  }, [queryClient]);

  const viewer = useMemo(() => {
    if (!viewerQuery.data || viewerQuery.data.variant !== "participant" || shortCourses.length === 0) {
      return viewerQuery.data ?? null;
    }

    // A pass is the server's record only (completion_source server_quiz).
    const completed = shortCourses.filter((course) => isServerVerifiedPass(course)).length;
    const activeCourses = shortCourses.filter((course) => !isServerVerifiedPass(course));
    const activeProgress = activeCourses.length
      ? Math.round(
          activeCourses.reduce((total, course) => total + shortCourseProgress(course), 0) /
            activeCourses.length,
        )
      : 0;

    return {
      ...viewerQuery.data,
      metrics: [
        { label: "Enrolled Courses", value: String(shortCourses.length), icon: "book" as const },
        // Issued certificates come from the certificates table (server metric), not from passes.
        viewerQuery.data.metrics.find((m) => m.icon === "certificate") ??
          { label: "Certificates Earned", value: "0", icon: "certificate" as const },
        { label: "Courses Completed", value: String(completed), icon: "completed" as const },
        { label: "Active Progress", value: `${activeProgress}%`, icon: "progress" as const },
      ],
    };
  }, [shortCourses, viewerQuery.data]);

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
      viewer,
      publicStats: publicQuery.data ?? null,
      publicStatsLoading: publicQuery.isLoading,
      signOut: async () => {
        await supabase.auth.signOut();
        setSessionUserId(null);
        queryClient.clear();
      },
    }),
    [publicQuery.data, publicQuery.isLoading, sessionUserId, viewer, viewerQuery.data, viewerQuery.isError],
  );

  return <HomeExperienceContext.Provider value={value}>{children}</HomeExperienceContext.Provider>;
}
