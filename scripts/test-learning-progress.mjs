// Live test: a module pass is recorded only by the server (migration 20261021100000).
// Uses temporary @example.test accounts and a test course code; everything is deleted afterwards.
// Run: npm run test:learning-progress
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = `Tdd-${Math.random().toString(36).slice(2)}-Aa1!`, stamp = Date.now();
const CODE = `tdd-learning-${stamp}`;
const created = [];
let passed = 0, failed = 0;
const check = (cond, label) => { if (cond) { passed++; console.log("  ok  ", label); } else { failed++; console.log("  FAIL", label); } };

async function retry(fn, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= tries || !/fetch failed|timeout|ECONNRESET/i.test(String(e?.message ?? e))) throw e; await new Promise((r) => setTimeout(r, 1500 * i)); }
  }
}
async function persona(label) {
  const email = `tdd-learning-${label}-${stamp}@example.test`;
  const { data: u, error } = await retry(() => svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } }));
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await retry(() => c.auth.signInWithPassword({ email, password: PASSWORD }));
  if (se) throw new Error(se.message);
  return { id: u.user.id, c };
}
const row = async (uid) => (await svc.from("self_paced_enrollments").select("*").eq("user_id", uid).eq("code", CODE).maybeSingle()).data;
const record = (uid, correct, total = 10, max = 3) => svc.rpc("learning_record_quiz_attempt", {
  _uid: uid, _code: CODE, _kind: "master", _correct: correct, _total: total, _pass_mark: 70, _max_attempts: max,
  _title: "TDD Modul", _hours: "2", _instructor: null, _category: null,
});

try {
  const learner = await persona("learner");

  console.log("\n== browser tidak bisa meluluskan");
  let r = await learner.c.rpc("self_paced_sync", { _courses: { [CODE]: { code: CODE, explicitlyEnrolled: true, completed: true, score: 100, completedAt: Date.now(), completedSteps: { video: true, pdf: true, ppt: true, quiz: true } } } });
  let s = await row(learner.id);
  check(!r.error && s && s.completed === false && s.score === null && s.completion_source === null, `sinkron 'completed:true, score:100' diabaikan (${r.error?.message ?? "ok"})`);
  check(s?.completed_steps?.video === true && s?.completed_steps?.quiz === undefined, "langkah video disimpan, langkah kuis dari browser dibuang");
  r = await learner.c.rpc("learning_record_quiz_attempt", { _uid: learner.id, _code: CODE, _kind: "master", _correct: 10, _total: 10, _pass_mark: 70, _max_attempts: 3 });
  check(Boolean(r.error), `peserta tidak bisa memanggil fungsi pencatatan (${r.error?.code ?? "TERBUKA"})`);
  r = await learner.c.from("module_quiz_attempts").insert({ user_id: learner.id, module_code: CODE, module_kind: "master", correct: 10, total: 10, score: 100, pass_mark: 70, passed: true }).select("id");
  check(Boolean(r.error), `peserta tidak bisa menulis percobaan kuis (${r.error?.code ?? "TERBUKA"})`);

  console.log("\n== pencatatan server");
  r = await record(learner.id, 10);
  check(!r.error && r.data?.recorded === false && r.data?.reason === "not_enrolled", `belum disetujui -> tidak dicatat (${r.error?.message ?? r.data?.reason})`);
  const { error: appErr } = await svc.from("course_enrollment_applications").insert({ user_id: learner.id, course_id: CODE, course_title: "TDD Modul", status: "approved" });
  if (appErr) throw new Error(appErr.message);
  r = await record(learner.id, 5);
  check(!r.error && r.data?.recorded === true && r.data?.passed === false && r.data?.score === 50 && r.data?.attemptsLeft === 2, `gagal 50% tercatat, sisa 2 (${r.error?.message ?? JSON.stringify(r.data)})`);
  r = await record(learner.id, 8);
  s = await row(learner.id);
  check(!r.error && r.data?.passed === true && s?.completed === true && s?.completion_source === "server_quiz" && Number(s?.score) === 80, `lulus 80% tercatat sebagai server_quiz (${r.error?.message ?? "ok"})`);
  r = await record(learner.id, 10);
  check(r.data?.recorded === false && r.data?.reason === "already_passed", "setelah lulus tidak ada pencatatan baru");
  r = await learner.c.from("module_quiz_attempts").select("score").eq("module_code", CODE);
  check(!r.error && r.data?.length === 2, `peserta membaca 2 percobaannya sendiri (${r.error?.message ?? r.data?.length})`);

  console.log("\n== jejak kelulusan");
  r = await learner.c.from("self_paced_enrollments").delete().eq("code", CODE).select("code");
  check(!r.error && (r.data?.length ?? 0) === 0 && Boolean(await row(learner.id)), "baris yang sudah lulus tidak bisa dihapus peserta");

  console.log("\n== ringkasan trainer");
  r = await learner.c.rpc("trainer_module_learning_summary");
  check(/trainer_access_required/.test(r.error?.message ?? ""), `bukan trainer ditolak (${r.error?.message ?? "TERBUKA"})`);
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  r = await anon.rpc("trainer_module_learning_summary");
  check(Boolean(r.error), `pengunjung ditolak (${r.error?.code ?? "TERBUKA"})`);
} catch (e) {
  failed++;
  console.log("  FAIL", e.message);
} finally {
  await svc.from("module_quiz_attempts").delete().eq("module_code", CODE);
  await svc.from("self_paced_enrollments").delete().eq("code", CODE);
  await svc.from("course_enrollment_applications").delete().eq("course_id", CODE);
  for (const id of created) {
    await svc.from("rbac_user_roles").delete().eq("user_id", id);
    await svc.from("profiles").delete().eq("id", id);
    const { error } = await retry(() => svc.auth.admin.deleteUser(id));
    if (error) console.log("cleanup user", id, error.message);
  }
}
console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed ? 1 : 0);
