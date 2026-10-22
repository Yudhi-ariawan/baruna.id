// Live test: version history + learner notification when a module is updated
// (migration 20261022040000 + src/lib/notifications/learning-notifications.server.ts).
//
// 1. content_version_history: a module goes live (v1) and is updated (v2); the owner
//    and an approver see v2 and v1, another user does not, content is not exposed.
// 2. Notifications (through the running app, npm run dev): a learner enrolled before
//    v2 and not yet passed is told about v2; a learner who already passed and a
//    learner who enrolled after v2 are not.
// Creates temporary accounts (@example.test), one module and enrollments, and
// deletes everything afterwards.
// Run: npm run dev (other terminal), then npm run test:version-history
import { createClient } from "@supabase/supabase-js";
import { toJSONAsync, fromCrossJSON } from "seroval";

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const APP = (process.env.CONSOLE_TEST_URL || process.env.APP_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = `Tdd-${Math.random().toString(36).slice(2)}-Aa1!`, stamp = Date.now();
const created = [], experts = [];
let passed = 0, failed = 0, moduleId = null;
const check = (cond, label) => { if (cond) { passed++; console.log("  ok  ", label); } else { failed++; console.log("  FAIL", label); } };

async function retry(fn, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= tries || !/fetch failed|timeout|ECONNRESET/i.test(String(e?.message ?? e))) throw e; await new Promise((r) => setTimeout(r, 1500 * i)); }
  }
}
const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function callFn(token, file, exp) {
  const res = await fetch(`${APP}/_serverFn/${fnId(file, exp)}?payload=${encodeURIComponent(JSON.stringify(await toJSONAsync({ data: undefined })))}`,
    { headers: { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${token}` } });
  const text = await res.text();
  try { const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] }); return { result: v?.result, error: v?.error }; }
  catch (e) { return { error: { message: `decode: ${e.message} ${text.slice(0, 120)}` } }; }
}

const { data: roleRows, error: roleErr } = await svc.from("rbac_roles").select("id, code");
if (roleErr) throw new Error(roleErr.message);
const roleId = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));

async function persona(label, role) {
  const email = `tdd-version-history-${label}-${stamp}@example.test`;
  const { data: u, error } = await retry(() => svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } }));
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_version_history_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: se } = await retry(() => c.auth.signInWithPassword({ email, password: PASSWORD }));
  if (se) throw new Error(se.message);
  return { id: u.user.id, c, token: s.session.access_token };
}
async function makeTrainer(user) {
  const { data: ex, error } = await svc.from("experts").insert({ source_type: "external_submission", original_contributor_id: user.id,
    created_by: user.id, display_name: `TDD Trainer ${stamp}`, slug: `tdd-version-history-${stamp}`, current_status: "published",
    visibility: "public", verification_status: "governance_verified" }).select("id").single();
  if (error) throw new Error(error.message);
  experts.push(ex.id);
  const { error: e2 } = await svc.from("expert_trainer_status").insert({ expert_id: ex.id, trainer_status: "active", trainer_level: "certified", rationale: "tdd_version_history_test" });
  if (e2) throw new Error(e2.message);
}
const payload = (trainerId, summary) => ({
  title: `TDD Modul Versi ${stamp}`, summary, language: "Indonesian", target_participants: "Pengawas perikanan",
  estimated_learning_hours: 4, learning_objectives: ["Memahami prosedur pengawasan"], topic: "MCS", competency: "Pengawasan",
  assessment_approach: { method: "Kuis", passing_score: 70, quiz_questions: [
    { id: 1, question: "Apa kepanjangan MCS?", options: ["Monitoring, Control and Surveillance", "Marine Coastal System"], correctAnswer: 0 }] },
  metadata: { level: "Intermediate", attached_resources: [
    { name: "materi.pdf", path: `users/${trainerId}/modules/tdd-${stamp}.pdf`, bucket: "module-attachments", size: 1000, type: "pdf" }] },
});
const save = (t, draftId, summary) => t.c.rpc("trainer_module_save", {
  _draft_id: draftId, _title: `TDD Modul Versi ${stamp}`, _module_type: "technical", _payload: payload(t.id, summary), _submit: true });
const decide = (a, sid, d, why) => a.c.rpc("admin_module_decide", { _subject_id: sid, _decision: d, _rationale: why ?? null, _expected_updated_at: null });
const history = (u, sid) => u.c.rpc("content_version_history", { _subject_id: sid });
const enroll = (u) => svc.from("course_enrollment_applications").insert({ user_id: u.id, course_id: moduleId, course_title: `TDD Modul Versi ${stamp}`,
  status: "approved", decision_at: new Date().toISOString() });
let subjectId = null;

try {
  const trainer = await persona("trainer", "expert");
  await makeTrainer(trainer);
  const approver = await persona("approver", "approver");
  const outsider = await persona("outsider");
  const active = await persona("learner-active");
  const graduate = await persona("learner-passed");
  const late = await persona("learner-late");

  console.log("\n== modul v1 tayang, peserta mendaftar");
  let r = await save(trainer, null, "Versi pertama");
  subjectId = r.data?.subjectId;
  check(!r.error && Boolean(subjectId), `trainer mengirim modul (${r.error?.message ?? "ok"})`);
  if (!subjectId) throw new Error("modul uji tidak terbentuk");
  r = await decide(approver, subjectId, "approve", "Versi awal disetujui");
  moduleId = (await svc.from("module_registry").select("id").eq("source_submission_id", subjectId).single()).data?.id;
  check(!r.error && Boolean(moduleId), `v1 tayang (${r.error?.message ?? "ok"})`);
  for (const u of [active, graduate]) {
    const { error } = await enroll(u);
    if (error) throw new Error(`enroll: ${error.message}`);
  }
  const { error: passErr } = await svc.from("self_paced_enrollments").insert({ user_id: graduate.id, code: moduleId, title: `TDD Modul Versi ${stamp}`,
    completed: true, completion_source: "server_quiz", score: 90, completed_at: new Date().toISOString() });
  if (passErr) throw new Error(`passed row: ${passErr.message}`);
  await new Promise((res) => setTimeout(res, 1200));

  console.log("\n== trainer memperbarui → v2");
  r = await trainer.c.rpc("trainer_open_module_update", { _subject_id: subjectId, _note: "Menambah studi kasus 2026" });
  r = await save(trainer, r.data, "Versi kedua: studi kasus");
  r = await decide(approver, subjectId, "approve", "Pembaruan disetujui");
  const live = (await svc.from("module_registry").select("version").eq("id", moduleId).single()).data;
  check(!r.error && live?.version === 2, `v2 tayang (${r.error?.message ?? `v${live?.version}`})`);
  await new Promise((res) => setTimeout(res, 1200));
  { const { error } = await enroll(late); if (error) throw new Error(`enroll late: ${error.message}`); }

  console.log("\n== riwayat versi (RPC)");
  const h = await history(trainer, subjectId);
  const versions = h.data?.versions ?? [];
  check(!h.error && h.data?.currentVersion === 2 && h.data?.published === true, `pemilik melihat riwayat, versi tayang 2 (${h.error?.message ?? "ok"})`);
  check(versions.map((v) => v.version).join() === "2,1", `urutan v2, v1 (${versions.map((v) => v.version).join()})`);
  check(versions[0]?.note === "Pembaruan disetujui" && versions[0]?.approvedBy === "TDD approver", "v2: alasan dan nama penyetuju");
  check(versions[1]?.note === "Versi awal disetujui", "v1: dari keputusan approve pertama");
  check(!JSON.stringify(h.data ?? {}).includes("quiz_questions"), "isi modul (kuis) tidak dibuka");
  check(!(await history(approver, subjectId)).error, "approver melihat riwayat");
  check(/subject_not_found/.test((await history(outsider, subjectId)).error?.message ?? ""), "pengguna lain tidak bisa melihat");

  console.log(`\n== notifikasi peserta (aplikasi ${APP})`);
  let appUp = true;
  try { await fetch(APP, { method: "HEAD" }); } catch { appUp = false; }
  check(appUp, `aplikasi berjalan di ${APP} (jalankan npm run dev)`);
  if (appUp) {
    const fileFn = ["/src/lib/notifications/notifications.functions.ts", "listMyNotifications"];
    const has = async (u) => {
      const res = await callFn(u.token, ...fileFn);
      if (res.error) throw new Error(`listMyNotifications: ${res.error.message ?? JSON.stringify(res.error).slice(0, 160)}`);
      return (res.result ?? []).filter((n) => String(n.id).startsWith("module-update-") && String(n.targetUrl).endsWith(moduleId));
    };
    const a = await has(active);
    check(a.length === 1 && /versi 2/.test(a[0].title), `peserta yang sedang belajar diberi tahu v2 (${a.length} notifikasi)`);
    check(a[0]?.targetUrl === `/academy/learn/${moduleId}`, "notifikasi menuju ruang belajar modul");
    check((await has(graduate)).length === 0, "peserta yang sudah lulus tidak diberi tahu (menunggu keputusan mentor)");
    check((await has(late)).length === 0, "peserta yang mendaftar setelah v2 tidak diberi tahu");
    check((await has(outsider)).length === 0, "pengguna yang tidak terdaftar tidak diberi tahu");
  }
} catch (e) {
  failed++;
  console.log("  FAIL", e.message);
} finally {
  if (moduleId) {
    await svc.from("self_paced_enrollments").delete().eq("code", moduleId);
    await svc.from("course_enrollment_applications").delete().eq("course_id", moduleId);
  }
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
  await svc.from("notification_reads").delete().in("user_id", created);
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
