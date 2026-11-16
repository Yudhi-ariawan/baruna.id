/**
 * Live test: Authentication Log (Slide 42; migration 20261116050000; CATATAN_PERBAIKAN 2bg)
 * against the database in .env and the running app (npm run dev; CONSOLE_TEST_URL or
 * APP_BASE_URL). Signs a test account in and out for real and reads the Admin Portal page.
 *
 * It WRITES test data (accounts @example.test and their log rows) and removes everything
 * at the end. Needs the migration to have been run.
 * Run: npm run test:auth-log
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
const PASSWORD = "TddAuth!2026#";
const created = [];
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };

const FILE = "/src/lib/admin/auth-log.functions.ts";
const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function listLog(token, data) {
  const headers = { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${token}` };
  const payload = JSON.stringify(await toJSONAsync({ data }));
  const text = await (await fetch(`${APP}/_serverFn/${fnId(FILE, "listAuthEvents")}?payload=${encodeURIComponent(payload)}`, { headers })).text();
  try {
    const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] });
    return v?.result !== undefined ? { data: v.result } : { error: String(v?.error?.message ?? text.slice(0, 120)) };
  } catch {
    return { error: text.slice(0, 160) };
  }
}

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function account(label, role) {
  const email = `tdd-auth-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_auth_test" });
    if (e) throw new Error(e.message);
  }
  return { id: u.user.id, email };
}
async function signIn(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(error.message);
  return { c, token: s.session.access_token };
}
const logOf = async (userId) =>
  ((await svc.from("auth_event_log").select("event, ip, user_agent, session_id, email").eq("user_id", userId).order("id")).data ?? []);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const probe = await svc.from("auth_event_log").select("id", { head: true, count: "exact" });
if (probe.error) {
  console.error(`Tabel auth_event_log belum ada (${probe.error.message}). Jalankan migrasi 20261116050000_auth_event_log.sql dulu.`);
  process.exit(1);
}
await fetch(APP + FILE);
try {
  console.log("1. Kejadian tercatat otomatis");
  const admin = await account("admin", "super_admin");
  const user = await account("user", null);
  let log = await logOf(user.id);
  check(log.some((l) => l.event === "account_created" && l.email === user.email), "akun dibuat tercatat beserta emailnya");

  const s = await signIn(user.email);
  await wait(800);
  log = await logOf(user.id);
  const signIn1 = log.filter((l) => l.event === "sign_in");
  check(signIn1.length === 1, `masuk dengan kata sandi tercatat satu kali (${signIn1.length})`);
  const viaSessions = Boolean(signIn1[0]?.session_id);
  console.log(`  info: sumber catatan masuk = ${viaSessions ? "auth.sessions (dengan IP/peramban)" : "auth.users.last_sign_in_at (cadangan, tanpa IP/peramban)"}`);
  if (viaSessions) check(Boolean(signIn1[0].ip || signIn1[0].user_agent), `IP atau peramban ikut tercatat (ip=${signIn1[0].ip ?? "-"}, ua=${(signIn1[0].user_agent ?? "-").slice(0, 30)})`);

  await s.c.auth.refreshSession();
  await wait(500);
  log = await logOf(user.id);
  check(log.filter((l) => l.event === "sign_in").length === 1, "memperbarui token (sesi tersimpan) tidak dicatat sebagai masuk baru");

  await s.c.auth.signOut();
  await wait(800);
  log = await logOf(user.id);
  if (viaSessions) check(log.some((l) => l.event === "sign_out"), "keluar tercatat");
  else console.log("  info: keluar tidak tercatat pada jalur cadangan (tanpa trigger auth.sessions)");

  await svc.auth.admin.updateUserById(user.id, { password: `${PASSWORD}x` });
  await wait(500);
  log = await logOf(user.id);
  check(log.some((l) => l.event === "password_changed"), "kata sandi diubah tercatat");

  console.log("2. Halaman Log Autentikasi");
  const adminSession = await signIn(admin.email);
  let r = await listLog(adminSession.token, { search: user.email, hideTestAccounts: false });
  const shown = r.data?.items ?? [];
  check(shown.some((i) => i.event === "sign_in" && i.email === user.email && i.name === "TDD user"), `admin melihat catatan masuk pengguna dengan namanya (${r.error?.slice(0, 60) ?? shown.length + " baris"})`);
  check(shown.length > 1 && shown.every((a, i) => i === 0 || shown[i - 1].id > a.id), "urutan terbaru di atas");
  r = await listLog(adminSession.token, { search: user.email, event: "password_changed", hideTestAccounts: false });
  check((r.data?.items ?? []).length === 1 && r.data.items[0].event === "password_changed", "filter jenis kejadian bekerja");
  r = await listLog(adminSession.token, { search: user.email });
  check((r.data?.items ?? []).length === 0, "akun uji @example.test disembunyikan secara bawaan");
  r = await listLog(adminSession.token, { adminsOnly: true, hideTestAccounts: false, search: "tdd-auth-" });
  check((r.data?.items ?? []).length > 0 && r.data.items.every((i) => i.isAdmin && i.email === admin.email), "filter hanya admin menampilkan akun admin saja");
  r = await listLog(adminSession.token, { search: "a'b" });
  check(Boolean(r.error), "kata kunci dengan karakter khusus ditolak");

  console.log("3. Hak akses");
  // The password was changed above; sign in with the new one.
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s2 } = await c.auth.signInWithPassword({ email: user.email, password: `${PASSWORD}x` });
  r = await listLog(s2?.session?.access_token ?? "", {});
  check(/forbidden|izin/.test(r.error ?? ""), "pengguna biasa tidak bisa membaca log");
  const direct = await c.from("auth_event_log").select("id").limit(1);
  check(Boolean(direct.error) || (direct.data ?? []).length === 0, "tabel tidak bisa dibaca langsung dari browser");
} finally {
  console.log("\nMembersihkan data uji...");
  let left = 0;
  for (const id of created) {
    await svc.from("rbac_user_roles").delete().eq("user_id", id);
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) { left++; console.log("  gagal hapus user", id, error.message); }
  }
  if (created.length) await svc.from("auth_event_log").delete().in("user_id", created);
  await svc.from("auth_event_log").delete().like("email", `tdd-auth-%-${stamp}@example.test`);
  console.log(left ? `Tersisa: ${left} akun.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
