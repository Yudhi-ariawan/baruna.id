/**
 * Remove Master Course cover images that nothing uses any more (CATATAN_PERBAIKAN 2am).
 *
 * Covers are uploaded to the public bucket `knowledge-module-covers` under
 * `academy-courses/` (program-cover.functions.ts). A file is left behind when the
 * author replaces or removes the image before saving, or withdraws the draft.
 *
 * A file is deleted only when ALL of these hold:
 *  - it is under academy-courses/ and named like an upload (<32 hex>.png|jpg|webp);
 *    Knowledge Hub module covers (modules/) in the same bucket are never touched;
 *  - no Master Course uses it (master_courses.cover_path);
 *  - no open draft uses it (draft / submitted / revision_requested);
 *  - no approved version record uses it (master_course_versions keeps history);
 *  - it is older than the grace period (default 24 h), so an image just uploaded
 *    on any device but not saved yet is kept.
 * References are read again right before deleting.
 *
 * Default is a dry run (lists only). Delete with --apply.
 *   npm run cleanup:course-covers              # dry run
 *   npm run cleanup:course-covers -- --apply   # delete
 *   options: --min-age-hours=24
 */
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

export const BUCKET = "knowledge-module-covers";
export const PREFIX = "academy-courses";
const NAME = /^[0-9a-f]{32}\.(png|jpg|webp)$/;
const OPEN = ["draft", "submitted", "revision_requested"];

async function listFiles(svc) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await svc.storage.from(BUCKET).list(PREFIX, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list: ${error.message}`);
    out.push(...(data ?? []).filter((f) => f.id)); // folders have no id
    if (!data || data.length < 1000) return out;
  }
}

async function referencedPaths(svc) {
  const used = new Set();
  const add = (p) => { if (typeof p === "string" && p) used.add(p); };
  const page = async (build) => {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await build().range(from, from + 999);
      if (error) throw new Error(error.message);
      for (const r of data ?? []) add(r.p);
      if (!data || data.length < 1000) return;
    }
  };
  await page(() => svc.from("master_courses").select("p:cover_path").not("cover_path", "is", null).order("id"));
  await page(() => svc.from("academy_program_drafts").select("p:payload->>cover_path").eq("kind", "master_course").in("status", OPEN).order("id"));
  await page(() => svc.from("master_course_versions").select("p:snapshot->>cover_path").order("id"));
  return used;
}

/**
 * @param {object} svc service-role client
 * @param {{ apply?: boolean, minAgeHours?: number, onlyPaths?: Set<string>, now?: number }} opts
 *   onlyPaths limits the run to those paths (used by the live test so it never touches real files).
 */
export async function cleanupCourseCovers(svc, { apply = false, minAgeHours = 24, onlyPaths, now = Date.now() } = {}) {
  const files = await listFiles(svc);
  const used = await referencedPaths(svc);
  const cutoff = now - minAgeHours * 3600 * 1000;
  const result = { scanned: 0, kept: [], candidates: [], deleted: [] };
  for (const f of files) {
    const path = `${PREFIX}/${f.name}`;
    if (onlyPaths && !onlyPaths.has(path)) continue;
    result.scanned++;
    const created = Date.parse(f.created_at ?? "");
    let reason = null;
    if (!NAME.test(f.name)) reason = "nama bukan unggahan";
    else if (used.has(path)) reason = "dipakai";
    else if (!Number.isFinite(created) || created > cutoff) reason = `lebih muda dari ${minAgeHours} jam`;
    if (reason) result.kept.push({ path, reason });
    else result.candidates.push(path);
  }
  if (apply && result.candidates.length) {
    // Read references again: a draft may have been saved meanwhile.
    const again = await referencedPaths(svc);
    const toDelete = result.candidates.filter((p) => !again.has(p));
    for (const p of result.candidates) if (again.has(p)) result.kept.push({ path: p, reason: "dipakai (baru disimpan)" });
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      const { error } = await svc.storage.from(BUCKET).remove(chunk);
      if (error) throw new Error(`remove: ${error.message}`);
      result.deleted.push(...chunk);
    }
  }
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !SERVICE) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  const ageArg = process.argv.find((a) => a.startsWith("--min-age-hours="));
  const minAgeHours = ageArg ? Number(ageArg.split("=")[1]) : 24;
  if (!Number.isFinite(minAgeHours) || minAgeHours < 1) {
    console.error("--min-age-hours minimal 1 (melindungi gambar yang baru diunggah tetapi belum disimpan).");
    process.exit(1);
  }
  const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const r = await cleanupCourseCovers(svc, { apply, minAgeHours });
  console.log(`Diperiksa ${r.scanned} berkas di ${BUCKET}/${PREFIX}/ (batas umur ${minAgeHours} jam).`);
  for (const k of r.kept) console.log(`  simpan  ${k.path} (${k.reason})`);
  for (const p of r.candidates) console.log(`  ${apply ? (r.deleted.includes(p) ? "HAPUS  " : "simpan ") : "akan dihapus"} ${p}`);
  console.log(apply ? `Dihapus: ${r.deleted.length}.` : `Dry run: ${r.candidates.length} berkas akan dihapus. Jalankan dengan --apply untuk menghapus.`);
}
