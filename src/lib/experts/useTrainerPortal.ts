import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActiveUserId } from "@/lib/authSession";
import { getTrainerPortalBootstrap } from "./portal-services.functions";

export function useTrainerPortal() {
  const load = useServerFn(getTrainerPortalBootstrap);
  const userId = getActiveUserId();
  return useQuery({
    queryKey: ["experts", "trainer-portal-dashboard", userId ?? "guest"],
    queryFn: () => load(),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

