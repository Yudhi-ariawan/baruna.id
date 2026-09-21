import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import { getUpcomingEvents } from "@/data/events";
import type { HomeMetric, HomeViewer, PublicHomeStats } from "./home.types";

function exactCount(result: { count: number | null; error: { message: string } | null }): number {
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

export const getPublicHomeStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicHomeStats> => {
    const [training, experts, publications] = await Promise.all([
      supabase
        .from("course_offerings")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      supabase.from("experts_public_v").select("id", { count: "exact", head: true }),
      supabase.from("knowledge_resources_public_v").select("id", { count: "exact", head: true }),
    ]);

    return {
      activeTraining: exactCount(training),
      verifiedExperts: exactCount(experts),
      openPublications: exactCount(publications),
      upcomingEvents: getUpcomingEvents().length,
    };
  },
);

type AdminClient = SupabaseClient<Database>;

async function countRows(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  return exactCount(await query);
}

async function participantMetrics(admin: AdminClient, userId: string): Promise<HomeMetric[]> {
  const [{ data: enrolments, error: enrolmentError }, certificates] = await Promise.all([
    admin
      .from("enrolments")
      .select("id, completion_status")
      .eq("user_id", userId)
      .neq("enrolment_status", "withdrawn"),
    countRows(
      admin
        .from("certificates")
        .select("id", { count: "exact", head: true })
        .eq("learner_id", userId),
    ),
  ]);
  if (enrolmentError) throw new Error(enrolmentError.message);

  const activeEnrolments = (enrolments ?? []).filter(
    (item) => item.completion_status !== "completed",
  );
  const completed = (enrolments ?? []).length - activeEnrolments.length;
  let progress = 0;
  if (activeEnrolments.length > 0) {
    const { data, error } = await admin
      .from("progress_records")
      .select("progress_value")
      .in(
        "enrolment_id",
        activeEnrolments.map((item) => item.id),
      );
    if (error) throw new Error(error.message);
    const values = (data ?? [])
      .map((item) => item.progress_value)
      .filter((value): value is number => typeof value === "number");
    progress = values.length
      ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
      : 0;
  }

  return [
    { label: "Enrolled Courses", value: String(enrolments?.length ?? 0), icon: "book" },
    { label: "Certificates Earned", value: String(certificates), icon: "certificate" },
    { label: "Courses Completed", value: String(completed), icon: "completed" },
    { label: "Active Progress", value: `${progress}%`, icon: "progress" },
  ];
}

async function adminMetrics(admin: AdminClient): Promise<HomeMetric[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [activeUsers, accessRequests, pendingReviews, auditToday] = await Promise.all([
    countRows(
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    ),
    countRows(
      admin
        .from("rbac_role_change_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ),
    countRows(
      admin
        .from("review_subjects")
        .select("id", { count: "exact", head: true })
        .in("current_status", ["submitted", "under_review"]),
    ),
    countRows(
      admin
        .from("admin_audit_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", today.toISOString()),
    ),
  ]);
  return [
    { label: "Active Users", value: String(activeUsers), icon: "users" },
    { label: "Access Requests", value: String(accessRequests), icon: "requests" },
    { label: "Pending Reviews", value: String(pendingReviews), icon: "reviews" },
    { label: "Audit Events Today", value: String(auditToday), icon: "audit" },
  ];
}

async function registeredMetrics(
  admin: AdminClient,
  userId: string,
  profile: {
    display_name: string | null;
    avatar_url: string | null;
    phone: string | null;
    job_title: string | null;
    organization: string | null;
  },
): Promise<HomeMetric[]> {
  const populated = [
    profile.display_name,
    profile.avatar_url,
    profile.phone,
    profile.job_title,
    profile.organization,
  ].filter(Boolean).length;
  const [enrolments, certificates, requests] = await Promise.all([
    countRows(
      admin
        .from("enrolments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .neq("enrolment_status", "withdrawn"),
    ),
    countRows(
      admin
        .from("certificates")
        .select("id", { count: "exact", head: true })
        .eq("learner_id", userId),
    ),
    countRows(
      admin
        .from("rbac_role_change_requests")
        .select("id", { count: "exact", head: true })
        .eq("target_user_id", userId)
        .eq("status", "pending"),
    ),
  ]);
  return [
    { label: "Profile Complete", value: `${populated * 20}%`, icon: "profile" },
    { label: "Enrolled Courses", value: String(enrolments), icon: "book" },
    { label: "Certificates", value: String(certificates), icon: "certificate" },
    { label: "Pending Requests", value: String(requests), icon: "requests" },
  ];
}

function dashboardUrlForRole(roleCode: string): string {
  if (["super_admin", "admin"].includes(roleCode)) return "/admin/users";
  if (roleCode === "expert") return "/experts/portal";
  if (["operator", "reviewer", "verifier", "approver", "publisher"].includes(roleCode)) {
    return "/governance/queue";
  }
  return "/dashboard";
}

const ROLE_PRIORITY = [
  "super_admin",
  "admin",
  "expert",
  "approver",
  "verifier",
  "reviewer",
  "operator",
  "publisher",
  "participant",
  "registered_user",
] as const;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrator",
  admin: "Administrator",
  expert: "Expert",
  approver: "Approver",
  verifier: "Verifier",
  reviewer: "Reviewer",
  operator: "Operator",
  publisher: "Publisher",
  participant: "Participant",
  registered_user: "Registered User",
};

function highestPriorityRole(roleCodes: string[]): string {
  return ROLE_PRIORITY.find((code) => roleCodes.includes(code)) ?? roleCodes[0] ?? "registered_user";
}

export const getAuthenticatedHomeContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HomeViewer> => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const [{ data: identity, error: identityError }, { data: profile, error: profileError }] =
      await Promise.all([
        admin.auth.admin.getUserById(context.userId),
        admin
          .from("profiles")
          .select("display_name, avatar_url, phone, job_title, organization")
          .eq("id", context.userId)
          .single(),
      ]);
    if (identityError || !identity.user) throw new Error("user_identity_not_found");
    if (profileError || !profile) throw new Error("profile_not_found");

    const { data: assignments, error: assignmentError } = await admin
      .from("rbac_user_roles")
      .select("rbac_roles(code)")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .lte("valid_from", now)
      .or(`valid_until.is.null,valid_until.gt.${now}`);
    if (assignmentError) throw new Error(assignmentError.message);

    const roleCodes = (assignments ?? [])
      .map((assignment) => assignment.rbac_roles?.code)
      .filter((code): code is string => Boolean(code));
    const roleCode = highestPriorityRole(roleCodes);
    let roleLabel = ROLE_LABELS[roleCode] ?? roleCode.replaceAll("_", " ");
    if (roleCode === "expert") {
      const { data: expert } = await admin
        .from("experts")
        .select("id")
        .or(`original_contributor_id.eq.${context.userId},created_by.eq.${context.userId}`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (expert) {
        const { data: trainer } = await admin
          .from("expert_trainer_status")
          .select("id")
          .eq("expert_id", expert.id)
          .eq("trainer_status", "active")
          .lte("effective_from", now)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .limit(1)
          .maybeSingle();
        if (trainer) roleLabel = "BARUNA Trainer";
      }
    }
    const variant = ["super_admin", "admin"].includes(roleCode)
      ? "admin"
      : roleCode === "participant"
        ? "participant"
        : "registered";
    const metrics =
      variant === "admin"
        ? await adminMetrics(admin)
        : variant === "participant"
          ? await participantMetrics(admin, context.userId)
          : await registeredMetrics(admin, context.userId, profile);
    const displayName =
      profile.display_name?.trim() ||
      (identity.user.user_metadata.full_name as string | undefined)?.trim() ||
      identity.user.email?.split("@")[0] ||
      "BARUNA Member";

    return {
      id: context.userId,
      displayName,
      avatarUrl: profile.avatar_url,
      primaryRoleCode: roleCode,
      primaryRoleLabel: roleLabel,
      variant,
      dashboardUrl: dashboardUrlForRole(roleCode),
      metrics,
    };
  });
