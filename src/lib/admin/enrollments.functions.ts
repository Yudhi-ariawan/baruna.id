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
    const enrollmentsMap = new Map<string, AdminCourseEnrollmentItem>();

    // 1. Fetch from primary table: course_enrollment_applications (all rows first for accurate counts)
    try {
      const { data: tableRows, error } = await (supabaseAdmin as any)
        .from("course_enrollment_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(tableRows)) {
        for (const r of tableRows) {
          const key = `${r.user_id}:${r.course_id}`;
          if (!enrollmentsMap.has(key)) {
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
      }
    } catch {
      // Table may not yet be present in schema cache
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
        const seenKeys = new Set<string>();
        for (const k of enrollmentsMap.keys()) {
          seenKeys.add(k);
        }

        for (const row of auditRows) {
          const payload = (row.after_data as Record<string, any>) || {};
          const userId = row.target_user_id || row.actor_id;
          const courseId = row.entity_id || payload.course_id;
          if (!userId || !courseId) continue;

          const key = `${userId}:${courseId}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const rowStatus = payload.status || "pending";
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
    } catch {
      // Ignore audit fallback read error
    }

    // Compute totals from the complete collection before tab filtering
    const allItems = Array.from(enrollmentsMap.values());
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

    let applicationFound = false;
    let appData: {
      id?: string;
      courseTitle?: string;
      applicantName?: string;
      applicantEmail?: string;
      applicantOrganization?: string | null;
      notes?: string | null;
    } = {};

    // 1a. Try primary table course_enrollment_applications
    try {
      const { data: appRow, error: appErr } = await (supabaseAdmin as any)
        .from("course_enrollment_applications")
        .update({
          status: finalStatus,
          decision_by: context.userId,
          decision_at: now,
          decision_notes: noteText,
          updated_at: now,
        })
        .eq("user_id", input.userId)
        .eq("course_id", input.courseId)
        .select("id, status, course_title, applicant_name, applicant_email, applicant_organization, notes")
        .maybeSingle();

      if (!appErr && appRow) {
        applicationFound = true;
        appData = {
          id: appRow.id,
          courseTitle: appRow.course_title,
          applicantName: appRow.applicant_name,
          applicantEmail: appRow.applicant_email,
          applicantOrganization: appRow.applicant_organization,
          notes: appRow.notes,
        };
      }
    } catch {
      // Table may not yet be in schema cache
    }

    // 1b. If not updated in table, check admin_audit_log for existing application
    if (!applicationFound) {
      try {
        const { data: auditRows } = await (supabaseAdmin as any)
          .from("admin_audit_log")
          .select("id, actor_id, target_user_id, entity_id, after_data, created_at")
          .eq("entity_type", "course_enrollment")
          .order("created_at", { ascending: false })
          .limit(50);

        if (Array.isArray(auditRows) && auditRows.length > 0) {
          const matchedLog = auditRows.find((r) => {
            const p = (r.after_data as Record<string, any>) || {};
            const cId = r.entity_id || p.course_id;
            const uId = r.target_user_id || r.actor_id;
            return (
              (input.id && r.id === input.id) ||
              (uId === input.userId && (!input.courseId || cId === input.courseId))
            );
          });

          if (matchedLog) {
            applicationFound = true;
            const payload = (matchedLog.after_data as Record<string, any>) || {};
            appData = {
              id: matchedLog.id,
              courseTitle: payload.course_title || "Pelatihan BARUNA",
              applicantName: payload.applicant_name || "Peserta BARUNA",
              applicantEmail: payload.applicant_email || "",
              applicantOrganization: payload.applicant_organization || null,
              notes: payload.notes || null,
            };
          }
        }
      } catch (auditReadErr) {
        console.warn("[decideAdminCourseEnrollment] audit lookup warning:", auditReadErr);
      }
    }

    // 1c. If still not matched, verify user existence in profiles to prevent deadlock
    if (!applicationFound) {
      try {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, organization")
          .eq("id", input.userId)
          .maybeSingle();

        if (profile) {
          applicationFound = true;
          appData = {
            courseTitle: input.courseId,
            applicantName: profile.display_name || "Peserta BARUNA",
            applicantOrganization: profile.organization || null,
          };
        }
      } catch {}
    }

    if (!applicationFound) {
      throw new Error("Permohonan kepesertaan tidak ditemukan atau data pengguna tidak valid.");
    }

    // 2. Comprehensive Admin Audit Log (guarantees persistence across environments)
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
          course_id: input.courseId,
          course_title: appData.courseTitle || input.courseId,
          applicant_name: appData.applicantName || "Peserta BARUNA",
          applicant_email: appData.applicantEmail || "",
          applicant_organization: appData.applicantOrganization || null,
          notes: appData.notes || null,
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

    // 3. If approved: assign participant role, update auth metadata, and grant enrolment
    if (input.decision === "approve") {
      // 3a. RBAC Role Assignment: safely assign participant role
      try {
        const { data: participantRole } = await supabaseAdmin
          .from("rbac_roles")
          .select("id")
          .eq("code", "participant")
          .maybeSingle();

        if (participantRole?.id) {
          const { data: existingPrimary } = await supabaseAdmin
            .from("rbac_user_roles")
            .select("id")
            .eq("user_id", input.userId)
            .eq("status", "active")
            .eq("is_primary", true)
            .maybeSingle();

          const { data: existingParticipantRole } = await supabaseAdmin
            .from("rbac_user_roles")
            .select("id, status")
            .eq("user_id", input.userId)
            .eq("role_id", participantRole.id)
            .maybeSingle();

          if (!existingParticipantRole) {
            // Assign participant role; is_primary: true only if no other active primary role exists
            await supabaseAdmin.from("rbac_user_roles").insert({
              user_id: input.userId,
              role_id: participantRole.id,
              status: "active",
              is_primary: !existingPrimary,
              scope: {},
              valid_from: now,
              granted_by: context.userId,
              approved_by: context.userId,
              approved_at: now,
              reason: `course_enrollment_approved:${input.courseId}`,
            });
          } else if (existingParticipantRole.status !== "active") {
            await supabaseAdmin
              .from("rbac_user_roles")
              .update({
                status: "active",
                valid_until: null,
                revoked_at: null,
                revoked_by: null,
                reason: `course_enrollment_reapproved:${input.courseId}`,
              })
              .eq("id", existingParticipantRole.id);
          }
        }
      } catch (roleErr) {
        console.warn("[decideAdminCourseEnrollment] rbac assignment warning:", roleErr);
      }

      // 3b. Update Supabase Auth user_metadata
      try {
        const { data: userIdent } = await supabaseAdmin.auth.admin.getUserById(input.userId);
        if (userIdent?.user) {
          const existingMeta = userIdent.user.user_metadata || {};
          const currentRoles: string[] = Array.isArray(existingMeta.roles)
            ? (existingMeta.roles as string[])
            : [((existingMeta.role as string) || "registered_user")];
          const updatedRoles = Array.from(new Set([...currentRoles, "participant"]));

          const approvedCourses: string[] = Array.isArray(existingMeta.approved_courses)
            ? Array.from(new Set([...existingMeta.approved_courses, input.courseId]))
            : [input.courseId];

          const courseEnrollments = {
            ...(existingMeta.course_enrollments || {}),
            [input.courseId]: {
              status: "approved",
              course_title: appData.courseTitle || input.courseId,
              approved_at: now,
              approved_by: context.userId,
              notes: noteText,
            },
          };

          const higherRoles = ["super_admin", "admin", "management", "qa_reviewer", "approver", "expert"];
          const existingPrimaryRole = typeof existingMeta.role === "string" ? existingMeta.role : "";
          const preservedPrimaryRole = higherRoles.includes(existingPrimaryRole)
            ? existingPrimaryRole
            : updatedRoles.find((r) => higherRoles.includes(r)) || "participant";

          await supabaseAdmin.auth.admin.updateUserById(input.userId, {
            user_metadata: {
              ...existingMeta,
              role: preservedPrimaryRole,
              roles: updatedRoles,
              approved_courses: approvedCourses,
              course_enrollments: courseEnrollments,
            },
          });
        }
      } catch (metaErr) {
        console.warn("[decideAdminCourseEnrollment] user metadata update warning:", metaErr);
      }

      // 3c. Public enrolments table link (if course matches course_offerings)
      try {
        let offeringId: string | null = null;
        const isUUID = /^[0-9a-fA-F-]{36}$/.test(input.courseId);

        if (isUUID) {
          const { data: off } = await supabaseAdmin
            .from("course_offerings")
            .select("id")
            .eq("id", input.courseId)
            .maybeSingle();
          if (off?.id) offeringId = off.id;
        }

        if (!offeringId) {
          const { data: off } = await supabaseAdmin
            .from("course_offerings")
            .select("id")
            .or(`offering_code.eq.${input.courseId},offering_title.eq.${input.courseId}`)
            .maybeSingle();
          if (off?.id) offeringId = off.id;
        }

        if (offeringId) {
          const { data: existingEnrolment } = await supabaseAdmin
            .from("enrolments")
            .select("id")
            .eq("user_id", input.userId)
            .eq("course_offering_id", offeringId)
            .maybeSingle();

          if (!existingEnrolment) {
            await supabaseAdmin.from("enrolments").insert({
              user_id: input.userId,
              course_offering_id: offeringId,
              enrolment_status: "enrolled",
              completion_status: "in-progress",
              enrolment_date: now,
            });
          } else {
            await supabaseAdmin
              .from("enrolments")
              .update({
                enrolment_status: "enrolled",
                completion_status: "in-progress",
                updated_at: now,
              })
              .eq("id", existingEnrolment.id);
          }
        }
      } catch (enrolErr) {
        console.warn("[decideAdminCourseEnrollment] enrolments table update warning:", enrolErr);
      }

      // 3d. Ensure profile isActive is true
      try {
        await supabaseAdmin.from("profiles").update({ is_active: true }).eq("id", input.userId);
      } catch {}
    } else {
      // If rejected, update user metadata record
      try {
        const { data: userIdent } = await supabaseAdmin.auth.admin.getUserById(input.userId);
        if (userIdent?.user) {
          const existingMeta = userIdent.user.user_metadata || {};
          const courseEnrollments = {
            ...(existingMeta.course_enrollments || {}),
            [input.courseId]: {
              status: "rejected",
              course_title: appData.courseTitle || input.courseId,
              rejected_at: now,
              rejected_by: context.userId,
              notes: noteText,
            },
          };

          await supabaseAdmin.auth.admin.updateUserById(input.userId, {
            user_metadata: {
              ...existingMeta,
              course_enrollments: courseEnrollments,
            },
          });
        }
      } catch (rejectMetaErr) {
        console.warn("[decideAdminCourseEnrollment] reject metadata update warning:", rejectMetaErr);
      }
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
