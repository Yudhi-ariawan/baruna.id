// Live test: the `expert` role cannot be ticked/unticked or requested by hand
// (migration 20261021080000). Creates temporary @example.test accounts and deletes them.
// Run: npm run test:expert-role-lock
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = `Tdd-${Math.random().toString(36).slice(2)}-Aa1!`;
const stamp = Date.now();
const created = [];
let passed = 0, failed = 0;
const check = (cond, label) => { if (cond) { passed++; console.log("  ok  ", label); } else { failed++; console.log("  FAIL", label); } };

async function retry(fn, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= tries || !/fetch failed|timeout|ECONNRESET/i.test(String(e?.message ?? e))) throw e; await new Promise((r) => setTimeout(r, 1500 * i)); }
  }
}

async function makeUser(label, extraRole) {
  const email = `tdd-role-lock-${label}-${stamp}@example.test`;
  const { data: u, error } = await retry(() => admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } }));
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (extraRole) {
    const { data: role, error: roleErr } = await admin.from("rbac_roles").select("id").eq("code", extraRole).single();
    if (roleErr) throw new Error(roleErr.message);
    const { error: insErr } = await admin.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: role.id, is_primary: false, status: "active", reason: "tdd_role_lock_test" });
    if (insErr) throw new Error(insErr.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: signErr } = await retry(() => c.auth.signInWithPassword({ email, password: PASSWORD }));
  if (signErr) throw new Error(signErr.message);
  return { id: u.user.id, client: c };
}

const activeRoles = async (userId) => {
  const { data, error } = await admin.from("rbac_user_roles").select("rbac_roles(code)").eq("user_id", userId).eq("status", "active");
  if (error) throw new Error(error.message);
  return data.map((r) => r.rbac_roles?.code).sort();
};

try {
  // users.assign_role is held by super_admin only (rbac_role_permissions).
  const boss = await makeUser("superadmin", "super_admin");
  const target = await makeUser("target");
  const rpc = (c, fn, args) => c.rpc(fn, args);

  console.log("\n== admin mencentang / mencabut");
  let r = await rpc(boss.client, "assign_rbac_role", { _target_user_id: target.id, _role_code: "expert" });
  check(r.error?.message === "expert_role_managed_by_flow", `assign expert ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
  check(!(await activeRoles(target.id)).includes("expert"), "target tetap tanpa peran expert");

  r = await rpc(boss.client, "assign_rbac_role", { _target_user_id: target.id, _role_code: "publisher" });
  check(!r.error, `assign publisher tetap bisa (${r.error?.message ?? "ok"})`);
  check((await activeRoles(target.id)).includes("publisher"), "target kini publisher");
  r = await rpc(boss.client, "revoke_rbac_role", { _target_user_id: target.id, _role_code: "publisher" });
  check(!r.error && !(await activeRoles(target.id)).includes("publisher"), `revoke publisher tetap bisa (${r.error?.message ?? "ok"})`);

  // An expert whose role came from somewhere else: unticking must also be refused.
  const { data: expertRole } = await admin.from("rbac_roles").select("id").eq("code", "expert").single();
  await admin.from("rbac_user_roles").insert({ user_id: target.id, role_id: expertRole.id, is_primary: false, status: "active", reason: "tdd_role_lock_test" });
  r = await rpc(boss.client, "revoke_rbac_role", { _target_user_id: target.id, _role_code: "expert" });
  check(r.error?.message === "expert_role_managed_by_flow", `revoke expert ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
  check((await activeRoles(target.id)).includes("expert"), "peran expert tidak tercabut");
  await admin.from("rbac_user_roles").delete().eq("user_id", target.id).eq("role_id", expertRole.id);

  console.log("\n== permintaan peran");
  const self = await makeUser("self");
  r = await rpc(self.client, "request_rbac_role_change", { _target_user_id: self.id, _role_code: "expert", _action: "grant", _reason: "uji" });
  check(r.error?.message === "expert_role_managed_by_flow", `pengguna meminta expert untuk dirinya ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
  const { count } = await admin.from("rbac_role_change_requests").select("id", { count: "exact", head: true }).eq("target_user_id", self.id);
  check(count === 0, "tidak ada permintaan yang tersimpan");

  console.log("\n== pengunjung tanpa login");
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  r = await rpc(anon, "assign_rbac_role", { _target_user_id: target.id, _role_code: "publisher" });
  check(Boolean(r.error), `anon tidak bisa memanggil assign_rbac_role (${r.error?.code ?? "TERBUKA"})`);
} catch (e) {
  failed++;
  console.log("  FAIL", e.message);
} finally {
  // Role rows first (they may point at another test account as granter), then accounts.
  for (const id of created) {
    await admin.from("rbac_role_change_requests").delete().eq("target_user_id", id);
    await admin.from("rbac_user_roles").delete().eq("user_id", id);
  }
  for (const id of created) {
    await admin.from("profiles").delete().eq("id", id);
    const { error } = await retry(() => admin.auth.admin.deleteUser(id));
    if (error) console.log("cleanup", id, error.message);
  }
}
console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed ? 1 : 0);
