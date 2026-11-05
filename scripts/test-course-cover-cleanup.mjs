/**
 * Live test of scripts/cleanup-course-covers.mjs against the database and storage in .env.
 * It uploads its own test images, links some of them to a test course / drafts / a
 * version record, and runs the cleaner limited to those files only (never real ones).
 * Everything it creates is removed at the end.
 * Run: npm run test:course-cover-cleanup
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { BUCKET, PREFIX, cleanupCourseCovers } from "./cleanup-course-covers.mjs";

const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const COURSE_CODE = `tdd-cleanup-${stamp}`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const hexName = (ext = "png") => `${PREFIX}/${randomBytes(16).toString("hex")}.${ext}`;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };

const F = { orphan: hexName(), live: hexName(), openDraft: hexName("jpg"), version: hexName("webp"), rejectedDraft: hexName(), oddName: `${PREFIX}/tdd-cleanup-${stamp}.png` };
const moduleCover = `modules/tdd-cleanup-${stamp}/cover.png`;
const all = [...Object.values(F), moduleCover];
const only = new Set(Object.values(F));
let userId = null;
let courseId = null;

const exists = async (path) => {
  const dir = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data } = await svc.storage.from(BUCKET).list(dir, { limit: 100, search: name });
  return (data ?? []).some((f) => f.name === name);
};

try {
  for (const p of all) {
    const ct = p.endsWith(".jpg") ? "image/jpeg" : p.endsWith(".webp") ? "image/webp" : "image/png";
    const { error } = await svc.storage.from(BUCKET).upload(p, PNG, { contentType: ct, upsert: false });
    if (error) throw new Error(`upload ${p}: ${error.message}`);
  }
  const { data: u, error: ue } = await svc.auth.admin.createUser({ email: `tdd-cleanup-${stamp}@example.test`, password: `Tdd-${stamp}-x!`, email_confirm: true,
    user_metadata: { display_name: "TDD cleanup", organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (ue) throw new Error(ue.message);
  userId = u.user.id;
  const { data: c, error: ce } = await svc.from("master_courses").insert({ course_code: COURSE_CODE, title: "TDD Cleanup", language: "en", status: "active", version: 1, cover_path: F.live }).select("id").single();
  if (ce) throw new Error(`course: ${ce.message}`);
  courseId = c.id;
  const { error: de } = await svc.from("academy_program_drafts").insert([
    { kind: "master_course", target_id: courseId, base_version: 1, status: "draft", created_by: userId, payload: { course_code: COURSE_CODE, cover_path: F.openDraft } },
    { kind: "master_course", target_id: null, status: "rejected", created_by: userId, payload: { course_code: `${COURSE_CODE}-x`, cover_path: F.rejectedDraft } },
  ]);
  if (de) throw new Error(`drafts: ${de.message}`);
  const { error: ve } = await svc.from("master_course_versions").insert({ master_course_id: courseId, version: 1, snapshot: { course_code: COURSE_CODE, cover_path: F.version } });
  if (ve) throw new Error(`version: ${ve.message}`);

  console.log("1. Batas umur melindungi unggahan baru");
  let r = await cleanupCourseCovers(svc, { apply: true, minAgeHours: 24, onlyPaths: only });
  check(r.scanned === 6, `6 berkas uji terbaca (${r.scanned})`);
  check(r.deleted.length === 0 && r.candidates.length === 0, "dengan batas 24 jam tidak ada yang dihapus (semua baru diunggah)");

  console.log("2. Dry run");
  r = await cleanupCourseCovers(svc, { apply: false, minAgeHours: 0, now: Date.now() + 60_000, onlyPaths: only });
  check(JSON.stringify([...r.candidates].sort()) === JSON.stringify([F.orphan, F.rejectedDraft].sort()),
    `kandidat hanya berkas yatim dan draf yang ditolak (${r.candidates.map((p) => p.slice(-12)).join(", ")})`);
  check(r.deleted.length === 0 && (await exists(F.orphan)), "dry run tidak menghapus apa pun");
  const reason = (p) => r.kept.find((k) => k.path === p)?.reason;
  check(reason(F.live) === "dipakai", "dipakai course tayang: disimpan");
  check(reason(F.openDraft) === "dipakai", "dipakai draf terbuka: disimpan");
  check(reason(F.version) === "dipakai", "dipakai riwayat versi: disimpan");
  check(reason(F.oddName) === "nama bukan unggahan", "nama yang bukan pola unggahan: disimpan");

  console.log("3. Hapus");
  r = await cleanupCourseCovers(svc, { apply: true, minAgeHours: 0, now: Date.now() + 60_000, onlyPaths: only });
  check(r.deleted.length === 2, `2 berkas dihapus (${r.deleted.length})`);
  check(!(await exists(F.orphan)) && !(await exists(F.rejectedDraft)), "berkas yatim dan dari draf ditolak sudah hilang");
  check((await exists(F.live)) && (await exists(F.openDraft)) && (await exists(F.version)) && (await exists(F.oddName)), "berkas yang dipakai tetap ada");
  check(await exists(moduleCover), "sampul modul Knowledge Hub (folder modules/) tidak tersentuh");
} finally {
  console.log("\nMembersihkan data uji...");
  await svc.storage.from(BUCKET).remove(all);
  if (courseId) {
    await svc.from("master_course_versions").delete().eq("master_course_id", courseId);
    await svc.from("master_courses").delete().eq("id", courseId);
  }
  if (userId) {
    await svc.from("academy_program_drafts").delete().eq("created_by", userId);
    const { error } = await svc.auth.admin.deleteUser(userId);
    if (error) console.log("  gagal hapus user", error.message);
  }
  let left = 0;
  for (const p of all) if (await exists(p)) left++;
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-cleanup-%")).count;
  console.log(left || rest ? `Tersisa: ${left} berkas, ${rest} course uji.` : "Selesai: database dan penyimpanan bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ")}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
