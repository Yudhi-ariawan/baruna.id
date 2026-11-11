/**
 * Live test of real-time decisions and of older applications named by offering title
 * (migration 20261111030000; CATATAN_PERBAIKAN 2ay) against the database in .env and
 * the running app (npm run dev; CONSOLE_TEST_URL or APP_BASE_URL).
 *
 * 1. Realtime: a participant subscribed like the navbar receives the administrator's
 *    decision within seconds, without reloading; another participant receives
 *    nothing; the approval queue receives a resubmission; a completion decision also
 *    arrives.
 * 2. An application whose course id is the offering TITLE (pre-2as) gets notification
 *    and dashboard links to the offering page by its code, not to a module page.
 *
 * It WRITES test data (accounts @example.test, course "tdd-live-<stamp>", an offering,
 * applications, an enrolment, a completion, audit rows) and removes everything at the end.
 * Run: npm run test:live-notifications
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
const PASSWORD = "TddLive!2026#";
const COURSE = `tdd-live-${stamp}`, OFF = `of-tdd-live-${stamp}`, OFF_TITLE = `Angkatan Live ${stamp}`;
const created = [];
const channels = [];
let courseId = null;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function getFn(token, file, exp) {
  const payload = JSON.stringify(await toJSONAsync({ data: undefined }));
  const res = await fetch(`${APP}/_serverFn/${fnId(file, exp)}?payload=${encodeURIComponent(payload)}`,
    { headers: { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${token}` } });
  const text = await res.text();
  try {
    const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] });
    return v?.result !== undefined ? { data: v.result } : { error: String(v?.error?.message ?? text.slice(0, 120)) };
  } catch {
    return { error: text.slice(0, 160) };
  }
}
const NOTIFS = "/src/lib/notifications/notifications.functions.ts";
const OVERVIEW = "/src/lib/learning/my-learning.functions.ts";

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-live-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_live_test" });
  if (e) throw new Error(e.message);
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: le } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (le) throw new Error(le.message);
  c.realtime.setAuth(s.session.access_token);
  return { id: u.user.id, c, token: s.session.access_token };
}
/** Subscribe like the app does; resolves once the channel is live. Collects events. */
async function listen(who, table, filter) {
  const events = [];
  const ch = who.c.channel(`tdd-${table}-${Math.random().toString(36).slice(2)}`);
  for (const event of ["INSERT", "UPDATE"]) {
    ch.on("postgres_changes", { event, schema: "public", table, ...(filter ? { filter } : {}) }, (p) => events.push(p));
  }
  const status = await new Promise((resolve) => {
    const t = setTimeout(() => resolve("TIMED_OUT"), 15000);
    ch.subscribe((s) => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") { clearTimeout(t); resolve(s); } });
  });
  channels.push([who.c, ch]);
  return { events, status };
}
async function waitFor(events, pred, ms = 10000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const hit = events.find(pred);
    if (hit) return { hit, ms: Date.now() - start };
    await sleep(200);
  }
  return { hit: null, ms };
}

try {
  const tpl = (await svc.from("learning_templates").select("id").eq("code", "knowledge_course").single()).data.id;
  courseId = (await svc.from("master_courses").insert({ course_code: COURSE, title: "TDD Live", language: "en", learning_template_id: tpl, status: "active", version: 1 }).select("id").single()).data.id;
  const mode = (await svc.from("delivery_modes").select("id").eq("code", "blended_cohort").single()).data.id;
  const o = await svc.from("course_offerings").insert({ master_course_id: courseId, offering_code: OFF, offering_title: OFF_TITLE, year: 2026, delivery_mode_id: mode,
    access_mode: "application-required", status: "published", learning_engine_version: "shared_v1", shared_learn_path: `/academy/course/${OFF}`, learning_model: "cohort_based",
    delivery_format: "blended", enrolment_access_rule: "approval_required", classification_source: "operator", cohort_financial_model: "fee_based",
    cohort_financial_model_source: "operator", cohort_payment_responsibility: "government_or_public_funding", cohort_payment_responsibility_source: "operator",
    completion_evaluation_required: false }).select("id").single();
  if (o.error) throw new Error(o.error.message);
  const offeringId = o.data.id;

  const peserta = await persona("peserta", "participant");
  const lain = await persona("lain", "participant");
  const operator = await persona("operator", "operator");
  const lama = await persona("lama", "participant");

  console.log("1. Keputusan sampai ke peserta tanpa memuat ulang");
  let r = await peserta.c.rpc("course_enrollment_apply", { _course_id: OFF, _course_title: "x", _notes: null });
  check(!r.error && r.data?.status === "pending", `peserta mengajukan (${r.error?.message ?? r.data?.status})`);
  const mine = await listen(peserta, "course_enrollment_applications", `user_id=eq.${peserta.id}`);
  const snoop = await listen(lain, "course_enrollment_applications", `user_id=eq.${peserta.id}`);
  const snoopAll = await listen(lain, "course_enrollment_applications");
  const queue = await listen(operator, "course_enrollment_applications");
  check(mine.status === "SUBSCRIBED" && snoop.status === "SUBSCRIBED" && queue.status === "SUBSCRIBED", `berlangganan perubahan (${mine.status}/${snoop.status}/${queue.status})`);
  await sleep(1500);
  r = await operator.c.rpc("admin_course_enrollment_decide", { _user_id: peserta.id, _course_id: OFF, _decision: "request_revision", _notes: "Lengkapi surat tugas" });
  check(!r.error, `operator meminta perbaikan (${r.error?.message ?? "ok"})`);
  let w = await waitFor(mine.events, (e) => e.new?.status === "revision_requested");
  check(Boolean(w.hit), `peserta menerima perubahan secara langsung (${w.hit ? `${w.ms} ms` : "TIDAK ADA dalam 10 detik"})`);
  check(w.hit?.new?.decision_notes === "Lengkapi surat tugas", "isi perubahan memuat catatan admin");

  console.log("2. Antrean admin ikut hidup");
  r = await peserta.c.rpc("course_enrollment_apply", { _course_id: OFF, _course_title: "x", _notes: "Sudah dilengkapi" });
  w = await waitFor(queue.events, (e) => e.new?.user_id === peserta.id && e.new?.status === "pending");
  check(Boolean(w.hit), `antrean Persetujuan Peserta menerima kiriman ulang (${w.hit ? `${w.ms} ms` : "TIDAK ADA"})`);

  console.log("3. Kelulusan");
  const enr = await svc.from("enrolments").insert({ user_id: peserta.id, course_offering_id: offeringId, enrolment_status: "enrolled" }).select("id").single();
  const done = await listen(peserta, "course_completions", `user_id=eq.${peserta.id}`);
  await sleep(1500);
  const comp = enr.error ? enr : await svc.from("course_completions").insert({ enrolment_id: enr.data.id, user_id: peserta.id, course_offering_id: offeringId }).select("id").single();
  check(!comp.error, `antrean kelulusan dibuat (${comp.error?.message ?? "ok"})`);
  if (!comp.error) await svc.from("course_completions").update({ status: "approved", decided_at: new Date().toISOString() }).eq("id", comp.data.id);
  w = await waitFor(done.events, (e) => e.new?.status === "approved");
  check(Boolean(w.hit), `peserta menerima keputusan kelulusan secara langsung (${w.hit ? `${w.ms} ms` : "TIDAK ADA"})`);

  console.log("4. Tidak bocor ke peserta lain");
  await sleep(1500);
  check(snoop.events.length === 0 && snoopAll.events.length === 0, `peserta lain tidak menerima apa pun (${snoop.events.length + snoopAll.events.length} event)`);

  console.log("5. Pengajuan lama yang memakai judul offering");
  const ins = await svc.from("course_enrollment_applications").insert({ user_id: lama.id, course_id: OFF_TITLE, course_title: OFF_TITLE, applicant_name: "TDD lama", status: "pending" });
  check(!ins.error, `pengajuan lama dibuat (${ins.error?.message ?? "ok"})`);
  r = await operator.c.rpc("admin_course_enrollment_decide", { _user_id: lama.id, _course_id: OFF_TITLE, _decision: "request_revision", _notes: "Perbaiki data" });
  check(!r.error, `admin masih bisa memutuskan dengan judul (${r.error?.message ?? "ok"})`);
  const n = await getFn(lama.token, NOTIFS, "listMyNotifications");
  const rev = (n.data ?? []).find((x) => String(x.id).startsWith("enrollment-") && x.type === "revision_requested");
  check(rev?.targetUrl === `/academy/course/${OFF}`, `notifikasi menuju halaman offering lewat kodenya (${rev?.targetUrl ?? n.error?.slice(0, 60) ?? "TIDAK ADA"})`);
  const ov = await getFn(lama.token, OVERVIEW, "getMyLearningOverview");
  const app = ov.data?.applications?.find((a) => a.courseId === OFF_TITLE);
  check(app?.kind === "offering" && app?.offeringCode === OFF, `dashboard mengenalinya sebagai Course Offering (${app?.kind}/${app?.offeringCode ?? ov.error?.slice(0, 60)})`);
  check(!(ov.data?.courses ?? []).some((c) => c.code === OFF_TITLE), "judul tidak muncul sebagai modul di daftar belajar");
} finally {
  console.log("\nMembersihkan data uji...");
  for (const [c, ch] of channels) await c.removeChannel(ch).catch(() => {});
  const { data: offs } = await svc.from("course_offerings").select("id").eq("offering_code", OFF);
  const ids = (offs ?? []).map((x) => x.id);
  if (ids.length) {
    await svc.from("course_completions").delete().in("course_offering_id", ids);
    await svc.from("enrolments").delete().in("course_offering_id", ids);
    await svc.from("learning_feature_flags").delete().in("course_offering_id", ids);
    await svc.from("course_offerings").delete().in("id", ids);
  }
  if (created.length) await svc.from("course_enrollment_applications").delete().in("user_id", created);
  if (courseId) await svc.from("master_courses").delete().eq("id", courseId);
  if (created.length) {
    await svc.from("admin_audit_log").delete().in("actor_id", created);
    await svc.from("admin_audit_log").delete().in("target_user_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) { const { error } = await svc.auth.admin.deleteUser(id); if (error) { left++; console.log("  gagal hapus user", id, error.message); } }
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-live-%")).count;
  console.log(left || rest ? `Tersisa: ${left} akun, ${rest} course uji.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
