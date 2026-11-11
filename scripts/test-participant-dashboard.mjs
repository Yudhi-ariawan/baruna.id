/**
 * Live test of the participant dashboard and enrolment-decision notifications
 * (PB-ACA-03/04, Slide 13 and 22) against the database in .env and the running app
 * (npm run dev; CONSOLE_TEST_URL or APP_BASE_URL).
 *
 * Checks: "Minta Perbaikan" and rejection show on the dashboard and as notifications,
 * an approved Course Offering is shown as a course (page link, module progress) and
 * never as a module, and nobody sees another participant's data.
 *
 * It WRITES test data (accounts @example.test, course "tdd-dash-<stamp>", an offering,
 * applications, enrolments, progress, audit rows) and removes everything at the end.
 * Run: npm run test:participant-dashboard
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
const PASSWORD = "TddDash!2026#";
const COURSE = `tdd-dash-${stamp}`, OFF = `of-tdd-dash-${stamp}`;
const created = [];
let courseId = null;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const errOf = (r) => r.error?.message ?? "";

const OVERVIEW = "/src/lib/learning/my-learning.functions.ts";
const NOTIFS = "/src/lib/notifications/notifications.functions.ts";
const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function callFn(token, file, exp) {
  const headers = { "x-tsr-serverFn": "true", accept: "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const payload = JSON.stringify(await toJSONAsync({ data: undefined }));
  const res = await fetch(`${APP}/_serverFn/${fnId(file, exp)}?payload=${encodeURIComponent(payload)}`, { headers });
  const text = await res.text();
  try {
    const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] });
    return v?.result !== undefined ? { data: v.result } : { error: String(v?.error?.message ?? text.slice(0, 120)) };
  } catch {
    const m = text.match(/"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"\}/);
    return { error: m ? JSON.parse(`"${m[1]}"`) : text.slice(0, 160) };
  }
}
const APPLY_FILE = "/src/lib/learning/enrollment-application.functions.ts";
async function postFn(token, file, exp, data) {
  const res = await fetch(`${APP}/_serverFn/${fnId(file, exp)}`, { method: "POST",
    headers: { "x-tsr-serverFn": "true", accept: "application/json", "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(await toJSONAsync({ data })) });
  const text = await res.text();
  try {
    const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] });
    return v?.result !== undefined ? { data: v.result } : { error: String(v?.error?.message ?? text.slice(0, 120)) };
  } catch {
    const m = text.match(/"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"\}/);
    return { error: m ? JSON.parse(`"${m[1]}"`) : text.slice(0, 160) };
  }
}
const FT = "international-training-fisheries-african-countries"; // Full Training: course id = training slug
const DOCS_FILE = "/src/lib/learning/enrollment-documents.functions.ts";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const uploaded = [];
/**
 * After migration 20261111020000 a Full Training application needs its documents:
 * upload and record one small PDF per required document, as the apply page does.
 * Before it there is no document list and nothing is uploaded.
 */
async function ftAttachDocs(token) {
  const { data: prog, error } = await svc.from("full_training_programs").select("required_documents").eq("course_id", FT).maybeSingle();
  if (error || !prog) return 0;
  for (const requirement of prog.required_documents) {
    const up = await postFn(token, DOCS_FILE, "createEnrollmentDocumentUpload", { courseId: FT, fileName: "dok.pdf", size: PDF.length, contentType: "application/pdf" });
    if (up.error) throw new Error(up.error);
    const put = await svc.storage.from("enrollment-documents").uploadToSignedUrl(up.data.path, up.data.token, PDF, { contentType: "application/pdf" });
    if (put.error) throw new Error(put.error.message);
    uploaded.push(up.data.path);
    const reg = await postFn(token, DOCS_FILE, "registerEnrollmentDocument", { courseId: FT, requirement, path: up.data.path, fileName: `${requirement}.pdf` });
    if (reg.error) throw new Error(reg.error);
  }
  return prog.required_documents.length;
}
const overview = async (u) => (await callFn(u.token, OVERVIEW, "getMyLearningOverview"));
const enrollNotifs = async (u) => {
  const r = await callFn(u.token, NOTIFS, "listMyNotifications");
  return r.error ? { error: r.error } : { data: (r.data ?? []).filter((n) => String(n.id).startsWith("enrollment-")) };
};

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-dash-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_dash_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(se.message);
  return { id: u.user.id, c, token: s.session.access_token };
}
const apply = (u) => u.c.rpc("course_enrollment_apply", { _course_id: OFF, _course_title: "TDD Dashboard", _notes: null });
const decide = (admin, u, d, n) => admin.c.rpc("admin_course_enrollment_decide", { _user_id: u.id, _course_id: OFF, _decision: d, _notes: n });

await fetch(APP + OVERVIEW); // dev mode registers the server functions once the module is loaded
await fetch(APP + NOTIFS);
await fetch(APP + APPLY_FILE);
try {
  const tpl = (await svc.from("learning_templates").select("id").eq("code", "knowledge_course").single()).data.id;
  courseId = (await svc.from("master_courses").insert({ course_code: COURSE, title: "TDD Dashboard", language: "en", learning_template_id: tpl, status: "active", version: 1 }).select("id").single()).data.id;
  await svc.from("master_modules").insert([
    { master_course_id: courseId, module_code: "TD-01", title: "Satu", sequence: 1, learning_hours: 1 },
    { master_course_id: courseId, module_code: "TD-02", title: "Dua", sequence: 2, learning_hours: 1 },
  ]);
  const mode = (await svc.from("delivery_modes").select("id").eq("code", "blended_cohort").single()).data.id;
  const o = await svc.from("course_offerings").insert({ master_course_id: courseId, offering_code: OFF, offering_title: "Angkatan Dashboard", year: 2026, delivery_mode_id: mode,
    access_mode: "application-required", status: "published", learning_engine_version: "shared_v1", shared_learn_path: `/academy/course/${OFF}`, learning_model: "cohort_based",
    delivery_format: "blended", enrolment_access_rule: "approval_required", classification_source: "operator", cohort_financial_model: "fee_based",
    cohort_financial_model_source: "operator", cohort_payment_responsibility: "government_or_public_funding", cohort_payment_responsibility_source: "operator",
    completion_evaluation_required: false, required_documents: [] }).select("id").single();
  if (o.error) throw new Error(o.error.message);
  await svc.from("learning_feature_flags").insert({ course_offering_id: o.data.id, engine_version: "shared_v1", enabled: true });

  const peserta = await persona("peserta", "participant");
  const lain = await persona("lain", "participant");
  const operator = await persona("operator", "operator");
  const approver = await persona("approver", "approver");

  console.log("1. Pengajuan menunggu");
  let r = await apply(peserta);
  check(r.data?.status === "pending", `peserta mengajukan (${errOf(r).slice(0, 50) || r.data?.status})`);
  let ov = await overview(peserta);
  let app = ov.data?.applications?.find((a) => a.courseId === OFF);
  check(app?.status === "pending" && app?.kind === "offering", `dashboard: menunggu, dikenali sebagai Course Offering (${ov.error?.slice(0, 60) ?? `${app?.status}/${app?.kind}`})`);
  check(ov.data?.counts?.pending === 1 && !ov.data?.courses?.some((c) => c.code === OFF), "dashboard: 1 menunggu, belum ada di daftar belajar");

  console.log("2. Minta perbaikan");
  r = await decide(operator, peserta, "request_revision", "Lengkapi nama instansi");
  check(!r.error, `operator meminta perbaikan (${errOf(r).slice(0, 50) || "ok"})`);
  ov = await overview(peserta);
  app = ov.data?.applications?.find((a) => a.courseId === OFF);
  check(app?.status === "revision_requested" && app?.decisionNotes === "Lengkapi nama instansi", `dashboard: perlu perbaikan beserta catatan (${app?.status})`);
  check(ov.data?.counts?.revisionRequested === 1 && ov.data?.counts?.pending === 0, "dashboard: hitungan perlu perbaikan 1, menunggu 0");
  let n = await enrollNotifs(peserta);
  const rev = n.data?.find((x) => x.type === "revision_requested");
  check(Boolean(rev) && rev.targetUrl === `/academy/course/${OFF}` && rev.body.includes("Lengkapi nama instansi"),
    `notifikasi minta perbaikan, tautan ke halaman course (${n.error?.slice(0, 50) ?? rev?.targetUrl ?? "TIDAK ADA"})`);

  console.log("3. Kirim ulang dan disetujui");
  r = await apply(peserta);
  check(r.data?.status === "pending", `peserta mengirim ulang (${errOf(r).slice(0, 50) || r.data?.status})`);
  r = await decide(approver, peserta, "approve", null);
  check(!r.error, `approver menyetujui (${errOf(r).slice(0, 50) || "ok"})`);
  ov = await overview(peserta);
  const rows = (ov.data?.courses ?? []).filter((c) => c.code === OFF);
  const row = rows[0];
  check(rows.length === 1 && row?.kind === "offering", `dashboard: satu baris course, bukan modul (${rows.length}/${row?.kind})`);
  check(row?.offering?.totalModules === 2 && row?.progress === 0 && row?.approved === true, `dashboard: 0 dari 2 modul (${row?.offering?.completedModules}/${row?.offering?.totalModules}, ${row?.progress}%)`);
  check(ov.data?.counts?.inProgress === 1 && ov.data?.counts?.revisionRequested === 0, "dashboard: 1 sedang dipelajari");
  n = await enrollNotifs(peserta);
  const ok = n.data?.find((x) => x.type === "approved");
  check(Boolean(ok) && ok.targetUrl === `/academy/course/${OFF}`, `notifikasi disetujui, tautan ke halaman course (${ok?.targetUrl ?? "TIDAK ADA"})`);
  check(n.data?.length === 2, `riwayat lengkap: minta perbaikan tetap ada setelah disetujui (${n.data?.length})`);

  console.log("4. Progres modul");
  const enr = (await svc.from("enrolments").select("id").eq("user_id", peserta.id).eq("course_offering_id", o.data.id).single()).data;
  r = await peserta.c.rpc("learning_progress_mark", { _enrolment_id: enr.id, _activity_id: "module:TD-01", _status: "completed", _progress: null });
  check(!r.error, `peserta menandai modul 1 selesai (${errOf(r).slice(0, 50) || "ok"})`);
  ov = await overview(peserta);
  const row2 = ov.data?.courses?.find((c) => c.code === OFF);
  check(row2?.progress === 50 && row2?.offering?.completedModules === 1, `dashboard: progres 50% (${row2?.progress}%)`);

  console.log("5. Ditolak dan pemisahan data");
  r = await apply(lain);
  r = await decide(operator, lain, "reject", "Kuota angkatan ini penuh");
  check(!r.error, `pengajuan peserta lain ditolak (${errOf(r).slice(0, 50) || "ok"})`);
  const nl = await enrollNotifs(lain);
  const rej = nl.data?.find((x) => x.type === "rejected");
  check(Boolean(rej) && rej.body.includes("Kuota angkatan ini penuh") && rej.targetUrl === `/academy/course/${OFF}`, `notifikasi ditolak dengan alasan (${rej?.targetUrl ?? "TIDAK ADA"})`);
  const ovl = await overview(lain);
  check(ovl.data?.applications?.find((a) => a.courseId === OFF)?.status === "rejected" && (ovl.data?.courses ?? []).length === 0,
    "dashboard peserta lain: ditolak, tanpa data belajar peserta pertama");
  n = await enrollNotifs(peserta);
  check(n.data?.length === 2 && !n.data.some((x) => x.type === "rejected"), "notifikasi peserta pertama tidak berisi keputusan orang lain");

  console.log("6. Full Training: minta perbaikan lalu kirim ulang (tidak macet)");
  const ftDecide = (admin, d, n) => admin.c.rpc("admin_course_enrollment_decide", { _user_id: peserta.id, _course_id: FT, _decision: d, _notes: n });
  await ftAttachDocs(peserta.token);
  r = await postFn(peserta.token, APPLY_FILE, "submitCourseEnrollmentApplication", { courseId: FT, courseTitle: "Full Training TDD", notes: "Motivasi awal", useUploadedDocuments: true });
  check(r.data?.status === "pending", `peserta mengajukan Full Training (${r.error?.slice(0, 50) ?? r.data?.status})`);
  r = await ftDecide(operator, "request_revision", "Lampirkan surat tugas atasan");
  check(!r.error, `operator meminta perbaikan Full Training (${errOf(r).slice(0, 50) || "ok"})`);
  check(/application_awaiting_revision/.test(errOf(await ftDecide(approver, "approve", null))), "selagi menunggu perbaikan, admin tidak bisa memutuskan (inilah kenapa peserta harus bisa kirim ulang)");
  ov = await overview(peserta);
  const ftApp = ov.data?.applications?.find((a) => a.courseId === FT);
  check(ftApp?.kind === "program" && ftApp?.status === "revision_requested" && ftApp?.notes === "Motivasi awal",
    `dashboard: dikenali sebagai Full Training, perlu perbaikan, catatan lama tersedia untuk diisi ulang (${ftApp?.kind}/${ftApp?.status})`);
  n = await enrollNotifs(peserta);
  const ftRev = n.data?.find((x) => x.type === "revision_requested" && x.title.includes("Full Training TDD"));
  check(ftRev?.targetUrl === `/academy/apply/${FT}`, `notifikasi Full Training menuju halaman pendaftaran program, bisa dibuka dari perangkat mana pun (${ftRev?.targetUrl ?? "TIDAK ADA"})`);
  r = await postFn(peserta.token, APPLY_FILE, "submitCourseEnrollmentApplication", { courseId: FT, courseTitle: "Full Training TDD", notes: "Surat tugas sudah saya kirim lewat email" });
  check(r.data?.status === "pending", `peserta mengirim ulang dengan tanggapan (${r.error?.slice(0, 50) ?? r.data?.status})`);
  const ftRow = (await svc.from("course_enrollment_applications").select("status, notes, decision_notes").eq("user_id", peserta.id).eq("course_id", FT).single()).data;
  check(ftRow?.notes === "Surat tugas sudah saya kirim lewat email" && ftRow?.decision_notes === null, "tanggapan peserta tersimpan, catatan keputusan lama dibersihkan");
  r = await ftDecide(approver, "approve", null);
  check(!r.error && (await svc.from("course_enrollment_applications").select("status").eq("user_id", peserta.id).eq("course_id", FT).single()).data?.status === "approved",
    `approver kini bisa menyetujui (${errOf(r).slice(0, 50) || "ok"})`);

  const anon = await callFn(null, OVERVIEW, "getMyLearningOverview");
  check(Boolean(anon.error) && !anon.data, `tanpa login ditolak (${(anon.error ?? "BISA").slice(0, 40)})`);
} finally {
  console.log("\nMembersihkan data uji...");
  if (uploaded.length) await svc.storage.from("enrollment-documents").remove(uploaded);
  if (created.length) await svc.from("course_enrollment_document_uploads").delete().in("user_id", created);
  const { data: offs } = await svc.from("course_offerings").select("id").eq("offering_code", OFF);
  const ids = (offs ?? []).map((x) => x.id);
  if (ids.length) {
    const { data: ens } = await svc.from("enrolments").select("id").in("course_offering_id", ids);
    const eids = (ens ?? []).map((x) => x.id);
    if (eids.length) await svc.from("progress_records").delete().in("enrolment_id", eids);
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
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-dash-%")).count;
  console.log(left || rest ? `Tersisa: ${left} akun, ${rest} course uji.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
