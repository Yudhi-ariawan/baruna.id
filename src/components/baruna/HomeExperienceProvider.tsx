import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedHomeContext, getPublicHomeStats } from "@/lib/home/home.functions";
import { HomeExperienceContext, type HomeExperience } from "./home-experience";
import {
  SHORT_COURSES_EVENT,
  shortCourseProgress,
  useShortCourses,
} from "@/lib/shortCourses";

export function HomeExperienceProvider({ children }: { children: ReactNode }) {
  const publicStatsFn = useServerFn(getPublicHomeStats);
  const authenticatedContextFn = useServerFn(getAuthenticatedHomeContext);
  const queryClient = useQueryClient();
  const { enrollments: shortCourses } = useShortCourses();
  const [sessionUserId, setSessionUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSessionUserId(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user.id ?? null;
      setSessionUserId(nextId);
      // Immediately clear in-memory cache when user logs out or switches accounts
      if (event === "SIGNED_OUT" || event === "USER_UPDATED" || (session && session.user.id !== sessionUserId)) {
        queryClient.clear();
      }
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient, sessionUserId]);

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
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
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

    const completed = shortCourses.filter((course) => course.completed).length;
    const activeCourses = shortCourses.filter((course) => !course.completed);
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
        { label: "Certificates Earned", value: String(completed), icon: "certificate" as const },
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
