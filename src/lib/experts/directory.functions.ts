import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { instructors, type Instructor } from "@/data/instructors";
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
    trainerStatus: row.trainer_status,
    trainerLevel: row.trainer_level,
    uniqueGraduatedParticipants: row.unique_graduated_participants,
    recognitionMinParticipants: row.recognition_min_participants,
    availabilityStatus: row.availability_status,
    availableModes: row.available_modes ?? [],
    nextAvailableFrom: row.next_available_from,
  };
}

const TRAINER_RECOGNITION: Record<
  string,
  {
    level: PublicExpert["trainerLevel"];
    participants: number;
    city: string;
  }
> = {
  "i-putu-suarma": { level: "certified", participants: 45, city: "Banyuwangi" },
  "sri-astutik": { level: "senior", participants: 120, city: "Banyuwangi" },
  "achmad-suhermanto": { level: "advanced", participants: 85, city: "Karawang" },
  "sumartin": { level: "senior", participants: 150, city: "Banyuwangi" },
  "firman-pra-setia-nugraha": { level: "certified", participants: 35, city: "Banyuwangi" },
  "herison-lingga": { level: "certified", participants: 40, city: "Banyuwangi" },
  "erika-arisetiana-dewi": { level: "certified", participants: 30, city: "Banyuwangi" },
  "emi-wati": { level: "certified", participants: 25, city: "Banyuwangi" },
  "ricky-aditya-saputra": { level: "certified", participants: 30, city: "Banyuwangi" },
  "iman-setya-dwi-ardani": { level: "certified", participants: 20, city: "Banyuwangi" },
};

function mapInstructorToPublicExpert(inst: Instructor): PublicExpert {
  const recognition = TRAINER_RECOGNITION[inst.slug] || {
    level: "certified" as const,
    participants: 30,
    city: "Indonesia",
  };

  return {
    id: `trainer-${inst.slug}`,
    slug: inst.slug,
    displayName: inst.name,
    headline: inst.position,
    bio: inst.biography || inst.summary,
    country: "Indonesia",
    city: recognition.city,
    avatarUrl: inst.photo,
    expertiseAreas: inst.expertise,
    languages: ["Indonesian", "English"],
    verificationStatus: "governance_verified",
    institution: inst.organization,
    institutionRole: inst.position,
    trainerStatus: "active",
    trainerLevel: recognition.level,
    uniqueGraduatedParticipants: recognition.participants,
    recognitionMinParticipants: 25,
    availabilityStatus: "available",
    availableModes: ["Online", "Onsite"],
    nextAvailableFrom: null,
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
          return signed?.signedUrl ?? url;
        } catch {
          return url;
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

const publicColumns =
  "id, slug, display_name, headline, bio, country, city, avatar_url, expertise_areas, languages, verification_status, institution, institution_role, trainer_status, trainer_level, unique_graduated_participants, recognition_min_participants, availability_status, available_modes, next_available_from";

export const listPublicExperts = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicExpert[]> => {
    let dbExperts: PublicExpert[] = [];

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("experts_directory_v")
        .select(publicColumns)
        .in("verification_status", ["institutionally_verified", "governance_verified"])
        .order("display_name");

      if (!error && data) {
        const rows = data as DirectoryRow[];
        const pathsToSign: { index: number; path: string }[] = [];
        const mappedList: PublicExpert[] = rows.map((r, index) => {
          const mapped = mapExpert(r);
          if (r.avatar_url && !r.avatar_url.startsWith("http://") && !r.avatar_url.startsWith("https://")) {
            pathsToSign.push({ index, path: r.avatar_url.trim() });
          } else if (r.avatar_url?.includes("/expert-applications/")) {
            const match = r.avatar_url.match(/\/expert-applications\/(.+?)(\?|$)/);
            if (match && match[1]) {
              pathsToSign.push({ index, path: decodeURIComponent(match[1]) });
            }
          }
          return mapped;
        });

        if (pathsToSign.length > 0) {
          try {
            const { data: signedList } = await supabaseAdmin.storage
              .from("expert-applications")
              .createSignedUrls(
                pathsToSign.map((p) => p.path),
                86400,
              );
            if (signedList) {
              signedList.forEach((s, idx) => {
                const original = pathsToSign[idx];
                if (original && s?.signedUrl) {
                  mappedList[original.index].avatarUrl = s.signedUrl;
                }
              });
            }
          } catch (e) {
            console.warn("Batch sign avatars failed:", e);
          }
        }

        dbExperts = mappedList;
      }
    } catch (err) {
      console.warn("Failed to load experts from db:", err);
    }

    return dbExperts;
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
      const { data, error } = await supabaseAdmin
        .from("experts_directory_v")
        .select("country, expertise_areas, institution, verification_status")
        .in("verification_status", ["institutionally_verified", "governance_verified"]);

      if (error) throw error;

      const experts = data ?? [];
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
      console.warn("Failed to load public expert statistics:", error);
      return EMPTY_EXPERT_STATS;
    }
  },
);

export const getPublicExpertBySlug = createServerFn({ method: "GET" })
  .validator((value: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(value))
  .handler(async ({ data }): Promise<PublicExpert | null> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: expert, error } = await supabaseAdmin
        .from("experts_directory_v")
        .select(publicColumns)
        .eq("slug", data.slug)
        .maybeSingle();

      if (!error && expert) {
        const mapped = mapExpert(expert as DirectoryRow);
        mapped.avatarUrl = await resolveAvatarUrl(expert.avatar_url, supabaseAdmin);
        return mapped;
      }
    } catch (err) {
      console.warn("Failed to load expert by slug:", err);
    }

    const foundInst = instructors.find((inst) => inst.slug === data.slug);
    if (foundInst) {
      return mapInstructorToPublicExpert(foundInst);
    }

    return null;
  });
