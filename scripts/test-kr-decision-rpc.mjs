/**
 * Live test of public.admin_kr_decide (migration 20261020060000) against the real
 * Supabase database configured in .env.
 *
 * It WRITES test data (accounts @example.test, Knowledge Hub submissions and the
 * catalog rows they publish) and removes everything at the end, even when a check
 * fails. Run: npm run test:kr-rpc   (use --keep to leave the data for inspection)
 *
 * Real users and real publications are never touched: every row is created by this
 * script and tracked by id before it is deleted.
 */
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const stamp = Date.now();
const password = "TddKrRpc!2026#";
const keep = process.argv.includes("--keep");
const users = [];
const subjects = [];
let passed = 0;
const failures = [];

const ok = (cond, label) => {
  try { assert.ok(cond, label); passed++; console.log("  ok", label); }
  catch { failures.push(label); console.log("  FAIL", label); }
};
const rejects = async (promise, pattern, label) => {
  const { error } = await promise;
  const good = Boolean(error) && pattern.test(error.message);
  if (!good) console.log("   got:", error ? error.message : "no error");
  ok(good, label);
};

async function mkUser(tag, role) {
  const email = `tdd.krrpc.${tag}.${stamp}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: `TDD ${tag}`, organization: "Instansi Uji", job_title: "Staf Uji", phone: "+6280000000000" },
  });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  const id = data.user.id;
  users.push(id);
  if (role) {
    const { data: r } = await admin.from("rbac_roles").select("id").eq("code", role).single();
    const { data: existing } = await admin.from("rbac_user_roles").select("id").eq("user_id", id).eq("is_primary", true);
    const { error: e } = existing?.length
      ? await admin.from("rbac_user_roles").update({ role_id: r.id, reason: "tdd" }).eq("id", existing[0].id)
      : await admin.from("rbac_user_roles").insert({ user_id: id, role_id: r.id, status: "active", is_primary: true, valid_from: new Date().toISOString(), reason: "tdd" });
    if (e) throw new Error(`role ${tag}: ${e.message}`);
  }
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(`signIn ${tag}: ${signErr.message}`);
  return { id, client };
}

async function submission(title, by) {
  const { data: s, error } = await admin.from("review_subjects")
    .insert({ kind: "knowledge_resource", title, submitted_by: by, current_status: "pending" }).select("id").single();
  if (error) throw new Error(`subject: ${error.message}`);
  subjects.push(s.id);
  const { error: dErr } = await admin.from("review_drafts").insert({
    subject_kind: "knowledge_resource", submitter_id: by, title, status: "submitted", linked_subject_id: s.id,
    payload: { title, type: "Research Report" },
  });
  if (dErr) throw new Error(`draft: ${dErr.message}`);
  return s.id;
}

const resource = (over = {}) => ({
  resource_type: "technical_report", title: `Uji Otomatis KR ${stamp}`, summary: "Ringkasan uji.", abstract: "Abstrak uji.",
  language: "Indonesian", publication_year: "2026", publisher: "Instansi Uji", external_url: null, thumbnail_url: null,
  topics: ["uji"], keywords: ["tdd"], geographic_focus: [], metadata: { attached_resources: [] },
  author_name: "TDD Penulis", author_affiliation: "Instansi Uji", author_role: "Author", ...over,
});
const decide = (client, subjectId, decision, extra = {}) => client.rpc("admin_kr_decide", {
  _subject_id: subjectId, _decision: decision, _rationale: extra.rationale ?? null,
  _expected_updated_at: extra.expected ?? null,
  _resource: extra.resource !== undefined ? extra.resource : decision === "approve" ? resource() : null,
});
const subjectRow = async (id) => (await admin.from("review_subjects").select("*").eq("id", id).single()).data;
const krOf = async (id) => (await admin.from("knowledge_resources").select("*").eq("source_submission_id", id).maybeSingle()).data;
const decisions = async (id) => (await admin.from("review_decisions").select("id", { count: "exact", head: true }).eq("subject_id", id)).count;

async function cleanup() {
  console.log("\nMembersihkan data uji...");
  if (subjects.length) {
    const { data: krs } = await admin.from("knowledge_resources").select("id").in("source_submission_id", subjects);
    const krIds = (krs ?? []).map((k) => k.id);
    if (krIds.length) {
      await admin.from("knowledge_resource_authors").delete().in("resource_id", krIds);
      await admin.from("knowledge_resource_versions").delete().in("resource_id", krIds);
      await admin.from("knowledge_resources").delete().in("id", krIds);
    }
    await admin.from("review_decisions").delete().in("subject_id", subjects);
    await admin.from("governance_audit_log").delete().in("subject_id", subjects);
  }
  await admin.from("review_drafts").delete().in("submitter_id", users);
  if (subjects.length) await admin.from("review_subjects").delete().in("id", subjects);
  await admin.from("governance_audit_log").delete().in("actor_id", users);
  await admin.from("admin_audit_log").delete().in("actor_id", users);
  await admin.from("admin_audit_log").delete().in("target_user_id", users);
  await admin.from("rbac_user_roles").delete().in("user_id", users);
  let left = 0;
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) { left++; console.log("  gagal hapus user", id, error.message); }
  }
  console.log(left ? `Selesai dengan ${left} akun tersisa.` : "Selesai: database bersih.");
}

async function run() {
  const author = await mkUser("author");
  const approver = await mkUser("approver", "approver");
  const verifier = await mkUser("verifier", "verifier");

  console.log("1. Setujui dan tayangkan");
  const s1 = await submission(`TDD KR ${stamp} satu`, author.id);
  const v0 = (await subjectRow(s1)).updated_at;
  const r1 = await decide(approver.client, s1, "approve", { expected: v0 });
  ok(!r1.error && r1.data?.status === "approved", "approve berhasil dalam satu panggilan");
  const k1 = await krOf(s1);
  ok(k1?.current_status === "published" && k1?.visibility === "public", "katalog tayang");
  ok((await admin.from("knowledge_resource_authors").select("id").eq("resource_id", k1?.id).eq("display_order", 0)).data?.length === 1, "penulis utama tercatat");

  console.log("2. Klik ganda, peran, milik sendiri");
  await rejects(decide(approver.client, s1, "approve", { expected: v0 }), /stale_subject/, "klik kedua dengan versi lama ditolak");
  await rejects(decide(approver.client, s1, "approve"), /already_approved/, "approve ulang ditolak");
  ok((await decisions(s1)) === 1, "tetap tepat satu keputusan");
  await rejects(decide(verifier.client, s1, "archive"), /forbidden/, "verifier tidak boleh mengarsipkan");
  await rejects(decide(author.client, s1, "archive"), /forbidden/, "pengguna biasa ditolak");
  await rejects(decide(anon, s1, "archive"), /authentication_required|permission denied/, "pengunjung tanpa login ditolak");
  const own = await submission(`TDD KR ${stamp} milik approver`, approver.id);
  await rejects(decide(approver.client, own, "approve"), /self_decision_forbidden/, "tidak bisa memutuskan milik sendiri");

  console.log("3. Siklus revisi");
  const r3 = await decide(approver.client, s1, "return_for_revision", { rationale: "Lengkapi data uji." });
  ok(!r3.error, "kembalikan untuk revisi");
  // Since 20261022020000 the approved version stays on air while a revision is pending.
  ok((await krOf(s1))?.current_status === "published", "versi yang disetujui tetap tayang selama revisi");
  await rejects(decide(approver.client, s1, "approve"), /awaiting_applicant_revision/, "approve saat kontributor merevisi ditolak");
  await admin.from("review_drafts").update({ status: "submitted" }).eq("linked_subject_id", s1).eq("submitter_id", author.id);
  const meta = (await subjectRow(s1)).metadata ?? {};
  await admin.from("review_subjects").update({ metadata: { ...meta, review_status: "resubmitted" } }).eq("id", s1);
  const r4 = await decide(approver.client, s1, "approve");
  const k2 = await krOf(s1);
  ok(!r4.error && k2?.current_status === "published" && k2?.version === 2, "disetujui ulang setelah revisi (versi 2)");

  console.log("4. Arsip dan pulihkan");
  ok(!(await decide(approver.client, s1, "archive")).error && (await krOf(s1))?.current_status === "archived", "arsip menurunkan tayangan");
  await rejects(decide(approver.client, s1, "reject"), /archived_restore_first/, "keputusan pada arsip ditolak");
  const r5 = await decide(approver.client, s1, "restore");
  ok(r5.data?.status === "approved" && (await krOf(s1))?.current_status === "published", "pulihkan yang pernah tayang -> tayang lagi");
  const s2 = await submission(`TDD KR ${stamp} belum disetujui`, author.id);
  await decide(approver.client, s2, "archive");
  const r6 = await decide(approver.client, s2, "restore");
  ok(r6.data?.status === "pending" && !(await krOf(s2)), "pulihkan yang belum pernah disetujui -> kembali ke antrean, tidak tayang");

  console.log("5. Tolak dan gagal di tengah");
  const s3 = await submission(`TDD KR ${stamp} tolak`, author.id);
  ok(!(await decide(approver.client, s3, "reject", { rationale: "Tidak relevan." })).error, "tolak");
  await rejects(decide(approver.client, s3, "reject"), /already_rejected/, "tolak dua kali ditolak");
  await rejects(decide(approver.client, s3, "return_for_revision"), /rejected_is_final/, "kembalikan setelah ditolak ditolak");
  const s4 = await submission(`TDD KR ${stamp} gagal`, author.id);
  const before = (await subjectRow(s4)).updated_at;
  await rejects(decide(approver.client, s4, "approve", { resource: resource({ resource_type: "bukan_jenis" }) }), /invalid_resource_type/, "jenis tidak dikenal ditolak");
  await rejects(decide(approver.client, s4, "approve", { resource: resource({ external_url: "javascript:alert(1)" }) }), /unsafe_url/, "URL berbahaya ditolak");
  const after = await subjectRow(s4);
  ok(after.current_status === "pending" && after.updated_at === before && (await decisions(s4)) === 0 && !(await krOf(s4)),
    "gagal di tengah tidak meninggalkan sisa apa pun");
}

try {
  await run();
} catch (e) {
  console.error("Kesalahan:", e);
  failures.push(String(e?.message ?? e));
} finally {
  if (!keep) {
    try { await cleanup(); } catch (e) { console.error("Gagal membersihkan:", e); failures.push("cleanup gagal"); }
  }
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ")}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
