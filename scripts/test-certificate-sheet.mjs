/**
 * Live test of the temporary certificate sheet data (getMyCertificateSheet, CATATAN_PERBAIKAN 2ap)
 * against the database in .env and the running app (npm run dev; CONSOLE_TEST_URL or APP_BASE_URL):
 * the owner gets their own name, course and number; another participant and an
 * anonymous caller get nothing.
 *
 * It WRITES test data (accounts @example.test, course "tdd-sheet-<stamp>", its offering,
 * an enrolment and a certificate) and removes everything at the end.
 * Run: npm run test:certificate-sheet
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
const PASSWORD = "TddSheet!2026#";
const COURSE = `tdd-sheet-${stamp}`, OFF = `of-tdd-sheet-${stamp}`;
const created = [];
let courseId = null, offeringId = null;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };

const FILE = "/src/lib/learning/certificate-sheet.functions.ts";
const fnId = Buffer.from(JSON.stringify({ file: `${FILE}?tss-serverfn-split`, export: "getMyCertificateSheet_createServerFn_handler" })).toString("base64url");
async function sheet(token, certificateNumber) {
  const qs = `?payload=${encodeURIComponent(JSON.stringify(await toJSONAsync({ data: { certificateNumber } })))}`;
  const headers = { "x-tsr-serverFn": "true", accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const text = await (await fetch(`${APP}/_serverFn/${fnId}${qs}`, { headers })).text();
  try {
    const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] });
    return v?.result ? { data: v.result } : { error: String(v?.error?.message ?? v?.error ?? text.slice(0, 120)) };
  } catch {
    const m = text.match(/"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"\}/);
    return { error: m ? JSON.parse(`"${m[1]}"`) : text.slice(0, 160) };
  }
}
const LEARN = "/src/lib/learning/learning.functions.ts";
async function callGet(token, exp) {
  const id = Buffer.from(JSON.stringify({ file: `${LEARN}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
  const text = await (await fetch(`${APP}/_serverFn/${id}`, { headers: { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${token}` } })).text();
  try { const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] }); return v?.result ?? null; } catch { return null; }
}
async function persona(label, name) {
  const email = `tdd-sheet-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: name, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(se.message);
  return { id: u.user.id, c, token: s.session.access_token };
}

await fetch(APP + FILE); // dev mode registers the server function once its module is loaded
await fetch(APP + LEARN);
try {
  const tpl = (await svc.from("learning_templates").select("id").eq("code", "knowledge_course").single()).data.id;
  courseId = (await svc.from("master_courses").insert({ course_code: COURSE, title: "TDD Lembar Sertifikat", language: "en", learning_template_id: tpl, status: "active", version: 1 }).select("id").single()).data.id;
  await svc.from("master_modules").insert([{ master_course_id: courseId, module_code: "SH-01", title: "Satu", sequence: 1, learning_hours: 1.5 },
    { master_course_id: courseId, module_code: "SH-02", title: "Dua", sequence: 2, learning_hours: 2 }]);
  const mode = (await svc.from("delivery_modes").select("id").eq("code", "open_self_paced").single()).data.id;
  const o = await svc.from("course_offerings").insert({ master_course_id: courseId, offering_code: OFF, offering_title: "TDD Offering Lembar", year: 2026,
    delivery_mode_id: mode, access_mode: "open", status: "published", learning_engine_version: "shared_v1", shared_learn_path: `/academy/course/${OFF}`,
    learning_model: "self_paced", delivery_format: "fully_online", enrolment_access_rule: "open", classification_source: "operator",
    self_paced_access_model: "free", self_paced_access_model_source: "operator", completion_evaluation_required: false }).select("id").single();
  if (o.error) throw new Error(o.error.message);
  offeringId = o.data.id;
  await svc.from("learning_feature_flags").insert({ course_offering_id: offeringId, engine_version: "shared_v1", enabled: true });

  const owner = await persona("owner", "Peserta Lembar Uji");
  const other = await persona("other", "Peserta Lain");
  const eid = (await owner.c.rpc("learning_enrol", { _offering_code: OFF })).data?.id;
  for (const m of ["SH-01", "SH-02"]) await owner.c.rpc("learning_progress_mark", { _enrolment_id: eid, _activity_id: `module:${m}`, _status: "completed", _progress: null });
  // Since 20261109010000 the certificate is issued when a different decider approves the completion.
  const approver = await persona("approver", "Approver Uji");
  const { data: roles } = await svc.from("rbac_roles").select("id").eq("code", "approver").single();
  await svc.from("rbac_user_roles").insert({ user_id: approver.id, role_id: roles.id, is_primary: false, status: "active", reason: "tdd_sheet_test" });
  const comp = (await svc.from("course_completions").select("id, updated_at").eq("enrolment_id", eid).maybeSingle()).data;
  const decided = await approver.c.rpc("completion_decide", { _id: comp?.id, _decision: "approve", _note: null, _expected_updated_at: comp?.updated_at });
  if (decided.error) console.log("  (persetujuan:", decided.error.message, ")");
  const iss = await owner.c.rpc("issue_my_certificate", { _enrolment_id: eid, _certificate_type: "completion" });
  const number = iss.data?.certificate_number;
  check(Boolean(number), `sertifikat terbit ${number ?? iss.error?.message}`);

  console.log("Data lembar sertifikat");
  const r = await sheet(owner.token, number);
  check(!r.error, `pemilik mendapat data lembar ${r.error ?? ""}`);
  check(r.data?.participantName === "Peserta Lembar Uji", `nama dari profil (${r.data?.participantName})`);
  check(r.data?.courseTitle === "TDD Lembar Sertifikat" && r.data?.offeringTitle === "TDD Offering Lembar", "judul course dan offering dari database");
  check(r.data?.certificateNumber === number && r.data?.moduleCount === 2 && r.data?.totalHours === 3.5, `nomor, 2 modul, 3,5 jam (${r.data?.moduleCount}, ${r.data?.totalHours})`);
  check(r.data?.verificationPath === `/academy/certification?verify=${number}`, "tautan verifikasi sesuai catatan database");
  const r2 = await sheet(other.token, number);
  check(/tidak ditemukan/i.test(r2.error ?? ""), `peserta lain tidak bisa mengambil sertifikat orang lain (${(r2.error ?? "DAPAT DATA").slice(0, 50)})`);
  const r3 = await sheet(null, number);
  check(Boolean(r3.error) && !r3.data, `tanpa login ditolak (${(r3.error ?? "DAPAT DATA").slice(0, 50)})`);
  const r4 = await sheet(owner.token, "BARUNA-COMPLETION-2026-999999-XXXXXX");
  check(/tidak ditemukan/i.test(r4.error ?? ""), "nomor yang tidak ada: tidak ditemukan");

  console.log("My Learning (2aq)");
  const myCerts = (await callGet(owner.token, "listMyCertificates")) ?? [];
  const mine = myCerts.find((c) => c.certificate_number === number);
  const off = Array.isArray(mine?.course_offerings) ? mine.course_offerings[0] : mine?.course_offerings;
  const mc = Array.isArray(off?.master_courses) ? off.master_courses[0] : off?.master_courses;
  check(Boolean(mine) && mc?.title === "TDD Lembar Sertifikat", `daftar sertifikat pemilik memuat sertifikat ini dengan judul course (${mc?.title ?? "tidak ada"})`);
  const otherCerts = (await callGet(other.token, "listMyCertificates")) ?? [];
  check(!otherCerts.some((c) => c.certificate_number === number), "daftar sertifikat peserta lain tidak memuatnya");
  const myEnr = (await callGet(owner.token, "listMyEnrolments")) ?? [];
  const e = myEnr.find((x) => (Array.isArray(x.course_offerings) ? x.course_offerings[0] : x.course_offerings)?.offering_code === OFF);
  const eo = Array.isArray(e?.course_offerings) ? e.course_offerings[0] : e?.course_offerings;
  check(e?.completion_status === "completed" && eo?.learning_engine_version === "shared_v1", `daftar course memuat course ini, selesai, mesin bersama (${e?.completion_status ?? "tidak ada"})`);
  const otherEnr = (await callGet(other.token, "listMyEnrolments")) ?? [];
  check(!otherEnr.some((x) => (Array.isArray(x.course_offerings) ? x.course_offerings[0] : x.course_offerings)?.offering_code === OFF), "daftar course peserta lain tidak memuatnya");
} finally {
  console.log("\nMembersihkan data uji...");
  if (offeringId) {
    await svc.from("certificates").delete().eq("course_offering_id", offeringId);
    const { data: es } = await svc.from("enrolments").select("id").eq("course_offering_id", offeringId);
    const eids = (es ?? []).map((e) => e.id);
    if (eids.length) { await svc.from("progress_records").delete().in("enrolment_id", eids); await svc.from("enrolments").delete().in("id", eids); }
    await svc.from("course_offerings").delete().eq("id", offeringId);
  }
  if (courseId) await svc.from("master_courses").delete().eq("id", courseId);
  if (created.length) {
    await svc.from("learning_audit_log").delete().in("actor_id", created);
    await svc.from("governance_audit_log").delete().in("actor_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) { const { error } = await svc.auth.admin.deleteUser(id); if (error) { left++; console.log("  gagal hapus user", id, error.message); } }
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-sheet-%")).count;
  console.log(left || rest ? `Tersisa: ${left} akun, ${rest} course uji.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ")}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
