// Live test: a trainer updates their own live module (migration 20261021120000).
// The live version must stay on air while the update is drafted and reviewed;
// approval publishes a new version, rejection keeps the old one, a verifier's
// return-for-revision cannot be dropped by the trainer, and the level quota is
// untouched. Creates a temporary trainer (public expert profile, required for an
// active trainer), approver and plain user (@example.test)
// plus one module, and deletes everything afterwards.
// Run: npm run test:module-update
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
  const email = `tdd-module-update-${label}-${stamp}@example.test`;
  const { data: u, error } = await retry(() => svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } }));
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_module_update_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await retry(() => c.auth.signInWithPassword({ email, password: PASSWORD }));
  if (se) throw new Error(se.message);
  return { id: u.user.id, c };
}
async function makeTrainer(user) {
  const { data: ex, error } = await svc.from("experts").insert({ source_type: "external_submission", original_contributor_id: user.id,
    created_by: user.id, display_name: `TDD Trainer ${stamp}`, slug: `tdd-module-update-${stamp}`, current_status: "published",
    visibility: "public", verification_status: "governance_verified" }).select("id").single();
  if (error) throw new Error(error.message);
  experts.push(ex.id);
  const { error: e2 } = await svc.from("expert_trainer_status").insert({ expert_id: ex.id, trainer_status: "active", trainer_level: "certified", rationale: "tdd_module_update_test" });
  if (e2) throw new Error(e2.message);
}

const payload = (trainerId, summary, hours) => ({
  title: `TDD Modul Pengawasan ${stamp}`, summary, language: "Indonesian", target_participants: "Pengawas perikanan",
  estimated_learning_hours: hours, learning_objectives: ["Memahami prosedur pengawasan"], topic: "MCS", competency: "Pengawasan",
  assessment_approach: { method: "Kuis", passing_score: 70, quiz_questions: [
    { id: 1, question: "Apa kepanjangan MCS?", options: ["Monitoring, Control and Surveillance", "Marine Coastal System"], correctAnswer: 0 }] },
  metadata: { level: "Intermediate", attached_resources: [
    { name: "materi.pdf", path: `users/${trainerId}/modules/tdd-${stamp}.pdf`, bucket: "module-attachments", size: 1000, type: "pdf" }] },
});
const save = (t, draftId, summary, hours, submit = true) => t.c.rpc("trainer_module_save", {
  _draft_id: draftId, _title: `TDD Modul Pengawasan ${stamp}`, _module_type: "technical", _payload: payload(t.id, summary, hours), _submit: submit });
const decide = (a, sid, d, why) => a.c.rpc("admin_module_decide", { _subject_id: sid, _decision: d, _rationale: why ?? null, _expected_updated_at: null });
const live = async (sid) => (await svc.from("module_registry").select("id, version, summary, current_status, visibility").eq("source_submission_id", sid).maybeSingle()).data;
const subjectOf = async (sid) => (await svc.from("review_subjects").select("current_status, metadata").eq("id", sid).single()).data;
const openDraft = async (sid) => (await svc.from("review_drafts").select("id, payload").eq("linked_subject_id", sid).eq("status", "draft")).data ?? [];
const quota = async (t) => (await t.c.rpc("trainer_portal_bootstrap")).data?.moduleQuota;
let subjectId = null;

try {
  const trainer = await persona("trainer", "expert");
  await makeTrainer(trainer);
  const approver = await persona("approver", "approver");
  const plain = await persona("plain");

  console.log("\n== modul pertama tayang");
  let r = await save(trainer, null, "Versi pertama", 4);
  subjectId = r.data?.subjectId;
  check(!r.error && Boolean(subjectId), `trainer mengirim modul (${r.error?.message ?? "ok"})`);
  if (!subjectId) throw new Error("modul uji tidak terbentuk; uji berikutnya dilewati");
  r = await decide(approver, subjectId, "approve", "Modul disetujui");
  let m = await live(subjectId);
  check(!r.error && m?.current_status === "published", `approver menyetujui → tayang (${r.error?.message ?? "ok"})`);
  const v1 = m.version;
  const quotaBefore = await quota(trainer);

  console.log("\n== membuka pembaruan");
  r = await trainer.c.rpc("trainer_open_module_update", { _subject_id: subjectId, _note: "abc" });
  check(/update_note_required/.test(r.error?.message ?? ""), `catatan terlalu pendek ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await plain.c.rpc("trainer_open_module_update", { _subject_id: subjectId, _note: "Pembaruan data" });
  check(/active_trainer_required/.test(r.error?.message ?? ""), `pengguna biasa ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await approver.c.rpc("trainer_open_module_update", { _subject_id: subjectId, _note: "Pembaruan data" });
  check(/active_trainer_required/.test(r.error?.message ?? ""), `approver tidak bisa memakai jalur trainer (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await trainer.c.rpc("trainer_open_module_update", { _subject_id: subjectId, _note: "Memperbarui data statistik 2026" });
  let draftId = r.data;
  check(!r.error && Boolean(draftId), `trainer membuka pembaruan (${r.error?.message ?? "ok"})`);
  m = await live(subjectId);
  check(m.version === v1 && m.summary === "Versi pertama" && m.current_status === "published", "versi tayang tidak berubah selama draf");
  let s = await subjectOf(subjectId);
  check(s.current_status === "approved" && s.metadata.revision_initiated_by === "trainer", "status pengajuan tetap disetujui, ditandai pembaruan trainer");
  const q2 = await quota(trainer);
  check(q2?.used === quotaBefore?.used, `kuota level tidak bertambah (${quotaBefore?.used} → ${q2?.used})`);
  r = await approver.c.rpc("request_published_module_revision", { _subject_id: subjectId, _rationale: "Mohon perbarui" });
  check(/published_revision_already_open/.test(r.error?.message ?? ""), `admin tidak bisa membuka revisi kedua (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await trainer.c.rpc("trainer_open_module_update", { _subject_id: subjectId, _note: "Pembaruan lagi" });
  check(/module_update_already_open/.test(r.error?.message ?? ""), `tidak bisa dibuka dua kali (${r.error?.message ?? "TIDAK DITOLAK"})`);

  console.log("\n== batal, buka lagi, kirim, disetujui");
  r = await trainer.c.rpc("trainer_cancel_module_update", { _subject_id: subjectId });
  s = await subjectOf(subjectId);
  check(!r.error && (await openDraft(subjectId)).length === 0 && s.metadata.review_status === "approved", `trainer membatalkan pembaruan (${r.error?.message ?? "ok"})`);
  r = await trainer.c.rpc("trainer_open_module_update", { _subject_id: subjectId, _note: "Memperbarui data statistik 2026" });
  draftId = r.data;
  r = await save(trainer, draftId, "Versi kedua: data 2026", 5);
  s = await subjectOf(subjectId);
  check(!r.error && s.current_status === "pending", `pembaruan dikirim → antre verifikasi (${r.error?.message ?? "ok"})`);
  m = await live(subjectId);
  check(m.version === v1 && m.summary === "Versi pertama", "versi lama tetap tayang selama diverifikasi");
  r = await trainer.c.rpc("trainer_open_module_update", { _subject_id: subjectId, _note: "Pembaruan lain" });
  check(/module_review_in_progress/.test(r.error?.message ?? ""), `tidak bisa membuka pembaruan baru saat diverifikasi (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await decide(approver, subjectId, "approve", "Pembaruan disetujui");
  m = await live(subjectId);
  check(!r.error && m.version === v1 + 1 && m.summary === "Versi kedua: data 2026" && m.current_status === "published", `disetujui → versi ${v1} naik ke ${m?.version}, isi baru tayang`);
  const { data: versions } = await svc.from("module_registry_versions").select("version").eq("module_id", m.id);
  check((versions ?? []).some((v) => v.version === v1 + 1), "versi baru tersimpan di riwayat versi modul");

  console.log("\n== pembaruan ditolak: versi lama tetap");
  r = await trainer.c.rpc("trainer_open_module_update", { _subject_id: subjectId, _note: "Coba ubah durasi" });
  r = await save(trainer, r.data, "Versi ketiga yang ditolak", 9);
  r = await decide(approver, subjectId, "reject", "Durasi tidak sesuai kurikulum");
  m = await live(subjectId);
  s = await subjectOf(subjectId);
  check(!r.error && m.version === v1 + 1 && m.summary === "Versi kedua: data 2026" && s.current_status === "approved", `ditolak → versi ${v1 + 1} tetap tayang (${r.error?.message ?? "ok"})`);

  console.log("\n== verifikator minta revisi pembaruan");
  r = await trainer.c.rpc("trainer_open_module_update", { _subject_id: subjectId, _note: "Menambah studi kasus" });
  check(!r.error, `bisa membuka pembaruan lagi setelah ditolak (${r.error?.message ?? "ok"})`);
  r = await save(trainer, r.data, "Versi ketiga: studi kasus", 6);
  r = await decide(approver, subjectId, "return_for_revision", "Lengkapi sumber studi kasus");
  check(!r.error, `verifikator mengembalikan pembaruan (${r.error?.message ?? "ok"})`);
  r = await trainer.c.rpc("trainer_cancel_module_update", { _subject_id: subjectId });
  check(/no_module_update_open|module_update_has_decision/.test(r.error?.message ?? ""), `trainer tidak bisa membatalkan setelah ada catatan verifikator (${r.error?.message ?? "TIDAK DITOLAK"})`);
  m = await live(subjectId);
  check(m.version === v1 + 1 && m.current_status === "published", "versi tayang tetap selama revisi diminta");
  const [d] = await openDraft(subjectId);
  r = await save(trainer, d?.id, "Versi ketiga: studi kasus + sumber", 6);
  r = await decide(approver, subjectId, "approve", "Lengkap");
  m = await live(subjectId);
  check(!r.error && m.version === v1 + 2 && m.summary === "Versi ketiga: studi kasus + sumber", `revisi dikirim ulang dan disetujui → versi ${m?.version}`);
  const q3 = await quota(trainer);
  check(q3?.used === quotaBefore?.used, `kuota tetap sama setelah tiga pembaruan (${q3?.used})`);
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
