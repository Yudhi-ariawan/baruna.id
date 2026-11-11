/**
 * Live test of recorded enrolment uploads (migration 20261111010000; KESIAPAN_RILIS
 * bagian E: "dokumen yang belum dikirim hanya diingat di layar") against the database
 * in .env and the running app (npm run dev; CONSOLE_TEST_URL or APP_BASE_URL).
 * Two logins of one participant stand for two devices.
 *
 * It WRITES test data (accounts @example.test, course "tdd-upl-<stamp>", an offering,
 * uploaded PDFs, applications, audit rows) and removes everything at the end.
 * Run: npm run test:enrollment-uploads
 */
import { createClient } from "@supabase/supabase-js";
import { toJSONAsync, fromCrossJSON } from "seroval";
import { cleanupEnrollmentDocuments } from "./cleanup-enrollment-documents.mjs";

const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const APP = (process.env.CONSOLE_TEST_URL || process.env.APP_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
if (!URL_ || !SERVICE || !ANON) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}
const BUCKET = "enrollment-documents";
const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const PASSWORD = "TddUpl!2026#";
const COURSE = `tdd-upl-${stamp}`, OFF = `of-tdd-upl-${stamp}`;
const created = [];
const uploaded = [];
let courseId = null;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const DOCS_FILE = "/src/lib/learning/enrollment-documents.functions.ts";
const APPLY_FILE = "/src/lib/learning/enrollment-application.functions.ts";
const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function callFn(token, file, exp, data, method = "POST") {
  const headers = { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${token}` };
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
async function login(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(error.message);
  return { c, token: s.session.access_token };
}
async function persona(label, role, devices = 1) {
  const email = `tdd-upl-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_upl_test" });
    if (e) throw new Error(e.message);
  }
  const d = [];
  for (let i = 0; i < devices; i++) d.push(await login(email));
  return { id: u.user.id, d };
}
/** Upload a PDF from one device and record it, as the course page does. */
async function upload(dev, requirement, fileName) {
  const r = await callFn(dev.token, DOCS_FILE, "createEnrollmentDocumentUpload", { offeringCode: OFF, fileName, size: PDF.length, contentType: "application/pdf" });
  if (r.error) return { error: r.error };
  const up = await dev.c.storage.from(BUCKET).uploadToSignedUrl(r.data.path, r.data.token, PDF, { contentType: "application/pdf" });
  if (up.error) return { error: up.error.message };
  uploaded.push(r.data.path);
  const reg = await callFn(dev.token, DOCS_FILE, "registerEnrollmentDocument", { offeringCode: OFF, requirement, path: r.data.path, fileName });
  return reg.error ? { error: reg.error, path: r.data.path } : { path: r.data.path, supported: reg.data?.supported };
}
const status = async (dev) => (await callFn(dev.token, APPLY_FILE, "getMyCourseEnrollmentStatus", { courseId: OFF }, "GET")).data;
const send = (dev) => callFn(dev.token, APPLY_FILE, "submitCourseEnrollmentApplication", { courseId: OFF, courseTitle: "x", useUploadedDocuments: true });
/** null when the table does not exist yet (before the migration). */
const recordedRows = async (uid) => {
  const { data, error } = await svc.from("course_enrollment_document_uploads").select("requirement, storage_path, file_name").eq("user_id", uid);
  return error ? null : data ?? [];
};
const sentDocs = async (uid) => (await svc.from("course_enrollment_documents").select("requirement, storage_path, file_name").eq("user_id", uid)).data ?? [];

await fetch(APP + DOCS_FILE);
await fetch(APP + APPLY_FILE);
try {
  const tpl = (await svc.from("learning_templates").select("id").eq("code", "knowledge_course").single()).data.id;
  courseId = (await svc.from("master_courses").insert({ course_code: COURSE, title: "TDD Unggahan", language: "en", learning_template_id: tpl, status: "active", version: 1 }).select("id").single()).data.id;
  await svc.from("master_modules").insert([{ master_course_id: courseId, module_code: "TU-01", title: "Satu", sequence: 1, learning_hours: 1 }]);
  const mode = (await svc.from("delivery_modes").select("id").eq("code", "blended_cohort").single()).data.id;
  const o = await svc.from("course_offerings").insert({ master_course_id: courseId, offering_code: OFF, offering_title: "Angkatan Unggahan", year: 2026, delivery_mode_id: mode,
    access_mode: "application-required", status: "published", learning_engine_version: "shared_v1", shared_learn_path: `/academy/course/${OFF}`, learning_model: "cohort_based",
    delivery_format: "blended", enrolment_access_rule: "approval_required", classification_source: "operator", cohort_financial_model: "fee_based",
    cohort_financial_model_source: "operator", cohort_payment_responsibility: "government_or_public_funding", cohort_payment_responsibility_source: "operator",
    completion_evaluation_required: false, required_documents: ["Surat tugas", "CV"] }).select("id").single();
  if (o.error) throw new Error(o.error.message);
  await svc.from("learning_feature_flags").insert({ course_offering_id: o.data.id, engine_version: "shared_v1", enabled: true });

  const peserta = await persona("peserta", "participant", 2);
  const [hp, laptop] = peserta.d;
  const lain = await persona("lain", "participant");
  const operator = await persona("operator", "operator");

  console.log("1. Unggah di HP, lihat di laptop");
  let r = await upload(hp, "CV", "cv-hp.pdf");
  check(r.supported === true, `unggahan di HP tercatat di server (${r.error?.slice(0, 60) ?? (r.supported ? "ok" : "BELUM DIDUKUNG: migrasi belum dijalankan")})`);
  let st = await status(laptop);
  check(st?.uploads?.some((u) => u.requirement === "CV" && u.fileName === "cv-hp.pdf"), `laptop melihat CV dari HP sebelum dikirim (${JSON.stringify(st?.uploads?.map((u) => u.fileName) ?? null)})`);
  r = await upload(laptop, "Surat tugas", "st-laptop.pdf");
  st = await status(hp);
  check(st?.uploads?.length === 2, `HP melihat kedua dokumen (${st?.uploads?.length})`);

  console.log("2. Dua perangkat mengganti CV bersamaan");
  const [x, y] = await Promise.all([upload(hp, "CV", "cv-a.pdf"), upload(laptop, "CV", "cv-b.pdf")]);
  const cvRows = ((await recordedRows(peserta.id)) ?? []).filter((u) => u.requirement === "CV");
  check(!x.error && !y.error && cvRows.length === 1 && ["cv-a.pdf", "cv-b.pdf"].includes(cvRows[0].file_name), `tetap satu CV tercatat (${cvRows.map((u) => u.file_name).join(",")})`);

  console.log("3. Kirim dari laptop memakai unggahan yang tercatat");
  r = await send(laptop);
  const docs = await sentDocs(peserta.id);
  check(r.data?.status === "pending" && docs.length === 2, `pengajuan terkirim dengan dua dokumen (${r.error?.slice(0, 60) ?? r.data?.status}, ${docs.length})`);
  const sentCv = docs.find((d) => d.requirement === "CV")?.storage_path;
  check(Boolean(sentCv) && sentCv === cvRows[0]?.storage_path, "CV yang terkirim adalah unggahan terbaru yang tercatat");
  check((await recordedRows(peserta.id))?.length === 0, "catatan unggahan kosong setelah terkirim");
  r = await upload(hp, "CV", "cv-terlambat.pdf");
  check(/diproses|sudah disetujui/.test(r.error ?? ""), `selagi menunggu keputusan, unggahan baru ditolak (${(r.error ?? "DITERIMA").slice(0, 50)})`);

  console.log("4. Minta perbaikan, ganti CV dari HP, kirim dari laptop");
  r = await operator.d[0].c.rpc("admin_course_enrollment_decide", { _user_id: peserta.id, _course_id: OFF, _decision: "request_revision", _notes: "CV belum ditandatangani" });
  check(!r.error, `operator meminta perbaikan (${r.error?.message ?? "ok"})`);
  r = await upload(hp, "CV", "cv-ttd.pdf");
  st = await status(laptop);
  check(st?.status === "revision_requested" && st?.uploads?.[0]?.fileName === "cv-ttd.pdf", "laptop melihat CV baru dari HP");
  r = await send(laptop);
  const docs2 = await sentDocs(peserta.id);
  check(r.data?.status === "pending" && docs2.find((d) => d.requirement === "CV")?.file_name === "cv-ttd.pdf" && docs2.length === 2, "kirim ulang memakai CV baru, surat tugas tetap");

  console.log("5. Pemisahan data");
  const other = await status(lain.d[0]);
  check((other?.uploads ?? []).length === 0, "peserta lain tidak melihat unggahan orang lain");
  const victimPath = docs2[0]?.storage_path ?? uploaded[0];
  const steal = await callFn(lain.d[0].token, DOCS_FILE, "registerEnrollmentDocument", { offeringCode: OFF, requirement: "CV", path: victimPath, fileName: "curian.pdf" });
  check(Boolean(steal.error), `peserta lain tidak bisa memakai berkas orang lain (${(steal.error ?? (steal.data?.supported === false ? "fitur belum ada" : "BISA")).slice(0, 50)})`);
  const direct = await lain.d[0].c.from("course_enrollment_document_uploads").select("id");
  check(!direct.error && (direct.data ?? []).length === 0, `tabel unggahan hanya menampilkan milik sendiri (${direct.error?.message?.slice(0, 40) ?? "ok"})`);

  console.log("6. Pembersihan berkas yang tidak dipakai");
  const live = new Set((await sentDocs(peserta.id)).map((d) => d.storage_path));
  const cleaned = await cleanupEnrollmentDocuments(svc, { apply: true, minAgeHours: 0, onlyUsers: new Set([peserta.id, lain.id]) });
  const stillThere = async (p) => { const parts = p.split("/"); const { data } = await svc.storage.from(BUCKET).list(parts.slice(0, 2).join("/"), { search: parts[2] }); return (data ?? []).some((f) => f.name === parts[2]); };
  const keptLive = (await Promise.all([...live].map(stillThere))).every(Boolean);
  check(cleaned.deleted.length >= 3 && cleaned.deleted.every((p) => !live.has(p)) && keptLive,
    `berkas pengganti yang terbuang dihapus (${cleaned.deleted.length}), dokumen terkirim tetap ada`);
} finally {
  console.log("\nMembersihkan data uji...");
  if (uploaded.length) await svc.storage.from(BUCKET).remove(uploaded);
  if (created.length) await svc.from("course_enrollment_document_uploads").delete().in("user_id", created);
  const { data: offs } = await svc.from("course_offerings").select("id").eq("offering_code", OFF);
  const ids = (offs ?? []).map((x) => x.id);
  if (ids.length) {
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
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-upl-%")).count;
  console.log(left || rest ? `Tersisa: ${left} akun, ${rest} course uji.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
