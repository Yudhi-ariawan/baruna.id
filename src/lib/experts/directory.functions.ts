import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
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

const publicColumns =
  "id, slug, display_name, headline, bio, country, city, avatar_url, expertise_areas, languages, verification_status, institution, institution_role, trainer_status, trainer_level, unique_graduated_participants, recognition_min_participants, availability_status, available_modes, next_available_from";

export const listPublicExperts = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicExpert[]> => {
    const { data, error } = await supabase
      .from("experts_directory_v")
      .select(publicColumns)
      .order("display_name");
    if (error) throw new Error(error.message);
    return (data as DirectoryRow[]).map(mapExpert);
  },
);

export const getPublicExpertBySlug = createServerFn({ method: "GET" })
  .inputValidator((value) => z.object({ slug: z.string().min(1).max(120) }).parse(value))
  .handler(async ({ data }): Promise<PublicExpert | null> => {
    const { data: expert, error } = await supabase
      .from("experts_directory_v")
      .select(publicColumns)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return expert ? mapExpert(expert as DirectoryRow) : null;
  });
