/**
 * Live test of Data Master (migration 20261023010000) against the database in .env.
 *
 * - The 15 bidang keahlian of the Become an Expert form are in expertise_taxonomy.
 * - Direct table writes are refused; changes go through RPCs (approver/admin) with
 *   audit trail; ordinary users are refused.
 * - A bidang used by a profile cannot be renamed; trainer level rules are versioned.
 * - An expert application with a bidang outside the list is refused on submit.
 *
 * It WRITES test data (accounts @example.test, one bidang, one trainer-level
 * version, one expert application) and restores/removes everything at the end.
 * Run: npm run test:master-data
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
const password = "TddMasterData!2026#";
const users = [];
const createdExpertise = [];
let rulesBefore = null;
let newRuleVersion = null;
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
  const email = `tdd.master.${tag}.${stamp}@example.test`;
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
const FORM = ["Aquaculture", "Hatchery Management", "Fish Health", "Feed Development", "Fish Processing", "Quality Assurance",
  "Fisheries Management", "Marine Conservation", "Blue Economy", "Climate Change", "Marine Spatial Planning",
  "Monitoring, Control and Surveillance (MCS)", "IUU Fishing", "Ocean Literacy", "Capacity Development"];

async function cleanup() {
  console.log("\nMembersihkan data uji...");
  // Trainer level rules: drop every version a test account created (also one saved
  // by a check that wrongly succeeded), then reopen exactly the rows in force before.
  if (users.length) await admin.from("trainer_level_rules").delete().in("created_by", users);
  if (rulesBefore?.length) {
    await admin.from("trainer_level_rules").update({ effective_until: null }).in("id", rulesBefore.map((r) => r.id));
  }
  if (createdExpertise.length) await admin.from("expertise_taxonomy").delete().in("id", createdExpertise);
  await admin.from("governance_audit_log").delete().in("actor_id", users);
  const { data: subjects } = await admin.from("review_subjects").select("id").in("submitted_by", users);
  const subjectIds = (subjects ?? []).map((s) => s.id);
  if (subjectIds.length) {
    await admin.from("review_subject_revisions").delete().in("subject_id", subjectIds);
    await admin.from("governance_audit_log").delete().in("subject_id", subjectIds);
  }
  await admin.from("review_drafts").delete().in("submitter_id", users);
  if (subjectIds.length) await admin.from("review_subjects").delete().in("id", subjectIds);
  await admin.from("admin_audit_log").delete().in("target_user_id", users);
  await admin.from("rbac_user_roles").delete().in("user_id", users);
  let left = 0;
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) { left++; console.log("  gagal hapus user", id, error.message); }
  }
  const { data: rulesNow } = await admin.from("trainer_level_rules").select("version, trainer_level, min_unique_graduated_participants").is("effective_until", null);
  console.log(`Aturan level berlaku setelah pembersihan: ${JSON.stringify((rulesNow ?? []).map((r) => `${r.trainer_level}=${r.min_unique_graduated_participants}`))}`);
  console.log(left ? `Selesai dengan ${left} akun tersisa.` : "Selesai: database bersih.");
}

async function run() {
  const approver = await mkUser("approver", "approver");
  const user = await mkUser("user", "registered_user");
  const { data: rb } = await admin.from("trainer_level_rules").select("*").is("effective_until", null);
  rulesBefore = rb ?? [];

  console.log("1. Daftar bidang keahlian");
  const { data: tax } = await admin.from("expertise_taxonomy").select("name, active, display_order").eq("active", true).order("display_order");
  const names = (tax ?? []).map((t) => t.name);
  ok(FORM.every((f) => names.includes(f)), `15 bidang formulir aktif di database (${FORM.filter((f) => !names.includes(f)).length} hilang)`);

  console.log("2. Hak akses");
  const w1 = await user.client.from("expertise_taxonomy").insert({ code: `tdd_${stamp}`, name: `TDD ${stamp}` });
  const { data: leaked } = await admin.from("expertise_taxonomy").select("id").eq("code", `tdd_${stamp}`);
  if (leaked?.length) createdExpertise.push(...leaked.map((x) => x.id));
  ok(Boolean(w1.error) && !leaked?.length, `pengguna biasa tidak bisa menambah bidang langsung (${w1.error?.message?.slice(0, 50) ?? "TIDAK DITOLAK"})`);
  // Writes the value the row already has, so the real rule never changes even
  // where direct writes are still open (before the migration).
  const certified = rulesBefore.find((r) => r.trainer_level === "certified");
  const w2 = await approver.client.from("trainer_level_rules")
    .update({ min_unique_graduated_participants: certified?.min_unique_graduated_participants })
    .eq("id", certified?.id ?? "00000000-0000-0000-0000-000000000000").select("id");
  ok(Boolean(w2.error) || (w2.data?.length ?? 0) === 0, `approver pun tidak bisa menulis tabel langsung (wajib lewat RPC) (${w2.error?.message?.slice(0, 50) ?? `${w2.data?.length} baris`})`);
  await rejects(user.client.rpc("master_data_overview"), /forbidden/, "pengguna biasa tidak bisa membuka Data Master");
  const ov = await approver.client.rpc("master_data_overview");
  ok(!ov.error && ov.data?.expertise?.length >= 15 && ov.data?.trainerLevels?.length === 4, `approver membuka Data Master (${ov.error?.message ?? "ok"})`);

  console.log("3. Bidang keahlian");
  const add = await approver.client.rpc("master_expertise_save", { _id: null, _name: `TDD Seaweed ${stamp}`, _description: "uji", _display_order: null });
  if (add.data?.id) createdExpertise.push(add.data.id);
  ok(!add.error && add.data?.active === true, `approver menambah bidang (${add.error?.message ?? "ok"})`);
  await rejects(approver.client.rpc("master_expertise_save", { _id: null, _name: " aquaculture ", _description: null, _display_order: null }), /expertise_name_exists/, "nama ganda ditolak");
  const aqua = ov.data?.expertise?.find((e) => e.name === "Aquaculture");
  if (aqua?.usage > 0) {
    await rejects(approver.client.rpc("master_expertise_save", { _id: aqua.id, _name: "Akuakultur", _description: null, _display_order: null }), /expertise_in_use_rename_forbidden/, "bidang yang dipakai profil tidak bisa diganti nama");
  } else {
    ok(true, "(Aquaculture belum dipakai profil di database ini; cek ganti nama dilewati)");
  }
  const off = await approver.client.rpc("master_expertise_set_active", { _id: add.data?.id, _active: false });
  ok(!off.error && off.data?.changed === true, `bidang dinonaktifkan (${off.error?.message ?? "ok"})`);

  console.log("4. Aturan level trainer");
  const cur = Object.fromEntries(rulesBefore.map((r) => [r.trainer_level, r]));
  const rules = ["certified", "advanced", "senior", "master"].map((level, i) => ({
    level, minParticipants: (cur[level]?.min_unique_graduated_participants ?? (i + 1) * 100) + 1, evidence: cur[level]?.evidence_requirements ?? null }));
  // Certified 50 > Advanced 40: not increasing in level order.
  const decreasing = rules.map((r) => ({ ...r, minParticipants: { certified: 50, advanced: 40, senior: 1000, master: 2000 }[r.level] }));
  await rejects(approver.client.rpc("master_trainer_levels_set", { _rules: decreasing, _note: "Uji urutan" }), /trainer_levels_not_increasing/, "angka tidak naik berurutan ditolak");
  await rejects(approver.client.rpc("master_trainer_levels_set", { _rules: rules, _note: "abc" }), /trainer_levels_note_required/, "alasan perubahan wajib");
  await rejects(user.client.rpc("master_trainer_levels_set", { _rules: rules, _note: "Uji oleh pengguna" }), /forbidden/, "pengguna biasa ditolak");
  const set = await approver.client.rpc("master_trainer_levels_set", { _rules: rules, _note: "Uji otomatis Data Master" });
  newRuleVersion = set.data?.version ?? null;
  const { data: closed } = await admin.from("trainer_level_rules").select("id").eq("version", rulesBefore[0]?.version ?? -1).not("effective_until", "is", null);
  ok(!set.error && newRuleVersion > (rulesBefore[0]?.version ?? 0) && (closed?.length ?? 0) === 4, `versi baru ${newRuleVersion} berlaku, versi lama ditutup (${set.error?.message ?? "ok"})`);

  console.log("5. Pengajuan expert memakai daftar");
  const applicant = await mkUser("applicant", "registered_user");
  const payload = (expertise) => ({ fullName: `TDD Pakar ${stamp}`, title: "Peneliti", institution: "Lembaga Uji", country: "Indonesia",
    email: `tdd.master.contact.${stamp}@example.test`, expertise, roles: ["Reviewer"], biography: "Biografi uji.", documents: [] });
  const draft = await applicant.client.rpc("expert_draft_create", { _display_name: `TDD Pakar ${stamp}` });
  await applicant.client.rpc("expert_draft_update", { _draft_id: draft.data, _patch: payload(["Aquaculture", "Bidang Karangan"]) });
  await rejects(applicant.client.rpc("expert_draft_submit", { _draft_id: draft.data }), /expertise_unknown/, "bidang di luar daftar ditolak saat dikirim");
  await applicant.client.rpc("expert_draft_update", { _draft_id: draft.data, _patch: payload(["Aquaculture", "Fish Health"]) });
  const sub = await applicant.client.rpc("expert_draft_submit", { _draft_id: draft.data });
  ok(!sub.error && sub.data, `bidang dari daftar diterima (${sub.error?.message ?? "ok"})`);
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
