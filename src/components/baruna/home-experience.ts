import { createContext, useContext } from "react";
import type { HomeViewer, PublicHomeStats } from "@/lib/home/home.types";

export type HomeExperience = {
  authState: "loading" | "public" | "authenticated";
  viewer: HomeViewer | null;
  publicStats: PublicHomeStats | null;
  publicStatsLoading: boolean;
  signOut: () => Promise<void>;
};

export const HomeExperienceContext = createContext<HomeExperience | null>(null);

export function useHomeExperience(): HomeExperience {
  const context = useContext(HomeExperienceContext);
  if (!context) throw new Error("useHomeExperience must be used within HomeExperienceProvider");
  return context;
}
