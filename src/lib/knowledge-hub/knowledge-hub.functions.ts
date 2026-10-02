import { createServerFn } from "@tanstack/react-start";

export type KnowledgeHubStats = {
  totalPublished: number;
  totalViews: number;
  totalDownloads: number;
  categoryCount: number;
};

const EMPTY_STATS: KnowledgeHubStats = {
  totalPublished: 0,
  totalViews: 0,
  totalDownloads: 0,
  categoryCount: 0,
};

const CACHE_TTL_MS = 60_000;
let statsCache: { expiresAt: number; value: KnowledgeHubStats } | undefined;

function metricValue(metadata: unknown, names: string[]): number {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return 0;
  const record = metadata as Record<string, unknown>;
  const metrics =
    record.metrics && typeof record.metrics === "object" && !Array.isArray(record.metrics)
      ? (record.metrics as Record<string, unknown>)
      : undefined;

  for (const name of names) {
    const value = metrics?.[name] ?? record[name];
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric);
  }
  return 0;
}

/**
 * Public aggregate only. Individual private/draft resources never leave the server.
 * View/download counters are read from canonical resource metadata because the
 * current registry schema does not expose dedicated counter columns.
 */
export const getKnowledgeHubStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<KnowledgeHubStats> => {
    const now = Date.now();
    if (statsCache && statsCache.expiresAt > now) return statsCache.value;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("knowledge_resources")
        .select("resource_type, metadata")
        .eq("current_status", "published")
        .eq("visibility", "public");

      if (error) throw error;

      const resources = data ?? [];
      const value: KnowledgeHubStats = {
        totalPublished: resources.length,
        totalViews: resources.reduce(
          (total, resource) =>
            total + metricValue(resource.metadata, ["views", "view_count", "viewCount"]),
          0,
        ),
        totalDownloads: resources.reduce(
          (total, resource) =>
            total +
            metricValue(resource.metadata, ["downloads", "download_count", "downloadCount"]),
          0,
        ),
        categoryCount: new Set(
          resources.map((resource) => resource.resource_type).filter(Boolean),
        ).size,
      };

      statsCache = { value, expiresAt: now + CACHE_TTL_MS };
      return value;
    } catch (error) {
      console.warn("Knowledge Hub statistics query failed:", error);
      return EMPTY_STATS;
    }
  },
);
