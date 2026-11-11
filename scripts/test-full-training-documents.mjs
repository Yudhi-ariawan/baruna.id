/**
 * Live test of Full Training application documents (migration 20261111020000;
 * CATATAN_PERBAIKAN 2ax) against the database in .env and the running app (npm run
 * dev; CONSOLE_TEST_URL or APP_BASE_URL). Two logins of one participant stand for two
 * devices (HP and laptop).
 *
 * Checks: the files really reach the selection committee, every required document is
 * needed, PDF/JPG/PNG size rules, and after "Minta Perbaikan" one document can be
 * replaced from another device and sent again while the others stay.
 *
 * It WRITES test data (accounts @example.test, uploaded files, Full Training
 * applications of those accounts, audit rows) and removes everything at the end.
 * Run: npm run test:full-training-documents
 */
import { readFileSync } from "node:fs";
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
const FT = "international-training-fisheries-african-countries";
const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const PASSWORD = "TddFtd!2026#";
const created = [];
const uploaded = [];
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

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
  const email = `tdd-ftd-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_ftd_test" });
  if (e) throw new Error(e.message);
  const d = [];
  for (let i = 0; i < devices; i++) d.push(await login(email));
  return { id: u.user.id, d };
}
/** Upload one document from a device and record it, as the apply page does. */
async function upload(dev, requirement, fileName, body = PDF, contentType = "application/pdf", size = body.length) {
  const r = await callFn(dev.token, DOCS_FILE, "createEnrollmentDocumentUpload", { courseId: FT, fileName, size, contentType });
  if (r.error) return { error: r.error };
  const up = await dev.c.storage.from(BUCKET).uploadToSignedUrl(r.data.path, r.data.token, body, { contentType: r.data.contentType });
  if (up.error) return { error: up.error.message };
  uploaded.push(r.data.path);
  const reg = await callFn(dev.token, DOCS_FILE, "registerEnrollmentDocument", { courseId: FT, requirement, path: r.data.path, fileName });
  return reg.error ? { error: reg.error, path: r.data.path } : { path: r.data.path, supported: reg.data?.supported };
}
const status = async (dev) => (await callFn(dev.token, APPLY_FILE, "getMyCourseEnrollmentStatus", { courseId: FT }, "GET")).data;
const send = (dev, notes) => callFn(dev.token, APPLY_FILE, "submitCourseEnrollmentApplication", { courseId: FT, courseTitle: "x", notes, useUploadedDocuments: true });
const sentDocs = async (uid) => {
  const { data: app } = await svc.from("course_enrollment_applications").select("id").eq("user_id", uid).eq("course_id", FT).maybeSingle();
  if (!app) return [];
  return (await svc.from("course_enrollment_documents").select("id, requirement, storage_path, file_name").eq("application_id", app.id)).data ?? [];
};

await fetch(APP + DOCS_FILE);
await fetch(APP + APPLY_FILE);
try {
  console.log("0. Daftar dokumen server sama dengan formulir");
  const { data: prog, error: progErr } = await svc.from("full_training_programs").select("required_documents").eq("course_id", FT).maybeSingle();
  const formLabels = [...readFileSync(new URL("../src/lib/application.ts", import.meta.url), "utf8")
    .split("export const DOCUMENT_FIELDS")[1].split("];")[0].matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
  check(!progErr && JSON.stringify(prog?.required_documents) === JSON.stringify(formLabels),
    `server meminta ${prog?.required_documents?.length ?? 0} dokumen yang sama dengan formulir (${progErr?.message?.slice(0, 50) ?? "ok"})`);
  const REQ = prog?.required_documents ?? formLabels;

  const peserta = await persona("peserta", "participant", 2);
  const [hp, laptop] = peserta.d;
  const lain = await persona("lain", "participant");
  const operator = await persona("operator", "operator");
  const approver = await persona("approver", "approver");

  console.log("1. Unggah di HP, lihat di laptop");
  let r = await upload(hp, "Passport Copy", "paspor.jpg", JPG, "image/jpeg");
  check(r.supported === true, `paspor JPG dari HP tercatat di server (${r.error?.slice(0, 60) ?? (r.supported ? "ok" : "BELUM DIDUKUNG")})`);
  r = await upload(hp, "Curriculum Vitae (CV)", "cv-lama.pdf");
  let st = await status(laptop);
  check(st?.programDocuments?.length === 5 && st?.uploads?.length === 2, `laptop melihat daftar 5 dokumen dan 2 unggahan dari HP (${st?.programDocuments?.length}/${st?.uploads?.length})`);

  console.log("2. Aturan berkas");
  r = await callFn(hp.token, DOCS_FILE, "createEnrollmentDocumentUpload", { courseId: FT, fileName: "foto.png", size: 3 * 1024 * 1024, contentType: "image/png" });
  check(/2 MB/.test(r.error ?? ""), `gambar 3 MB ditolak (${(r.error ?? "DITERIMA").slice(0, 40)})`);
  r = await callFn(hp.token, DOCS_FILE, "createEnrollmentDocumentUpload", { courseId: FT, fileName: "cv.docx", size: 1000, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  check(/PDF, JPG/.test(r.error ?? ""), `Word ditolak (${(r.error ?? "DITERIMA").slice(0, 40)})`);

  console.log("3. Kirim dari laptop");
  r = await send(laptop, "Motivasi saya");
  check(/belum lengkap/.test(r.error ?? ""), `dokumen belum lengkap ditolak (${(r.error ?? r.data?.status ?? "").slice(0, 50)})`);
  check((await sentDocs(peserta.id)).length === 0 && !(await svc.from("course_enrollment_applications").select("id").eq("user_id", peserta.id).eq("course_id", FT).maybeSingle()).data,
    "tidak ada pengajuan setengah jadi");
  for (const req of REQ.filter((x) => !["Passport Copy", "Curriculum Vitae (CV)"].includes(x))) {
    r = await upload(laptop, req, req.includes("Photo") ? "foto.jpg" : `${req}.pdf`, req.includes("Photo") ? JPG : PDF, req.includes("Photo") ? "image/jpeg" : "application/pdf");
  }
  r = await send(laptop, "Motivasi saya");
  let docs = await sentDocs(peserta.id);
  check(r.data?.status === "pending" && docs.length === 5, `pengajuan terkirim dengan lima dokumen (${r.error?.slice(0, 60) ?? r.data?.status}, ${docs.length})`);
  check((await status(hp))?.uploads?.length === 0, "catatan unggahan kosong setelah terkirim");
  r = await upload(hp, "Curriculum Vitae (CV)", "cv-terlambat.pdf");
  check(/diproses|sudah disetujui/.test(r.error ?? ""), `selagi menunggu keputusan, dokumen tidak bisa diganti (${(r.error ?? "DITERIMA").slice(0, 50)})`);

  console.log("4. Admin membuka dokumen");
  const cvDoc = docs.find((d) => d.requirement === "Curriculum Vitae (CV)");
  const url = await callFn(operator.d[0].token, DOCS_FILE, "getEnrollmentDocumentUrl", { documentId: cvDoc?.id }, "GET");
  const body = url.data?.url ? Buffer.from(await (await fetch(url.data.url)).arrayBuffer()) : null;
  check(Boolean(body) && body.subarray(0, 5).toString() === "%PDF-", `operator membuka CV peserta (${url.error?.slice(0, 50) ?? "ok"})`);
  const spy = await callFn(lain.d[0].token, DOCS_FILE, "getEnrollmentDocumentUrl", { documentId: cvDoc?.id }, "GET");
  check(Boolean(cvDoc) && /tidak ditemukan|tidak berwenang/.test(spy.error ?? ""), `peserta lain tidak bisa membuka CV orang lain (${(spy.error ?? "BISA").slice(0, 40)})`);

  console.log("5. Minta perbaikan, ganti CV dari HP, kirim dari laptop");
  r = await operator.d[0].c.rpc("admin_course_enrollment_decide", { _user_id: peserta.id, _course_id: FT, _decision: "request_revision", _notes: "CV belum ditandatangani" });
  check(!r.error, `operator meminta perbaikan (${r.error?.message ?? "ok"})`);
  st = await status(hp);
  check(st?.status === "revision_requested" && st?.documents?.length === 5, `HP melihat permintaan perbaikan dan lima dokumen yang sudah terkirim (${st?.status}/${st?.documents?.length})`);
  r = await upload(hp, "Curriculum Vitae (CV)", "cv-ttd.pdf");
  st = await status(laptop);
  check(st?.uploads?.length === 1 && st.uploads[0].fileName === "cv-ttd.pdf", "laptop melihat CV pengganti dari HP");
  r = await send(laptop, "CV sudah ditandatangani");
  const docs2 = await sentDocs(peserta.id);
  const same = docs2.filter((d) => d.requirement !== "Curriculum Vitae (CV)").every((d) => docs.find((o) => o.requirement === d.requirement)?.storage_path === d.storage_path);
  check(r.data?.status === "pending" && docs2.length === 5 && docs2.find((d) => d.requirement === "Curriculum Vitae (CV)")?.file_name === "cv-ttd.pdf" && same,
    `kirim ulang mengganti CV, empat dokumen lain tetap (${r.error?.slice(0, 60) ?? r.data?.status})`);

  console.log("6. Keputusan dan pemisahan data");
  r = await approver.d[0].c.rpc("admin_course_enrollment_decide", { _user_id: peserta.id, _course_id: FT, _decision: "approve", _notes: null });
  check(!r.error, `approver menyetujui (${r.error?.message ?? "ok"})`);
  const other = await status(lain.d[0]);
  check(other?.status === "none" && (other?.uploads ?? []).length === 0, "peserta lain tidak melihat pengajuan atau unggahan orang lain");
  const victimPath = docs2[0]?.storage_path ?? uploaded[0] ?? `enrollment/${peserta.id}/${"a".repeat(32)}.pdf`;
  const steal = await callFn(lain.d[0].token, DOCS_FILE, "registerEnrollmentDocument", { courseId: FT, requirement: "Curriculum Vitae (CV)", path: victimPath, fileName: "curian.pdf" });
  check(/tidak valid/.test(steal.error ?? ""), `peserta lain tidak bisa memakai berkas orang lain (${(steal.error ?? (steal.data?.supported === false ? "fitur belum ada" : "BISA")).slice(0, 50)})`);
} finally {
  console.log("\nMembersihkan data uji...");
  if (uploaded.length) await svc.storage.from(BUCKET).remove(uploaded);
  if (created.length) {
    await svc.from("course_enrollment_document_uploads").delete().in("user_id", created);
    await svc.from("course_enrollment_applications").delete().in("user_id", created);
    await svc.from("admin_audit_log").delete().in("actor_id", created);
    await svc.from("admin_audit_log").delete().in("target_user_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) { const { error } = await svc.auth.admin.deleteUser(id); if (error) { left++; console.log("  gagal hapus user", id, error.message); } }
  console.log(left ? `Tersisa: ${left} akun.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
