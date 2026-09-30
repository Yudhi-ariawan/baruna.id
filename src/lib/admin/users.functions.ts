import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasPermission, requirePermission } from "@/lib/auth/permissions.server";

// Phase 2 tables are not present in the older generated Database type yet.
// Keep the temporary untyped boundary isolated to this server-only module.
/* eslint-disable @typescript-eslint/no-explicit-any */

const RoleCode = z.enum([
  "super_admin",
  "admin",
  "management",
  "qa_reviewer",
  "registered_user",
  "participant",
  "expert",
  "operator",
  "reviewer",
  "verifier",
  "approver",
  "publisher",
]);
const UserId = z.string().uuid();

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  phone: string | null;
  jobTitle: string | null;
  organization: string | null;
  isActive: boolean;
  bannedUntil: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  createdAt: string;
  roles: string[];
};

export type AdminAccess = {
  canReadUsers: boolean;
  canUpdateUsers: boolean;
  canInviteUsers: boolean;
  canSuspendUsers: boolean;
  canAssignRoles: boolean;
  canReadAudit: boolean;
};

export type AdminRole = { code: string; name: string; description: string | null };
export type AdminRoleCode = z.infer<typeof RoleCode>;
export type AdminAuditEvent = {
  id: string;
  event_type: string;
  actor_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function writeAudit(
  actorId: string,
  targetUserId: string | null,
  eventType: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  metadata: Record<string, unknown> = {},
) {
  const admin = await loadAdmin();
  const { error } = await admin.rpc(
    "log_admin_event" as never,
    {
      _event_type: eventType,
      _actor_id: actorId,
      _target_user_id: targetUserId,
      _entity_type: "user",
      _entity_id: targetUserId,
      _before: before,
      _after: after,
      _metadata: metadata,
    } as never,
  );
  if (error) throw new Error(error.message);
}

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    canReadUsers: await hasPermission(context, "users.read"),
    canUpdateUsers: await hasPermission(context, "users.update"),
    canInviteUsers: await hasPermission(context, "users.invite"),
    canSuspendUsers: await hasPermission(context, "users.suspend"),
    canAssignRoles: await hasPermission(context, "users.assign_role"),
    canReadAudit: await hasPermission(context, "audit.read"),
  }));

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ search: z.string().trim().max(120).default("") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context, "users.read");
    const admin = await loadAdmin();
    const collected = [];
    let page = 1;

    // Admin API is the source of truth for auth.users. Fetch in bounded pages;
    // profile and role data are joined server-side and never queried by browser.
    while (page <= 20) {
      const { data: pageData, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw new Error(error.message);
      collected.push(...pageData.users);
      if (pageData.users.length < 100) break;
      page += 1;
    }

    const userIds = collected.map((user) => user.id);
    if (userIds.length === 0) return { users: [] as AdminUser[], total: 0 };

    const db = admin as any;
    const [{ data: profiles, error: profileError }, { data: assignments, error: roleError }] =
      await Promise.all([
        db
          .from("profiles")
          .select("id, display_name, avatar_url, phone, job_title, organization, is_active")
          .in("id", userIds),
        db.from("rbac_user_roles").select("user_id, rbac_roles(code)").in("user_id", userIds),
      ]);
    if (profileError) throw new Error(profileError.message);
    if (roleError) throw new Error(roleError.message);

    const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
    const roleMap = new Map<string, string[]>();
    for (const assignment of assignments ?? []) {
      const code = assignment.rbac_roles?.code;
      if (!code) continue;
      roleMap.set(assignment.user_id, [...(roleMap.get(assignment.user_id) ?? []), code]);
    }

    const term = data.search.toLocaleLowerCase();
    const users = collected
      .map((user): AdminUser => {
        const profile: any = profileMap.get(user.id);
        return {
          id: user.id,
          email: user.email ?? "",
          displayName:
            profile?.display_name ??
            user.user_metadata?.display_name ??
            user.user_metadata?.full_name ??
            "",
          avatarUrl: profile?.avatar_url ?? null,
          phone: profile?.phone ?? user.phone ?? null,
          jobTitle: profile?.job_title ?? null,
          organization: profile?.organization ?? null,
          isActive: profile?.is_active ?? true,
          bannedUntil: user.banned_until ?? null,
          emailConfirmedAt: user.email_confirmed_at ?? null,
          lastSignInAt: user.last_sign_in_at ?? null,
          createdAt: user.created_at,
          roles: (roleMap.get(user.id) ?? []).sort(),
        };
      })
      .filter((user) => {
        if (!term) return true;
        return [user.email, user.displayName, user.organization, user.jobTitle, user.id]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase().includes(term));
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { users, total: users.length };
  });

export const listRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePermission(context, "roles.read");
    const admin = (await loadAdmin()) as any;
    const { data, error } = await admin
      .from("rbac_roles")
      .select("code, name, description")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email().max(254),
        displayName: z.string().trim().min(2).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context, "users.invite");
    const admin = await loadAdmin();
    const redirectTo = `${process.env.APP_BASE_URL ?? "https://baruna.id"}/auth?mode=invite`;
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(data.email, {
      data: { display_name: data.displayName },
      redirectTo,
    });
    if (error) throw new Error(error.message);
    if (!invited.user) throw new Error("invite_user_missing");
    await writeAudit(context.userId, invited.user.id, "user_invited", null, {
      email: data.email,
      display_name: data.displayName,
    });
    return { id: invited.user.id, email: invited.user.email ?? data.email };
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email("Invalid email address").max(254),
        password: z.string().min(8, "Password must be at least 8 characters").max(128),
        displayName: z.string().trim().min(2, "Full name must be at least 2 characters").max(120),
        organization: z.string().trim().max(160).optional(),
        jobTitle: z.string().trim().max(120).optional(),
        phone: z.string().trim().max(40).optional(),
        roles: z.array(RoleCode).min(1, "Select at least one role"),
        emailConfirm: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context, "users.invite");
    const admin = await loadAdmin();
    const db = admin as any;

    const org = data.organization?.trim() || "BARUNA";
    const title = data.jobTitle?.trim() || "Staff";
    const tel = data.phone?.trim() || "-";

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: data.emailConfirm,
      user_metadata: {
        display_name: data.displayName,
        full_name: data.displayName,
        organization: org,
        job_title: title,
        phone: tel,
      },
    });

    if (createError) throw new Error(createError.message);
    if (!created.user) throw new Error("user_creation_failed");

    const targetUserId = created.user.id;

    // Ensure profile reflects any supplied fields accurately
    await db
      .from("profiles")
      .update({
        display_name: data.displayName,
        organization: data.organization?.trim() || null,
        job_title: data.jobTitle?.trim() || null,
        phone: data.phone?.trim() || null,
        is_active: true,
      })
      .eq("id", targetUserId);

    // Assign all selected roles to the newly created user
    for (const role of data.roles) {
      const { error: roleError } = await context.supabase.rpc(
        "assign_rbac_role" as never,
        {
          _target_user_id: targetUserId,
          _role_code: role,
        } as never,
      );
      if (roleError) {
        console.error(`[createUser] Failed assigning role ${role} to ${targetUserId}:`, roleError);
      }
    }

    await writeAudit(context.userId, targetUserId, "user_created", null, {
      email: data.email,
      display_name: data.displayName,
      roles: data.roles,
    });

    return { id: targetUserId, email: created.user.email ?? data.email, roles: data.roles };
  });


export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: UserId,
        displayName: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(40).nullable(),
        jobTitle: z.string().trim().max(120).nullable(),
        organization: z.string().trim().max(160).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requirePermission(context, "users.update");
    const admin = (await loadAdmin()) as any;
    const { data: before, error: beforeError } = await admin
      .from("profiles")
      .select("display_name, phone, job_title, organization")
      .eq("id", data.userId)
      .single();
    if (beforeError) throw new Error(beforeError.message);
    const after = {
      display_name: data.displayName,
      phone: data.phone || null,
      job_title: data.jobTitle || null,
      organization: data.organization || null,
    };
    const { error } = await admin.from("profiles").update(after).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await writeAudit(context.userId, data.userId, "user_profile_updated", before, after);
    return { ok: true };
  });

export const assignUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: UserId, role: RoleCode }).parse(input))
  .handler(async ({ data, context }) => {
    await requirePermission(context, "users.assign_role");
    const { error } = await context.supabase.rpc(
      "assign_rbac_role" as never,
      {
        _target_user_id: data.userId,
        _role_code: data.role,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: UserId, role: RoleCode }).parse(input))
  .handler(async ({ data, context }) => {
    await requirePermission(context, "users.assign_role");
    const { error } = await context.supabase.rpc(
      "revoke_rbac_role" as never,
      {
        _target_user_id: data.userId,
        _role_code: data.role,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: UserId, suspended: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await requirePermission(context, "users.suspend");
    if (data.suspended && data.userId === context.userId) throw new Error("self_lockout_protected");

    const { error: statusError } = await context.supabase.rpc(
      "set_user_active" as never,
      {
        _target_user_id: data.userId,
        _is_active: !data.suspended,
      } as never,
    );
    if (statusError) throw new Error(statusError.message);

    const admin = await loadAdmin();
    const { error: authError } = await admin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.suspended ? "876000h" : "none",
    });
    if (authError) {
      await context.supabase.rpc(
        "set_user_active" as never,
        {
          _target_user_id: data.userId,
          _is_active: data.suspended,
        } as never,
      );
      throw new Error(authError.message);
    }
    return { ok: true };
  });

export const listUserAccessHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: UserId }).parse(input))
  .handler(async ({ data, context }) => {
    await requirePermission(context, "audit.read");
    const admin = (await loadAdmin()) as any;
    const { data: events, error } = await admin
      .from("admin_audit_log")
      .select("id, event_type, actor_id, before_data, after_data, metadata, created_at")
      .eq("target_user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return events ?? [];
  });
