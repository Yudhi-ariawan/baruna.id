import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { instructors, type Instructor } from "@/data/instructors";
import type { PublicExpert } from "./directory.types";

type DirectoryRow = Database["public"]["Views"]["experts_directory_v"]["Row"];

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
        .order("display_name");

      if (!error && data) {
        const rows = data as DirectoryRow[];
        dbExperts = await Promise.all(
          rows.map(async (r) => {
            const mapped = mapExpert(r);
            mapped.avatarUrl = await resolveAvatarUrl(r.avatar_url, supabaseAdmin);
            return mapped;
          }),
        );
      }
    } catch (err) {
      console.warn("Failed to load experts from db:", err);
    }

    const existingSlugs = new Set(dbExperts.map((e) => e.slug));
    const trainerExperts = instructors
      .filter((inst) => !existingSlugs.has(inst.slug))
      .map(mapInstructorToPublicExpert);

    return [...dbExperts, ...trainerExperts];
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
