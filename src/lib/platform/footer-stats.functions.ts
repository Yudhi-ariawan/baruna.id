import { createServerFn } from "@tanstack/react-start";
import { loadAcademyOverviewStats } from "@/lib/academy/academy-overview.functions";

export type FooterStats = {
  learners: number;
  programs: number;
  countries: number;
  partners: number;
  learningResources: number;
};

const CACHE_TTL_MS = 60_000;
const globalCache = globalThis as unknown as {
  __barunaFooterStats?: { expiresAt: number; value: FooterStats };
};

async function loadFooterStats(): Promise<FooterStats> {
  const now = Date.now();
  const cached = globalCache.__barunaFooterStats;
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // `partners` is introduced by the accompanying migration and is not yet in
  // the generated Database type. Keep the cast local to this server-only query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untypedAdmin = supabaseAdmin as any;
  const [academy, partnersResult, resourcesResult] = await Promise.all([
    loadAcademyOverviewStats(),
    untypedAdmin
      .from("partners")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabaseAdmin
      .from("knowledge_resources")
      .select("id", { count: "exact", head: true })
      .eq("current_status", "published")
      .eq("visibility", "public"),
  ]);

  if (partnersResult.error) throw new Error(partnersResult.error.message);
  if (resourcesResult.error) throw new Error(resourcesResult.error.message);

  const value: FooterStats = {
    learners: academy.learners,
    programs: academy.programs,
    countries: academy.countries,
    partners: partnersResult.count ?? 0,
    learningResources: resourcesResult.count ?? 0,
  };

  globalCache.__barunaFooterStats = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

export const getFooterStats = createServerFn({ method: "GET" }).handler(loadFooterStats);
