/**
 * Live test of the atomic Expert RPCs (migrations 20261015050000 .. 080000)
 * against the real Supabase database configured in .env.
 *
 * It WRITES test data (accounts @example.test, one expert application and the
 * profile it creates) and removes everything at the end, even when a check fails.
 * Run: npm run test:expert-rpc   (use --keep to leave the data for inspection)
 *
 * Real users are never touched: every row is created by this script and tracked
 * by id before it is deleted.
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
const stamp = Date.now();
const password = "TddExpertRpc!2026#";
const keep = process.argv.includes("--keep");
const users = [];
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
  const { data, error } = await admin.auth.admin.createUser({
    email: `tdd.exprpc.${tag}.${stamp}@example.test`, password, email_confirm: true,
    user_metadata: { display_name: `TDD ${tag}`, organization: "Instansi Uji", job_title: "Staf Uji", phone: "+6280000000000" },
  });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  const id = data.user.id;
  users.push(id);
  if (role) {
    const { data: r } = await admin.from("rbac_roles").select("id").eq("code", role).single();
    // Swap the single primary role in ONE statement (the primary-role trigger is deferred per transaction).
    const { data: existing } = await admin.from("rbac_user_roles").select("id").eq("user_id", id).eq("is_primary", true);
    if (existing?.length) {
      const { error: e } = await admin.from("rbac_user_roles").update({ role_id: r.id, reason: "tdd" }).eq("id", existing[0].id);
      if (e) throw new Error(`role swap ${tag}: ${e.message}`);
    } else {
      const { error: e } = await admin.from("rbac_user_roles").insert({ user_id: id, role_id: r.id, status: "active", is_primary: true, valid_from: new Date().toISOString(), reason: "tdd" });
      if (e) throw new Error(`role insert ${tag}: ${e.message}`);
    }
  }
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email: `tdd.exprpc.${tag}.${stamp}@example.test`, password });
  if (signErr) throw new Error(`signIn ${tag}: ${signErr.message}`);
  return { id, client };
}

const payload = (name) => ({
  fullName: name, title: "Peneliti Madya", institution: "Lembaga Uji", country: "Indonesia",
  email: `tdd.exprpc.contact.${stamp}@example.test`, phone: "0800000000",
  expertise: ["Oseanografi"], roles: ["trainer"], biography: "Biografi uji otomatis.",
  structuredLanguages: [{ language: "Bahasa Indonesia", proficiency: "native" }, { language: "English", proficiency: "professional" }],
  structuredProjects: [{ name: "Proyek Uji", institution: "KKP", role: "Ketua", period: "2024" }],
  structuredPublications: [{ title: "Makalah Uji", venue: "Jurnal Uji", year: "2024" }],
  documents: [],
});

const subjectRow = async (id) => (await admin.from("review_subjects").select("*").eq("id", id).single()).data;
const expertOf = async (sid) => (await admin.from("experts").select("*").eq("source_submission_id", sid).maybeSingle()).data;
const trainerLatest = async (eid) => (await admin.from("expert_trainer_status").select("*").eq("expert_id", eid).order("version", { ascending: false }).limit(1)).data?.[0];
const roleOf = async (uid, code) => {
  const { data } = await admin.from("rbac_user_roles").select("status, is_primary, revoked_at, rbac_roles!inner(code)").eq("user_id", uid).eq("rbac_roles.code", code);
  return data?.[0];
};
const decide = (c, sid, d, why, exp) => c.rpc("admin_expert_decide", { _subject_id: sid, _decision: d, _rationale: why ?? null, _expected_updated_at: exp ?? null });

async function cleanup() {
  console.log("\nMembersihkan data uji...");
  const { data: subjects } = await admin.from("review_subjects").select("id").in("submitted_by", users);
  const subjectIds = (subjects ?? []).map((s) => s.id);
  if (subjectIds.length) {
    const { data: ex } = await admin.from("experts").select("id").in("source_submission_id", subjectIds);
    if (ex?.length) await admin.from("experts").delete().in("id", ex.map((e) => e.id));
    await admin.from("review_decisions").delete().in("subject_id", subjectIds);
    await admin.from("review_subject_revisions").delete().in("subject_id", subjectIds);
  }
  await admin.from("review_drafts").delete().in("submitter_id", users);
  if (subjectIds.length) await admin.from("review_subjects").delete().in("id", subjectIds);
  await admin.from("governance_audit_log").delete().in("actor_id", users);
  await admin.from("admin_audit_log").delete().in("actor_id", users);
  await admin.from("admin_audit_log").delete().in("target_user_id", users);
  await admin.from("rbac_user_roles").delete().in("user_id", users);
  await admin.from("user_roles").delete().in("user_id", users);
  let left = 0;
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) { left++; console.log("  gagal hapus user", id, error.message); }
  }
  console.log(left ? `Selesai dengan ${left} akun tersisa.` : "Selesai: database bersih.");
}

async function run() {
  const name = `TDD Expert ${stamp}`;
  const approverA = await mkUser("approverA", "approver");
  const approverB = await mkUser("approverB", "approver");
  const reviewer = await mkUser("reviewer", "reviewer");
  const applicant = await mkUser("applicant", "registered_user");
  const outsider = await mkUser("outsider", "registered_user");
  console.log("Akun uji dibuat (2 approver, 1 reviewer, 2 pengguna biasa)");

  console.log("\n1. Pengajuan lewat RPC bergerbang");
  const draft = await applicant.client.rpc("expert_draft_create", { _display_name: name });
  ok(!draft.error && draft.data, "draf dibuat lewat expert_draft_create");
  const draftId = draft.data;
  await rejects(applicant.client.rpc("expert_draft_submit", { _draft_id: draftId }), /payload_incomplete/, "kirim draf kosong ditolak database");
  const upd = await applicant.client.rpc("expert_draft_update", { _draft_id: draftId, _patch: payload(name) });
  ok(!upd.error, "draf diisi lengkap");
  await rejects(applicant.client.rpc("expert_draft_update", { _draft_id: draftId, _patch: { documents: [{ category: "cv", path: `users/${outsider.id}/cv.pdf` }] } }), /document_not_owned/, "dokumen milik akun lain ditolak");
  const sub = await applicant.client.rpc("expert_draft_submit", { _draft_id: draftId });
  ok(!sub.error && sub.data, "pengajuan terkirim");
  const sid = sub.data;
  await rejects(applicant.client.rpc("expert_draft_submit", { _draft_id: draftId }), /draft_already_submitted/, "kirim ganda ditolak");

  console.log("\n2. Tulis langsung dari browser ditutup");
  const direct1 = await outsider.client.from("review_drafts").insert({ submitter_id: outsider.id, subject_kind: "expert", title: "palsu" });
  ok(Boolean(direct1.error), "insert draf expert langsung ditolak");
  const direct2 = await outsider.client.from("review_drafts").insert({ submitter_id: outsider.id, subject_kind: "knowledge_resource", title: "tautan palsu", linked_subject_id: sid });
  ok(Boolean(direct2.error), "menautkan draf ke pengajuan orang lain ditolak");
  const direct3 = await outsider.client.rpc("submit_draft_for_review", { _draft_id: draftId });
  ok(Boolean(direct3.error), "mengirim draf orang lain lewat fungsi inti ditolak");
  const direct4 = await applicant.client.from("review_decisions").insert({ subject_id: sid, decided_by: applicant.id, decision: "approve" });
  ok(Boolean(direct4.error), "menulis keputusan langsung ditolak");

  console.log("\n3. Hak memutuskan");
  await rejects(decide(reviewer.client, sid, "approve"), /forbidden/, "reviewer tidak boleh memutuskan");
  await rejects(decide(outsider.client, sid, "approve"), /forbidden/, "pengguna biasa tidak boleh memutuskan");
  await rejects(decide(approverA.client, sid, "bogus"), /invalid_decision/, "keputusan tidak dikenal ditolak");
  await rejects(decide(approverA.client, sid, "sync"), /expert_not_approved/, "sinkron sebelum disetujui ditolak");

  console.log("\n4. Dua approver menyetujui bersamaan dari tampilan yang sama");
  const seen = (await subjectRow(sid)).updated_at;
  const [r1, r2] = await Promise.all([decide(approverA.client, sid, "approve", null, seen), decide(approverB.client, sid, "approve", null, seen)]);
  for (const r of [r1, r2]) console.log('   rpc ->', r.error ? 'ERROR ' + r.error.message : 'ok ' + JSON.stringify(r.data).slice(0, 120));
  const winners = [r1, r2].filter((r) => !r.error);
  const losers = [r1, r2].filter((r) => r.error);
  ok(winners.length === 1 && losers.length === 1, "tepat satu approver berhasil");
  ok(losers[0]?.error && /stale_subject/.test(losers[0].error.message), "yang kalah mendapat stale_subject");
  const { count: decisionRows } = await admin.from("review_decisions").select("id", { count: "exact", head: true }).eq("subject_id", sid);
  ok(decisionRows === 1, "hanya satu baris keputusan");
  const ex = await expertOf(sid);
  ok(ex && ex.current_status === "published" && ex.visibility === "public", "profil tayang di direktori");
  const expertId = ex.id;
  ok(ex.slug && /^[a-z0-9-]+$/.test(ex.slug), `slug valid (${ex.slug})`);
  const { count: langs } = await admin.from("expert_languages").select("id", { count: "exact", head: true }).eq("expert_id", expertId);
  const { count: pubs } = await admin.from("expert_publications").select("id", { count: "exact", head: true }).eq("expert_id", expertId);
  const { count: projs } = await admin.from("expert_projects").select("id", { count: "exact", head: true }).eq("expert_id", expertId);
  ok(langs === 2 && pubs === 1 && projs === 1, "bahasa, publikasi, dan proyek tersalin tanpa ganda");
  const contact = (await admin.from("expert_contact_private").select("email").eq("expert_id", expertId).maybeSingle()).data;
  ok(contact?.email?.includes("tdd.exprpc.contact"), "kontak privat tersimpan");
  const t1 = await trainerLatest(expertId);
  ok(t1?.trainer_status === "active" && t1.version === 1, "status trainer aktif v1");
  const roleExpert = await roleOf(applicant.id, "expert");
  ok(roleExpert?.status === "active", "role expert aktif");
  const prof = (await admin.from("profiles").select("job_title").eq("id", applicant.id).single()).data;
  ok(prof?.job_title === "Peneliti Madya", "jabatan profil tersinkron");

  console.log("\n5. Pemohon tidak bisa mengubah profil tayang langsung");
  const w1 = await applicant.client.from("expert_publications").insert({ expert_id: expertId, title: "palsu" });
  ok(Boolean(w1.error), "menambah publikasi langsung ditolak");
  const w2 = await applicant.client.from("expert_contact_private").update({ email: "lain@example.test" }).eq("expert_id", expertId);
  const contactAfter = (await admin.from("expert_contact_private").select("email").eq("expert_id", expertId).maybeSingle()).data;
  ok(contactAfter?.email === contact.email, "kontak privat tidak berubah" + (w2.error ? "" : " (0 baris terpengaruh)"));
  const w3 = await applicant.client.from("experts").update({ display_name: "Diganti" }).eq("id", expertId);
  const afterName = (await admin.from("experts").select("display_name").eq("id", expertId).single()).data;
  ok(afterName.display_name === name, "nama profil tidak berubah" + (w3.error ? "" : " (0 baris terpengaruh)"));

  console.log("\n6. Sinkron ulang idempoten dan menghormati penangguhan admin");
  const syncOnce = await decide(approverA.client, sid, "sync");
  ok(!syncOnce.error && syncOnce.data?.resynced === true, "sinkron ulang berhasil");
  const { count: langs2 } = await admin.from("expert_languages").select("id", { count: "exact", head: true }).eq("expert_id", expertId);
  ok(langs2 === 2, "data turunan tidak berlipat setelah sinkron");
  const approveAgain = await decide(approverB.client, sid, "approve");
  ok(!approveAgain.error && approveAgain.data?.changed === false, "approve ulang = sinkron, bukan keputusan baru");
  await admin.from("expert_trainer_status").insert({ expert_id: expertId, trainer_status: "suspended", trainer_level: "certified", version: 2, rationale: "tdd: ditangguhkan admin" });
  await decide(approverA.client, sid, "sync");
  ok((await trainerLatest(expertId)).trainer_status === "suspended", "sinkron tidak mengaktifkan trainer yang ditangguhkan");

  console.log("\n7. Minta revisi lalu kirim ulang");
  const rev = await decide(approverA.client, sid, "return_for_revision", "Lengkapi data");
  ok(!rev.error && rev.data?.status === "revision_requested", "revisi diminta");
  // Since 20261022030000 a revision of a published profile keeps the profile,
  // the trainer status and the expert role until the revision is decided.
  const exRev = await expertOf(sid);
  ok(exRev.current_status === "published" && exRev.visibility === "public", "profil yang disetujui tetap tayang selama revisi");
  const t3 = await trainerLatest(expertId);
  ok(t3.trainer_status === "suspended" && t3.version === 2, "status trainer tidak diubah oleh permintaan revisi");
  const { data: v1row } = await admin.from("expert_trainer_status").select("trainer_status").eq("expert_id", expertId).eq("version", 1).single();
  ok(v1row.trainer_status === "active", "riwayat versi 1 tidak tertimpa");
  const rr = await roleOf(applicant.id, "expert");
  ok(rr?.status === "active", "role expert tetap aktif selama revisi");
  await rejects(decide(approverA.client, sid, "approve"), /awaiting_applicant_revision/, "approve saat pemohon masih merevisi ditolak");
  await rejects(decide(approverB.client, sid, "return_for_revision"), /already_awaiting_revision/, "minta revisi dua kali ditolak");
  const reopened = (await admin.from("review_drafts").select("id,status").eq("linked_subject_id", sid).eq("status", "draft")).data;
  ok(reopened?.length === 1, "tepat satu draf dibuka kembali");
  const bad = await applicant.client.rpc("expert_revision_resubmit", { _subject_id: sid, _draft_id: reopened[0].id, _display_name: name, _payload: { ...payload(name), biography: "" } });
  ok(Boolean(bad.error) && /payload_incomplete/.test(bad.error.message), "kirim ulang tidak lengkap ditolak");
  const edited = { ...payload(name), title: "Peneliti Utama" };
  const resub = await applicant.client.rpc("expert_revision_resubmit", { _subject_id: sid, _draft_id: reopened[0].id, _display_name: name, _payload: edited });
  ok(!resub.error && resub.data?.revision === 2, "revisi terkirim ulang (snapshot 2)");
  const resub2 = await applicant.client.rpc("expert_revision_resubmit", { _subject_id: sid, _draft_id: reopened[0].id, _display_name: name, _payload: edited });
  ok(Boolean(resub2.error), "kirim ulang ganda ditolak");
  const approved2 = await decide(approverB.client, sid, "approve", "Revisi baik");
  ok(!approved2.error && approved2.data?.status === "approved", "disetujui setelah revisi");
  const ex2 = await expertOf(sid);
  ok(ex2.current_status === "published" && ex2.headline === "Peneliti Utama" && ex2.slug === ex.slug, "profil tayang dengan data revisi, slug tetap");
  ok((await trainerLatest(expertId)).trainer_status === "suspended", "trainer kembali ke penangguhan admin (bukan aktif buta)");
  ok((await roleOf(applicant.id, "expert"))?.status === "active", "role expert aktif kembali");

  console.log("\n8. Arsip dan pulihkan");
  const stale = await approverA.client.rpc("admin_expert_archive", { _subject_id: sid, _rationale: "tdd", _expected_updated_at: "2001-01-01T00:00:00Z" });
  ok(Boolean(stale.error) && /stale_subject/.test(stale.error.message), "arsip dari tampilan usang ditolak");
  const arch = await approverA.client.rpc("admin_expert_archive", { _subject_id: sid, _rationale: "tdd arsip" });
  ok(!arch.error, "diarsipkan");
  ok((await expertOf(sid)).current_status === "archived", "profil keluar dari direktori");
  ok((await roleOf(applicant.id, "expert"))?.status === "revoked", "role dicabut saat arsip");
  await rejects(approverA.client.rpc("admin_expert_archive", { _subject_id: sid }), /already_archived/, "arsip ganda ditolak");
  await rejects(decide(approverA.client, sid, "approve"), /expert_archived|expert_not_approved/, "keputusan pada expert terarsip ditolak");
  const rest = await approverB.client.rpc("admin_expert_restore", { _subject_id: sid });
  ok(!rest.error && rest.data?.status === "published", "dipulihkan ke direktori");
  ok((await expertOf(sid)).current_status === "published", "profil tayang kembali");
  ok((await trainerLatest(expertId)).trainer_status === "suspended", "trainer kembali ke status sebelum arsip");
  ok((await roleOf(applicant.id, "expert"))?.status === "active", "role aktif kembali");
  await rejects(approverB.client.rpc("admin_expert_restore", { _subject_id: sid }), /not_archived/, "pulihkan ganda ditolak");

  console.log("\n9. Peringatan duplikat (A2)");
  const dups = await admin.rpc("expert_duplicate_candidates", { _name: name.toUpperCase(), _email: "", _exclude_user: null });
  ok(!dups.error && dups.data?.some((d) => d.expert_id === expertId), "nama sama (beda huruf besar) terdeteksi");
  const dupMail = await admin.rpc("expert_duplicate_candidates", { _name: "nama lain", _email: `TDD.EXPRPC.CONTACT.${stamp}@example.test`, _exclude_user: null });
  ok(!dupMail.error && dupMail.data?.some((d) => d.expert_id === expertId), "email sama terdeteksi");
  const dupSelf = await admin.rpc("expert_duplicate_candidates", { _name: name, _email: "", _exclude_user: applicant.id });
  ok(!dupSelf.error && !dupSelf.data?.some((d) => d.expert_id === expertId), "profil milik pemohon sendiri dikecualikan");
  const dupBrowser = await applicant.client.rpc("expert_duplicate_candidates", { _name: name, _email: "", _exclude_user: null });
  ok(Boolean(dupBrowser.error), "fungsi duplikat tidak bisa dipanggil dari browser");

  console.log("\n10. Fungsi internal tidak terbuka");
  for (const fn of ["_expert_publish_from_subject", "_expert_set_role", "_expert_deactivate_outputs"]) {
    const res = await applicant.client.rpc(fn, { _subject_id: sid, _decision_id: null, _actor: applicant.id, _new_decision: true, _uid: applicant.id, _active: true, _reason: "x" });
    ok(Boolean(res.error), `${fn} tidak bisa dipanggil dari browser`);
  }
}

try {
  await run();
} catch (e) {
  console.error("\nUJI BERHENTI KARENA ERROR:", e);
  failures.push("error tak terduga: " + (e?.message ?? e));
} finally {
  if (!keep) {
    try { await cleanup(); } catch (e) { console.error("Gagal membersihkan:", e); failures.push("cleanup gagal"); }
  } else {
    console.log("\n--keep: data uji dipertahankan.");
  }
}
console.log(`\n${failures.length ? "GAGAL" : "LULUS"}: ${passed} pengecekan lulus, ${failures.length} gagal`);
if (failures.length) { console.log(failures.map((f) => " - " + f).join("\n")); process.exit(1); }
