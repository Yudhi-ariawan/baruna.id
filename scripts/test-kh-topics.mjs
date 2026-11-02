/**
 * Live test of Data Master topik Knowledge Hub (migration 20261102020000) against
 * the database in .env.
 *
 * - The 12 topics of the contribution form are in kh_topic_taxonomy, readable by
 *   visitors; direct writes are refused; changes go through RPCs (approver/admin)
 *   with audit trail; ordinary users are refused.
 * - A topic used by a publication cannot be renamed.
 * - A Knowledge Hub submission with a topic outside the list, or without a topic,
 *   is refused when sent; a topic from the list is accepted.
 *
 * It WRITES test data (accounts @example.test, one topic, two submissions) and
 * removes everything at the end. Run: npm run test:kh-topics
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
const PASSWORD = "TddKhTopics!2026#";
const created = [];
const createdTopics = [];
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const FORM = ["Aquaculture", "Fisheries Management", "Fish Health", "Fish Processing", "Marine Conservation", "Blue Economy",
  "Climate Change", "Marine Spatial Planning", "Monitoring, Control and Surveillance (MCS)", "IUU Fishing", "Ocean Literacy",
  "Capacity Development"];

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));

async function persona(label, role) {
  const email = `tdd-kh-topics-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_kh_topics_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(se.message);
  return { id: u.user.id, c };
}

const form = (tag, topic) => ({ title: `TDD Topik ${stamp} ${tag}`, resource_type: "technical_report", type: "Technical Report",
  externalUrl: `https://example.org/tdd-topik-${stamp}-${tag}`, description: `Isi ${tag}`,
  ...(topic === undefined ? {} : { topicCategory: topic }) });
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

  console.log("1. Daftar topik");
  const { data: tax, error: taxErr } = await svc.from("kh_topic_taxonomy").select("name, active").eq("active", true);
  const names = (tax ?? []).map((t) => t.name);
  check(!taxErr && FORM.every((f) => names.includes(f)), `12 topik formulir aktif di database (${taxErr?.message ?? `${FORM.filter((f) => !names.includes(f)).length} hilang`})`);
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: pub } = await anon.from("kh_topic_taxonomy").select("name").eq("active", true);
  check((pub?.length ?? 0) >= 12, `pengunjung bisa membaca daftar (${pub?.length ?? 0})`);

  console.log("2. Hak akses");
  const w = await approver.c.from("kh_topic_taxonomy").insert({ code: `tdd_${stamp}`, name: `TDD ${stamp}` }).select("id");
  if (w.data?.length) createdTopics.push(...w.data.map((x) => x.id));
  check(Boolean(w.error), `tulis langsung ditolak (${w.error?.message?.slice(0, 50) ?? "TIDAK DITOLAK"})`);
  const deny = await author.c.rpc("master_kh_topics_overview");
  check(/forbidden/.test(deny.error?.message ?? ""), `pengguna biasa tidak bisa membuka daftar kelola (${deny.error?.message ?? "TIDAK DITOLAK"})`);
  const ov = await approver.c.rpc("master_kh_topics_overview");
  check(!ov.error && (ov.data?.length ?? 0) >= 12, `approver membuka daftar kelola (${ov.error?.message ?? `${ov.data?.length} topik`})`);

  console.log("3. Kelola topik");
  const add = await approver.c.rpc("master_kh_topic_save", { _id: null, _name: `TDD Rumput Laut ${stamp}`, _description: "uji", _display_order: null });
  if (add.data?.id) createdTopics.push(add.data.id);
  check(!add.error && add.data?.active === true, `approver menambah topik (${add.error?.message ?? "ok"})`);
  const dup = await approver.c.rpc("master_kh_topic_save", { _id: null, _name: " aquaculture ", _description: null, _display_order: null });
  check(/kh_topic_name_exists/.test(dup.error?.message ?? ""), "nama ganda ditolak");
  const used = (ov.data ?? []).find((t) => t.usage > 0);
  if (used) {
    const ren = await approver.c.rpc("master_kh_topic_save", { _id: used.id, _name: `${used.name} X`, _description: null, _display_order: null });
    check(/kh_topic_in_use_rename_forbidden/.test(ren.error?.message ?? ""), `topik terpakai ("${used.name}") tidak bisa diganti nama`);
  } else {
    check(true, "(belum ada topik terpakai; cek ganti nama dilewati)");
  }
  const off = await approver.c.rpc("master_kh_topic_set_active", { _id: add.data?.id, _active: false });
  check(!off.error && off.data?.changed === true, `topik dinonaktifkan (${off.error?.message ?? "ok"})`);

  console.log("4. Pengajuan memakai daftar");
  let r = await send(author, "karangan", "Topik Karangan Bebas");
  check(/kr_topic_unknown/.test(r.error?.message ?? ""), `topik di luar daftar ditolak (${r.error?.message ?? "DITERIMA"})`);
  r = await send(author, "kosong");
  check(/kr_topic_required/.test(r.error?.message ?? ""), `tanpa topik ditolak (${r.error?.message ?? "DITERIMA"})`);
  r = await send(author, "sah", "Fisheries Management");
  check(!r.error && Boolean(r.data), `topik dari daftar diterima (${r.error?.message ?? "ok"})`);
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
  if (createdTopics.length) await svc.from("kh_topic_taxonomy").delete().in("id", createdTopics);
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
