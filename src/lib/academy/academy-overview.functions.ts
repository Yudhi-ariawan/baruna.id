import { createServerFn } from "@tanstack/react-start";

export type AcademyOverviewStats = {
  programs: number;
  learners: number;
  instructors: number;
  countries: number;
};

type EnrollmentUser = { user_id: string };

/** Shared server-side aggregate used by Academy and global platform statistics. */
export async function loadAcademyOverviewStats(): Promise<AcademyOverviewStats> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchAllPages } = await import("@/lib/supabase/batch.server");

  // Learner lists are paged: a plain select stops at 1000 rows without an error.
  const [programsResult, enrollments, expertsResult, selfPaced] = await Promise.all([
    supabaseAdmin
      .from("module_registry")
      .select("id", { count: "exact", head: true })
      .eq("current_status", "published")
      .eq("visibility", "public"),
    fetchAllPages<EnrollmentUser>((from, to) =>
      supabaseAdmin
        .from("enrolments")
        .select("id, user_id")
        .neq("enrolment_status", "withdrawn")
        .order("id")
        .range(from, to),
    ),
    supabaseAdmin
      .from("experts_directory_v")
      .select("id,country,verification_status,trainer_status")
      .in("verification_status", ["institutionally_verified", "governance_verified"])
      .eq("trainer_status", "active"),
    fetchAllPages<EnrollmentUser>((from, to) =>
      // This table was introduced after the generated Supabase Database type.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from("self_paced_enrollments")
        .select("id, user_id")
        .order("id")
        .range(from, to),
    ),
  ]);

  if (programsResult.error) throw new Error(programsResult.error.message);
  if (expertsResult.error) throw new Error(expertsResult.error.message);

  const learnerIds = new Set<string>();
  for (const row of enrollments) learnerIds.add(row.user_id);
  for (const row of selfPaced) learnerIds.add(row.user_id);

  const countries = new Set(
    (expertsResult.data ?? [])
      .map((expert) => expert.country?.trim())
      .filter((country): country is string => Boolean(country)),
  );

  return {
    programs: programsResult.count ?? 0,
    learners: learnerIds.size,
    instructors: expertsResult.data?.length ?? 0,
    countries: Math.max(1, countries.size),
  };
}

export const getAcademyOverviewStats = createServerFn({ method: "GET" }).handler(
  loadAcademyOverviewStats,
);
