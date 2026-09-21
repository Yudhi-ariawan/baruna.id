import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;
const expertSlug = process.env.EXPERT_SLUG;

if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase Admin credentials");
if (!email || !password || !expertSlug) {
  throw new Error("Set TEST_USER_EMAIL, TEST_USER_PASSWORD, and EXPERT_SLUG");
}
if (password.length < 12) throw new Error("Test account password must contain at least 12 characters");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(targetEmail) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === targetEmail.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  return null;
}

const { data: expert, error: expertError } = await admin
  .from("experts")
  .select("id, display_name, slug, current_status, visibility")
  .eq("slug", expertSlug)
  .single();
if (expertError || !expert) throw expertError ?? new Error("Expert not found");
if (expert.current_status !== "published" || expert.visibility !== "public") {
  throw new Error("Expert must be published and public before account linking");
}

const { data: employment } = await admin
  .from("expert_employment")
  .select("organization, role")
  .eq("expert_id", expert.id)
  .eq("is_current", true)
  .order("updated_at", { ascending: false })
  .limit(1)
  .maybeSingle();
const userMetadata = {
  display_name: expert.display_name,
  organization: employment?.organization ?? "BARUNA",
  job_title: employment?.role ?? "BARUNA Trainer",
  phone: "+6280000000000",
};

let user = await findUserByEmail(email);
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });
  if (error) throw error;
  user = data.user;
} else {
  const { data, error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { ...user.user_metadata, ...userMetadata },
  });
  if (error) throw error;
  user = data.user;
}

const { data: roles, error: rolesError } = await admin
  .from("rbac_roles")
  .select("id, code")
  .in("code", ["registered_user", "expert"]);
if (rolesError) throw rolesError;
const roleIds = Object.fromEntries(roles.map((role) => [role.code, role.id]));
if (!roleIds.registered_user || !roleIds.expert) throw new Error("Required RBAC roles are missing");

const { error: registeredError } = await admin.from("rbac_user_roles").upsert(
  {
    user_id: user.id,
    role_id: roleIds.registered_user,
    status: "active",
    is_primary: true,
    valid_from: new Date().toISOString(),
    scope: {},
    reason: "expert_test_account",
  },
  { onConflict: "user_id,role_id" },
);
if (registeredError) throw registeredError;

const { error: expertRoleError } = await admin.from("rbac_user_roles").upsert(
  {
    user_id: user.id,
    role_id: roleIds.expert,
    status: "active",
    is_primary: false,
    valid_from: new Date().toISOString(),
    scope: { expert_id: expert.id },
    reason: "linked_existing_expert",
  },
  { onConflict: "user_id,role_id" },
);
if (expertRoleError) throw expertRoleError;

const { error: linkError } = await admin
  .from("experts")
  .update({ original_contributor_id: user.id })
  .eq("id", expert.id);
if (linkError) throw linkError;

const now = new Date().toISOString();
const { data: activeStatus, error: statusReadError } = await admin
  .from("expert_trainer_status")
  .select("id, trainer_status, trainer_level")
  .eq("expert_id", expert.id)
  .eq("trainer_status", "active")
  .lte("effective_from", now)
  .or(`expires_at.is.null,expires_at.gt.${now}`)
  .order("version", { ascending: false })
  .limit(1)
  .maybeSingle();
if (statusReadError) throw statusReadError;

let trainerStatus = activeStatus;
if (!trainerStatus) {
  const { data: latest } = await admin
    .from("expert_trainer_status")
    .select("version, trainer_level, unique_graduated_participants")
    .eq("expert_id", expert.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await admin
    .from("expert_trainer_status")
    .insert({
      expert_id: expert.id,
      trainer_status: "active",
      trainer_level: latest?.trainer_level === "not_assigned" || !latest?.trainer_level ? "certified" : latest.trainer_level,
      unique_graduated_participants: latest?.unique_graduated_participants ?? 0,
      granted_by: user.id,
      effective_from: now,
      rationale: "Existing expert test account activation",
      version: (latest?.version ?? 0) + 1,
    })
    .select("id, trainer_status, trainer_level")
    .single();
  if (error) throw error;
  trainerStatus = data;
}

await admin.from("admin_audit_log").insert({
  event_type: "expert.test_account_linked",
  actor_id: user.id,
  target_user_id: user.id,
  entity_type: "expert",
  entity_id: expert.id,
  after_data: {
    email,
    expert_slug: expert.slug,
    roles: ["registered_user", "expert"],
    trainer_status: trainerStatus.trainer_status,
    trainer_level: trainerStatus.trainer_level,
  },
  metadata: { script: "create-expert-trainer-login" },
});

console.log(JSON.stringify({
  ok: true,
  userId: user.id,
  email,
  emailConfirmed: Boolean(user.email_confirmed_at),
  expert: { id: expert.id, displayName: expert.display_name, slug: expert.slug },
  roles: ["registered_user", "expert"],
  trainerStatus: trainerStatus.trainer_status,
  trainerLevel: trainerStatus.trainer_level,
  portal: "/experts/portal",
}, null, 2));
