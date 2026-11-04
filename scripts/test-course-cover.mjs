/**
 * Live test of the Master Course cover image (migration 20261104020000) against the
 * database in .env and the running app (npm run dev; CONSOLE_TEST_URL or APP_BASE_URL).
 *
 * Upload goes through the app's server function (role, author, size, real file type),
 * then the draft is submitted and approved by a different approver; the database must
 * re-check the path and keep it in the course and its version record.
 *
 * It WRITES test data (accounts @example.test, course "tdd-cover-<stamp>", drafts,
 * uploaded images, audit rows) and removes everything at the end.
 * Run: npm run test:course-cover
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
const BUCKET = "knowledge-module-covers";
const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const PASSWORD = "TddCover!2026#";
const COURSE_CODE = `tdd-cover-${stamp}`;
const created = [];
const uploaded = [];
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const errOf = (r) => r.error?.message ?? "";

// 1x1 PNG.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PDF = Buffer.from("%PDF-1.4\n%fake cover pretending to be an image\n").toString("base64");
const BIG = Buffer.concat([Buffer.from(PNG, "base64"), Buffer.alloc(2 * 1024 * 1024)]).toString("base64");

const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
const COVER_FN = "/src/lib/academy/program-cover.functions.ts";
async function uploadCover(token, draftId, dataBase64) {
  const res = await fetch(`${APP}/_serverFn/${fnId(COVER_FN, "uploadProgramCover")}`, {
    method: "POST",
    headers: { "x-tsr-serverFn": "true", accept: "application/json", "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(await toJSONAsync({ data: { draftId, dataBase64 } })),
  });
  const text = await res.text();
  try {
    const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] });
    if (v?.error) return { error: String(v.error.message ?? v.error) };
    if (v?.result?.path) uploaded.push(v.result.path);
    return { path: v?.result?.path, error: v?.result ? null : text.slice(0, 160) };
  } catch {
    // Thrown errors are serialized as "$TSR/Error" (needs a plugin): read the message directly.
    const m = text.match(/"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"\}/);
    return { error: m ? JSON.parse(`"${m[1]}"`) : `HTTP ${res.status} ${text.slice(0, 160)}` };
  }
}

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-cover-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_cover_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(se.message);
  return { id: u.user.id, c, token: s.session.access_token };
}
const draftRow = async (id) => (await svc.from("academy_program_drafts").select("*").eq("id", id).maybeSingle()).data;
const save = async (u, id, payload) => u.c.rpc("program_draft_save", { _draft_id: id, _payload: payload, _expected_updated_at: (await draftRow(id))?.updated_at });
const decide = async (u, id, decision, note = null) => u.c.rpc("program_draft_decide", { _draft_id: id, _decision: decision, _note: note, _expected_updated_at: (await draftRow(id))?.updated_at });
const course = (o = {}) => ({ course_code: COURSE_CODE, title: "TDD Course Bersampul", description: "uji sampul", language: "en",
  learning_template_code: "knowledge_course", modules: [{ module_code: "CV-01", title: "Satu", learning_hours: 1 }], ...o });

await fetch(APP + COVER_FN); // dev mode registers the server function once its module is loaded
try {
  const operator = await persona("operator", "operator");
  const approver = await persona("approver", "approver");
  const plain = await persona("plain");
  // Roles are read with valid_from <= app clock; wait until this machine passed it.
  const { data: grants } = await svc.from("rbac_user_roles").select("valid_from").in("user_id", created);
  const wait = Math.max(0, ...(grants ?? []).map((g) => new Date(g.valid_from).getTime())) + 1500 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  console.log("1. Unggah lewat server");
  const d1 = (await operator.c.rpc("program_draft_open", { _kind: "master_course", _target_id: null })).data;
  check(Boolean(d1), "operator membuka draf course");
  let r = await uploadCover(plain.token, d1, PNG);
  check(/tidak berwenang/.test(r.error ?? "") && !r.path, `pengguna biasa ditolak (${(r.error ?? "TIDAK DITOLAK").slice(0, 70)})`);
  r = await uploadCover(approver.token, d1, PNG);
  check(/tidak berwenang/.test(r.error ?? "") && !r.path, `approver tidak bisa mengunggah ke draf orang lain (${(r.error ?? "TIDAK DITOLAK").slice(0, 70)})`);
  r = await uploadCover(operator.token, d1, PDF);
  check(/PNG, JPG, atau WebP/.test(r.error ?? ""), `PDF yang menyamar ditolak (${(r.error ?? "TIDAK DITOLAK").slice(0, 70)})`);
  r = await uploadCover(operator.token, d1, BIG);
  // The validator refuses the oversized body before the handler runs (length limit of 2 MB in base64).
  check(/too_big|2 MB|String must contain at most/i.test(r.error ?? "") && !r.path, `lebih dari 2 MB ditolak (${(r.error ?? "TIDAK DITOLAK").slice(0, 70)})`);
  r = await uploadCover(operator.token, d1, PNG);
  const path = r.path;
  check(/^academy-courses\/[0-9a-f]{32}\.png$/.test(path ?? ""), `PNG sah diunggah (${path ?? r.error})`);
  const pub = path ? await fetch(svc.storage.from(BUCKET).getPublicUrl(path).data.publicUrl) : null;
  check(pub?.status === 200 && /image\/png/.test(pub.headers.get("content-type") ?? ""), `gambar bisa dibuka publik sebagai image/png (${pub?.status})`);

  console.log("2. Database memeriksa sampul");
  const fake = `academy-courses/${"0".repeat(32)}.png`;
  await save(operator, d1, course({ cover_path: fake }));
  r = await operator.c.rpc("program_draft_submit", { _draft_id: d1 });
  check(/program_cover_invalid/.test(errOf(r)), `alamat sampul yang tidak ada ditolak saat dikirim (${errOf(r).slice(0, 60) || "DITERIMA"})`);
  if (!r.error) await operator.c.rpc("program_draft_withdraw", { _draft_id: d1 });

  console.log("3. Persetujuan dan versi");
  const d2 = (await draftRow(d1))?.status === "withdrawn"
    ? (await operator.c.rpc("program_draft_open", { _kind: "master_course", _target_id: null })).data : d1;
  await save(operator, d2, course({ cover_path: path }));
  r = await operator.c.rpc("program_draft_submit", { _draft_id: d2 });
  check(!r.error, `draf bersampul dikirim ${errOf(r)}`);
  r = await decide(approver, d2, "approve");
  check(!r.error, `approver lain menyetujui ${errOf(r)}`);
  const { data: live, error: le } = await svc.from("master_courses").select("id, cover_path, version").eq("course_code", COURSE_CODE).maybeSingle();
  check(live?.cover_path === path, `course tayang menyimpan sampul (${le?.message ?? live?.cover_path ?? "kosong"})`);
  const { data: ver } = live ? await svc.from("master_course_versions").select("snapshot").eq("master_course_id", live.id).eq("version", 1).maybeSingle() : { data: null };
  check(ver?.snapshot?.cover_path === path, "riwayat versi mencatat sampul");
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: pubRow, error: pe } = await anon.from("master_courses").select("cover_path").eq("course_code", COURSE_CODE).maybeSingle();
  check(pubRow?.cover_path === path, `katalog publik bisa membaca sampul (${pe?.message ?? pubRow?.cover_path ?? "kosong"})`);
  const { error: we } = await operator.c.from("master_courses").update({ cover_path: null }).eq("course_code", COURSE_CODE);
  const { data: after } = await svc.from("master_courses").select("cover_path").eq("course_code", COURSE_CODE).maybeSingle();
  check(Boolean(we) || after?.cover_path === path, `sampul tidak bisa diubah langsung tanpa persetujuan (${we?.message?.slice(0, 50) ?? "tidak berubah"})`);
} finally {
  console.log("\nMembersihkan data uji...");
  await svc.from("academy_program_drafts").delete().in("created_by", created);
  const { data: cs } = await svc.from("master_courses").select("id").eq("course_code", COURSE_CODE);
  if (cs?.length) await svc.from("master_courses").delete().in("id", cs.map((x) => x.id));
  if (uploaded.length) await svc.storage.from(BUCKET).remove(uploaded);
  await svc.from("governance_audit_log").delete().in("actor_id", created);
  await svc.from("rbac_user_roles").delete().in("user_id", created);
  let left = 0;
  for (const id of created) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) { left++; console.log("  gagal hapus user", id, error.message); }
  }
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-cover-%")).count;
  const { data: files } = await svc.storage.from(BUCKET).list("academy-courses", { limit: 1000 });
  const leftFiles = (files ?? []).filter((f) => uploaded.some((p) => p.endsWith(f.name))).length;
  console.log(left || rest || leftFiles ? `Tersisa: ${left} akun, ${rest} course uji, ${leftFiles} berkas.` : "Selesai: database dan penyimpanan bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ")}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
