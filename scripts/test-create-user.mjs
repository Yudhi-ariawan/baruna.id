// Live test of "Tambah User" (createUser) through the running app (npm run dev).
// An admin without users.assign_role must not create an account that silently
// lacks the requested roles; failures are reported and the audit tells the truth.
// Creates temporary accounts (@example.test) and deletes everything afterwards.
// Run: npm run dev (other terminal), then npm run test:create-user
import { createClient } from "@supabase/supabase-js";
import { toJSONAsync, fromCrossJSON } from "seroval";

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const APP = (process.env.CONSOLE_TEST_URL || process.env.APP_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
const PASSWORD = `Tdd-${stamp}-Aa1!`;
const created = [];
let passed = 0, failed = 0;
const check = (cond, label) => { if (cond) { passed++; console.log("  ok  ", label); } else { failed++; console.log("  FAIL", label); } };
const FILE = "/src/lib/admin/users.functions.ts";
const fnId = (exp) => Buffer.from(JSON.stringify({ file: `${FILE}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");

async function callFn(token, exp, data, method) {
  const headers = { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${token}` };
  const res = method === "GET"
    ? await fetch(`${APP}/_serverFn/${fnId(exp)}`, { headers })
    : await fetch(`${APP}/_serverFn/${fnId(exp)}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(await toJSONAsync({ data })) });
  const text = await res.text();
  try { const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] }); return { result: v?.result, error: v?.error }; }
  // A thrown Error is serialized with a plugin this decoder lacks: keep the raw
  // response so the error code in it can still be checked.
  catch (e) { return { error: { message: `decode: ${e.message} ${text}` } }; }
}

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-create-user-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_create_user_test" });
  if (e) throw new Error(e.message);
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(se.message);
  return { id: u.user.id, token: s.session.access_token };
}
const userByEmail = async (email) => {
  const { data } = await svc.auth.admin.listUsers({ perPage: 1000 });
  return data.users.find((u) => u.email === email) ?? null;
};
const activeRoles = async (uid) => ((await svc.from("rbac_user_roles").select("status, rbac_roles!inner(code)").eq("user_id", uid).eq("status", "active")).data ?? [])
  .map((r) => r.rbac_roles.code).sort();
const newUser = (tag, roles) => ({ email: `tdd-create-user-new-${tag}-${stamp}@example.test`, password: PASSWORD, displayName: `TDD Baru ${tag}`,
  organization: "KKP", jobTitle: "Staf", phone: "+6281234567890", roles, emailConfirm: true });

try {
  try { await fetch(APP, { method: "HEAD" }); } catch { throw new Error(`aplikasi tidak berjalan di ${APP} (jalankan npm run dev)`); }
  // The dev server registers a server function once a page that imports it was
  // rendered ("Invalid server function ID" before that).
  await fetch(`${APP}/admin/users`).then((r) => r.text()).catch(() => null);
  const admin = await persona("admin", "admin");
  const superAdmin = await persona("super", "super_admin");

  console.log("\n== izin di layar");
  const accA = await callFn(admin.token, "getAdminAccess", undefined, "GET");
  const accS = await callFn(superAdmin.token, "getAdminAccess", undefined, "GET");
  check(accA.result?.canAssignRoles === false, `admin biasa: canAssignRoles = false (${accA.result?.canAssignRoles ?? accA.error?.message})`);
  check(accS.result?.canAssignRoles === true, `super admin: canAssignRoles = true (${accS.result?.canAssignRoles ?? accS.error?.message})`);

  console.log("\n== admin biasa meminta peran reviewer");
  const a1 = newUser("a1", ["registered_user", "reviewer"]);
  const r1 = await callFn(admin.token, "createUser", a1, "POST");
  const u1 = await userByEmail(a1.email);
  if (u1) created.push(u1.id);
  check(/role_assignment_forbidden/.test(r1.error?.message ?? ""), `ditolak dengan pesan jelas (${r1.error?.message ?? "TIDAK DITOLAK"})`);
  check(!u1, "akun TIDAK dibuat setengah jadi");

  console.log("\n== admin biasa, Registered User saja");
  const a2 = newUser("a2", ["registered_user"]);
  const r2 = await callFn(admin.token, "createUser", a2, "POST");
  const u2 = await userByEmail(a2.email);
  if (u2) created.push(u2.id);
  check(!r2.error && r2.result?.failedRoles?.length === 0, `akun dibuat tanpa kegagalan (${r2.error?.message ?? "ok"})`);
  check(u2 && (await activeRoles(u2.id)).join() === "registered_user", "peran sesuai: registered_user");

  console.log("\n== super admin memberi peran reviewer");
  const s1 = newUser("s1", ["registered_user", "reviewer"]);
  const r3 = await callFn(superAdmin.token, "createUser", s1, "POST");
  const u3 = await userByEmail(s1.email);
  if (u3) created.push(u3.id);
  check(!r3.error && r3.result?.roles?.includes("reviewer") && r3.result?.failedRoles?.length === 0, `berhasil (${r3.error?.message ?? JSON.stringify(r3.result?.roles)})`);
  check(u3 && (await activeRoles(u3.id)).join() === "registered_user,reviewer", `peran di database: ${u3 ? (await activeRoles(u3.id)).join() : "-"}`);
  const { data: audit } = await svc.from("admin_audit_log").select("after_data").eq("target_user_id", u3?.id ?? "00000000-0000-0000-0000-000000000000").eq("event_type", "user_created").limit(1);
  check(JSON.stringify(audit?.[0]?.after_data?.roles ?? []) === JSON.stringify(["registered_user", "reviewer"]), "audit mencatat peran yang benar-benar diberikan");
} catch (e) {
  failed++;
  console.log("  FAIL", e.message);
} finally {
  for (const id of created) {
    await svc.from("admin_audit_log").delete().eq("target_user_id", id);
    await svc.from("admin_audit_log").delete().eq("actor_id", id);
    await svc.from("rbac_user_roles").delete().eq("user_id", id);
    await svc.from("profiles").delete().eq("id", id);
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) console.log("cleanup user", id, error.message);
  }
  const { data } = await svc.auth.admin.listUsers({ perPage: 1000 });
  console.log(`Akun uji tersisa: ${data.users.filter((u) => u.email?.includes(`-${stamp}@example.test`)).length}`);
}
console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed ? 1 : 0);
