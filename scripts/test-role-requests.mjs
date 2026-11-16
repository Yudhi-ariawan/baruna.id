/**
 * Live test: Permintaan Akses / Peran (Slide 42, LS-01; CATATAN_PERBAIKAN 2be) against
 * the database in .env and the running app (npm run dev; CONSOLE_TEST_URL or APP_BASE_URL).
 * Goes through the real server functions (My Profile, Admin Portal, notifications).
 *
 * It WRITES test data (accounts @example.test, role requests, roles, audit rows) and
 * removes everything at the end.
 * Run: npm run test:role-requests
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
const PASSWORD = "TddRole!2026#";
const created = [];
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };

const ACCOUNT = "/src/lib/account/role-requests.functions.ts";
const ADMIN = "/src/lib/admin/role-requests.functions.ts";
const NOTIF = "/src/lib/notifications/notifications.functions.ts";
const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function callFn(token, file, exp, data, method = "POST") {
  const headers = { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${token}` };
  const payload = JSON.stringify(await toJSONAsync({ data }));
  const res = method === "GET"
    ? await fetch(`${APP}/_serverFn/${fnId(file, exp)}?payload=${encodeURIComponent(payload)}`, { headers })
    : await fetch(`${APP}/_serverFn/${fnId(file, exp)}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: payload });
  const text = await res.text();
  try {
    const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] });
    return v?.result !== undefined ? { data: v.result } : { error: String(v?.error?.message ?? text.slice(0, 120)) };
  } catch {
    const m = text.match(/"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"\}/);
    return { error: m ? JSON.parse(`"${m[1]}"`) : text.slice(0, 160) };
  }
}

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-role-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_role_test" });
    if (e) throw new Error(e.message);
  }
  // valid_from is set by the database clock; wait until this machine's clock passes it.
  await new Promise((r) => setTimeout(r, 1500));
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: le } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (le) throw new Error(le.message);
  return { id: u.user.id, c, token: s.session.access_token };
}
const hasRole = async (userId, code) =>
  ((await svc.from("rbac_user_roles").select("id, rbac_roles!inner(code)").eq("user_id", userId).eq("rbac_roles.code", code).eq("status", "active")).data ?? []).length > 0;
const REASON = "Saya ditugaskan unit kerja untuk meninjau modul pelatihan mulai bulan depan.";

for (const f of [ACCOUNT, ADMIN, NOTIF]) await fetch(APP + f);
try {
  const user = await persona("user", null);
  const admin = await persona("admin", "admin");
  const superA = await persona("super", "super_admin");

  console.log("1. Pengguna mengajukan peran");
  let r = await callFn(user.token, ACCOUNT, "submitRoleRequest", { role: "reviewer", reason: "terlalu pendek" });
  check(/minimal 20/i.test(r.error ?? ""), `alasan pendek ditolak (${(r.error ?? "DITERIMA").slice(0, 50)})`);
  r = await callFn(user.token, ACCOUNT, "submitRoleRequest", { role: "admin", reason: REASON });
  check(Boolean(r.error), `peran admin tidak bisa diajukan sendiri (${(r.error ?? "DITERIMA").slice(0, 40)})`);
  r = await callFn(user.token, ACCOUNT, "submitRoleRequest", { role: "reviewer", reason: REASON, validUntil: new Date(Date.now() - 86400000).toISOString() });
  check(/setelah hari ini/.test(r.error ?? ""), "tanggal berakhir di masa lalu ditolak");
  r = await callFn(user.token, ACCOUNT, "submitRoleRequest", { role: "reviewer", reason: REASON });
  const reviewerReq = r.data?.id;
  check(Boolean(reviewerReq), `permintaan Reviewer terkirim (${r.error?.slice(0, 60) ?? "ok"})`);
  r = await callFn(user.token, ACCOUNT, "submitRoleRequest", { role: "reviewer", reason: REASON });
  check(/masih menunggu/.test(r.error ?? ""), "permintaan ganda untuk peran yang sama ditolak");
  r = await user.c.rpc("request_rbac_role_change", { _target_user_id: user.id, _role_code: "expert", _action: "grant", _reason: REASON });
  check(/expert_role_managed_by_flow/.test(r.error?.message ?? ""), "peran Expert tidak bisa diminta (langsung ke database pun ditolak)");
  r = await callFn(user.token, ACCOUNT, "getMyRoleRequests", undefined, "GET");
  check(r.data?.requests?.some((x) => x.id === reviewerReq && x.status === "pending" && x.role === "reviewer"), "pengguna melihat permintaannya berstatus menunggu");

  console.log("2. Siapa yang boleh memutuskan");
  r = await callFn(user.token, ADMIN, "listAccessRequests", { view: "pending" }, "GET");
  check(Boolean(r.error), `pengguna biasa tidak bisa membuka antrean (${(r.error ?? "BISA").slice(0, 40)})`);
  r = await callFn(user.token, ADMIN, "decideAccessRequest", { requestId: reviewerReq, decision: "approve" });
  check(/tidak berwenang/.test(r.error ?? ""), "pengguna tidak bisa menyetujui permintaannya sendiri");
  r = await callFn(admin.token, ADMIN, "listAccessRequests", { view: "pending" }, "GET");
  check(r.data?.canDecide === false && r.data.items.some((i) => i.id === reviewerReq && i.target.email?.includes("tdd-role-user")), "admin biasa melihat antrean (dengan email) tapi tidak bisa memutuskan");
  r = await callFn(admin.token, ADMIN, "decideAccessRequest", { requestId: reviewerReq, decision: "approve" });
  check(/tidak berwenang/.test(r.error ?? ""), "admin biasa ditolak saat menyetujui");
  r = await callFn(superA.token, NOTIF, "listMyNotifications", undefined, "GET");
  check((r.data ?? []).some((n) => n.targetUrl === "/admin/access-requests" && /TDD user meminta peran Reviewer/.test(n.title)), "super admin mendapat notifikasi permintaan baru");

  console.log("3. Super admin menyetujui");
  r = await callFn(superA.token, ADMIN, "listAccessRequests", { view: "pending" }, "GET");
  check(r.data?.canDecide === true, "super admin bisa memutuskan");
  r = await callFn(superA.token, ADMIN, "decideAccessRequest", { requestId: reviewerReq, decision: "approve", note: "Selamat bertugas" });
  check(r.data?.result === "applied" && (await hasRole(user.id, "reviewer")), `disetujui dan peran Reviewer langsung aktif (${r.error?.slice(0, 60) ?? "ok"})`);
  r = await callFn(superA.token, ADMIN, "decideAccessRequest", { requestId: reviewerReq, decision: "reject", note: "Ubah pikiran" });
  check(/sudah diputuskan/.test(r.error ?? ""), "permintaan yang sudah diputuskan tidak bisa diputuskan lagi");
  await new Promise((res) => setTimeout(res, 1500));
  r = await callFn(user.token, ACCOUNT, "submitRoleRequest", { role: "reviewer", reason: REASON });
  check(/sudah memiliki/.test(r.error ?? ""), "peran yang sudah dimiliki tidak bisa diajukan lagi");

  console.log("4. Super admin menolak dengan alasan");
  r = await callFn(user.token, ACCOUNT, "submitRoleRequest", { role: "verifier", reason: REASON });
  const verifierReq = r.data?.id;
  check(Boolean(verifierReq), "permintaan Verifier terkirim");
  r = await callFn(superA.token, ADMIN, "decideAccessRequest", { requestId: verifierReq, decision: "reject", note: "" });
  check(/wajib/.test(r.error ?? ""), "menolak tanpa alasan ditolak");
  r = await callFn(superA.token, ADMIN, "decideAccessRequest", { requestId: verifierReq, decision: "reject", note: "Unit Anda belum mengajukan surat tugas" });
  check(r.data?.result === "rejected" && !(await hasRole(user.id, "verifier")), "ditolak dan peran tidak diberikan");
  r = await callFn(user.token, ACCOUNT, "getMyRoleRequests", undefined, "GET");
  const mine = r.data?.requests ?? [];
  check(mine.find((x) => x.id === reviewerReq)?.status === "applied" && mine.find((x) => x.id === verifierReq)?.decisionNote === "Unit Anda belum mengajukan surat tugas" && r.data.activeRoles.includes("reviewer"),
    "pengguna melihat status disetujui/ditolak, alasan penolakan, dan peran barunya");
  r = await callFn(user.token, NOTIF, "listMyNotifications", undefined, "GET");
  const notifs = r.data ?? [];
  check(notifs.some((n) => n.type === "approved" && /Reviewer disetujui/.test(n.title)) && notifs.some((n) => n.type === "rejected" && n.body === "Unit Anda belum mengajukan surat tugas"),
    "pengguna mendapat notifikasi disetujui dan ditolak (dengan alasan)");
  r = await callFn(admin.token, ADMIN, "listAccessRequests", { view: "decided" }, "GET");
  check([reviewerReq, verifierReq].every((id) => r.data?.items.some((i) => i.id === id && i.reviewerName === "TDD super")), "tab Sudah diputuskan menampilkan keduanya beserta nama pemutus");

  console.log("5. Pemisahan tugas");
  r = await callFn(superA.token, ACCOUNT, "submitRoleRequest", { role: "operator", reason: REASON });
  const ownReq = r.data?.id;
  r = await callFn(superA.token, ADMIN, "decideAccessRequest", { requestId: ownReq, decision: "approve" });
  check(/super admin lain/.test(r.error ?? ""), "super admin tidak bisa menyetujui permintaannya sendiri");

  console.log("6. Jejak audit");
  const audit = (await svc.from("admin_audit_log").select("event_type").in("target_user_id", [user.id, superA.id])).data ?? [];
  const n = (t) => audit.filter((a) => a.event_type === t).length;
  check(n("role_change_requested") === 3 && n("role_change_applied") === 1 && n("role_change_rejected") === 1,
    `diajukan 3, disetujui 1, ditolak 1 tercatat (${n("role_change_requested")}/${n("role_change_applied")}/${n("role_change_rejected")})`);
} finally {
  console.log("\nMembersihkan data uji...");
  if (created.length) {
    await svc.from("rbac_role_change_requests").delete().in("target_user_id", created);
    await svc.from("rbac_role_change_requests").delete().in("requested_by", created);
    await svc.from("admin_audit_log").delete().in("actor_id", created);
    await svc.from("admin_audit_log").delete().in("target_user_id", created);
    await svc.from("notification_reads").delete().in("user_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) { const { error } = await svc.auth.admin.deleteUser(id); if (error) { left++; console.log("  gagal hapus user", id, error.message); } }
  console.log(left ? `Tersisa: ${left} akun.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
