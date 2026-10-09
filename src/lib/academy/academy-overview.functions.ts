import { createServerFn } from "@tanstack/react-start";

export type AcademyOverviewStats = {
  programs: number;
  learners: number;
  instructors: number;
  countries: number;
};

type EnrollmentUser = { user_id: string };

export const getAcademyOverviewStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<AcademyOverviewStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [programsResult, enrollmentsResult, expertsResult] = await Promise.all([
      supabaseAdmin
        .from("module_registry")
        .select("id", { count: "exact", head: true })
        .eq("current_status", "published")
        .eq("visibility", "public"),
      supabaseAdmin
        .from("enrolments")
        .select("user_id")
        .neq("enrolment_status", "withdrawn"),
      supabaseAdmin
        .from("experts_directory_v")
        .select("id,country,verification_status,trainer_status")
        .in("verification_status", ["institutionally_verified", "governance_verified"])
        .eq("trainer_status", "active"),
    ]);

    if (programsResult.error) throw new Error(programsResult.error.message);
    if (enrollmentsResult.error) throw new Error(enrollmentsResult.error.message);
    if (expertsResult.error) throw new Error(expertsResult.error.message);

    // This table was introduced after the generated Supabase Database type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selfPacedResult = await (supabaseAdmin as any)
      .from("self_paced_enrollments")
      .select("user_id");
    if (selfPacedResult.error) throw new Error(selfPacedResult.error.message);

    const learnerIds = new Set<string>();
    for (const row of enrollmentsResult.data ?? []) learnerIds.add(row.user_id);
    for (const row of (selfPacedResult.data ?? []) as EnrollmentUser[]) learnerIds.add(row.user_id);

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
  },
);
