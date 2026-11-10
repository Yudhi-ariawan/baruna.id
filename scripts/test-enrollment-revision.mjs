/**
 * Live test of required documents and "Minta Perbaikan" for Course Offering
 * applications (PB-ACA-03, migration 20261110020000) against the database in .env
 * and the running app (npm run dev; CONSOLE_TEST_URL or APP_BASE_URL).
 *
 * It WRITES test data (accounts @example.test, course "tdd-revdoc-<stamp>", an
 * offering, applications, uploaded PDFs, enrolments, audit rows) and removes
 * everything at the end.
 * Run: npm run test:enrollment-revision
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
const BUCKET = "enrollment-documents";
const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const PASSWORD = "TddRevDoc!2026#";
const COURSE = `tdd-revdoc-${stamp}`, OFF = `of-tdd-revdoc-${stamp}`;
const created = [];
const uploaded = [];
let courseId = null;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const errOf = (r) => r.error?.message ?? "";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const FILE = "/src/lib/learning/enrollment-documents.functions.ts";
const fnId = (exp) => Buffer.from(JSON.stringify({ file: `${FILE}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function callFn(token, exp, data, method) {
  const headers = { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${token}` };
  const payload = JSON.stringify(await toJSONAsync({ data }));
  const res = method === "GET"
    ? await fetch(`${APP}/_serverFn/${fnId(exp)}?payload=${encodeURIComponent(payload)}`, { headers })
    : await fetch(`${APP}/_serverFn/${fnId(exp)}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: payload });
  const text = await res.text();
  try {
    const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] });
    return v?.result ? { data: v.result } : { error: String(v?.error?.message ?? text.slice(0, 120)) };
  } catch {
    const m = text.match(/"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"\}/);
    return { error: m ? JSON.parse(`"${m[1]}"`) : text.slice(0, 160) };
  }
}

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-revdoc-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_revdoc_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(se.message);
  return { id: u.user.id, c, token: s.session.access_token };
}
async function uploadDoc(u, name = "dokumen.pdf") {
  const r = await callFn(u.token, "createEnrollmentDocumentUpload", { offeringCode: OFF, fileName: name, size: PDF.length, contentType: "application/pdf" }, "POST");
  if (r.error) return { error: r.error };
  const up = await u.c.storage.from(BUCKET).uploadToSignedUrl(r.data.path, r.data.token, PDF, { contentType: "application/pdf" });
  if (up.error) return { error: up.error.message };
  uploaded.push(r.data.path);
  return { path: r.data.path, fileName: name };
}
const apply = (u, docs) => u.c.rpc("course_enrollment_apply", { _course_id: OFF, _course_title: "x", _notes: null, ...(docs ? { _documents: docs } : {}) });
const appOf = async (u) => (await svc.from("course_enrollment_applications").select("id, status, decision_notes").eq("user_id", u.id).eq("course_id", OFF).maybeSingle()).data;

await fetch(APP + FILE); // dev mode registers the server functions once the module is loaded
try {
  const tpl = (await svc.from("learning_templates").select("id").eq("code", "knowledge_course").single()).data.id;
  courseId = (await svc.from("master_courses").insert({ course_code: COURSE, title: "TDD Dokumen", language: "en", learning_template_id: tpl, status: "active", version: 1 }).select("id").single()).data.id;
  await svc.from("master_modules").insert([{ master_course_id: courseId, module_code: "RD-01", title: "Satu", sequence: 1, learning_hours: 1 }]);
  const mode = (await svc.from("delivery_modes").select("id").eq("code", "blended_cohort").single()).data.id;
  const base = { master_course_id: courseId, offering_code: OFF, offering_title: "Angkatan Dokumen", year: 2026, delivery_mode_id: mode, access_mode: "application-required",
    status: "published", learning_engine_version: "shared_v1", shared_learn_path: `/academy/course/${OFF}`, learning_model: "cohort_based", delivery_format: "blended",
    enrolment_access_rule: "approval_required", classification_source: "operator", cohort_financial_model: "fee_based", cohort_financial_model_source: "operator",
    cohort_payment_responsibility: "government_or_public_funding", cohort_payment_responsibility_source: "operator", completion_evaluation_required: false };
  let o = await svc.from("course_offerings").insert({ ...base, required_documents: ["Surat tugas", "CV"] }).select("id").single();
  const hasDocsColumn = !o.error;
  if (o.error) o = await svc.from("course_offerings").insert(base).select("id").single();
  if (o.error) throw new Error(o.error.message);
  await svc.from("learning_feature_flags").insert({ course_offering_id: o.data.id, engine_version: "shared_v1", enabled: true });
  check(hasDocsColumn, "offering bisa menyimpan dokumen persyaratan");

  const peserta = await persona("peserta", "participant");
  const lain = await persona("lain", "participant");
  const operator = await persona("operator", "operator");
  const approver = await persona("approver", "approver");

  console.log("1. Unggah dokumen");
  const st = await uploadDoc(peserta, "surat-tugas.pdf");
  const cv = await uploadDoc(peserta, "cv.pdf");
  check(Boolean(st.path && cv.path), `PDF terunggah ke penyimpanan privat (${st.error ?? cv.error ?? "ok"})`);
  const notPdf = await callFn(peserta.token, "createEnrollmentDocumentUpload", { offeringCode: OFF, fileName: "foto.png", size: 100, contentType: "image/png" }, "POST");
  check(/PDF/.test(notPdf.error ?? ""), `bukan PDF ditolak server (${(notPdf.error ?? "DITERIMA").slice(0, 40)})`);
  const pub = st.path ? await fetch(`${URL_}/storage/v1/object/public/${BUCKET}/${st.path}`) : null;
  check(!pub || pub.status >= 400, `dokumen tidak bisa dibuka publik (${pub?.status})`);

  console.log("2. Pengajuan");
  let r = await apply(peserta, null);
  check(/documents_required/.test(errOf(r)), `tanpa dokumen ditolak (${errOf(r).slice(0, 40) || "DITERIMA"})`);
  if (!r.error) await svc.from("course_enrollment_applications").delete().eq("user_id", peserta.id).eq("course_id", OFF);
  r = await apply(peserta, [{ requirement: "Surat tugas", path: st.path ?? "x", file_name: "surat-tugas.pdf" }, { requirement: "CV", path: cv.path ?? "x", file_name: "cv.pdf" }]);
  check(r.data?.status === "pending", `dokumen lengkap: menunggu persetujuan (${errOf(r).slice(0, 50) || r.data?.status})`);
  const { count: nDocs } = await svc.from("course_enrollment_documents").select("id", { count: "exact", head: true }).eq("user_id", peserta.id);
  check(nDocs === 2, `dua dokumen tercatat (${nDocs})`);

  console.log("3. Minta perbaikan");
  const decide = (u, d, n) => u.c.rpc("admin_course_enrollment_decide", { _user_id: peserta.id, _course_id: OFF, _decision: d, _notes: n });
  check(/revision_note_required/.test(errOf(await decide(operator, "request_revision", "x"))), "catatan perbaikan wajib");
  r = await decide(operator, "request_revision", "CV belum ditandatangani");
  check(!r.error && (await appOf(peserta))?.status === "revision_requested", `operator meminta perbaikan (${errOf(r).slice(0, 50) || "ok"})`);
  check(/application_awaiting_revision/.test(errOf(await decide(approver, "approve", null))), "tidak bisa disetujui selagi menunggu perbaikan");
  const cv2 = await uploadDoc(peserta, "cv-ttd.pdf");
  r = await apply(peserta, [{ requirement: "CV", path: cv2.path ?? "x", file_name: "cv-ttd.pdf" }]);
  check(r.data?.status === "pending", `peserta mengirim ulang, hanya CV diganti (${errOf(r).slice(0, 50) || r.data?.status})`);
  const docs = (await svc.from("course_enrollment_documents").select("id, requirement, file_name").eq("user_id", peserta.id)).data ?? [];
  check(docs.length === 2 && docs.find((d) => d.requirement === "CV")?.file_name === "cv-ttd.pdf", "surat tugas lama tetap, CV diperbarui");

  console.log("4. Membuka dokumen");
  const docId = docs[0]?.id ?? "00000000-0000-0000-0000-000000000000";
  const own = await callFn(peserta.token, "getEnrollmentDocumentUrl", { documentId: docId }, "GET");
  const adm = await callFn(operator.token, "getEnrollmentDocumentUrl", { documentId: docId }, "GET");
  const other = await callFn(lain.token, "getEnrollmentDocumentUrl", { documentId: docId }, "GET");
  check(Boolean(own.data?.url), `pemilik bisa membuka (${(own.error ?? "ok").slice(0, 40)})`);
  const fileRes = adm.data?.url ? await fetch(adm.data.url) : null;
  check(fileRes?.status === 200 && (await fileRes.text()).startsWith("%PDF"), `operator membuka PDF lewat tautan sementara (${(adm.error ?? fileRes?.status ?? "").toString().slice(0, 40)})`);
  check(Boolean(other.error) && !other.data, `peserta lain tidak bisa (${(other.error ?? "BISA").slice(0, 40)})`);

  console.log("5. Persetujuan");
  r = await decide(approver, "approve", null);
  const enr = (await svc.from("enrolments").select("enrolment_status").eq("user_id", peserta.id).eq("course_offering_id", o.data.id).maybeSingle()).data;
  check(!r.error && enr?.enrolment_status === "enrolled", `disetujui dan terdaftar (${errOf(r).slice(0, 50) || "ok"})`);
} finally {
  console.log("\nMembersihkan data uji...");
  if (uploaded.length) await svc.storage.from(BUCKET).remove(uploaded);
  const { data: offs } = await svc.from("course_offerings").select("id").eq("offering_code", OFF);
  const ids = (offs ?? []).map((x) => x.id);
  if (ids.length) { await svc.from("enrolments").delete().in("course_offering_id", ids); await svc.from("course_offerings").delete().in("id", ids); }
  if (created.length) await svc.from("course_enrollment_applications").delete().in("user_id", created);
  if (courseId) await svc.from("master_courses").delete().eq("id", courseId);
  if (created.length) {
    await svc.from("admin_audit_log").delete().in("actor_id", created);
    await svc.from("admin_audit_log").delete().in("target_user_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) { const { error } = await svc.auth.admin.deleteUser(id); if (error) { left++; console.log("  gagal hapus user", id, error.message); } }
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-revdoc-%")).count;
  console.log(left || rest ? `Tersisa: ${left} akun, ${rest} course uji.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
