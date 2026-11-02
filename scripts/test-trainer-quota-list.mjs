/**
 * Live test of the trainer list in Data Master → Kuota Modul per Level Trainer
 * (migration 20261102010000) against the database in .env.
 *
 * - Only approver/admin/super admin can read it; ordinary users are refused.
 * - Every row's numbers equal _trainer_module_quota for that trainer (the function
 *   module_draft_create uses), and the per-level counts equal the panel summary.
 * - No email or contact data is returned.
 *
 * Reads only, apart from two temporary accounts @example.test that it removes.
 * Run: npm run test:trainer-quota-list
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const stamp = Date.now();
const password = "TddQuotaList!2026#";
const users = [];
let passed = 0;
const failures = [];
const ok = (cond, label) => { if (cond) { passed++; console.log("  ok", label); } else { failures.push(label); console.log("  FAIL", label); } };

async function mkUser(tag, role) {
  const email = `tdd.quotalist.${tag}.${stamp}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { display_name: `TDD ${tag}`, organization: "Instansi Uji", job_title: "Staf Uji", phone: "+6280000000000" } });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  const id = data.user.id;
  users.push(id);
  if (role) {
    const { data: r } = await admin.from("rbac_roles").select("id").eq("code", role).single();
    const { data: existing } = await admin.from("rbac_user_roles").select("id").eq("user_id", id).eq("is_primary", true);
    const { error: e } = existing?.length
      ? await admin.from("rbac_user_roles").update({ role_id: r.id, reason: "tdd" }).eq("id", existing[0].id)
      : await admin.from("rbac_user_roles").insert({ user_id: id, role_id: r.id, status: "active", is_primary: true, valid_from: new Date().toISOString(), reason: "tdd" });
    if (e) throw new Error(`role ${tag}: ${e.message}`);
  }
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(`signIn ${tag}: ${signErr.message}`);
  return { id, client };
}

async function cleanup() {
  console.log("\nMembersihkan data uji...");
  await admin.from("admin_audit_log").delete().in("target_user_id", users);
  await admin.from("rbac_user_roles").delete().in("user_id", users);
  let left = 0;
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) { left++; console.log("  gagal hapus user", id, error.message); }
  }
  console.log(left ? `Selesai dengan ${left} akun tersisa.` : "Selesai: database bersih.");
}

async function run() {
  const approver = await mkUser("approver", "approver");
  const user = await mkUser("user", "registered_user");

  console.log("1. Hak akses");
  const denied = await user.client.rpc("master_trainer_quota_list");
  ok(Boolean(denied.error) && /forbidden/.test(denied.error.message), `pengguna biasa ditolak (${denied.error?.message ?? "TIDAK DITOLAK"})`);
  const res = await approver.client.rpc("master_trainer_quota_list");
  ok(!res.error && Array.isArray(res.data), `approver membaca daftar (${res.error?.message ?? `${res.data?.length} trainer`})`);
  const list = res.data ?? [];

  console.log("2. Angka sama dengan kuota yang dipakai saat membuat modul");
  let same = 0;
  for (const row of list) {
    const { data: e } = await admin.from("experts").select("original_contributor_id").eq("id", row.expertId).single();
    const { data: qd, error } = await admin.rpc("_trainer_module_quota", { _uid: e?.original_contributor_id });
    const match = !error && qd.limit === row.limit && qd.used === row.used && qd.live === row.live && qd.queued === row.queued;
    if (match) same++;
    console.log(`   ${row.name} (${row.level}): ${row.used}/${row.limit}${row.portalActive ? "" : " · portal tidak aktif"}${match ? "" : " · BEDA"}`);
  }
  ok(list.length > 0 && same === list.length, `${same}/${list.length} baris sama dengan _trainer_module_quota`);

  const ov = await approver.client.rpc("master_module_limits_overview");
  const counts = {};
  for (const r of list) counts[r.level] = (counts[r.level] ?? 0) + 1;
  const levels = ["certified", "advanced", "senior", "master"];
  ok(!ov.error && levels.every((l) => (ov.data.trainers?.[l] ?? 0) === (counts[l] ?? 0)),
    `jumlah per level sama dengan ringkasan panel (${levels.map((l) => `${l} ${counts[l] ?? 0}`).join(", ")})`);
  ok(!/@/.test(JSON.stringify(list)), "tidak ada email/kontak dalam daftar");
}

try {
  await run();
} catch (e) {
  console.error("Kesalahan:", e);
  failures.push(String(e?.message ?? e));
} finally {
  try { await cleanup(); } catch (e) { console.error("Gagal membersihkan:", e); failures.push("cleanup gagal"); }
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ")}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
