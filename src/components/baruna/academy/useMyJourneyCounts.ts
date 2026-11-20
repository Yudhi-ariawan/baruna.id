// Per-account figures for the Academy sidebar "My Journey" links. Each figure uses the
// same server function and query key as the page it links to, so the badge and the page
// share one cached request. Nothing is fetched for signed-out visitors or in
// presentation mode.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyLearningOverview } from "@/lib/learning/my-learning.functions";
import { listMyTrainingRequests } from "@/lib/training-requests/my-requests.functions";
import { listMyExpertServiceRequests } from "@/lib/experts/portal-services.functions";
import { useAuthUser } from "@/lib/learning/useBackendEnrolment";
import { usePresentationMode } from "@/lib/demoMode";

/** count: items on the page; attention: items waiting for the account holder. */
export type JourneyFigure = { count: number; attention: number };
export type JourneyCounts = Partial<Record<"my-applications" | "my-learning" | "my-training-requests" | "my-expert-requests", JourneyFigure>>;

const CACHE = { staleTime: 30_000, gcTime: 300_000, retry: false } as const;

export function useMyJourneyCounts(): JourneyCounts {
  const { user } = useAuthUser();
  const [presentation] = usePresentationMode();
  const enabled = Boolean(user) && !presentation;
  const overviewFn = useServerFn(getMyLearningOverview);
  const trainingFn = useServerFn(listMyTrainingRequests);
  const expertFn = useServerFn(listMyExpertServiceRequests);

  const overview = useQuery({ queryKey: ["dashboard", "my-learning-overview"], queryFn: () => overviewFn(), enabled, ...CACHE });
  const training = useQuery({ queryKey: ["training-requests", "mine", user?.id], queryFn: () => trainingFn(), enabled, ...CACHE });
  const expert = useQuery({ queryKey: ["experts", "my-service-requests", user?.id ?? "guest"], queryFn: () => expertFn(), enabled, ...CACHE });

  if (!enabled) return {};
  const out: JourneyCounts = {};
  if (overview.data) {
    const apps = overview.data.applications;
    out["my-applications"] = { count: apps.length, attention: apps.filter((a) => a.status === "revision_requested").length };
    out["my-learning"] = { count: overview.data.counts.inProgress, attention: 0 };
  }
  if (training.data) {
    out["my-training-requests"] = {
      count: training.data.length,
      attention: training.data.filter((r) => r.stage.key === "revision_requested").length,
    };
  }
  if (expert.data) {
    const sent = expert.data.filter((r) => r.status !== "draft");
    out["my-expert-requests"] = { count: sent.length, attention: sent.filter((r) => r.status === "information_requested").length };
  }
  return out;
}
