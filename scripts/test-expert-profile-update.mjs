/**
 * Live test: an approved expert updates their published profile through review
 * (migration 20261022030000) against the Supabase database configured in .env.
 *
 * The published profile, the expert role and the trainer status must stay while
 * an update or a verifier's revision request is open; approval publishes the new
 * profile version, rejection keeps the published one.
 *
 * It WRITES test data (accounts @example.test, one expert application and the
 * profile it creates) and removes everything at the end, even when a check fails.
 * Run: npm run test:expert-profile-update
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const stamp = Date.now();
const password = "TddExpertUpdate!2026#";
const users = [];
let passed = 0;
const failures = [];
const ok = (cond, label) => { if (cond) { passed++; console.log("  ok", label); } else { failures.push(label); console.log("  FAIL", label); } };
const rejects = async (promise, pattern, label) => {
  const { error } = await promise;
  const good = Boolean(error) && pattern.test(error.message);
  if (!good) console.log("   got:", error ? error.message : "no error");
  ok(good, label);
};

async function mkUser(tag, role) {
  const email = `tdd.expupd.${tag}.${stamp}@example.test`;
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

const payload = (name, headline) => ({
  fullName: name, title: headline, institution: "Lembaga Uji", country: "Indonesia",
  email: `tdd.expupd.contact.${stamp}@example.test`, phone: "0800000000",
  expertise: ["Oseanografi"], roles: ["trainer"], biography: `Biografi ${headline}.`,
  structuredLanguages: [{ language: "Bahasa Indonesia", proficiency: "native" }],
  documents: [],
});
const expertOf = async (sid) => (await admin.from("experts").select("*").eq("source_submission_id", sid).maybeSingle()).data;
const subjectRow = async (sid) => (await admin.from("review_subjects").select("current_status, metadata").eq("id", sid).single()).data;
const trainerLatest = async (eid) => (await admin.from("expert_trainer_status").select("trainer_status").eq("expert_id", eid).order("version", { ascending: false }).limit(1)).data?.[0]?.trainer_status;
const roleStatus = async (uid) => (await admin.from("rbac_user_roles").select("status, rbac_roles!inner(code)").eq("user_id", uid).eq("rbac_roles.code", "expert")).data?.[0]?.status;
const openDraft = async (sid) => (await admin.from("review_drafts").select("id, payload").eq("linked_subject_id", sid).eq("status", "draft")).data?.[0];
const decide = (c, sid, d, why) => c.rpc("admin_expert_decide", { _subject_id: sid, _decision: d, _rationale: why ?? "Catatan verifikator uji", _expected_updated_at: null });
const resubmit = (c, sid, draftId, name, headline) => c.rpc("expert_revision_resubmit", { _subject_id: sid, _draft_id: draftId, _display_name: name, _payload: payload(name, headline), _notes: "Pembaruan uji" });
const onAir = (e, headline) => e?.current_status === "published" && e?.visibility === "public" && e?.headline === headline;

async function cleanup() {
  console.log("\nMembersihkan data uji...");
  const { data: subjects } = await admin.from("review_subjects").select("id").in("submitted_by", users);
  const subjectIds = (subjects ?? []).map((s) => s.id);
  if (subjectIds.length) {
    const { data: ex } = await admin.from("experts").select("id").in("source_submission_id", subjectIds);
    if (ex?.length) await admin.from("experts").delete().in("id", ex.map((e) => e.id));
    await admin.from("review_decisions").delete().in("subject_id", subjectIds);
    await admin.from("review_subject_revisions").delete().in("subject_id", subjectIds);
    await admin.from("governance_audit_log").delete().in("subject_id", subjectIds);
  }
  await admin.from("review_drafts").delete().in("submitter_id", users);
  if (subjectIds.length) await admin.from("review_subjects").delete().in("id", subjectIds);
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
  const name = `TDD Expert Update ${stamp}`;
  const approver = await mkUser("approver", "approver");
  const applicant = await mkUser("applicant", "registered_user");
  const outsider = await mkUser("outsider", "registered_user");

  console.log("1. Expert disetujui (profil v1)");
  const draft = await applicant.client.rpc("expert_draft_create", { _display_name: name });
  await applicant.client.rpc("expert_draft_update", { _draft_id: draft.data, _patch: payload(name, "Peneliti V1") });
  const sub = await applicant.client.rpc("expert_draft_submit", { _draft_id: draft.data });
  const sid = sub.data;
  ok(!sub.error && sid, `pengajuan terkirim (${sub.error?.message ?? "ok"})`);
  if (!sid) throw new Error("pengajuan uji tidak terbentuk");
  const ap = await decide(approver.client, sid, "approve", null);
  const ex = await expertOf(sid);
  ok(!ap.error && onAir(ex, "Peneliti V1") && (await roleStatus(applicant.id)) === "active" && (await trainerLatest(ex.id)) === "active", `disetujui: profil tayang, role & trainer aktif (${ap.error?.message ?? "ok"})`);

  console.log("2. Verifikator minta revisi profil tayang");
  const rev = await decide(approver.client, sid, "return_for_revision");
  const exR = await expertOf(sid);
  ok(!rev.error && onAir(exR, "Peneliti V1"), `profil TETAP tayang (${rev.error?.message ?? exR?.visibility})`);
  ok((await roleStatus(applicant.id)) === "active" && (await trainerLatest(ex.id)) === "active", "role expert & status trainer TETAP aktif");
  let d = await openDraft(sid);
  ok(d?.payload?.title === "Peneliti V1", "draf revisi berisi versi tayang");
  await resubmit(applicant.client, sid, d?.id, name, "Peneliti DITOLAK");
  const rj = await decide(approver.client, sid, "reject");
  ok(!rj.error && onAir(await expertOf(sid), "Peneliti V1") && (await subjectRow(sid)).current_status === "approved", `revisi ditolak: profil v1 tetap (${rj.error?.message ?? "ok"})`);
  ok((await roleStatus(applicant.id)) === "active" && (await trainerLatest(ex.id)) === "active", "ditolak: role & trainer tetap aktif");
  await rejects(decide(approver.client, sid, "reject"), /nothing_to_decide/, "Tolak tanpa pengajuan menunggu ditolak");

  console.log("3. Expert membuka pembaruan sendiri");
  await rejects(outsider.client.rpc("expert_open_profile_update", { _subject_id: sid, _note: "Memperbarui data" }), /expert_subject_not_found/, "orang lain ditolak");
  await rejects(applicant.client.rpc("expert_open_profile_update", { _subject_id: sid, _note: "abc" }), /update_note_required/, "catatan terlalu pendek ditolak");
  const op = await applicant.client.rpc("expert_open_profile_update", { _subject_id: sid, _note: "Memperbarui jabatan" });
  ok(!op.error && op.data, `pemilik membuka pembaruan (${op.error?.message ?? "ok"})`);
  d = await openDraft(sid);
  ok(d?.payload?.title === "Peneliti V1", "draf pembaruan berisi versi tayang, bukan yang ditolak");
  await rejects(decide(approver.client, sid, "sync"), /expert_update_open/, "sinkron saat pembaruan disiapkan ditolak");
  const cancel = await applicant.client.rpc("expert_cancel_profile_update", { _subject_id: sid });
  ok(!cancel.error && !(await openDraft(sid)), `pemilik membatalkan pembaruan (${cancel.error?.message ?? "ok"})`);

  await applicant.client.rpc("expert_open_profile_update", { _subject_id: sid, _note: "Memperbarui jabatan" });
  d = await openDraft(sid);
  const rs = await resubmit(applicant.client, sid, d?.id, name, "Peneliti V2");
  ok(!rs.error && (await subjectRow(sid)).current_status === "pending" && onAir(await expertOf(sid), "Peneliti V1"), `pembaruan dikirim, v1 tetap tayang (${rs.error?.message ?? "ok"})`);
  await rejects(applicant.client.rpc("expert_cancel_profile_update", { _subject_id: sid }), /no_profile_update_open/, "setelah dikirim tidak bisa dibatalkan");
  const ok2 = await decide(approver.client, sid, "approve", null);
  const ex2 = await expertOf(sid);
  ok(!ok2.error && onAir(ex2, "Peneliti V2") && ex2.version > ex.version && ex2.slug === ex.slug, `disetujui: profil v${ex2?.version} tayang, slug tetap (${ok2.error?.message ?? "ok"})`);
  const { data: versions } = await admin.from("expert_versions").select("version").eq("expert_id", ex.id);
  ok((versions ?? []).some((v) => v.version === ex2.version), "versi baru tersimpan di riwayat versi expert");
  ok((await roleStatus(applicant.id)) === "active" && (await trainerLatest(ex.id)) === "active", "role & trainer tetap aktif sepanjang alur");
}

try {
  await run();
} catch (e) {
  console.error("Kesalahan:", e);
  failures.push(String(e?.message ?? e));
} finally {
  try { await cleanup(); } catch (e) { console.error("Gagal membersihkan:", e); failures.push("cleanup gagal"); }
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ")}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
