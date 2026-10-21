// Live test: submissions and reviewer assignments cannot be written directly from
// the browser (migration 20261021090000); conflict of interest goes through
// review_assignment_declare_conflict. Creates temporary @example.test accounts and
// test submissions, and deletes them afterwards.
// Run: npm run test:review-lockdown
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = `Tdd-${Math.random().toString(36).slice(2)}-Aa1!`, stamp = Date.now();
const created = [], subjects = [];
let passed = 0, failed = 0;
const check = (cond, label) => { if (cond) { passed++; console.log("  ok  ", label); } else { failed++; console.log("  FAIL", label); } };

async function retry(fn, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= tries || !/fetch failed|timeout|ECONNRESET/i.test(String(e?.message ?? e))) throw e; await new Promise((r) => setTimeout(r, 1500 * i)); }
  }
}

const { data: roleRows, error: roleErr } = await svc.from("rbac_roles").select("id, code");
if (roleErr) throw new Error(roleErr.message);
const roleId = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));

async function persona(label, role) {
  const email = `tdd-review-lock-${label}-${stamp}@example.test`;
  const { data: u, error } = await retry(() => svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } }));
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_review_lock_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await retry(() => c.auth.signInWithPassword({ email, password: PASSWORD }));
  if (se) throw new Error(se.message);
  return { id: u.user.id, c };
}
const subject = async (by, kind, status = "pending") => {
  const { data, error } = await svc.from("review_subjects").insert({ kind, title: `TDD review lock ${kind}`, submitted_by: by, current_status: status }).select("id").single();
  if (error) throw new Error(error.message);
  subjects.push(data.id);
  return data.id;
};
const statusOf = async (id) => (await svc.from("review_subjects").select("current_status").eq("id", id).single()).data?.current_status;

try {
  const approver = await persona("approver", "approver");
  const admin = await persona("admin", "admin");
  const reviewer = await persona("reviewer", "reviewer");
  const other = await persona("other");

  console.log("\n== status pengajuan tidak bisa diubah langsung");
  for (const kind of ["expert", "module", "knowledge_resource", "training_need"]) {
    const own = await subject(approver.id, kind);
    const r = await approver.c.from("review_subjects").update({ current_status: "approved" }).eq("id", own).select("id");
    check(Boolean(r.error) && (await statusOf(own)) === "pending", `approver menyetujui pengajuan ${kind} miliknya sendiri: ditolak (${r.error?.code ?? "TIDAK DITOLAK"})`);
  }
  const othersSubject = await subject(other.id, "training_need");
  let r = await admin.c.from("review_subjects").update({ current_status: "approved" }).eq("id", othersSubject).select("id");
  check(Boolean(r.error) && (await statusOf(othersSubject)) === "pending", `admin mengubah status langsung: ditolak (${r.error?.code ?? "TIDAK DITOLAK"})`);
  r = await approver.c.from("review_subjects").insert({ kind: "training_need", title: "palsu", submitted_by: approver.id }).select("id");
  if (r.data?.length) subjects.push(r.data[0].id);
  check(Boolean(r.error), `approver membuat pengajuan langsung: ditolak (${r.error?.code ?? "TIDAK DITOLAK"})`);

  console.log("\n== penugasan reviewer");
  r = await approver.c.from("review_assignments").insert({ subject_id: othersSubject, reviewer_id: approver.id, assigned_by: approver.id, status: "active" }).select("id");
  check(Boolean(r.error), `approver menugaskan dirinya langsung: ditolak (${r.error?.code ?? "TIDAK DITOLAK"})`);
  const viaRpc = await admin.c.rpc("assign_reviewer", { _subject_id: othersSubject, _reviewer_id: reviewer.id, _due_at: null, _template_version_id: null });
  check(!viaRpc.error && (await statusOf(othersSubject)) === "under_review", `jalur resmi assign_reviewer tetap jalan (${viaRpc.error?.message ?? "ok"})`);
  const assignmentId = viaRpc.data;
  const elsewhere = await subject(other.id, "training_need");
  r = await reviewer.c.from("review_assignments").update({ subject_id: elsewhere }).eq("id", assignmentId).select("id");
  const { data: still } = await svc.from("review_assignments").select("subject_id").eq("id", assignmentId).single();
  check(Boolean(r.error) && still?.subject_id === othersSubject, `reviewer memindahkan penugasannya: ditolak (${r.error?.code ?? "TIDAK DITOLAK"})`);
  r = await reviewer.c.from("review_subjects").select("id").eq("id", othersSubject);
  check(r.data?.length === 1, "reviewer tetap bisa membaca pengajuan yang ditugaskan");

  console.log("\n== nyatakan konflik kepentingan");
  r = await other.c.rpc("review_assignment_declare_conflict", { _assignment_id: assignmentId, _reason: "bukan milik saya" });
  check(/assignment_not_found/.test(r.error?.message ?? ""), `orang lain tidak bisa (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await reviewer.c.rpc("review_assignment_declare_conflict", { _assignment_id: assignmentId, _reason: "Saya rekan kerja pengaju" });
  const { data: a } = await svc.from("review_assignments").select("subject_id, status, conflict_of_interest_declared, conflict_of_interest_reason").eq("id", assignmentId).single();
  check(!r.error && a?.status === "recused" && a.conflict_of_interest_declared && a.conflict_of_interest_reason === "Saya rekan kerja pengaju" && a.subject_id === othersSubject,
    `reviewer menyatakan konflik: recused + alasan tersimpan (${r.error?.message ?? "ok"})`);
  r = await reviewer.c.rpc("review_assignment_declare_conflict", { _assignment_id: assignmentId, _reason: "lagi" });
  check(/assignment_not_active/.test(r.error?.message ?? ""), `pernyataan kedua ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
} catch (e) {
  failed++;
  console.log("  FAIL", e.message);
} finally {
  for (const id of subjects) {
    await svc.from("governance_audit_log").delete().eq("subject_id", id);
    const { error } = await svc.from("review_subjects").delete().eq("id", id);
    if (error) console.log("cleanup subject", id, error.message);
  }
  for (const id of created) {
    await svc.from("governance_audit_log").update({ actor_id: null }).eq("actor_id", id);
    await svc.from("rbac_user_roles").delete().eq("user_id", id);
  }
  for (const id of created) {
    await svc.from("profiles").delete().eq("id", id);
    const { error } = await retry(() => svc.auth.admin.deleteUser(id));
    if (error) console.log("cleanup user", id, error.message);
  }
}
console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed ? 1 : 0);
