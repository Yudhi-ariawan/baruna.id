/**
 * Live test of Data Master kuota modul per level trainer (migration 20261023020000)
 * against the database in .env.
 *
 * - Direct table writes are refused; changes go through master_module_limits_set
 *   (approver/admin) with validation and audit trail; ordinary users are refused.
 * - A save based on values someone else changed meanwhile is refused (no silent
 *   overwrite); two simultaneous saves: exactly one wins.
 * - module_draft_create reads the new quota (_module_level_limit).
 *
 * It WRITES test data (accounts @example.test, one quota change) and restores the
 * original quota and removes everything at the end.
 * Run: npm run test:module-limits
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
const password = "TddModuleLimits!2026#";
const LEVELS = ["certified", "advanced", "senior", "master"];
const users = [];
let original = null;
let passed = 0;
const failures = [];
const ok = (cond, label) => { if (cond) { passed++; console.log("  ok", label); } else { failures.push(label); console.log("  FAIL", label); } };
const rejects = async (promise, pattern, label) => {
  const { error } = await promise;
  const good = Boolean(error) && pattern.test(error.message);
  if (!good) console.log("   got:", error ? error.message : "no error");
  ok(good, label);
};

async function mkUser(tag, role) {
  const email = `tdd.modlimit.${tag}.${stamp}@example.test`;
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

async function readLimits() {
  const { data, error } = await admin.from("trainer_level_module_limits").select("level, module_limit, updated_at").in("level", LEVELS);
  if (error) throw new Error(`read limits: ${error.message}`);
  return data;
}
const asMap = (rows) => Object.fromEntries(rows.map((r) => [r.level, r.module_limit]));

async function cleanup() {
  console.log("\nMembersihkan data uji...");
  // Put back exactly the rows (value and timestamp) that were there before the test.
  for (const r of original ?? []) {
    const { error } = await admin.from("trainer_level_module_limits")
      .update({ module_limit: r.module_limit, updated_at: r.updated_at }).eq("level", r.level);
    if (error) console.log("  gagal mengembalikan kuota", r.level, error.message);
  }
  if (users.length) await admin.from("governance_audit_log").delete().in("actor_id", users);
  await admin.from("admin_audit_log").delete().in("target_user_id", users);
  await admin.from("rbac_user_roles").delete().in("user_id", users);
  let left = 0;
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) { left++; console.log("  gagal hapus user", id, error.message); }
  }
  console.log(`Kuota setelah pembersihan: ${JSON.stringify(asMap(await readLimits()))}`);
  console.log(left ? `Selesai dengan ${left} akun tersisa.` : "Selesai: database bersih.");
}

async function run() {
  original = await readLimits();
  const cur = asMap(original);
  console.log(`Kuota sebelum uji: ${JSON.stringify(cur)}`);
  const approver = await mkUser("approver", "approver");
  const approver2 = await mkUser("approver2", "approver");
  const user = await mkUser("user", "registered_user");

  console.log("1. Tulis langsung dan hak akses");
  // Writes the value the row already has, so the real quota never changes even if
  // direct writes were still open.
  const w = await approver.client.from("trainer_level_module_limits")
    .update({ module_limit: cur.certified }).eq("level", "certified").select("level");
  ok(Boolean(w.error) || (w.data?.length ?? 0) === 0, `approver tidak bisa menulis tabel langsung (${w.error?.message?.slice(0, 50) ?? `${w.data?.length} baris`})`);
  await rejects(user.client.rpc("master_module_limits_overview"), /forbidden/, "pengguna biasa tidak bisa membuka kuota");
  const next = { ...cur, certified: cur.certified + 1 <= cur.advanced ? cur.certified + 1 : cur.certified - 1 };
  await rejects(user.client.rpc("master_module_limits_set", { _limits: next, _expected: cur, _note: "Uji pengguna biasa" }), /forbidden/, "pengguna biasa tidak bisa mengubah kuota");
  const ov = await approver.client.rpc("master_module_limits_overview");
  ok(!ov.error && ov.data?.limits?.length === 4, `approver membuka kuota (${ov.error?.message ?? "ok"})`);

  console.log("2. Validasi");
  const set = (c, limits, expected, note = "Uji otomatis kuota modul") => c.client.rpc("master_module_limits_set", { _limits: limits, _expected: expected, _note: note });
  await rejects(set(approver, next, cur, "abc"), /module_limits_note_required/, "alasan wajib");
  await rejects(set(approver, { ...cur, certified: 0 }, cur), /module_limits_value_invalid/, "kuota 0 ditolak");
  await rejects(set(approver, { ...cur, master: 10000 }, cur), /module_limits_value_invalid/, "kuota > 9999 ditolak");
  await rejects(set(approver, { ...cur, certified: 1.5 }, cur), /module_limits_value_invalid/, "pecahan ditolak");
  await rejects(set(approver, { certified: 6, advanced: 5, senior: 10, master: 999 }, cur), /module_limits_decreasing/, "level lebih tinggi lebih kecil ditolak");
  await rejects(set(approver, { ...cur, none: 1 }, cur), /module_limits_invalid/, "kunci di luar 4 level ditolak");
  await rejects(set(approver, cur, cur), /module_limits_unchanged/, "tanpa perubahan ditolak");
  await rejects(set(approver, next, { ...cur, certified: cur.certified + 50 }), /module_limits_stale/, "nilai acuan layar berbeda ditolak");
  ok(JSON.stringify(asMap(await readLimits())) === JSON.stringify(cur), "semua penolakan tidak mengubah kuota");

  console.log("3. Simpan bersamaan dari dua perangkat");
  const [a, b] = await Promise.all([set(approver, next, cur), set(approver2, next, cur)]);
  const wins = [a, b].filter((x) => !x.error).length;
  const stale = [a, b].filter((x) => /module_limits_stale/.test(x.error?.message ?? "")).length;
  ok(wins === 1 && stale === 1, `tepat satu tersimpan, yang lain ditolak karena data sudah berubah (${a.error?.message ?? "ok"} / ${b.error?.message ?? "ok"})`);
  ok(asMap(await readLimits()).certified === next.certified, "kuota baru tersimpan");
  const { data: lim } = await admin.rpc("_module_level_limit", { _level: "certified" });
  ok(lim === next.certified, `kuota pembuatan modul memakai nilai baru (${lim})`);
  const { data: log } = await admin.from("governance_audit_log").select("actor_id, before, after")
    .eq("event_type", "master_module_limits_changed").in("actor_id", users);
  ok(log?.length === 1 && log[0].before?.limits?.certified === cur.certified && log[0].after?.limits?.certified === next.certified
    && log[0].after?.note === "Uji otomatis kuota modul", "audit trail: satu catatan dengan sebelum, sesudah, alasan");
  const ov2 = await approver.client.rpc("master_module_limits_overview");
  ok(ov2.data?.history?.[0]?.after?.certified === next.certified, "riwayat di konsol menampilkan perubahan terbaru");
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
