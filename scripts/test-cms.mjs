/**
 * Live test: Dynamic CMS (migration 20261118010000; CATATAN_PERBAIKAN 2br) against the
 * database in .env, with the real role/permission matrix (Slide 16).
 *
 * It WRITES test data (accounts @example.test, one page "tdd-cms-<stamp>", one form
 * "tdd-form-<stamp>" and its submissions, drafts, audit rows) and removes it at the end
 * (audit rows stay). The site menu is NOT changed: menu approval is covered by the local
 * PGlite test; here only its permissions and validation are checked.
 * Run: npm run test:cms
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
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
const stamp = Date.now();
const PASSWORD = "TddCms!2026#";
const PAGE_SLUG = `tdd-cms-${stamp}`, FORM_SLUG = `tdd-form-${stamp}`;
const created = [];
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const errOf = (r) => r.error?.message ?? "";

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-cms-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD CMS ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role !== "registered_user") {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_cms_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: le } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (le) throw new Error(le.message);
  return { id: u.user.id, c };
}
async function updatedAt(id) {
  return (await svc.from("cms_drafts").select("updated_at").eq("id", id).single()).data.updated_at;
}
const save = async (p, id, payload) => p.c.rpc("cms_draft_save", { _draft_id: id, _payload: payload, _expected_updated_at: await updatedAt(id) });
const decide = async (p, id, decision, note = null) => p.c.rpc("cms_draft_decide", { _draft_id: id, _decision: decision, _note: note, _expected_updated_at: await updatedAt(id) });

async function cleanup() {
  const { data: forms } = await svc.from("cms_forms").select("id").like("slug", `tdd-form-${stamp}%`);
  for (const f of forms ?? []) await svc.from("cms_form_submissions").delete().eq("form_id", f.id);
  await svc.from("cms_forms").delete().like("slug", `tdd-form-${stamp}%`);
  await svc.from("cms_pages").delete().like("slug", `tdd-cms-${stamp}%`);
  for (const id of created) {
    await svc.from("cms_drafts").delete().eq("created_by", id);
    await svc.from("rbac_user_roles").delete().eq("user_id", id);
    await svc.auth.admin.deleteUser(id);
  }
}

try {
  console.log("\n[1] Migrasi ada");
  const probe = await anon.from("cms_pages_public_v").select("id").limit(1);
  check(!probe.error, `view publik cms_pages_public_v ada${probe.error ? " — " + probe.error.message + " (jalankan migrasi 20261118010000)" : ""}`);
  if (probe.error) throw new Error("migration_missing");

  const reg = await persona("reg", "registered_user");
  const op = await persona("op", "operator");
  const appr = await persona("appr", "approver");
  const pub = await persona("pub", "publisher");
  const adm = await persona("adm", "admin");
  const rev = await persona("rev", "reviewer");

  console.log("\n[2] Izin menyunting (matriks peran asli)");
  let r = await reg.c.rpc("cms_draft_open", { _kind: "page", _target_id: null, _domain: "about" });
  check(/forbidden/.test(errOf(r)), "Registered User (punya about.update) tidak bisa membuka draf halaman");
  r = await anon.rpc("cms_draft_open", { _kind: "page", _target_id: null, _domain: "about" });
  check(!!r.error, "pengunjung tanpa login ditolak");
  r = await reg.c.rpc("cms_overview");
  check(/forbidden/.test(errOf(r)), "Registered User tidak bisa membuka ringkasan CMS");
  r = await op.c.rpc("cms_overview");
  check(!r.error && r.data?.can?.editDomains?.includes("about"), "Operator: ringkasan CMS terbuka, boleh menyunting About");

  console.log("\n[3] Halaman: draf → kirim → setujui orang lain → tayang");
  r = await op.c.rpc("cms_draft_open", { _kind: "page", _target_id: null, _domain: "about" });
  const d1 = r.data;
  check(!!d1, "Operator membuka draf halaman");
  const base = { domain: "about", slug: PAGE_SLUG, title_id: "Halaman Uji CMS", title_en: "", summary_id: "", summary_en: "" };
  await save(op, d1, { ...base, blocks: [{ type: "cta", title_id: "Ayo", button_id: "Klik", url: "javascript:alert(1)" }] });
  r = await op.c.rpc("cms_draft_submit", { _draft_id: d1 });
  check(/cms_block_url_invalid:1/.test(errOf(r)), "tautan javascript: ditolak database");
  const blocks = [
    { type: "text", heading_id: "Tentang", body_id: "Halaman uji otomatis CMS." },
    { type: "cards", items: [{ title_id: "Academy", url: "/academy" }, { title_id: "KKP", url: "https://kkp.go.id" }] },
  ];
  r = await save(op, d1, { ...base, blocks });
  check(!r.error, "draf valid tersimpan");
  r = await op.c.rpc("cms_draft_submit", { _draft_id: d1 });
  check(!r.error, "draf terkirim");
  r = await decide(op, d1, "approve");
  check(!!r.error, "penyunting tidak bisa menyetujui draf sendiri");
  r = await decide(pub, d1, "approve");
  check(/forbidden/.test(errOf(r)), "Publisher tidak bisa menyetujui");
  r = await decide(appr, d1, "approve");
  check(!r.error, "Approver menyetujui");
  r = await anon.from("cms_pages_public_v").select("slug, version, blocks").eq("slug", PAGE_SLUG);
  check(r.data?.length === 1 && r.data[0].version === 1 && r.data[0].blocks.length === 2, "pengunjung melihat halaman tayang versi 1");
  r = await anon.from("cms_pages").select("id").limit(1);
  check(!!r.error, "pengunjung tidak bisa membaca tabel cms_pages langsung");
  r = await reg.c.from("cms_drafts").select("id").limit(1);
  check(!!r.error, "pengguna tidak bisa membaca tabel draf langsung");

  console.log("\n[4] Penayangan");
  const pageId = (await svc.from("cms_pages").select("id").eq("slug", PAGE_SLUG).single()).data.id;
  r = await op.c.rpc("cms_set_status", { _kind: "page", _id: pageId, _status: "on_hold", _reason: "Uji turunkan" });
  check(/forbidden/.test(errOf(r)), "Operator tidak bisa menurunkan halaman");
  r = await pub.c.rpc("cms_set_status", { _kind: "page", _id: pageId, _status: "on_hold", _reason: "Uji turunkan" });
  const hidden = await anon.from("cms_pages_public_v").select("id").eq("slug", PAGE_SLUG);
  check(!r.error && hidden.data?.length === 0, "Publisher menurunkan; halaman hilang dari pengunjung");
  r = await pub.c.rpc("cms_set_status", { _kind: "page", _id: pageId, _status: "published", _reason: "Uji tayang lagi" });
  check(!r.error, "Publisher menayangkan lagi");

  console.log("\n[5] Formulir");
  r = await op.c.rpc("cms_draft_open", { _kind: "form", _target_id: null, _domain: "about" });
  const f1 = r.data;
  await save(op, f1, { domain: "about", slug: FORM_SLUG, title_id: "Formulir Uji", title_en: "", description_id: "", description_en: "",
    notify_on_submit: true, max_per_user_per_day: 1,
    fields: [{ key: "nama", label_id: "Nama", type: "text", required: true }, { key: "email", label_id: "Email", type: "email", required: true }] });
  await op.c.rpc("cms_draft_submit", { _draft_id: f1 });
  r = await decide(appr, f1, "approve");
  check(!r.error, "formulir disetujui");
  const formId = (await svc.from("cms_forms").select("id").eq("slug", FORM_SLUG).single()).data?.id;
  r = await anon.rpc("cms_form_submit", { _slug: FORM_SLUG, _data: { nama: "A", email: "a@example.test" } });
  check(!!r.error, "kiriman tanpa login ditolak");
  r = await reg.c.rpc("cms_form_submit", { _slug: FORM_SLUG, _data: { nama: "", email: "a@example.test" } });
  check(/cms_submission_required:nama/.test(errOf(r)), "kolom wajib kosong ditolak");
  r = await reg.c.rpc("cms_form_submit", { _slug: FORM_SLUG, _data: { nama: "Budi", email: "budi@example.test" } });
  check(!r.error, "kiriman valid diterima");
  r = await reg.c.rpc("cms_form_submit", { _slug: FORM_SLUG, _data: { nama: "Budi", email: "budi@example.test" } });
  check(/cms_submission_limit/.test(errOf(r)), "kiriman melebihi batas per hari ditolak");
  r = await reg.c.rpc("cms_form_submission_list", { _form_id: formId, _status: null, _limit: 50 });
  check(/forbidden/.test(errOf(r)), "pengirim tidak bisa membaca daftar kiriman");
  r = await rev.c.rpc("cms_form_submission_list", { _form_id: formId, _status: null, _limit: 50 });
  check(!r.error && r.data?.rows?.length === 1, "Reviewer membaca kiriman formulir About");
  r = await reg.c.from("cms_form_submissions").select("id").limit(1);
  check(!!r.error, "tabel kiriman tidak bisa dibaca langsung");

  console.log("\n[6] Menu navigasi (tanpa mengubah menu situs)");
  r = await op.c.rpc("cms_draft_open", { _kind: "menu", _target_id: null, _domain: null });
  check(/forbidden/.test(errOf(r)), "Operator tidak bisa menyunting menu navigasi");
  r = await adm.c.rpc("cms_draft_open", { _kind: "menu", _target_id: null, _domain: null });
  const m1 = r.data;
  check(!!m1 || /cms_draft_exists/.test(errOf(r)), "Admin membuka draf menu");
  if (m1) {
    await save(adm, m1, { items: [{ label_id: "KKP", label_en: "", href: "https://kkp.go.id", is_external: false, is_active: true, icon: null }] });
    r = await adm.c.rpc("cms_draft_submit", { _draft_id: m1 });
    check(/cms_menu_external_mismatch/.test(errOf(r)), "tautan https:// wajib ditandai eksternal");
    r = await adm.c.rpc("cms_draft_withdraw", { _draft_id: m1 });
    check(!r.error, "draf menu uji ditarik (menu situs tidak berubah)");
  }
} catch (e) {
  if (e.message !== "migration_missing") { failures.push(`exception: ${e.message}`); console.log("  FAIL exception:", e.message); }
} finally {
  await cleanup();
  console.log("\n  pembersihan: akun, halaman, formulir, dan kiriman uji dihapus");
}

console.log(`\n${passed}/${passed + failures.length} lulus`);
if (failures.length) { console.log("Gagal:\n- " + failures.join("\n- ")); process.exit(1); }
