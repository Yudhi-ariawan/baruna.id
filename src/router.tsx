import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes default cache
        gcTime: 1000 * 60 * 15, // 15 minutes garbage collection
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const msg = error instanceof Error ? error.message : String(error);
          if (
            msg.includes("forbidden") ||
            msg.includes("unauthorized") ||
            msg.includes("JWT") ||
            msg.includes("profile_not_found")
          ) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  });

  // Work queues of the Konsol Kurasi (/governance) and Portal Admin (/admin) change
  // through other people's actions (a draft submitted, a decision taken, a form sent).
  // Their pages refresh when the window regains focus and every 30 s while the tab is
  // visible, so a second window or device shows the change without reloading
  // (CATATAN_PERBAIKAN 2bv). Few people use these pages, so the extra requests stay
  // small; public pages keep the calmer defaults above. Options given in a useQuery
  // call still win.
  const liveQueue = { staleTime: 10_000, refetchOnWindowFocus: true, refetchInterval: 30_000 } as const;
  queryClient.setQueryDefaults(["governance"], liveQueue);
  queryClient.setQueryDefaults(["admin"], liveQueue);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
