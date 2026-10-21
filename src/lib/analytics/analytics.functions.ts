import { createServerFn } from "@tanstack/react-start";
import { primaryModuleCategory, MODULE_CATEGORY_LABELS } from "@/lib/academy/module-categories";

/**
 * Public impact dashboard (/analytics). Every number is counted from a BARUNA
 * database table; a metric the platform does not record yet is `null` and the
 * page shows "Belum tersedia" instead of an estimate (decision 21 Okt 2026,
 * CATATAN_PERBAIKAN 2l Nomor 9).
 */

export type CategoryModuleBreakdown = {
  slug: string;
  name: string;
  modulesCount: number;
  instructionalHours: number;
};

/** `null` = not recorded by the platform yet (never an estimate). */
type Metric = number | null;

export type PlatformImpactAnalytics = {
  registeredParticipants: Metric;
  activeLearners: Metric;
  uniqueSuccessfulParticipants: Metric;
  countriesReached: Metric;
  verifiedExperts: Metric;
  approvedTrainers: Metric;
  approvedModules: Metric;
  publishedShortCourses: Metric;
  fullTrainingPrograms: Metric;
  certificatesIssued: Metric;
  participantLearningHoursGenerated: Metric;
  eventsConducted: Metric;
  communityMembers: Metric;
  knowledgeResources: Metric;
  activePartners: Metric;
  fellowshipParticipants: Metric;
  alumni: Metric;
  trainingArchiveRecords: Metric;
  levelDistribution: Record<"certified" | "advanced" | "senior" | "master", number>;
  categoryBreakdown: CategoryModuleBreakdown[];
  generatedAt: string;
};

type CacheEntry = { expiresAt: number; data: PlatformImpactAnalytics };
let cachedAnalytics: CacheEntry | null = null;
const CACHE_TTL_MS = 60_000; // one read per minute per server instance under load

type FeatureFlags = { trainer?: boolean } | null;

async function buildAnalytics(): Promise<PlatformImpactAnalytics> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchAllPages } = await import("@/lib/supabase/batch.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const now = new Date().toISOString();

  const count = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: n, error } = await query;
    if (error) throw new Error(error.message);
    return n ?? 0;
  };
  const userIds = (table: string, column: string, apply: (q: any) => any = (q) => q) => // eslint-disable-line @typescript-eslint/no-explicit-any
    fetchAllPages<Record<string, string>>((from, to) =>
      apply(db.from(table).select(`id, ${column}`)).order("id").range(from, to),
    ).then((rows) => rows.map((r) => r[column]).filter(Boolean));

  const [
    participantRows,
    enrolledUsers,
    selfPacedUsers,
    approvedApplicants,
    certificateHolders,
    certificatesIssued,
    experts,
    approvedModules,
    publishedModules,
    knowledgeResources,
    activePartners,
    offerings,
    deliveryModes,
  ] = await Promise.all([
    fetchAllPages<{ id: string; user_id: string }>((from, to) =>
      db
        .from("rbac_user_roles")
        .select("id, user_id, rbac_roles!inner(code)")
        .eq("rbac_roles.code", "participant")
        .eq("status", "active")
        .lte("valid_from", now)
        .or(`valid_until.is.null,valid_until.gt.${now}`)
        .order("id")
        .range(from, to),
    ),
    userIds("enrolments", "user_id", (q) => q.neq("enrolment_status", "withdrawn")),
    userIds("self_paced_enrollments", "user_id"),
    userIds("course_enrollment_applications", "user_id", (q) => q.eq("status", "approved")),
    userIds("certificates", "learner_id", (q) => q.eq("certificate_status", "issued")),
    count(db.from("certificates").select("id", { count: "exact", head: true }).eq("certificate_status", "issued")),
    fetchAllPages<{ id: string; trainer_status: string | null; trainer_level: string | null }>((from, to) =>
      db
        .from("experts_directory_v")
        .select("id, trainer_status, trainer_level")
        .in("verification_status", ["institutionally_verified", "governance_verified"])
        .order("id")
        .range(from, to),
    ),
    count(db.from("module_registry_public_v").select("id", { count: "exact", head: true })),
    fetchAllPages<{ id: string; title: string | null; summary: string | null; estimated_learning_hours: number | null }>(
      (from, to) =>
        db
          .from("module_registry_public_v")
          .select("id, title, summary, estimated_learning_hours")
          .order("id")
          .range(from, to),
    ),
    count(db.from("knowledge_resources_public_v").select("id", { count: "exact", head: true })),
    count(db.from("partners").select("id", { count: "exact", head: true }).eq("status", "active")),
    fetchAllPages<{ id: string; status: string | null; delivery_mode_id: string | null }>((from, to) =>
      db.from("course_offerings").select("id, status, delivery_mode_id").order("id").range(from, to),
    ),
    fetchAllPages<{ id: string; feature_flags: FeatureFlags }>((from, to) =>
      db.from("delivery_modes").select("id, feature_flags").order("id").range(from, to),
    ),
  ]);

  // Self-paced vs facilitated (Full Training) follows the delivery mode, the same
  // rule as public._is_self_paced_delivery_mode: no trainer = self-paced.
  const facilitated = new Set(deliveryModes.filter((m) => m.feature_flags?.trainer === true).map((m) => m.id));
  const isFacilitated = (o: { delivery_mode_id: string | null }) => Boolean(o.delivery_mode_id && facilitated.has(o.delivery_mode_id));
  const published = offerings.filter((o) => o.status === "published");
  const runOrRunning = offerings.filter((o) => o.status === "published" || o.status === "completed");

  const learners = new Set([...enrolledUsers, ...selfPacedUsers, ...approvedApplicants]);
  const graduates = new Set(certificateHolders).size;
  const activeTrainers = experts.filter((e) => e.trainer_status === "active");

  const levelDistribution = { certified: 0, advanced: 0, senior: 0, master: 0 };
  for (const t of activeTrainers) {
    if (t.trainer_level && t.trainer_level in levelDistribution) {
      levelDistribution[t.trainer_level as keyof typeof levelDistribution] += 1;
    }
  }

  const byCategory = new Map<string, { count: number; hours: number }>();
  for (const mod of publishedModules) {
    const slug = primaryModuleCategory({ title: mod.title ?? "", summary: mod.summary ?? "" });
    const current = byCategory.get(slug) ?? { count: 0, hours: 0 };
    byCategory.set(slug, { count: current.count + 1, hours: current.hours + (Number(mod.estimated_learning_hours) || 0) });
  }
  const categoryBreakdown = Object.entries(MODULE_CATEGORY_LABELS).map(([slug, name]) => {
    const c = byCategory.get(slug) ?? { count: 0, hours: 0 };
    return { slug, name, modulesCount: c.count, instructionalHours: c.hours };
  });

  return {
    registeredParticipants: new Set(participantRows.map((r) => r.user_id)).size,
    activeLearners: learners.size,
    uniqueSuccessfulParticipants: graduates,
    countriesReached: null, // participants' countries are not recorded
    verifiedExperts: experts.length,
    approvedTrainers: activeTrainers.length,
    approvedModules,
    publishedShortCourses: published.filter((o) => !isFacilitated(o)).length,
    fullTrainingPrograms: runOrRunning.filter(isFacilitated).length,
    certificatesIssued,
    participantLearningHoursGenerated: null, // needs completion records per module
    eventsConducted: null, // events are not stored in the database yet
    communityMembers: null, // no community membership records yet
    knowledgeResources,
    activePartners,
    fellowshipParticipants: null, // no fellowship records yet
    alumni: graduates,
    trainingArchiveRecords: offerings.filter((o) => o.status === "completed").length,
    levelDistribution,
    categoryBreakdown,
    generatedAt: new Date().toISOString(),
  };
}

export const getPlatformImpactAnalytics = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformImpactAnalytics> => {
    const nowMs = Date.now();
    if (cachedAnalytics && cachedAnalytics.expiresAt > nowMs) return cachedAnalytics.data;
    try {
      const data = await buildAnalytics();
      cachedAnalytics = { expiresAt: nowMs + CACHE_TTL_MS, data };
      return data;
    } catch (err) {
      console.error("[getPlatformImpactAnalytics] failed:", err);
      // Last known figures rather than an error page; never invented numbers.
      if (cachedAnalytics) return cachedAnalytics.data;
      throw new Error("Data dampak platform sedang tidak dapat dimuat. Coba lagi beberapa saat lagi.");
    }
  },
);
