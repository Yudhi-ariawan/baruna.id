// Live test: "Buka revisi modul tayang" by an approver (migration 20261022010000).
// The revision must start from the live version (the revision approved by the
// decision that published the module), not from a rejected update, and it must not
// withdraw a trainer update that is still waiting for a decision. Creates a
// temporary trainer (public expert profile), approver and plain user (@example.test)
// plus one module, and deletes everything afterwards.
// Run: npm run test:admin-module-revision
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = `Tdd-${Math.random().toString(36).slice(2)}-Aa1!`, stamp = Date.now();
const created = [], experts = [];
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
  const email = `tdd-admin-revision-${label}-${stamp}@example.test`;
  const { data: u, error } = await retry(() => svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } }));
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_admin_revision_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await retry(() => c.auth.signInWithPassword({ email, password: PASSWORD }));
  if (se) throw new Error(se.message);
  return { id: u.user.id, c };
}
async function makeTrainer(user) {
  const { data: ex, error } = await svc.from("experts").insert({ source_type: "external_submission", original_contributor_id: user.id,
    created_by: user.id, display_name: `TDD Trainer ${stamp}`, slug: `tdd-admin-revision-${stamp}`, current_status: "published",
    visibility: "public", verification_status: "governance_verified" }).select("id").single();
  if (error) throw new Error(error.message);
  experts.push(ex.id);
  const { error: e2 } = await svc.from("expert_trainer_status").insert({ expert_id: ex.id, trainer_status: "active", trainer_level: "certified", rationale: "tdd_admin_revision_test" });
  if (e2) throw new Error(e2.message);
}

// Each version carries its own quiz question and attachment, so the source of a
// revision draft is visible.
const payload = (trainerId, summary, tag) => ({
  title: `TDD Modul Revisi Admin ${stamp}`, summary, language: "Indonesian", target_participants: "Pengawas perikanan",
  estimated_learning_hours: 4, learning_objectives: ["Memahami prosedur pengawasan"], topic: "MCS", competency: "Pengawasan",
  assessment_approach: { method: "Kuis", passing_score: 70, quiz_questions: [
    { id: 1, question: `Soal versi ${tag}?`, options: ["Benar", "Salah"], correctAnswer: 0 }] },
  metadata: { level: "Intermediate", attached_resources: [
    { name: `materi-${tag}.pdf`, path: `users/${trainerId}/modules/tdd-${stamp}-${tag}.pdf`, bucket: "module-attachments", size: 1000, type: "pdf" }] },
});
const save = (t, draftId, summary, tag, submit = true) => t.c.rpc("trainer_module_save", {
  _draft_id: draftId, _title: `TDD Modul Revisi Admin ${stamp}`, _module_type: "technical", _payload: payload(t.id, summary, tag), _submit: submit });
const decide = (a, sid, d, why) => a.c.rpc("admin_module_decide", { _subject_id: sid, _decision: d, _rationale: why ?? null, _expected_updated_at: null });
const openRevision = (a, sid, why = "Mohon perbarui data statistik") =>
  a.c.rpc("request_published_module_revision", { _subject_id: sid, _rationale: why });
const live = async (sid) => (await svc.from("module_registry").select("id, version, summary, current_status, visibility").eq("source_submission_id", sid).maybeSingle()).data;
const subjectOf = async (sid) => (await svc.from("review_subjects").select("current_status, metadata").eq("id", sid).single()).data;
const openDraft = async (sid) => (await svc.from("review_drafts").select("id, submitter_id, payload").eq("linked_subject_id", sid).eq("status", "draft")).data ?? [];
const quizOf = (p) => p?.assessment_approach?.quiz_questions?.[0]?.question;
const fileOf = (p) => p?.metadata?.attached_resources?.[0]?.name;
let subjectId = null;

try {
  const trainer = await persona("trainer", "expert");
  await makeTrainer(trainer);
  const approver = await persona("approver", "approver");
  const plain = await persona("plain");

  console.log("\n== modul tayang (versi LIVE)");
  let r = await save(trainer, null, "Versi tayang", "LIVE");
  subjectId = r.data?.subjectId;
  check(!r.error && Boolean(subjectId), `trainer mengirim modul (${r.error?.message ?? "ok"})`);
  if (!subjectId) throw new Error("modul uji tidak terbentuk; uji berikutnya dilewati");
  r = await decide(approver, subjectId, "approve", "Modul disetujui");
  let m = await live(subjectId);
  check(!r.error && m?.current_status === "published", `approver menyetujui → tayang (${r.error?.message ?? "ok"})`);
  const v1 = m.version;

  console.log("\n== pembaruan trainer DITOLAK");
  r = await trainer.c.rpc("trainer_open_module_update", { _subject_id: subjectId, _note: "Mengganti kuis" });
  r = await save(trainer, r.data, "Versi yang ditolak", "DITOLAK");
  check(!r.error, `pembaruan dikirim (${r.error?.message ?? "ok"})`);
  r = await decide(approver, subjectId, "reject", "Kuis tidak sesuai kurikulum");
  m = await live(subjectId);
  let s = await subjectOf(subjectId);
  check(!r.error && m.version === v1 && m.summary === "Versi tayang" && s.current_status === "approved", `ditolak → versi tayang tetap (${r.error?.message ?? "ok"})`);

  console.log("\n== approver membuka revisi modul tayang");
  r = await openRevision(plain, subjectId);
  check(/forbidden|42501/.test(r.error?.message ?? ""), `pengguna biasa ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await openRevision(trainer, subjectId);
  check(/forbidden|42501/.test(r.error?.message ?? ""), `trainer tidak bisa memakai jalur admin (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await openRevision(approver, subjectId, "abc");
  check(/revision_rationale_required/.test(r.error?.message ?? ""), `catatan terlalu pendek ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await openRevision(approver, subjectId);
  check(!r.error && Boolean(r.data), `approver membuka revisi (${r.error?.message ?? "ok"})`);
  let [draft] = await openDraft(subjectId);
  check(quizOf(draft?.payload) === "Soal versi LIVE?", `kuis revisi = versi tayang, bukan yang ditolak (${quizOf(draft?.payload)})`);
  check(fileOf(draft?.payload) === "materi-LIVE.pdf", `lampiran revisi = versi tayang (${fileOf(draft?.payload)})`);
  check(draft?.submitter_id === trainer.id, "draf revisi milik trainer");
  s = await subjectOf(subjectId);
  m = await live(subjectId);
  check(s.metadata.review_status === "revision_requested" && m.version === v1 && m.current_status === "published", "trainer diminta revisi, versi tayang tetap");
  r = await openRevision(approver, subjectId);
  check(/published_revision_already_open/.test(r.error?.message ?? ""), `tidak bisa dibuka dua kali (${r.error?.message ?? "TIDAK DITOLAK"})`);

  console.log("\n== kiriman trainer menunggu keputusan");
  r = await save(trainer, draft.id, "Versi kedua", "V2");
  s = await subjectOf(subjectId);
  check(!r.error && s.current_status === "pending", `trainer mengirim revisi → antre (${r.error?.message ?? "ok"})`);
  r = await openRevision(approver, subjectId);
  check(/module_review_in_progress/.test(r.error?.message ?? ""), `membuka revisi saat kiriman menunggu ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
  const { data: active } = await svc.from("review_drafts").select("status, payload").eq("linked_subject_id", subjectId).neq("status", "withdrawn");
  check((active ?? []).length === 1 && quizOf(active[0].payload) === "Soal versi V2?", "kiriman trainer tetap utuh (tidak ditarik)");
  r = await decide(approver, subjectId, "approve", "Revisi disetujui");
  m = await live(subjectId);
  check(!r.error && m.version === v1 + 1 && m.summary === "Versi kedua", `diputuskan lewat jalur biasa → versi ${m?.version}`);

  console.log("\n== revisi berikutnya mulai dari versi terbaru");
  r = await openRevision(approver, subjectId, "Mohon perbarui lagi");
  [draft] = await openDraft(subjectId);
  check(!r.error && quizOf(draft?.payload) === "Soal versi V2?", `revisi baru berisi versi ${v1 + 1} yang tayang (${r.error?.message ?? quizOf(draft?.payload)})`);
} catch (e) {
  failed++;
  console.log("  FAIL", e.message);
} finally {
  const { data: subs } = await svc.from("review_subjects").select("id").in("submitted_by", created);
  const ids = (subs ?? []).map((x) => x.id);
  if (ids.length) {
    const { data: mods } = await svc.from("module_registry").select("id").in("source_submission_id", ids);
    const modIds = (mods ?? []).map((x) => x.id);
    if (modIds.length) {
      await svc.from("module_quiz_answer_keys").delete().in("module_id", modIds);
      await svc.from("knowledge_resources").delete().in("source_submission_id", ids);
      const { error } = await svc.from("module_registry").delete().in("id", modIds);
      if (error) console.log("cleanup module", error.message);
    }
    await svc.from("review_records").delete().in("subject_id", ids);
    await svc.from("review_assignments").delete().in("subject_id", ids);
    await svc.from("review_decisions").delete().in("subject_id", ids);
    await svc.from("review_subject_revisions").delete().in("subject_id", ids);
    await svc.from("governance_audit_log").delete().in("subject_id", ids);
  }
  await svc.from("review_drafts").delete().in("submitter_id", created);
  if (ids.length) {
    const { error } = await svc.from("review_subjects").delete().in("id", ids);
    if (error) console.log("cleanup subjects", error.message);
  }
  if (experts.length) {
    await svc.from("expert_trainer_status").delete().in("expert_id", experts);
    const { error } = await svc.from("experts").delete().in("id", experts);
    if (error) console.log("cleanup experts", error.message);
  }
  await svc.from("governance_audit_log").delete().in("actor_id", created);
  await svc.from("platform_events").delete().in("actor_id", created);
  for (const id of created) await svc.from("rbac_user_roles").delete().eq("user_id", id);
  for (const id of created) {
    await svc.from("profiles").delete().eq("id", id);
    const { error } = await retry(() => svc.auth.admin.deleteUser(id));
    if (error) console.log("cleanup user", id, error.message);
  }
  const { data: left } = await svc.from("review_subjects").select("id").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  console.log(left?.length ? `Data uji tersisa: ${left.length} pengajuan` : "Data uji tersisa: 0");
}
console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed ? 1 : 0);
