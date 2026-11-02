/**
 * Live test of Data Master kategori pelatihan (migration 20261102040000) against
 * the database in .env.
 *
 * - The 13 categories of the Request a Training form are in
 *   training_category_taxonomy, readable by visitors; direct writes are refused;
 *   changes go through RPCs (approver/admin) with audit trail.
 * - A Request a Training submission with a category outside the list, or without
 *   one, is refused when sent; a category from the list and "Other" are accepted.
 *
 * It WRITES test data (accounts @example.test, one category, requests) and removes
 * everything at the end. Run: npm run test:training-categories
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
const PASSWORD = "TddTrainingCat!2026#";
const created = [];
const createdCats = [];
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const FORM = ["Fisheries Management", "Aquaculture", "Marine Conservation", "Blue Economy", "Climate Change",
  "Marine Spatial Planning", "Fish Processing", "Fish Health", "Fisheries Technology", "Ocean Literacy",
  "Coastal Community Development", "Monitoring, Control & Surveillance", "Leadership & Capacity Development"];

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));

async function persona(label, role) {
  const email = `tdd-training-cat-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_training_categories_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(se.message);
  return { id: u.user.id, c };
}

// Same shape as buildTrainingNeedPatch (src/lib/training-requests/payload.ts), trimmed.
const patch = (title, topics) => ({
  title, summary: "Meningkatkan kapasitas pengawasan", target_participants: "Government Officers",
  competency_gap: "Belum ada pelatihan", geographic_focus: ["Indonesia"], ...(topics === undefined ? {} : { proposed_topics: topics }),
  delivery_preference: "online", requester_selected_learning_path: "facilitated", self_paced_alternative_found: false,
  funding_preference: "government_funded", participant_charge_preference: "no_participant_charge",
  logistics_requirements: { attendance_format: "Online", support_requested: [] },
  metadata: { requester: { full_name: "TDD Requester", email: "tdd@example.test", organization: "KKP", country: "Indonesia" }, participants: { count: "11–20" } },
});
async function send(u, tag, topics) {
  const title = `TDD Kategori ${stamp} ${tag}`;
  const { data: draftId, error } = await u.c.rpc("training_need_draft_create", { _title: title, _source_type: "external_submission" });
  if (error) return { error };
  const up = await u.c.rpc("training_need_draft_update", { _draft_id: draftId, _patch: patch(title, topics) });
  if (up.error) return { error: up.error };
  return u.c.rpc("training_need_draft_submit", { _draft_id: draftId });
}

try {
  const requester = await persona("requester");
  const approver = await persona("approver", "approver");

  console.log("1. Daftar kategori");
  const { data: tax, error: taxErr } = await svc.from("training_category_taxonomy").select("name, active").eq("active", true);
  const names = (tax ?? []).map((t) => t.name);
  check(!taxErr && FORM.every((f) => names.includes(f)), `13 kategori formulir aktif di database (${taxErr?.message ?? `${FORM.filter((f) => !names.includes(f)).length} hilang`})`);
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: pub } = await anon.from("training_category_taxonomy").select("name").eq("active", true);
  check((pub?.length ?? 0) >= 13, `pengunjung bisa membaca daftar (${pub?.length ?? 0})`);

  console.log("2. Hak akses");
  const w = await approver.c.from("training_category_taxonomy").insert({ code: `tdd_${stamp}`, name: `TDD ${stamp}` }).select("id");
  if (w.data?.length) createdCats.push(...w.data.map((x) => x.id));
  check(Boolean(w.error), `tulis langsung ditolak (${w.error?.message?.slice(0, 50) ?? "TIDAK DITOLAK"})`);
  const deny = await requester.c.rpc("master_training_categories_overview");
  check(/forbidden/.test(deny.error?.message ?? ""), `pengguna biasa tidak bisa membuka daftar kelola (${deny.error?.message ?? "TIDAK DITOLAK"})`);
  const ov = await approver.c.rpc("master_training_categories_overview");
  check(!ov.error && (ov.data?.length ?? 0) >= 13, `approver membuka daftar kelola (${ov.error?.message ?? `${ov.data?.length} kategori`})`);

  console.log("3. Kelola kategori");
  const add = await approver.c.rpc("master_training_category_save", { _id: null, _name: `TDD Rumput Laut ${stamp}`, _description: "uji", _display_order: null });
  if (add.data?.id) createdCats.push(add.data.id);
  check(!add.error && add.data?.active === true, `approver menambah kategori (${add.error?.message ?? "ok"})`);
  const dup = await approver.c.rpc("master_training_category_save", { _id: null, _name: " aquaculture ", _description: null, _display_order: null });
  check(/training_category_name_exists/.test(dup.error?.message ?? ""), "nama ganda ditolak");
  const off = await approver.c.rpc("master_training_category_set_active", { _id: add.data?.id, _active: false });
  check(!off.error && off.data?.changed === true, `kategori dinonaktifkan (${off.error?.message ?? "ok"})`);

  console.log("4. Pengajuan memakai daftar");
  let r = await send(requester, "karangan", ["Kategori Karangan Bebas"]);
  check(/training_category_unknown/.test(r.error?.message ?? ""), `kategori di luar daftar ditolak (${r.error?.message ?? "DITERIMA"})`);
  r = await send(requester, "kosong");
  check(/training_category_required/.test(r.error?.message ?? ""), `tanpa kategori ditolak (${r.error?.message ?? "DITERIMA"})`);
  r = await send(requester, "sah", ["Fisheries Management"]);
  check(!r.error && Boolean(r.data), `kategori dari daftar diterima (${r.error?.message ?? "ok"})`);
  r = await send(requester, "lain", ["Other"]);
  check(!r.error && Boolean(r.data), `"Other" diterima (${r.error?.message ?? "ok"})`);
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
  if (createdCats.length) await svc.from("training_category_taxonomy").delete().in("id", createdCats);
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
