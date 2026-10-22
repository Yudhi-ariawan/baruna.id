// Live test: Knowledge Hub publication stays on air during revision and update
// (migration 20261022020000). A contributor's live publication must stay in the
// catalog while a curator's revision request or the contributor's own update is
// prepared and reviewed; approval raises the version, rejection keeps the live
// version, and an unsent update can be cancelled. Uses the real RPCs
// (kr_draft_create / kr_draft_update / kr_draft_submit, admin_kr_decide,
// contributor_open_resource_update / contributor_cancel_resource_update).
// Creates a temporary contributor, approver and plain user (@example.test) and
// deletes everything afterwards.
// Run: npm run test:knowledge-update
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = `Tdd-${Math.random().toString(36).slice(2)}-Aa1!`, stamp = Date.now();
const created = [];
let passed = 0, failed = 0;
const check = (cond, label) => { if (cond) { passed++; console.log("  ok  ", label); } else { failed++; console.log("  FAIL", label); } };

async function retry(fn, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= tries || !/fetch failed|timeout|ECONNRESET/i.test(String(e?.message ?? e))) throw e; await new Promise((r) => setTimeout(r, 1500 * i)); }
  }
}

const { data: roleRows, error: roleErr } = await svc.from("rbac_roles").select("id, code");
if (roleErr) throw new Error(roleErr.message);
const roleId = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));

async function persona(label, role) {
  const email = `tdd-knowledge-update-${label}-${stamp}@example.test`;
  const { data: u, error } = await retry(() => svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } }));
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_knowledge_update_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await retry(() => c.auth.signInWithPassword({ email, password: PASSWORD }));
  if (se) throw new Error(se.message);
  return { id: u.user.id, c };
}

// Each version has its own title and link, so the catalog shows which one is live.
const form = (tag) => ({ title: `TDD Laporan ${stamp} ${tag}`, resource_type: "technical_report", type: "Technical Report",
  externalUrl: `https://example.org/tdd-${stamp}-${tag}`, description: `Isi versi ${tag}` });
const catalog = (tag) => ({ resource_type: "technical_report", title: `TDD Laporan ${stamp} ${tag}`, summary: `Isi versi ${tag}`,
  abstract: `Isi versi ${tag}`, language: "Indonesian", publication_year: "2026", publisher: "KKP",
  external_url: `https://example.org/tdd-${stamp}-${tag}`, thumbnail_url: null, topics: ["uji"], keywords: ["tdd"],
  geographic_focus: [], metadata: { attached_resources: [] }, author_name: "TDD Penulis", author_affiliation: "KKP", author_role: "Author" });
const decide = (a, sid, d, tag) => a.c.rpc("admin_kr_decide", { _subject_id: sid, _decision: d,
  _rationale: d === "approve" ? null : "Catatan kurator uji", _expected_updated_at: null, _resource: tag ? catalog(tag) : null });
const edit = (u, draftId, tag) => u.c.rpc("kr_draft_update", { _draft_id: draftId, _patch: form(tag) });
const live = async (sid) => (await svc.from("knowledge_resources").select("id, title, version, current_status, visibility").eq("source_submission_id", sid).maybeSingle()).data;
const subjectOf = async (sid) => (await svc.from("review_subjects").select("current_status, metadata").eq("id", sid).single()).data;
const openDraft = async (sid) => (await svc.from("review_drafts").select("id, payload").eq("linked_subject_id", sid).eq("status", "draft")).data ?? [];
const onAir = (k, tag) => k?.current_status === "published" && k?.visibility === "public" && k?.title === `TDD Laporan ${stamp} ${tag}`;
let subjectId = null;

try {
  const author = await persona("author");
  const approver = await persona("approver", "approver");
  const plain = await persona("plain");

  console.log("\n== publikasi tayang (V1)");
  let r = await author.c.rpc("kr_draft_create", { _title: form("V1").title, _resource_type: "technical_report", _source_type: "external_submission" });
  const firstDraft = r.data;
  r = await edit(author, firstDraft, "V1");
  r = await author.c.rpc("kr_draft_submit", { _draft_id: firstDraft });
  subjectId = r.data;
  check(!r.error && Boolean(subjectId), `kontributor mengirim publikasi (${r.error?.message ?? "ok"})`);
  if (!subjectId) throw new Error("publikasi uji tidak terbentuk; uji berikutnya dilewati");
  r = await decide(approver, subjectId, "approve", "V1");
  let k = await live(subjectId);
  check(!r.error && onAir(k, "V1") && k.version === 1, `disetujui → tayang v1 (${r.error?.message ?? "ok"})`);

  console.log("\n== kurator minta revisi publikasi tayang");
  r = await decide(approver, subjectId, "return_for_revision");
  k = await live(subjectId);
  check(!r.error && onAir(k, "V1"), `v1 TETAP tayang selama revisi (${r.error?.message ?? k?.current_status})`);
  let [draft] = await openDraft(subjectId);
  check(draft?.payload?.title === form("V1").title, "draf revisi berisi versi tayang");
  r = await edit(author, draft?.id, "DITOLAK");
  r = await author.c.rpc("kr_draft_submit", { _draft_id: draft?.id });
  check(!r.error && (await subjectOf(subjectId)).metadata.review_status === "resubmitted", `revisi dikirim ulang (${r.error?.message ?? "ok"})`);
  r = await decide(approver, subjectId, "reject");
  k = await live(subjectId);
  let s = await subjectOf(subjectId);
  check(!r.error && onAir(k, "V1") && s.current_status === "approved", `revisi ditolak → v1 tetap tayang (${r.error?.message ?? s.current_status})`);
  r = await decide(approver, subjectId, "reject");
  check(/nothing_to_decide/.test(r.error?.message ?? ""), `Tolak tanpa pengajuan menunggu ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);

  console.log("\n== kontributor membuka pembaruan sendiri");
  r = await plain.c.rpc("contributor_open_resource_update", { _subject_id: subjectId, _note: "Memperbarui data 2026" });
  check(/resource_subject_not_found/.test(r.error?.message ?? ""), `orang lain ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await author.c.rpc("contributor_open_resource_update", { _subject_id: subjectId, _note: "abc" });
  check(/update_note_required/.test(r.error?.message ?? ""), `catatan terlalu pendek ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await author.c.rpc("contributor_open_resource_update", { _subject_id: subjectId, _note: "Memperbarui data 2026" });
  check(!r.error && Boolean(r.data), `pemilik membuka pembaruan (${r.error?.message ?? "ok"})`);
  [draft] = await openDraft(subjectId);
  check(draft?.payload?.title === form("V1").title, "draf pembaruan berisi versi tayang, bukan yang ditolak");
  s = await subjectOf(subjectId);
  check(s.current_status === "approved" && s.metadata.update_open === true && onAir(await live(subjectId), "V1"), "status tetap disetujui, v1 tetap tayang");
  r = await decide(approver, subjectId, "approve", "X");
  check(/awaiting_applicant_revision/.test(r.error?.message ?? ""), `approver tidak bisa menyetujui pembaruan yang belum dikirim (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await author.c.rpc("contributor_cancel_resource_update", { _subject_id: subjectId });
  check(!r.error && (await openDraft(subjectId)).length === 0 && !("update_open" in (await subjectOf(subjectId)).metadata), `pemilik membatalkan pembaruan (${r.error?.message ?? "ok"})`);

  r = await author.c.rpc("contributor_open_resource_update", { _subject_id: subjectId, _note: "Memperbarui data 2026" });
  [draft] = await openDraft(subjectId);
  r = await edit(author, draft?.id, "V2");
  r = await author.c.rpc("kr_draft_submit", { _draft_id: draft?.id });
  s = await subjectOf(subjectId);
  check(!r.error && s.current_status === "pending" && s.metadata.review_status === "resubmitted", `pembaruan dikirim → antre kurasi (${r.error?.message ?? "ok"})`);
  check(onAir(await live(subjectId), "V1"), "v1 tetap tayang selama pembaruan ditinjau");
  r = await author.c.rpc("contributor_cancel_resource_update", { _subject_id: subjectId });
  check(/no_resource_update_open/.test(r.error?.message ?? ""), `setelah dikirim tidak bisa dibatalkan (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await decide(approver, subjectId, "approve", "V2");
  k = await live(subjectId);
  check(!r.error && onAir(k, "V2") && k.version === 2, `disetujui → v2 tayang (${r.error?.message ?? `v${k?.version}`})`);
  const { data: versions } = await svc.from("knowledge_resource_versions").select("version").eq("resource_id", k.id);
  check((versions ?? []).some((v) => v.version === 2), "v2 tersimpan di riwayat versi");
} catch (e) {
  failed++;
  console.log("  FAIL", e.message);
} finally {
  const { data: subs } = await svc.from("review_subjects").select("id").in("submitted_by", created);
  const ids = (subs ?? []).map((x) => x.id);
  if (ids.length) {
    const { data: krs } = await svc.from("knowledge_resources").select("id").in("source_submission_id", ids);
    const krIds = (krs ?? []).map((x) => x.id);
    if (krIds.length) {
      await svc.from("knowledge_resource_authors").delete().in("resource_id", krIds);
      await svc.from("knowledge_resource_versions").delete().in("resource_id", krIds);
      const { error } = await svc.from("knowledge_resources").delete().in("id", krIds);
      if (error) console.log("cleanup resource", error.message);
    }
    await svc.from("review_decisions").delete().in("subject_id", ids);
    await svc.from("review_subject_revisions").delete().in("subject_id", ids);
    await svc.from("governance_audit_log").delete().in("subject_id", ids);
  }
  await svc.from("review_drafts").delete().in("submitter_id", created);
  if (ids.length) {
    const { error } = await svc.from("review_subjects").delete().in("id", ids);
    if (error) console.log("cleanup subjects", error.message);
  }
  await svc.from("governance_audit_log").delete().in("actor_id", created);
  await svc.from("platform_events").delete().in("actor_id", created);
  for (const id of created) await svc.from("rbac_user_roles").delete().eq("user_id", id);
  for (const id of created) {
    await svc.from("profiles").delete().eq("id", id);
    const { error } = await retry(() => svc.auth.admin.deleteUser(id));
    if (error) console.log("cleanup user", id, error.message);
  }
  const { data: left } = await svc.from("review_subjects").select("id").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  console.log(left?.length ? `Data uji tersisa: ${left.length} pengajuan` : "Data uji tersisa: 0");
}
console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed ? 1 : 0);
