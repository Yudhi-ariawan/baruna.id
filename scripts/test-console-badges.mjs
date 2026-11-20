/**
 * Live test: sidebar badges (CATATAN_PERBAIKAN 2bf) against the database in .env and the
 * running app (npm run dev; CONSOLE_TEST_URL or APP_BASE_URL). Checks that each count
 * equals the queue's own "waiting" rule, that a role only gets counts for menus it may
 * open, and that a new item raises the count.
 *
 * It WRITES test data (accounts @example.test, one role request, audit rows) and removes
 * everything at the end.
 * Run: npm run test:console-badges
 */
import { createClient } from "@supabase/supabase-js";
import { toJSONAsync, fromCrossJSON } from "seroval";

const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const APP = (process.env.CONSOLE_TEST_URL || process.env.APP_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
if (!URL_ || !SERVICE || !ANON) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}
const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const PASSWORD = "TddBadge!2026#";
const created = [];
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };

const FILE = "/src/lib/governance/console-badges.functions.ts";
const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function getFn(token, exp, file = FILE) {
  const headers = { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${token}` };
  const payload = JSON.stringify(await toJSONAsync({ data: undefined }));
  const text = await (await fetch(`${APP}/_serverFn/${fnId(file, exp)}?payload=${encodeURIComponent(payload)}`, { headers })).text();
  try {
    const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] });
    return v?.result !== undefined ? { data: v.result } : { error: String(v?.error?.message ?? text.slice(0, 120)) };
  } catch {
    return { error: text.slice(0, 160) };
  }
}

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-badge-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_badge_test" });
    if (e) throw new Error(e.message);
  }
  await new Promise((r) => setTimeout(r, 1500));
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: le } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (le) throw new Error(le.message);
  return { id: u.user.id, c, token: s.session.access_token };
}

const count = async (q) => (await q).count ?? 0;
const head = (t) => svc.from(t).select("id", { count: "exact", head: true });
const review = (kind) => head("review_subjects").eq("kind", kind).in("current_status", ["pending", "under_review", "decision_pending"]);
async function expected() {
  return {
    experts: await count(review("expert")),
    modules: await count(review("module")),
    publications: await count(review("knowledge_resource")),
    trainingNeeds: await count(review("training_need")),
    enrollments: await count(head("course_enrollment_applications").eq("status", "pending")),
    completions: await count(head("course_completions").eq("status", "pending_review")),
    programs: await count(head("academy_program_drafts").eq("status", "submitted")),
    masterData: await count(head("master_data_change_requests").eq("status", "pending")),
    // Konten Situs (CMS, 2br): drafts waiting for a decision + new submissions of "notify" forms.
    cms: await count(head("cms_drafts").eq("status", "submitted")) +
      await count(svc.from("cms_form_submissions").select("id, cms_forms!inner(notify_on_submit)", { count: "exact", head: true })
        .eq("status", "new").eq("cms_forms.notify_on_submit", true)),
  };
}

await fetch(APP + FILE);
try {
  const superA = await persona("super", "super_admin");
  const reviewer = await persona("reviewer", "reviewer");
  const user = await persona("user", null);

  console.log("1. Angka sama dengan antrean");
  const exp = await expected();
  let r = await getFn(superA.token, "getConsoleBadges");
  check(r.data && Object.keys(exp).every((k) => r.data[k] === exp[k]), `super admin: kesembilan antrean cocok (${JSON.stringify(r.data ?? r.error).slice(0, 160)} vs ${JSON.stringify(exp)})`);

  console.log("2. Hanya menu yang boleh dibuka");
  r = await getFn(reviewer.token, "getConsoleBadges");
  const keys = Object.keys(r.data ?? {}).sort();
  // The menus the console itself opens for this account (same rule as the sidebar).
  const acc = await getFn(reviewer.token, "getGovernanceConsoleAccess", "/src/lib/governance/console-access.functions.ts");
  const readable = Object.entries(acc.data?.menus ?? {}).filter(([k, m]) => m.read && k in exp).map(([k]) => k).sort();
  check(keys.length > 0 && JSON.stringify(keys) === JSON.stringify(readable) && !keys.includes("enrollments") && !keys.includes("masterData"),
    `reviewer hanya mendapat angka menu yang boleh dibukanya (${keys.join(",") || r.error} = ${readable.join(",") || acc.error})`);
  r = await getFn(user.token, "getConsoleBadges");
  check(r.data && Object.keys(r.data).length === 0, `pengguna tanpa peran kurasi tidak mendapat angka (${JSON.stringify(r.data ?? r.error).slice(0, 60)})`);
  r = await getFn(reviewer.token, "getAdminBadges");
  check(/forbidden/.test(r.error ?? ""), "reviewer tidak bisa membaca angka Portal Admin");

  console.log("3. Item baru menaikkan angka");
  r = await getFn(superA.token, "getAdminBadges");
  const before = r.data?.accessRequests;
  const pendingNow = await count(head("rbac_role_change_requests").eq("status", "pending"));
  check(before === pendingNow, `angka Permintaan Akses cocok (${before} vs ${pendingNow})`);
  // Penugasan Expert (2bx): requests waiting for an admin step.
  const srNow = await count(head("expert_service_requests").in("status", ["submitted", "under_review", "expert_matching"]));
  check(r.data?.serviceRequests === srNow, `angka Penugasan Expert cocok (${r.data?.serviceRequests} vs ${srNow})`);
  const req = await user.c.rpc("request_rbac_role_change", { _target_user_id: user.id, _role_code: "reviewer", _action: "grant", _reason: "Uji angka sidebar untuk permintaan akses baru." });
  check(!req.error, `permintaan uji dibuat (${req.error?.message ?? "ok"})`);
  r = await getFn(superA.token, "getAdminBadges");
  check(r.data?.accessRequests === before + 1, `angka naik satu (${before} → ${r.data?.accessRequests})`);
} finally {
  console.log("\nMembersihkan data uji...");
  if (created.length) {
    await svc.from("rbac_role_change_requests").delete().in("target_user_id", created);
    await svc.from("admin_audit_log").delete().in("actor_id", created);
    await svc.from("admin_audit_log").delete().in("target_user_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) { const { error } = await svc.auth.admin.deleteUser(id); if (error) { left++; console.log("  gagal hapus user", id, error.message); } }
  console.log(left ? `Tersisa: ${left} akun.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
