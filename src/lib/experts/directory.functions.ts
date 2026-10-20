import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PublicExpert } from "./directory.types";

type DirectoryRow = Database["public"]["Views"]["experts_directory_v"]["Row"];

export type PublicExpertStats = {
  verifiedExperts: number;
  countries: number;
  topics: number;
  institutions: number;
};

const EMPTY_EXPERT_STATS: PublicExpertStats = {
  verifiedExperts: 0,
  countries: 0,
  topics: 0,
  institutions: 0,
};

const EXPERT_STATS_CACHE_TTL_MS = 60_000;
let expertStatsCache:
  | { expiresAt: number; value: PublicExpertStats }
  | undefined;

/** Called after every expert decision/archive/restore so the next read is fresh. */
export function clearExpertStatsCache(): void {
  expertStatsCache = undefined;
  expertListCache = undefined;
}

function normalizedUnique(values: Array<string | null | undefined>): number {
  return new Set(
    values.map((value) => value?.trim().toLocaleLowerCase()).filter(Boolean),
  ).size;
}

function mapExpert(row: DirectoryRow): PublicExpert {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    headline: row.headline,
    bio: row.bio,
    country: row.country,
    city: row.city,
    avatarUrl: row.avatar_url,
    expertiseAreas: row.expertise_areas ?? [],
    languages: row.languages ?? [],
    verificationStatus: row.verification_status,
    institution: row.institution,
    institutionRole: row.institution_role,
    contactEmail: row.contact_email ?? null,
    trainerStatus: row.trainer_status,
    trainerLevel: row.trainer_level,
    uniqueGraduatedParticipants: row.unique_graduated_participants,
    recognitionMinParticipants: row.recognition_min_participants,
    availabilityStatus: row.availability_status,
    availableModes: row.available_modes ?? [],
    nextAvailableFrom: row.next_available_from,
  };
}

async function resolveAvatarUrl(
  rawAvatarUrl: string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
): Promise<string | null> {
  if (!rawAvatarUrl || !rawAvatarUrl.trim()) return null;
  const url = rawAvatarUrl.trim();

  // If already a valid public HTTP(S) URL
  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (url.includes("/expert-applications/")) {
      const match = url.match(/\/expert-applications\/(.+?)(\?|$)/);
      if (match && match[1]) {
        try {
          const { data: signed } = await adminClient.storage
            .from("expert-applications")
            .createSignedUrl(decodeURIComponent(match[1]), 86400);
          return signed?.signedUrl ?? null;
        } catch {
          return null;
        }
      }
    }
    return url;
  }

  // If it's a storage path like "users/<uid>/..."
  try {
    const { data: signed } = await adminClient.storage
      .from("expert-applications")
      .createSignedUrl(url, 86400);
    return signed?.signedUrl ?? null;
  } catch {
    return null;
  }
}

const EXPERT_LIST_CACHE_TTL_MS = 60_000;
let expertListCache: { expiresAt: number; value: PublicExpert[] } | undefined;
let expertListInFlight: Promise<PublicExpert[]> | undefined;

async function loadPublicExperts(): Promise<PublicExpert[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchAllPages, fetchByIdChunks } = await import("@/lib/supabase/batch.server");

  // Paged: a single select stops at 1000 rows without any error.
  const rows = await fetchAllPages<DirectoryRow>((from, to) =>
    supabaseAdmin
      .from("experts_directory_v")
      .select("*")
      .in("verification_status", ["institutionally_verified", "governance_verified"])
      .order("display_name")
      .order("id")
      .range(from, to),
  );
  if (rows.length === 0) return [];

  // Chunked: hundreds of ids in one .in() overflow the URL.
  const rawExperts = await fetchByIdChunks(
    rows.map((r) => r.id).filter((id): id is string => Boolean(id)),
    (ids, from, to) =>
      supabaseAdmin
        .from("experts")
        .select("id,original_contributor_id,created_by")
        .in("id", ids)
        .order("id")
        .range(from, to),
  );
  const userIds = rawExperts
    .map((r) => r.original_contributor_id || r.created_by)
    .filter((uid): uid is string => Boolean(uid));
  const profiles = await fetchByIdChunks(userIds, (ids, from, to) =>
    supabaseAdmin.from("profiles").select("id,avatar_url").in("id", ids).order("id").range(from, to),
  );

  const profileAvatarByUserId = new Map<string, string | null>(profiles.map((p) => [p.id, p.avatar_url]));
  const userIdByExpertId = new Map<string, string | null>(
    rawExperts.map((r) => [r.id, r.original_contributor_id || r.created_by || null]),
  );

  const pathsToSign: { index: number; path: string }[] = [];
  const mappedList: PublicExpert[] = rows.map((r, index) => {
    const mapped = mapExpert(r);
    const uid = userIdByExpertId.get(r.id);
    const profileAvatar = uid ? profileAvatarByUserId.get(uid) : null;
    if (profileAvatar && (profileAvatar.startsWith("http://") || profileAvatar.startsWith("https://"))) {
      mapped.avatarUrl = profileAvatar;
      return mapped;
    }
    if (r.avatar_url && !r.avatar_url.startsWith("http://") && !r.avatar_url.startsWith("https://")) {
      mapped.avatarUrl = null;
      pathsToSign.push({ index, path: r.avatar_url.trim() });
    } else if (r.avatar_url?.includes("/expert-applications/")) {
      const match = r.avatar_url.match(/\/expert-applications\/(.+?)(\?|$)/);
      if (match && match[1]) {
        mapped.avatarUrl = null;
        pathsToSign.push({ index, path: decodeURIComponent(match[1]) });
      }
    }
    return mapped;
  });

  // Avatars are cosmetic: a signing failure leaves the placeholder, never fails the list.
  for (let i = 0; i < pathsToSign.length; i += 100) {
    const part = pathsToSign.slice(i, i + 100);
    try {
      const { data: signedList } = await supabaseAdmin.storage
        .from("expert-applications")
        .createSignedUrls(part.map((p) => p.path), 86400);
      signedList?.forEach((signed, idx) => {
        const original = part[idx];
        if (original && signed?.signedUrl) mappedList[original.index].avatarUrl = signed.signedUrl;
      });
    } catch (e) {
      console.warn("Batch sign avatars failed:", e);
    }
  }
  return mappedList;
}

/**
 * Public directory list. Cached for 60 s per server instance and de-duplicated
 * while a load is running, so a traffic spike becomes one database read. On a
 * database error the last good list is served; with no cached list the error is
 * thrown instead of pretending the directory is empty.
 */
export const listPublicExperts = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicExpert[]> => {
    const now = Date.now();
    if (expertListCache && expertListCache.expiresAt > now) return expertListCache.value;
    if (!expertListInFlight) {
      expertListInFlight = loadPublicExperts()
        .then((value) => {
          expertListCache = { value, expiresAt: Date.now() + EXPERT_LIST_CACHE_TTL_MS };
          return value;
        })
        .finally(() => {
          expertListInFlight = undefined;
        });
    }
    try {
      return await expertListInFlight;
    } catch (err) {
      console.error("Failed to load experts from db:", err);
      if (expertListCache) return expertListCache.value;
      throw new Error("Direktori expert sedang tidak dapat dimuat. Coba lagi beberapa saat lagi.");
    }
  },
);

export const getPublicExpertStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicExpertStats> => {
    const now = Date.now();
    if (expertStatsCache && expertStatsCache.expiresAt > now) {
      return expertStatsCache.value;
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { fetchAllPages } = await import("@/lib/supabase/batch.server");
      // Paged: a plain select stops at 1000 rows, which would freeze the counters.
      const experts = await fetchAllPages((from, to) =>
        supabaseAdmin
          .from("experts_directory_v")
          .select("id, country, expertise_areas, institution, verification_status")
          .in("verification_status", ["institutionally_verified", "governance_verified"])
          .order("id")
          .range(from, to),
      );
      const value: PublicExpertStats = {
        verifiedExperts: experts.length,
        countries: normalizedUnique(experts.map((expert) => expert.country)),
        topics: normalizedUnique(
          experts.flatMap((expert) => expert.expertise_areas ?? []),
        ),
        institutions: normalizedUnique(
          experts.map((expert) => expert.institution),
        ),
      };

      expertStatsCache = {
        value,
        expiresAt: now + EXPERT_STATS_CACHE_TTL_MS,
      };
      return value;
    } catch (error) {
      console.error("Failed to load public expert statistics:", error);
      // Prefer the last known figures over showing a misleading zero.
      return expertStatsCache?.value ?? EMPTY_EXPERT_STATS;
    }
  },
);

export const getPublicExpertBySlug = createServerFn({ method: "GET" })
  .validator((value: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(value))
  .handler(async ({ data }): Promise<PublicExpert | null> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.slug);

      // If expert is archived in database, do not show and do not fallback to mock
      const rawQuery = supabaseAdmin
        .from("experts")
        .select("id, slug, original_contributor_id, created_by, current_status");
      const { data: rawExpertRow } = await (isUuid
        ? rawQuery.eq("id", data.slug)
        : rawQuery.eq("slug", data.slug)
      ).maybeSingle();

      if (rawExpertRow?.current_status === "archived") {
        return null;
      }

      const dirQuery = supabaseAdmin
        .from("experts_directory_v")
        .select("*");
      const { data: expert, error } = await (isUuid
        ? dirQuery.eq("id", data.slug)
        : dirQuery.eq("slug", data.slug)
      ).maybeSingle();

      if (!error && expert) {
        const mapped = mapExpert(expert as DirectoryRow);
        let profileAvatar: string | null = null;
        const ownerUserId = rawExpertRow?.original_contributor_id || rawExpertRow?.created_by;
        if (ownerUserId) {
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("avatar_url")
            .eq("id", ownerUserId)
            .maybeSingle();
          if (
            prof?.avatar_url &&
            (prof.avatar_url.startsWith("http://") || prof.avatar_url.startsWith("https://"))
          ) {
            profileAvatar = prof.avatar_url;
          }
        }
        mapped.avatarUrl =
          profileAvatar || (await resolveAvatarUrl(expert.avatar_url, supabaseAdmin));
        return mapped;
      }
    } catch (err) {
      console.warn("Failed to load expert by slug:", err);
    }

    return null;
  });
