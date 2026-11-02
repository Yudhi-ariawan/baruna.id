/**
 * Live test of Data Master bahasa (migration 20261102030000) against the database
 * in .env.
 *
 * - languages_taxonomy holds the 17 existing languages plus Swahili; visitors can
 *   read it; direct writes are refused; changes go through RPCs (approver/admin)
 *   with audit trail; ordinary users are refused; a language code never changes.
 * - A language used by profiles or publications cannot be renamed.
 * - A Knowledge Hub submission with a language outside the list, or without a
 *   language, is refused when sent; a known name ("Bahasa Indonesia") is accepted.
 *
 * It WRITES test data (accounts @example.test, one language, submissions) and
 * removes everything at the end. Run: npm run test:languages
 */
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !SERVICE || !ANON) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}
const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const PASSWORD = "TddLanguages!2026#";
const created = [];
const createdLangs = [];
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));

async function persona(label, role) {
  const email = `tdd-languages-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_languages_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(se.message);
  return { id: u.user.id, c };
}

const form = (tag, language) => ({ title: `TDD Bahasa ${stamp} ${tag}`, resource_type: "technical_report", type: "Technical Report",
  externalUrl: `https://example.org/tdd-bahasa-${stamp}-${tag}`, description: `Isi ${tag}`, topicCategory: "Aquaculture",
  ...(language === undefined ? {} : { language }) });
async function send(u, tag, topic) {
  const { data: draftId, error } = await u.c.rpc("kr_draft_create", { _title: form(tag).title, _resource_type: "technical_report", _source_type: "external_submission" });
  if (error) return { error };
  const up = await u.c.rpc("kr_draft_update", { _draft_id: draftId, _patch: form(tag, topic) });
  if (up.error) return { error: up.error };
  return u.c.rpc("kr_draft_submit", { _draft_id: draftId });
}

try {
  const author = await persona("author");
  const approver = await persona("approver", "approver");

  console.log("1. Daftar bahasa");
  const { data: langs, error: le } = await svc.from("languages_taxonomy").select("code, name, active");
  const codes = (langs ?? []).filter((l) => l.active).map((l) => l.code);
  check(!le && ["id", "en", "ms", "zh", "es", "fr", "ar", "pt", "sw"].every((c) => codes.includes(c)), `bahasa formulir tersedia, termasuk Swahili (${le?.message ?? `${codes.length} aktif`})`);
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: pub } = await anon.from("languages_taxonomy").select("code");
  check((pub?.length ?? 0) >= 17, `pengunjung bisa membaca daftar (${pub?.length ?? 0})`);

  console.log("2. Hak akses");
  // Writes the value the row already has, so the real list never changes even if direct writes are open.
  const en = (langs ?? []).find((l) => l.code === "en");
  const w = await approver.c.from("languages_taxonomy").update({ name: en?.name ?? "English" }).eq("code", "en").select("code");
  check(Boolean(w.error) || (w.data?.length ?? 0) === 0, `approver tidak bisa menulis tabel langsung (${w.error?.message?.slice(0, 50) ?? `${w.data?.length} baris BERUBAH`})`);
  const deny = await author.c.rpc("master_languages_overview");
  check(/forbidden/.test(deny.error?.message ?? ""), `pengguna biasa tidak bisa membuka daftar kelola (${deny.error?.message ?? "TIDAK DITOLAK"})`);
  const ov = await approver.c.rpc("master_languages_overview");
  check(!ov.error && (ov.data?.length ?? 0) >= 17, `approver membuka daftar kelola (${ov.error?.message ?? `${ov.data?.length} bahasa`})`);

  console.log("3. Kelola bahasa");
  const code = `qaa-${stamp.toString(36).slice(-6)}`; // ISO 639 private-use range
  const add = await approver.c.rpc("master_language_save", { _id: null, _code: code, _name: `TDD Bahasa ${stamp}`, _native_name: "Uji", _display_order: null });
  if (add.data?.id) createdLangs.push(add.data.id);
  check(!add.error && add.data?.code === code, `approver menambah bahasa (${add.error?.message ?? code})`);
  const dup = await approver.c.rpc("master_language_save", { _id: null, _code: "en", _name: `TDD Inggris ${stamp}`, _native_name: null, _display_order: null });
  check(/language_code_exists/.test(dup.error?.message ?? ""), "kode ganda ditolak");
  const used = (ov.data ?? []).find((l) => l.usage > 0);
  if (used) {
    const ren = await approver.c.rpc("master_language_save", { _id: used.id, _code: used.code, _name: `${used.name} X`, _native_name: used.nativeName, _display_order: null });
    check(/language_in_use_rename_forbidden/.test(ren.error?.message ?? ""), `bahasa terpakai ("${used.name}", ${used.usage}x) tidak bisa diganti nama`);
  } else {
    check(true, "(belum ada bahasa terpakai; cek ganti nama dilewati)");
  }
  const off = await approver.c.rpc("master_language_set_active", { _id: add.data?.id, _active: false });
  check(!off.error && off.data?.changed === true, `bahasa dinonaktifkan (${off.error?.message ?? "ok"})`);

  console.log("4. Pengajuan memakai daftar");
  let r = await send(author, "karangan", "Bahasa Karangan");
  check(/kr_language_unknown/.test(r.error?.message ?? ""), `bahasa di luar daftar ditolak (${r.error?.message ?? "DITERIMA"})`);
  r = await send(author, "kosong");
  check(/kr_language_required/.test(r.error?.message ?? ""), `tanpa bahasa ditolak (${r.error?.message ?? "DITERIMA"})`);
  r = await send(author, "sah", "Bahasa Indonesia");
  check(!r.error && Boolean(r.data), `"Bahasa Indonesia" diterima (${r.error?.message ?? "ok"})`);
} catch (e) {
  console.error("Kesalahan:", e);
  failures.push(String(e?.message ?? e));
} finally {
  console.log("\nMembersihkan data uji...");
  const { data: subs } = await svc.from("review_subjects").select("id").in("submitted_by", created);
  const ids = (subs ?? []).map((x) => x.id);
  if (ids.length) {
    await svc.from("review_decisions").delete().in("subject_id", ids);
    await svc.from("review_subject_revisions").delete().in("subject_id", ids);
    await svc.from("governance_audit_log").delete().in("subject_id", ids);
  }
  await svc.from("review_drafts").delete().in("submitter_id", created);
  if (ids.length) await svc.from("review_subjects").delete().in("id", ids);
  if (createdLangs.length) await svc.from("languages_taxonomy").delete().in("id", createdLangs);
  await svc.from("governance_audit_log").delete().in("actor_id", created);
  await svc.from("platform_events").delete().in("actor_id", created);
  await svc.from("rbac_user_roles").delete().in("user_id", created);
  let left = 0;
  for (const id of created) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) { left++; console.log("  gagal hapus user", id, error.message); }
  }
  console.log(left ? `Selesai dengan ${left} akun tersisa.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ")}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
