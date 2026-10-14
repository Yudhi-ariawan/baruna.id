import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toFriendlyEnrollmentError } from "@/lib/learning/enrollment-errors";

export type AdminCourseEnrollmentItem = {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  applicantName: string;
  applicantEmail: string;
  applicantOrganization: string | null;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  decisionBy: string | null;
  decisionAt: string | null;
  decisionNotes: string | null;
  createdAt: string;
  userCurrentRoles: string[];
};

export type AdminEnrollmentsResponse = {
  items: AdminCourseEnrollmentItem[];
  counts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
};

async function assertAdminAccess(context: { supabase: any; userId: string }) {
  const allowed = ["super_admin", "admin", "operator", "approver"];
  const now = new Date().toISOString();
  const { data: assignments } = await context.supabase
    .from("rbac_user_roles")
    .select("rbac_roles!inner(code)")
    .eq("user_id", context.userId)
    .eq("status", "active")
    .lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gt.${now}`)
    .in("rbac_roles.code", allowed)
    .limit(1);

  if (assignments && assignments.length > 0) return true;

  for (const role of allowed.slice(0, 2)) {
    const { data } = await context.supabase.rpc("has_rbac_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (data) return true;
  }
  return false;
}

export const listAdminCourseEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
        search: z.string().trim().max(120).default(""),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data: input, context }): Promise<AdminEnrollmentsResponse> => {
    if (!(await assertAdminAccess(context))) {
      throw new Error("Akses ditolak: Hanya Administrator atau Pengelola Tata Kelola yang dapat meninjau peserta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The table is the only source of truth; a read failure is reported, not hidden.
    const { data: tableRows, error } = await (supabaseAdmin as any)
      .from("course_enrollment_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(toFriendlyEnrollmentError(error.message));

    const allItems: AdminCourseEnrollmentItem[] = (tableRows ?? []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      courseId: r.course_id,
      courseTitle: r.course_title || "Pelatihan BARUNA",
      applicantName: r.applicant_name || "Peserta BARUNA",
      applicantEmail: r.applicant_email || "",
      applicantOrganization: r.applicant_organization || null,
      status: r.status,
      notes: r.notes,
      decisionBy: r.decision_by,
      decisionAt: r.decision_at,
      decisionNotes: r.decision_notes,
      createdAt: r.created_at,
      userCurrentRoles: [],
    }));

    // Compute totals from the complete collection before tab filtering
    const counts = {
      total: allItems.length,
      pending: allItems.filter((i) => i.status === "pending").length,
      approved: allItems.filter((i) => i.status === "approved").length,
      rejected: allItems.filter((i) => i.status === "rejected").length,
    };

    // Filter by tab status
    let items = allItems;
    if (input.status !== "all") {
      items = items.filter((i) => i.status === input.status);
    }

    // Filter by search string if provided
    if (input.search) {
      const s = input.search.toLowerCase();
      items = items.filter(
        (it) =>
          it.applicantName.toLowerCase().includes(s) ||
          it.applicantEmail.toLowerCase().includes(s) ||
          it.courseTitle.toLowerCase().includes(s) ||
          (it.applicantOrganization && it.applicantOrganization.toLowerCase().includes(s)),
      );
    }

    // Fetch user current roles in bulk
    const userIds = [...new Set(items.map((i) => i.userId))];
    if (userIds.length > 0) {
      const { data: userRoles } = await supabaseAdmin
        .from("rbac_user_roles")
        .select("user_id, rbac_roles(code)")
        .in("user_id", userIds)
        .eq("status", "active");

      const roleMap: Record<string, string[]> = {};
      for (const ur of userRoles || []) {
        const uId = ur.user_id;
        const code = (ur.rbac_roles as any)?.code;
        if (code) {
          if (!roleMap[uId]) roleMap[uId] = [];
          roleMap[uId].push(code);
        }
      }

      for (const item of items) {
        item.userCurrentRoles = roleMap[item.userId] || ["registered_user"];
      }
    }

    return {
      items,
      counts,
    };
  });

export const decideAdminCourseEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        id: z.string().optional(),
        userId: z.string().uuid(),
        courseId: z.string().min(1).max(200),
        decision: z.enum(["approve", "reject"]),
        decisionNotes: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    // One transaction in the database: decision row, participant role grant and
    // enrolment link either all commit or none do. Runs as the caller so the RPC
    // can enforce the admin role and block self-decisions via auth.uid().
    const { data: result, error } = await (context.supabase as any).rpc("admin_course_enrollment_decide", {
      _user_id: input.userId,
      _course_id: input.courseId,
      _decision: input.decision,
      _notes: input.decisionNotes?.trim() || null,
    });
    if (error) throw new Error(toFriendlyEnrollmentError(error.message));

    const { status, changed, offeringLinked } = result as {
      status: "approved" | "rejected";
      changed: boolean;
      offeringLinked: boolean;
    };
    const message =
      input.decision === "approve"
        ? changed
          ? `Pendaftaran peserta berhasil disetujui. Peran Participant telah aktif di akun pengguna${
              offeringLinked ? " dan kelas telah ditautkan." : "."
            }`
          : "Pendaftaran ini sudah disetujui sebelumnya; peran Participant dipastikan aktif."
        : changed
          ? "Pendaftaran peserta telah ditolak."
          : "Pendaftaran ini sudah ditolak sebelumnya.";
    return { success: true, decision: input.decision, status, message };
  });
