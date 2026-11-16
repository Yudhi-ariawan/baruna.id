/**
 * Live test: attendance for cohort Course Offerings and redirecting the old Full
 * Training program to its replacement offering (migrations 20261116030000 and
 * 20261116040000; CATATAN_PERBAIKAN 2bb) against the database in .env and the running
 * app (npm run dev; CONSOLE_TEST_URL or APP_BASE_URL). Uses the app's server functions.
 *
 * It WRITES test data (accounts @example.test, course "tdd-att-<stamp>", an offering,
 * an enrolment, sessions, attendance, audit rows) and removes everything at the end.
 * The Full Training program's replacement setting is restored to what it was.
 * Run: npm run test:offering-attendance
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
const PASSWORD = "TddAtt!2026#";
const COURSE = `tdd-att-${stamp}`, OFF = `of-tdd-att-${stamp}`;
const FT = "international-training-fisheries-african-countries";
const created = [];
let courseId = null;
let ftBefore;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };

const ATT = "/src/lib/learning/attendance.functions.ts";
const REPL = "/src/lib/academy/full-training-replacement.functions.ts";
const APPLY = "/src/lib/learning/enrollment-application.functions.ts";
const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function callFn(token, file, exp, data, method = "POST") {
  const headers = { "x-tsr-serverFn": "true", accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const payload = JSON.stringify(await toJSONAsync({ data }));
  const res = method === "GET"
    ? await fetch(`${APP}/_serverFn/${fnId(file, exp)}?payload=${encodeURIComponent(payload)}`, { headers })
    : await fetch(`${APP}/_serverFn/${fnId(file, exp)}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: payload });
  const text = await res.text();
  try {
    const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] });
    return v?.result !== undefined ? { data: v.result } : { error: String(v?.error?.message ?? text.slice(0, 120)) };
  } catch {
    const m = text.match(/"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"\}/);
    return { error: m ? JSON.parse(`"${m[1]}"`) : text.slice(0, 160) };
  }
}
const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-att-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_att_test" });
  if (e) throw new Error(e.message);
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: le } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (le) throw new Error(le.message);
  return { id: u.user.id, c, token: s.session.access_token };
}

await Promise.all([ATT, REPL, APPLY].map((f) => fetch(APP + f)));
try {
  const ft = await svc.from("full_training_programs").select("replaced_by_offering_code").eq("course_id", FT).maybeSingle();
  ftBefore = ft.error ? undefined : ft.data?.replaced_by_offering_code ?? null;

  const operator = await persona("operator", "operator");
  const approver = await persona("approver", "approver");
  const peserta = await persona("peserta", "participant");
  const lain = await persona("lain", "participant");
  const baru = await persona("baru", "participant");

  const tpl = (await svc.from("learning_templates").select("id").eq("code", "knowledge_course").single()).data.id;
  courseId = (await svc.from("master_courses").insert({ course_code: COURSE, title: "TDD Kehadiran", language: "en", learning_template_id: tpl, status: "active", version: 1 }).select("id").single()).data.id;
  const mode = (await svc.from("delivery_modes").select("id").eq("code", "blended_cohort").single()).data.id;
  const o = await svc.from("course_offerings").insert({ master_course_id: courseId, offering_code: OFF, offering_title: "Angkatan Kehadiran", year: 2026, delivery_mode_id: mode,
    access_mode: "application-required", status: "published", learning_engine_version: "shared_v1", shared_learn_path: `/academy/course/${OFF}`, learning_model: "cohort_based",
    delivery_format: "blended", enrolment_access_rule: "approval_required", classification_source: "operator", cohort_financial_model: "fee_based",
    cohort_financial_model_source: "operator", cohort_payment_responsibility: "government_or_public_funding", cohort_payment_responsibility_source: "operator",
    completion_evaluation_required: false }).select("id").single();
  if (o.error) throw new Error(o.error.message);
  const offeringId = o.data.id;
  const enr = await svc.from("enrolments").insert({ user_id: peserta.id, course_offering_id: offeringId, enrolment_status: "enrolled" }).select("id").single();
  if (enr.error) throw new Error(enr.error.message);

  console.log("1. Operator membuat sesi dan mencatat kehadiran");
  let r = await callFn(operator.token, ATT, "listAttendanceOfferings", undefined, "GET");
  check((r.data ?? []).some((x) => x.id === offeringId), `offering angkatan muncul di daftar Kehadiran (${r.error?.slice(0, 60) ?? "ok"})`);
  r = await callFn(peserta.token, ATT, "listAttendanceOfferings", undefined, "GET");
  check(/Hanya Operator/.test(r.error ?? ""), "peserta tidak bisa membuka halaman Kehadiran");
  r = await callFn(operator.token, ATT, "saveAttendanceSession", { offeringId, id: null, title: "Hari 1 — Pembukaan", startsAt: new Date().toISOString(), location: "Bali" });
  const sessionId = r.data?.id;
  check(Boolean(sessionId), `sesi dibuat (${r.error?.slice(0, 60) ?? "ok"})`);
  r = await callFn(operator.token, ATT, "getAttendanceOverview", { offeringId }, "GET");
  check(r.data?.participants?.length === 1 && r.data.participants[0].enrolmentId === enr.data.id, "rekap menampilkan peserta terdaftar");
  r = await callFn(operator.token, ATT, "setAttendanceRecords", { sessionId, records: [{ enrolmentId: enr.data.id, status: "late", note: "15 menit" }] });
  check(r.data?.count === 1, `kehadiran tercatat (${r.error?.slice(0, 60) ?? "ok"})`);
  r = await callFn(approver.token, ATT, "setAttendanceRecords", { sessionId, records: [{ enrolmentId: enr.data.id, status: "present" }] });
  const recs = (await svc.from("attendance_records").select("status").eq("session_id", sessionId ?? "00000000-0000-0000-0000-000000000000")).data ?? [];
  check(recs.length === 1 && recs[0].status === "present", "Approver memperbarui: tetap satu catatan");

  console.log("2. Peserta melihat kehadirannya sendiri");
  r = await callFn(peserta.token, ATT, "getMyAttendance", { offeringId }, "GET");
  check(r.data?.[0]?.status === "present" && r.data[0].title === "Hari 1 — Pembukaan", "peserta melihat: Hadir");
  r = await callFn(lain.token, ATT, "getMyAttendance", { offeringId }, "GET");
  check(Array.isArray(r.data) && r.data.length === 0, "peserta lain tidak melihat apa pun");
  const direct = await lain.c.from("attendance_records").select("id");
  check(!direct.error && (direct.data ?? []).length === 0, "tabel kehadiran hanya menampilkan milik sendiri");
  r = await callFn(operator.token, ATT, "deleteAttendanceSession", { id: sessionId });
  check(/sudah punya catatan/.test(r.error ?? ""), "sesi yang sudah ada catatan tidak bisa dihapus");

  console.log("3. Full Training dialihkan ke Course Offering");
  r = await callFn(operator.token, REPL, "setFullTrainingReplacement", { courseId: FT, offeringCode: OFF });
  check(/Hanya Approver/.test(r.error ?? ""), "Operator tidak bisa mengatur pengalihan");
  r = await callFn(approver.token, REPL, "setFullTrainingReplacement", { courseId: FT, offeringCode: OFF });
  check(r.data?.replacedBy === OFF, `Approver menautkan program ke offering (${r.error?.slice(0, 60) ?? "ok"})`);
  r = await callFn(null, REPL, "getFullTrainingReplacement", { slug: FT }, "GET");
  check(r.data === OFF, "halaman Full Training (tanpa login) tahu offering penggantinya");
  r = await callFn(baru.token, APPLY, "submitCourseEnrollmentApplication", { courseId: FT, courseTitle: "x", useUploadedDocuments: true });
  check(/kini dibuka sebagai course/.test(r.error ?? ""), `pendaftar baru diarahkan ke course (${(r.error ?? "DITERIMA").slice(0, 50)})`);
} finally {
  console.log("\nMembersihkan data uji...");
  if (ftBefore !== undefined) await svc.from("full_training_programs").update({ replaced_by_offering_code: ftBefore }).eq("course_id", FT);
  const { data: offs } = await svc.from("course_offerings").select("id").eq("offering_code", OFF);
  const ids = (offs ?? []).map((x) => x.id);
  if (ids.length) {
    const { data: ses } = await svc.from("offering_sessions").select("id").in("course_offering_id", ids);
    const sids = (ses ?? []).map((x) => x.id);
    if (sids.length) await svc.from("attendance_records").delete().in("session_id", sids);
    await svc.from("offering_sessions").delete().in("course_offering_id", ids);
    await svc.from("enrolments").delete().in("course_offering_id", ids);
    await svc.from("learning_feature_flags").delete().in("course_offering_id", ids);
    await svc.from("course_offerings").delete().in("id", ids);
  }
  if (courseId) await svc.from("master_courses").delete().eq("id", courseId);
  if (created.length) {
    await svc.from("course_enrollment_applications").delete().in("user_id", created);
    await svc.from("admin_audit_log").delete().in("actor_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) { const { error } = await svc.auth.admin.deleteUser(id); if (error) { left++; console.log("  gagal hapus user", id, error.message); } }
  console.log(left ? `Tersisa: ${left} akun.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
