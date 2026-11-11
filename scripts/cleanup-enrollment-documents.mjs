/**
 * Remove enrolment document files that nothing uses any more (CATATAN_PERBAIKAN 2aw).
 *
 * Participants upload PDFs to the private bucket `enrollment-documents` under
 * `enrollment/<user id>/` (enrollment-documents.functions.ts). A file is left behind
 * when it is replaced by a newer upload (same document, any device) or when the
 * upload never got recorded (closed tab, failed step).
 *
 * A file is deleted only when ALL of these hold:
 *  - it is named like an upload (enrollment/<uuid>/<32 hex>.pdf);
 *  - no sent application document uses it (course_enrollment_documents);
 *  - no recorded, not-yet-sent upload uses it (course_enrollment_document_uploads);
 *  - it is older than the grace period (default 24 h), so a file being uploaded right
 *    now on any device is kept.
 * References are read again right before deleting.
 *
 * Default is a dry run (lists only). Delete with --apply.
 *   npm run cleanup:enrollment-documents              # dry run
 *   npm run cleanup:enrollment-documents -- --apply   # delete
 *   options: --min-age-hours=24
 */
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

export const BUCKET = "enrollment-documents";
export const PREFIX = "enrollment";
const USER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NAME = /^[0-9a-f]{32}\.pdf$/;

async function list(svc, prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await svc.storage.from(BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function listFiles(svc, onlyUsers) {
  const folders = (await list(svc, PREFIX)).filter((f) => !f.id && USER.test(f.name) && (!onlyUsers || onlyUsers.has(f.name)));
  const files = [];
  for (const folder of folders) {
    for (const f of await list(svc, `${PREFIX}/${folder.name}`)) {
      if (f.id) files.push({ path: `${PREFIX}/${folder.name}/${f.name}`, name: f.name, created_at: f.created_at });
    }
  }
  return files;
}

async function referencedPaths(svc) {
  const used = new Set();
  const page = async (table) => {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await svc.from(table).select("storage_path").order("storage_path").range(from, from + 999);
      if (error) {
        if (table === "course_enrollment_document_uploads" && /course_enrollment_document_uploads|schema cache/.test(error.message)) return; // before 20261111010000
        throw new Error(`${table}: ${error.message}`);
      }
      for (const r of data ?? []) used.add(r.storage_path);
      if (!data || data.length < 1000) return;
    }
  };
  await page("course_enrollment_documents");
  await page("course_enrollment_document_uploads");
  return used;
}

/**
 * @param {object} svc service-role client
 * @param {{ apply?: boolean, minAgeHours?: number, onlyUsers?: Set<string>, now?: number }} opts
 *   onlyUsers limits the run to those participants' folders (used by the live test so it never touches real files).
 */
export async function cleanupEnrollmentDocuments(svc, { apply = false, minAgeHours = 24, onlyUsers, now = Date.now() } = {}) {
  const files = await listFiles(svc, onlyUsers);
  const used = await referencedPaths(svc);
  const cutoff = now - minAgeHours * 3600 * 1000;
  const result = { scanned: files.length, kept: [], candidates: [], deleted: [] };
  for (const f of files) {
    const created = Date.parse(f.created_at ?? "");
    let reason = null;
    if (!NAME.test(f.name)) reason = "nama bukan unggahan";
    else if (used.has(f.path)) reason = "dipakai";
    else if (!Number.isFinite(created) || created > cutoff) reason = `lebih muda dari ${minAgeHours} jam`;
    if (reason) result.kept.push({ path: f.path, reason });
    else result.candidates.push(f.path);
  }
  if (apply && result.candidates.length) {
    // Read references again: an upload may have been recorded or sent meanwhile.
    const again = await referencedPaths(svc);
    const toDelete = result.candidates.filter((p) => !again.has(p));
    for (const p of result.candidates) if (again.has(p)) result.kept.push({ path: p, reason: "dipakai (baru dicatat)" });
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
    console.error("--min-age-hours minimal 1 (melindungi berkas yang sedang diunggah tetapi belum dicatat).");
    process.exit(1);
  }
  const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const r = await cleanupEnrollmentDocuments(svc, { apply, minAgeHours });
  console.log(`Diperiksa ${r.scanned} berkas di ${BUCKET}/${PREFIX}/ (batas umur ${minAgeHours} jam).`);
  for (const k of r.kept) console.log(`  simpan  ${k.path} (${k.reason})`);
  for (const p of r.candidates) console.log(`  ${apply ? (r.deleted.includes(p) ? "HAPUS  " : "simpan ") : "akan dihapus"} ${p}`);
  console.log(apply ? `Dihapus: ${r.deleted.length}.` : `Dry run: ${r.candidates.length} berkas akan dihapus. Jalankan dengan --apply untuk menghapus.`);
}
