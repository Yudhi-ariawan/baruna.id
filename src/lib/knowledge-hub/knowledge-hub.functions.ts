import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { KhResource, KhResourceType } from "@/data/demo/knowledgeHub";
import { primaryModuleCategory } from "@/lib/academy/module-categories";

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

const CACHE_TTL_MS = 5_000;
type KhCacheStore = {
  stats?: { expiresAt: number; value: KnowledgeHubStats };
  modules?: { expiresAt: number; value: KhResource[] };
  overview?: { expiresAt: number; value: KnowledgeHubOverview };
};
const gCache = globalThis as unknown as { __barunaKhCache?: KhCacheStore };
function khCache(): KhCacheStore {
  if (!gCache.__barunaKhCache) {
    gCache.__barunaKhCache = {};
  }
  return gCache.__barunaKhCache;
}

export type KnowledgeHubOverview = {
  resources: KhResource[];
  counts: Record<KhResourceType, number>;
  categories: string[];
};

const EMPTY_TYPE_COUNTS: Record<KhResourceType, number> = {
  publications: 0,
  "learning-modules": 0,
  "best-practices": 0,
  videos: 0,
  "policy-briefs": 0,
  infographics: 0,
  "case-studies": 0,
  toolkits: 0,
};

function catalogueType(type: string): KhResourceType {
  if (["module", "training_material"].includes(type)) return "learning-modules";
  if (type === "best_practice") return "best-practices";
  if (["video", "podcast", "webinar_recording"].includes(type)) return "videos";
  if (type === "policy_brief") return "policy-briefs";
  if (["infographic", "poster"].includes(type)) return "infographics";
  if (type === "case_study") return "case-studies";
  if (["toolkit", "tool", "methodology", "model", "dataset", "database"].includes(type)) return "toolkits";
  return "publications";
}

function catalogueTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    publication: "Publication",
    journal_article: "Journal Article",
    book: "Book",
    book_chapter: "Book Chapter",
    working_paper: "Working Paper",
    technical_report: "Technical Report",
    policy_brief: "Policy Brief",
    guideline: "Guideline",
    standard: "Standard",
    best_practice: "Best Practice",
    case_study: "Case Study",
    infographic: "Infographic",
    poster: "Poster",
    video: "Video",
    podcast: "Podcast",
    webinar_recording: "Webinar Recording",
    training_material: "Training Material",
    module: "Learning Module",
    toolkit: "Toolkit",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
}

function attachmentMetadata(metadata: Record<string, unknown>) {
  const attachments = Array.isArray(metadata.attached_resources)
    ? metadata.attached_resources as Array<Record<string, unknown>>
    : [];
  const item = attachments[0];
  const bytes = Number(item?.fileSize ?? item?.size ?? metadata.file_size ?? 0);
  const fileName = String(item?.fileName ?? item?.name ?? "");
  const mime = String(item?.fileType ?? metadata.file_type ?? "");
  const fileType = mime.includes("pdf") || fileName.toLowerCase().endsWith(".pdf")
    ? "PDF"
    : mime.includes("video") ? "Video" : fileName.split(".").pop()?.toUpperCase() || "Digital Resource";
  const fileSize = Number.isFinite(bytes) && bytes > 0
    ? bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`
    : undefined;
  return { fileType, fileSize };
}

export function clearKnowledgeHubCache(): void {
  const store = khCache();
  store.overview = undefined;
  store.stats = undefined;
  store.modules = undefined;
}

export const getKnowledgeHubOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<KnowledgeHubOverview> => {
    const now = Date.now();
    const store = khCache();
    if (store.overview && store.overview.expiresAt > now) return store.overview.value;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("knowledge_resources")
      .select("id,title,summary,abstract,resource_type,language,publication_year,publisher,thumbnail_url,external_url,topics,keywords,related_expert_ids,metadata,created_at,updated_at")
      .eq("current_status", "published")
      .eq("visibility", "public")
      .order("publication_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const expertIds = [...new Set((data ?? []).flatMap((item) => item.related_expert_ids ?? []))];
    const { data: experts, error: expertError } = expertIds.length
      ? await supabaseAdmin
          .from("experts_directory_v")
          .select("id,display_name,headline,institution,country,avatar_url,slug")
          .in("id", expertIds)
      : { data: [], error: null };
    if (expertError) throw new Error(expertError.message);
    const expertById = new Map((experts ?? []).map((expert) => [expert.id, expert]));

    const resources: KhResource[] = (data ?? []).map((item) => {
      const metadata = metadataRecord(item.metadata);
      const expert = expertById.get(item.related_expert_ids?.[0] ?? "");
      const type = catalogueType(item.resource_type);
      const taxonomyCategory = type === "learning-modules"
        ? primaryModuleCategory({
            title: item.title,
            summary: item.summary,
            topic: (item.topics ?? []).join(" "),
            competency: (item.keywords ?? []).join(" "),
            metadata,
          })
        : item.topics?.[0] || "Marine & Fisheries";
      const files = attachmentMetadata(metadata);
      const year = item.publication_year ?? new Date(item.created_at).getFullYear();
      const learningHours = Number(metadata.estimated_learning_hours ?? 0) || undefined;

      const rawAccess = String(metadata.accessLevel ?? metadata.accessType ?? "Open Access");
      let access: KhResource["access"] = "Public Access";
      if (rawAccess === "BARUNA Members Only" || rawAccess === "registered") {
        access = "Registered User";
      } else if (rawAccess === "Restricted Access" || rawAccess === "restricted") {
        access = "Restricted Internal";
      } else if (rawAccess === "Course Participant") {
        access = "Course Participant";
      } else if (rawAccess === "Completion Required") {
        access = "Completion Required";
      }

      const explicitAuthor =
        (typeof metadata.author_name === "string" && metadata.author_name.trim()) ||
        (typeof metadata.author === "string" && metadata.author.trim()) ||
        null;
      const explicitOrg =
        (typeof metadata.institution === "string" && metadata.institution.trim()) ||
        (typeof item.publisher === "string" && item.publisher.trim()) ||
        null;
      const explicitCountry =
        (typeof metadata.country === "string" && metadata.country.trim()) ||
        null;

      const resolvedAuthor = explicitAuthor ?? expert?.display_name ?? "BARUNA Network";

      return {
        id: item.id,
        type,
        typeLabel: catalogueTypeLabel(item.resource_type),
        title: item.title,
        category: taxonomyCategory,
        summary: item.summary ?? item.abstract ?? "BARUNA public knowledge resource.",
        abstract: item.abstract ?? item.summary ?? "BARUNA public knowledge resource.",
        author: resolvedAuthor,
        contributor: expert?.display_name ?? String(metadata.contributor_name ?? resolvedAuthor),
        organization: explicitOrg ?? expert?.institution ?? "BARUNA Network",
        year,
        language: item.language ?? "English",
        country: explicitCountry ?? expert?.country ?? "Indonesia",
        keywords: [...(item.keywords ?? []), ...(item.topics ?? [])],
        access,
        status: "Published",
        coverImage: item.thumbnail_url ?? undefined,
        externalUrl: item.external_url ?? (typeof metadata.externalUrl === "string" ? metadata.externalUrl : undefined),
        fileType: files.fileType,
        fileSize: files.fileSize,
        learningHours,
        duration: typeof metadata.duration === "string" ? metadata.duration : undefined,
        version: String(metadata.version ?? "1.0"),
        moduleCode: typeof metadata.module_code === "string" ? metadata.module_code : undefined,
        expertId: expert?.id ?? "",
        relatedExpert: expert
          ? {
              slug: expert.slug || "",
              name: expert.display_name,
              title: expert.headline || "Verified BARUNA Expert",
              avatarUrl: expert.avatar_url || null,
            }
          : null,
        practiceStructure:
          metadata.practiceStructure && typeof metadata.practiceStructure === "object" && !Array.isArray(metadata.practiceStructure)
            ? (metadata.practiceStructure as KhResource["practiceStructure"])
            : null,
        metrics: {
          views: metricValue(metadata, ["views", "view_count", "viewCount"]),
          uniqueViewers: metricValue(metadata, ["unique_viewers", "uniqueViewers"]),
          downloads: metricValue(metadata, ["downloads", "download_count", "downloadCount"]),
          saves: metricValue(metadata, ["saves", "save_count"]),
          shares: metricValue(metadata, ["shares", "share_count"]),
        },
        citation: `${resolvedAuthor} (${year}). ${item.title}. BARUNA Knowledge Hub.`,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      };
    });
    const counts = { ...EMPTY_TYPE_COUNTS };
    for (const resource of resources) counts[resource.type] += 1;
    const categories = [...new Set(resources.map((resource) => resource.category).filter(Boolean))].sort();
    const value = { resources, counts, categories };
    store.overview = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  },
);

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
    const store = khCache();
    if (store.stats && store.stats.expiresAt > now) return store.stats.value;

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

      store.stats = { value, expiresAt: now + CACHE_TTL_MS };
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
    const store = khCache();
    if (store.modules && store.modules.expiresAt > now) return store.modules.value;

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
      const taxonomyCategory = primaryModuleCategory({
        title: resource.title,
        summary: resource.summary,
        topic: (resource.topics ?? []).join(" "),
        competency: (resource.keywords ?? []).join(" "),
        metadata,
      });
      return {
        id: resource.id,
        type: "learning-modules",
        typeLabel: "Learning Module",
        title: resource.title,
        category: taxonomyCategory,
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
    store.modules = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  },
);

export type KnowledgeResourceDownloadResult = {
  resourceId: string;
  downloadUrl: string | null;
  fileName: string;
  externalUrl: string | null;
};

export const getKnowledgeResourceDownload = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ resourceId: z.string().uuid() }).parse(input))
  .handler(async ({ data: { resourceId } }): Promise<KnowledgeResourceDownloadResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: resource, error } = await supabaseAdmin
      .from("knowledge_resources")
      .select("id, title, external_url, metadata")
      .eq("id", resourceId)
      .eq("current_status", "published")
      .eq("visibility", "public")
      .maybeSingle();

    if (error || !resource) {
      throw new Error("Publikasi tidak ditemukan atau tidak tersedia untuk publik.");
    }

    const metadata = metadataRecord(resource.metadata);
    const attachments = Array.isArray(metadata.attached_resources)
      ? (metadata.attached_resources as Array<Record<string, unknown>>)
      : [];

    const file = attachments[0];
    const filePath =
      typeof file?.filePath === "string"
        ? file.filePath
        : typeof metadata.filePath === "string"
          ? metadata.filePath
          : typeof metadata.uploadedFilePath === "string"
            ? metadata.uploadedFilePath
            : undefined;

    const fileName = String(
      file?.fileName ?? file?.name ?? metadata.fileName ?? "dokumen-publikasi-baruna.pdf"
    );

    let downloadUrl: string | null = null;
    if (filePath) {
      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from("knowledge-resource-submissions")
        .createSignedUrl(filePath, 3600, { download: fileName });

      if (!signError && signed?.signedUrl) {
        downloadUrl = signed.signedUrl;
      }
    }

    return {
      resourceId,
      downloadUrl,
      fileName,
      externalUrl: resource.external_url ?? (typeof metadata.externalUrl === "string" ? metadata.externalUrl : null),
    };
  });
