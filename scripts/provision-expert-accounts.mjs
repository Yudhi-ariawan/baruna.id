import { createClient } from "@supabase/supabase-js";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "EXPERT_DEFAULT_PASSWORD"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: experts, error: expertError } = await supabase
  .from("experts_directory_v")
  .select("id,slug,display_name,institution,institution_role")
  .order("display_name");
if (expertError) throw expertError;

const { data: roles, error: roleError } = await supabase
  .from("rbac_roles")
  .select("id,code")
  .in("code", ["registered_user", "expert"]);
if (roleError) throw roleError;
const roleIds = Object.fromEntries(roles.map((role) => [role.code, role.id]));
if (!roleIds.registered_user || !roleIds.expert) throw new Error("Required RBAC roles are missing");

let authUsers = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  authUsers.push(...data.users);
  if (data.users.length < 1000) break;
}

const summary = [];
for (const expert of experts) {
  const email = `${expert.slug.replaceAll("-", ".")}@baruna.id`;
  let user = authUsers.find((candidate) => candidate.email?.toLowerCase() === email);

  if (user) {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: process.env.EXPERT_DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        display_name: expert.display_name,
        organization: expert.institution ?? "BARUNA Network",
        job_title: expert.institution_role ?? "Expert",
        phone: "+6280000000000",
        expert_id: expert.id,
      },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: process.env.EXPERT_DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: expert.display_name,
        organization: expert.institution ?? "BARUNA Network",
        job_title: expert.institution_role ?? "Expert",
        phone: "+6280000000000",
        expert_id: expert.id,
      },
    });
    if (error) throw error;
    user = data.user;
    authUsers.push(user);
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: expert.display_name,
    organization: expert.institution ?? "BARUNA Network",
    job_title: expert.institution_role ?? "Expert",
    phone: "+6280000000000",
    is_active: true,
  });
  if (profileError) throw profileError;

  const { error: linkError } = await supabase
    .from("experts")
    .update({ original_contributor_id: user.id })
    .eq("id", expert.id);
  if (linkError) throw linkError;

  const { data: assignments, error: assignmentError } = await supabase
    .from("rbac_user_roles")
    .select("id,role_id")
    .eq("user_id", user.id)
    .in("role_id", [roleIds.registered_user, roleIds.expert]);
  if (assignmentError) throw assignmentError;

  for (const [code, roleId] of Object.entries(roleIds)) {
    const existing = assignments.find((assignment) => assignment.role_id === roleId);
    const values = {
      status: "active",
      // The signup trigger already establishes the mandatory single primary
      // role. Role display uses hierarchy, so Expert need not replace it here.
      is_primary: existing ? undefined : false,
      valid_from: new Date().toISOString(),
      valid_until: null,
      revoked_at: null,
      revoked_by: null,
      scope: {},
      reason: "official_expert_account_provisioning",
    };
    const query = existing
      ? supabase.from("rbac_user_roles").update(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))).eq("id", existing.id)
      : supabase.from("rbac_user_roles").insert({ user_id: user.id, role_id: roleId, ...values });
    const { error } = await query;
    if (error) throw error;
  }

  summary.push({
    name: expert.display_name,
    institution: expert.institution ?? "BARUNA Network",
    email,
    userId: user.id,
    expertId: expert.id,
  });
}

console.log(JSON.stringify(summary, null, 2));
