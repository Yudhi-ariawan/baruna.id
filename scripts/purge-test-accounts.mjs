#!/usr/bin/env node
// ============================================================================
// Purge leftover automated-test accounts (@example.test) from the Supabase
// project configured in .env, together with the rows that reference them.
//
//   node --env-file=.env scripts/purge-test-accounts.mjs           # dry run: report only
//   node --env-file=.env scripts/purge-test-accounts.mjs --apply   # delete
//
// Only accounts whose email ends with @example.test are touched. Run it on the
// intern-update database only; never point it at main.
// ============================================================================
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");
const TEST_DOMAIN = "@example.test";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function listTestUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Gagal membaca daftar akun: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users.filter((u) => (u.email || "").toLowerCase().endsWith(TEST_DOMAIN));
}

/** Every uuid column of every exposed table, from the PostgREST schema. */
async function uuidColumns() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Gagal membaca skema REST: HTTP ${res.status}`);
  const spec = await res.json();
  const cols = [];
  for (const [table, def] of Object.entries(spec.definitions || {})) {
    for (const [col, prop] of Object.entries(def.properties || {})) {
      if (prop.format === "uuid") cols.push({ table, col });
    }
  }
  return cols;
}

function chunks(list, size = 100) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Rows (table.column) that reference any of the given ids. */
async function findReferences(columns, ids) {
  const hits = [];
  for (const { table, col } of columns) {
    let count = 0;
    for (const part of chunks(ids)) {
      const { count: c, error } = await admin.from(table).select("*", { count: "exact", head: true }).in(col, part);
      if (error) break; // views or columns PostgREST cannot filter on
      count += c || 0;
    }
    if (count) hits.push({ table, col, count });
  }
  return hits;
}

async function deleteWhere(table, col, ids) {
  for (const part of chunks(ids)) {
    const { error } = await admin.from(table).delete().in(col, part);
    if (error) return error.message;
  }
  return null;
}

async function selectIds(table, col, ids) {
  const found = [];
  for (const part of chunks(ids)) {
    const { data, error } = await admin.from(table).select("id").in(col, part);
    if (error) throw new Error(`${table}.${col}: ${error.message}`);
    found.push(...(data || []).map((r) => r.id));
  }
  return found;
}

async function main() {
  const host = new URL(SUPABASE_URL).host;
  console.log(`Project: ${host}`);
  console.log(APPLY ? "Mode: HAPUS (--apply)" : "Mode: DRY RUN (tidak ada yang dihapus)");

  const users = await listTestUsers();
  console.log(`\nAkun ${TEST_DOMAIN}: ${users.length}`);
  if (!users.length) return;
  const byPrefix = {};
  for (const u of users) {
    const prefix = u.email.split("@")[0].replace(/\.\d+$/, "");
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
  }
  for (const [p, n] of Object.entries(byPrefix)) console.log(`  ${p}: ${n}`);

  const ids = users.map((u) => u.id);
  const columns = (await uuidColumns()).filter(({ col }) => col !== "id");
  const hits = await findReferences(columns, ids);
  console.log("\nBaris yang merujuk akun tersebut:");
  for (const h of hits) console.log(`  ${h.table}.${h.col}: ${h.count}`);
  if (!hits.length) console.log("  (tidak ada)");

  if (!APPLY) {
    console.log("\nJalankan ulang dengan --apply untuk menghapus.");
    return;
  }

  // Review records hang off drafts/subjects rather than users; clear them first.
  const draftIds = [];
  const subjectIds = [];
  for (const h of hits) {
    if (h.table === "review_drafts") draftIds.push(...(await selectIds("review_drafts", h.col, ids)));
    if (h.table === "review_subjects") subjectIds.push(...(await selectIds("review_subjects", h.col, ids)));
  }
  const failures = [];
  if (subjectIds.length) {
    for (const t of ["review_decisions", "review_subject_revisions"]) {
      const err = await deleteWhere(t, "subject_id", subjectIds);
      if (err) failures.push(`${t}: ${err}`);
    }
  }
  if (draftIds.length) {
    const err = await deleteWhere("review_subject_revisions", "draft_id", draftIds);
    if (err) failures.push(`review_subject_revisions (draft): ${err}`);
  }

  // Foreign keys between the referencing tables decide the order; retry until
  // nothing is left or no further progress is possible.
  let pending = hits;
  for (let pass = 1; pass <= 5 && pending.length; pass++) {
    for (const h of pending) await deleteWhere(h.table, h.col, ids);
    pending = await findReferences(columns, ids);
  }
  for (const h of pending) {
    failures.push(`${h.table}.${h.col}: ${h.count} baris tidak dapat dihapus (${await deleteWhere(h.table, h.col, ids)})`);
  }

  let deleted = 0;
  for (const u of users) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) failures.push(`akun ${u.email}: ${error.message}`);
    else deleted++;
  }
  console.log(`\nAkun terhapus: ${deleted}/${users.length}`);
  if (failures.length) {
    console.error("Gagal:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
