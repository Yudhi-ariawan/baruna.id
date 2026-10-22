/**
 * Live test: an approved expert becomes a trainer only when they chose the
 * "Trainer" role (migration 20261022050000) against the database in .env.
 *
 * Experts who did not choose Trainer stay experts (profile published, expert role
 * active) without a trainer status, also after opening the trainer portal; they
 * apply for trainer qualification instead (Slide 39).
 *
 * It WRITES test data (accounts @example.test, expert applications and the
 * profiles they create) and removes everything at the end, even when a check fails.
 * Run: npm run test:trainer-choice
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
const password = "TddTrainerChoice!2026#";
const users = [];
let passed = 0;
const failures = [];
const ok = (cond, label) => { if (cond) { passed++; console.log("  ok", label); } else { failures.push(label); console.log("  FAIL", label); } };

async function mkUser(tag, role) {
  const email = `tdd.trchoice.${tag}.${stamp}@example.test`;
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
const payload = (name, roles) => ({ fullName: name, title: "Peneliti Madya", institution: "Lembaga Uji", country: "Indonesia",
  email: `tdd.trchoice.contact.${stamp}@example.test`, expertise: ["Oseanografi"], roles, biography: "Biografi uji.",
  structuredLanguages: [{ language: "Bahasa Indonesia", proficiency: "native" }], documents: [] });
async function applyAndApprove(applicant, approver, name, roles) {
  const draft = await applicant.client.rpc("expert_draft_create", { _display_name: name });
  await applicant.client.rpc("expert_draft_update", { _draft_id: draft.data, _patch: payload(name, roles) });
  const sub = await applicant.client.rpc("expert_draft_submit", { _draft_id: draft.data });
  if (sub.error) throw new Error(`submit: ${sub.error.message}`);
  const dec = await approver.client.rpc("admin_expert_decide", { _subject_id: sub.data, _decision: "approve", _rationale: null, _expected_updated_at: null });
  if (dec.error) throw new Error(`approve: ${dec.error.message}`);
  return (await admin.from("experts").select("id, current_status").eq("source_submission_id", sub.data).single()).data;
}
const trainerOf = async (eid) => (await admin.from("expert_trainer_status").select("trainer_status").eq("expert_id", eid).order("version", { ascending: false }).limit(1)).data?.[0]?.trainer_status ?? null;
const roleStatus = async (uid) => (await admin.from("rbac_user_roles").select("status, rbac_roles!inner(code)").eq("user_id", uid).eq("rbac_roles.code", "expert")).data?.[0]?.status;

async function cleanup() {
  console.log("\nMembersihkan data uji...");
  const { data: subjects } = await admin.from("review_subjects").select("id").in("submitted_by", users);
  const subjectIds = (subjects ?? []).map((s) => s.id);
  if (subjectIds.length) {
    const { data: ex } = await admin.from("experts").select("id").in("source_submission_id", subjectIds);
    if (ex?.length) await admin.from("experts").delete().in("id", ex.map((e) => e.id));
    await admin.from("review_decisions").delete().in("subject_id", subjectIds);
    await admin.from("review_subject_revisions").delete().in("subject_id", subjectIds);
    await admin.from("governance_audit_log").delete().in("subject_id", subjectIds);
  }
  await admin.from("review_drafts").delete().in("submitter_id", users);
  if (subjectIds.length) await admin.from("review_subjects").delete().in("id", subjectIds);
  await admin.from("governance_audit_log").delete().in("actor_id", users);
  await admin.from("admin_audit_log").delete().in("actor_id", users);
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
  const reviewerOnly = await mkUser("reviewer-only", "registered_user");
  const trainerToo = await mkUser("trainer-too", "registered_user");

  console.log("1. Expert yang TIDAK memilih Trainer (Reviewer, Speaker)");
  const e1 = await applyAndApprove(reviewerOnly, approver, `TDD Reviewer ${stamp}`, ["Reviewer", "Speaker"]);
  ok(e1.current_status === "published" && (await roleStatus(reviewerOnly.id)) === "active", "profil tayang dan role expert aktif");
  ok((await trainerOf(e1.id)) === null, `tidak menjadi trainer (status: ${await trainerOf(e1.id)})`);
  const bf = await reviewerOnly.client.rpc("trainer_status_backfill_self");
  ok(!bf.error && bf.data === false && (await trainerOf(e1.id)) === null, `membuka portal tidak memberi status trainer (${bf.error?.message ?? bf.data})`);
  const app = await reviewerOnly.client.rpc("trainer_application_my");
  ok(!app.error && app.data?.trainerStatus === "not_applied", `bisa mengajukan Kualifikasi Trainer (status: ${app.data?.trainerStatus ?? app.error?.message})`);

  console.log("2. Expert yang memilih Trainer");
  const e2 = await applyAndApprove(trainerToo, approver, `TDD Trainer ${stamp}`, ["Speaker", "Trainer"]);
  ok((await trainerOf(e2.id)) === "active", "menjadi trainer aktif");
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
