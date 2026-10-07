import { createServerFn } from "@tanstack/react-start";
import type { KhResource } from "@/data/demo/knowledgeHub";

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
let moduleCache: { expiresAt: number; value: KhResource[] } | undefined;

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

/** Curated public projection used by /knowledge-hub/learning-modules. */
export const getPublishedLearningModules = createServerFn({ method: "GET" }).handler(
  async (): Promise<KhResource[]> => {
    const now = Date.now();
    if (moduleCache && moduleCache.expiresAt > now) return moduleCache.value;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("knowledge_resources")
      .select("id,title,summary,abstract,language,publication_year,publisher,thumbnail_url,topics,keywords,related_expert_ids,external_url,metadata,created_at,updated_at")
      .eq("resource_type", "module")
      .eq("current_status", "published")
      .eq("visibility", "public")
      .order("publication_date", { ascending: false });
    if (error) throw new Error(error.message);

    const expertIds = [...new Set((data ?? []).flatMap((resource) => resource.related_expert_ids ?? []))];
    const { data: experts, error: expertError } = expertIds.length
      ? await supabaseAdmin
          .from("experts_directory_v")
          .select("id,display_name,institution,country")
          .in("id", expertIds)
      : { data: [], error: null };
    if (expertError) throw new Error(expertError.message);
    const expertById = new Map((experts ?? []).map((expert) => [expert.id, expert]));

    const value: KhResource[] = (data ?? []).map((resource) => {
      const metadata = resource.metadata && typeof resource.metadata === "object" && !Array.isArray(resource.metadata)
        ? resource.metadata as Record<string, unknown>
        : {};
      const expert = expertById.get(resource.related_expert_ids?.[0] ?? "");
      const year = resource.publication_year ?? new Date(resource.created_at).getFullYear();
      const rawLearningHours = metadata.estimated_learning_hours;
      const learningHours = typeof rawLearningHours === "number"
        ? rawLearningHours
        : typeof rawLearningHours === "string" && rawLearningHours.trim() !== ""
          ? Number(rawLearningHours)
          : undefined;
      const moduleCode = typeof metadata.module_code === "string" && metadata.module_code.trim() !== ""
        ? metadata.module_code.trim()
        : undefined;
      return {
        id: resource.id,
        type: "learning-modules",
        typeLabel: "Learning Module",
        title: resource.title,
        category: "fisheries-management",
        summary: resource.summary ?? "BARUNA learning module.",
        abstract: resource.abstract ?? resource.summary ?? "BARUNA learning module.",
        coverImage: resource.thumbnail_url ?? undefined,
        author: expert?.display_name ?? String(metadata.author_name ?? "BARUNA Expert"),
        contributor: expert?.display_name ?? "BARUNA Network",
        organization: expert?.institution ?? resource.publisher ?? String(metadata.institution ?? "BARUNA Network"),
        year,
        language: resource.language ?? "English",
        country: expert?.country ?? String(metadata.country ?? "Indonesia"),
        keywords: [...(resource.keywords ?? []), ...(resource.topics ?? [])],
        access: "Public Access",
        status: "Published",
        fileType: String(metadata.file_type ?? "Module Package"),
        version: String(metadata.version ?? "1.0"),
        learningHours: Number.isFinite(learningHours) && Number(learningHours) > 0
          ? Number(learningHours)
          : undefined,
        moduleCode,
        shortCourseCode: typeof metadata.short_course_id === "string" ? metadata.short_course_id : undefined,
        expertId: expert?.id ?? "",
        metrics: {
          views: metricValue(metadata, ["views", "view_count"]),
          uniqueViewers: metricValue(metadata, ["unique_viewers", "uniqueViewers"]),
          downloads: metricValue(metadata, ["downloads", "download_count"]),
          saves: metricValue(metadata, ["saves", "save_count"]),
          shares: metricValue(metadata, ["shares", "share_count"]),
        },
        citation: `${expert?.display_name ?? "BARUNA Expert"} (${year}). ${resource.title}. BARUNA Knowledge Hub.`,
        createdAt: resource.created_at,
        updatedAt: resource.updated_at,
      };
    });
    moduleCache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  },
);
