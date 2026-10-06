import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  const allowed = ["super_admin", "admin", "management", "qa_reviewer", "verifier", "approver", "operator"];
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
    const { data } = await context.supabase.rpc("has_role", {
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
    const enrollmentsMap = new Map<string, AdminCourseEnrollmentItem>();

    // 1. Fetch from primary table: course_enrollment_applications
    try {
      let query = (supabaseAdmin as any)
        .from("course_enrollment_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (input.status !== "all") {
        query = query.eq("status", input.status);
      }

      const { data: tableRows, error } = await query;
      if (!error && Array.isArray(tableRows)) {
        for (const r of tableRows) {
          const key = `${r.user_id}:${r.course_id}`;
          enrollmentsMap.set(key, {
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
          });
        }
      }
    } catch {
      // Table may not yet be present
    }

    // 2. Fetch from audit log as resilient fallback or supplement
    try {
      const { data: auditRows } = await (supabaseAdmin as any)
        .from("admin_audit_log")
        .select("id, actor_id, target_user_id, entity_id, after_data, created_at")
        .eq("entity_type", "course_enrollment")
        .order("created_at", { ascending: false })
        .limit(200);

      if (Array.isArray(auditRows)) {
        for (const row of auditRows) {
          const payload = (row.after_data as Record<string, any>) || {};
          const userId = row.target_user_id || row.actor_id;
          const courseId = row.entity_id || payload.course_id;
          if (!userId || !courseId) continue;

          const key = `${userId}:${courseId}`;
          if (!enrollmentsMap.has(key)) {
            const rowStatus = payload.status || "pending";
            if (input.status !== "all" && rowStatus !== input.status) continue;

            enrollmentsMap.set(key, {
              id: row.id,
              userId,
              courseId,
              courseTitle: payload.course_title || "Pelatihan BARUNA",
              applicantName: payload.applicant_name || "Peserta BARUNA",
              applicantEmail: payload.applicant_email || "",
              applicantOrganization: payload.applicant_organization || null,
              status: rowStatus,
              notes: payload.notes || null,
              decisionBy: payload.decision_by || null,
              decisionAt: payload.decision_at || null,
              decisionNotes: payload.decision_notes || null,
              createdAt: row.created_at,
              userCurrentRoles: [],
            });
          }
        }
      }
    } catch {
      // Ignore audit fallback read error
    }

    let items = Array.from(enrollmentsMap.values());

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

    // Compute totals
    const allItems = Array.from(enrollmentsMap.values());
    const counts = {
      total: allItems.length,
      pending: allItems.filter((i) => i.status === "pending").length,
      approved: allItems.filter((i) => i.status === "approved").length,
      rejected: allItems.filter((i) => i.status === "rejected").length,
    };

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
    if (!(await assertAdminAccess(context))) {
      throw new Error("Akses ditolak: Hanya Administrator atau Pengelola Tata Kelola yang dapat memutuskan persetujuan peserta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const finalStatus = input.decision === "approve" ? "approved" : "rejected";
    const noteText =
      input.decisionNotes?.trim() ||
      (input.decision === "approve"
        ? "Pendaftaran disetujui. Akun peserta telah diberikan akses ke ruang belajar."
        : "Pendaftaran belum dapat disetujui pada periode ini.");

    // 1. Update in course_enrollment_applications if exists
    try {
      await (supabaseAdmin as any)
        .from("course_enrollment_applications")
        .update({
          status: finalStatus,
          decision_by: context.userId,
          decision_at: now,
          decision_notes: noteText,
          updated_at: now,
        })
        .match({ user_id: input.userId, course_id: input.courseId });
    } catch (e) {
      console.warn("[decideAdminCourseEnrollment] update table warning:", e);
    }

    // 2. If approved: Assign the official "participant" role safely to user
    if (input.decision === "approve") {
      try {
        const { data: participantRole } = await supabaseAdmin
          .from("rbac_roles")
          .select("id")
          .eq("code", "participant")
          .maybeSingle();

        if (participantRole) {
          const { data: existingRole } = await supabaseAdmin
            .from("rbac_user_roles")
            .select("id, status")
            .eq("user_id", input.userId)
            .eq("role_id", participantRole.id)
            .maybeSingle();

          if (!existingRole) {
            // Assign participant role with is_primary: false (preserving expert or admin primary role!)
            await supabaseAdmin.from("rbac_user_roles").insert({
              user_id: input.userId,
              role_id: participantRole.id,
              status: "active",
              is_primary: false,
              valid_from: now,
              granted_by: context.userId,
              approved_by: context.userId,
              approved_at: now,
              reason: `course_enrollment_approved:${input.courseId}`,
            });
          } else if (existingRole.status !== "active") {
            await supabaseAdmin
              .from("rbac_user_roles")
              .update({
                status: "active",
                valid_until: null,
                revoked_at: null,
                revoked_by: null,
                reason: `course_enrollment_reapproved:${input.courseId}`,
              })
              .eq("id", existingRole.id);
          }
        }
      } catch (roleErr) {
        console.error("[decideAdminCourseEnrollment] role assignment error:", roleErr);
      }

      // Ensure profile isActive is true
      try {
        await supabaseAdmin.from("profiles").update({ is_active: true }).eq("id", input.userId);
      } catch {}
    }

    // 3. Write comprehensive audit record
    try {
      await (supabaseAdmin as any).from("admin_audit_log").insert({
        event_type: input.decision === "approve" ? "course_enrollment_approved" : "course_enrollment_rejected",
        actor_id: context.userId,
        target_user_id: input.userId,
        entity_type: "course_enrollment",
        entity_id: input.courseId,
        before_data: { status: "pending" },
        after_data: {
          status: finalStatus,
          decision_by: context.userId,
          decision_at: now,
          decision_notes: noteText,
        },
        metadata: {
          decided_at: now,
          decision: input.decision,
        },
      });
    } catch (auditErr) {
      console.warn("[decideAdminCourseEnrollment] audit write warning:", auditErr);
    }

    return {
      success: true,
      decision: input.decision,
      status: finalStatus,
      message:
        input.decision === "approve"
          ? "Pendaftaran peserta berhasil disetujui. Peran Participant telah aktif di akun pengguna."
          : "Pendaftaran peserta telah ditolak.",
    };
  });

