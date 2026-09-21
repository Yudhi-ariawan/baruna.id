import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTrainerPortalBootstrap } from "./portal-services.functions";

export function useTrainerPortal() {
  const load = useServerFn(getTrainerPortalBootstrap);
  return useQuery({ queryKey: ["experts", "trainer-portal-dashboard"], queryFn: () => load(), retry: false });
}
