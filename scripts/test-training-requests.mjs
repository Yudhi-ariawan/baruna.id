// Live test: Request a Training end to end on the database (migration 20261021110000):
// submit → status history → SLA → assign → recommend → return for revision →
// resubmit → reassign → withdraw, plus a full approval, each with the
// requester's / reviewer's / approver's own client (RLS and RPC checks apply).
// Creates temporary @example.test accounts and test requests, and deletes them
// afterwards. SLA values changed by the test are restored.
// Run: npm run test:training-requests
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
  const email = `tdd-training-req-${label}-${stamp}@example.test`;
  const { data: u, error } = await retry(() => svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } }));
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_training_request_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await retry(() => c.auth.signInWithPassword({ email, password: PASSWORD }));
  if (se) throw new Error(se.message);
  return { id: u.user.id, c };
}

// Same shape as buildTrainingNeedPatch (src/lib/training-requests/payload.ts), trimmed.
const patch = (topic, count) => ({
  title: topic, summary: "Meningkatkan kapasitas pengawasan", target_participants: "Government Officers",
  competency_gap: "Belum ada pelatihan", proposed_topics: ["Fisheries Management"], geographic_focus: ["Indonesia"],
  delivery_preference: "online", requester_selected_learning_path: "facilitated", self_paced_alternative_found: false,
  funding_preference: "government_funded", participant_charge_preference: "no_participant_charge",
  logistics_requirements: { attendance_format: "Online", support_requested: [] },
  metadata: { requester: { full_name: "TDD Requester", email: "tdd@example.test", organization: "KKP", country: "Indonesia" },
    participants: { count } },
});
async function submitRequest(user, topic) {
  const { data: draftId, error: e1 } = await user.c.rpc("training_need_draft_create", { _title: topic, _source_type: "external_submission" });
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await user.c.rpc("training_need_draft_update", { _draft_id: draftId, _patch: patch(topic, "11–20") });
  if (e2) throw new Error(e2.message);
  const { data: subjectId, error: e3 } = await user.c.rpc("training_need_draft_submit", { _draft_id: draftId });
  if (e3) throw new Error(e3.message);
  return subjectId;
}
const statusOf = async (id) => (await svc.from("review_subjects").select("current_status").eq("id", id).single()).data?.current_status;
const historyOf = async (c, id) => (await c.from("review_subject_status_history").select("from_status, to_status, is_backfill").eq("subject_id", id).order("changed_at").order("id")).data ?? [];
async function recommend(reviewer, subjectId, assignmentId, recommendation) {
  const { data: rec, error } = await reviewer.c.from("review_records").insert({ subject_id: subjectId, reviewer_id: reviewer.id, assignment_id: assignmentId,
    recommendation, rationale: "Uji otomatis", criteria: {}, status: "draft" }).select("id").single();
  if (error) return { error };
  return reviewer.c.rpc("submit_review_recommendation", { _record_id: rec.id });
}

const { data: slaBefore } = await svc.from("workflow_sla_policies").select("*").eq("subject_kind", "training_need");

try {
  const requester = await persona("requester");
  const other = await persona("other");
  const reviewer = await persona("reviewer", "reviewer");
  const approver = await persona("approver", "approver");
  const admin = await persona("admin", "admin");

  console.log("\n== pengajuan dan riwayat status");
  const sid = await submitRequest(requester, `TDD Pelatihan MCS ${stamp}`);
  let h = await historyOf(requester.c, sid);
  check(h.length === 1 && h[0].from_status === null && h[0].to_status === "pending" && !h[0].is_backfill, "riwayat tercatat saat diajukan, terbaca pemohon");
  check((await historyOf(other.c, sid)).length === 0, "pengguna lain tidak melihat riwayat");
  let r = await requester.c.from("review_subject_status_history").select("changed_by").eq("subject_id", sid);
  check(Boolean(r.error), `kolom changed_by tertutup untuk pemohon (${r.error?.code ?? "TERBUKA"})`);
  r = await requester.c.from("review_subjects").select("id, current_status").eq("id", sid);
  check(r.data?.[0]?.current_status === "pending", "pemohon membaca pengajuannya dari server (bukan browser)");
  r = await other.c.from("review_subjects").select("id").eq("id", sid);
  check(r.data?.length === 0, "pengguna lain tidak melihat pengajuan");

  console.log("\n== SLA");
  r = await requester.c.from("workflow_sla_policies").select("status, target_hours").eq("subject_kind", "training_need");
  check(r.data?.length === 3, `pemohon membaca 3 SLA permintaan pelatihan (${r.data?.length ?? r.error?.message})`);
  r = await approver.c.rpc("set_workflow_sla_policy", { _subject_kind: "training_need", _status: "pending", _target_hours: 1, _responsible_label: "x", _is_active: true });
  check(/forbidden/.test(r.error?.message ?? ""), `approver tidak bisa mengubah SLA (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await admin.c.from("workflow_sla_policies").update({ target_hours: 1 }).eq("subject_kind", "training_need").select("status");
  check(Boolean(r.error) || r.data?.length === 0, `admin tidak bisa update SLA langsung (${r.error?.code ?? "0 baris"})`);
  const pendingBefore = slaBefore.find((p) => p.status === "pending");
  r = await admin.c.rpc("set_workflow_sla_policy", { _subject_kind: "training_need", _status: "pending", _target_hours: pendingBefore.target_hours + 1,
    _responsible_label: pendingBefore.responsible_label, _is_active: pendingBefore.is_active });
  const { data: slaNow } = await svc.from("workflow_sla_policies").select("target_hours, updated_by").eq("subject_kind", "training_need").eq("status", "pending").single();
  check(!r.error && slaNow.target_hours === pendingBefore.target_hours + 1 && slaNow.updated_by === admin.id, `admin mengubah SLA lewat RPC (${r.error?.message ?? "ok"})`);
  const { data: slaLog } = await svc.from("governance_audit_log").select("id").eq("event_type", "sla_policy_updated").eq("actor_id", admin.id);
  check(slaLog?.length === 1, "perubahan SLA tercatat di audit trail");

  console.log("\n== penugasan, rekomendasi, dikembalikan untuk revisi");
  r = await admin.c.rpc("assign_reviewer", { _subject_id: sid, _reviewer_id: reviewer.id, _due_at: null, _template_version_id: null });
  const asg1 = r.data;
  check(!r.error && (await statusOf(sid)) === "under_review", `admin menugaskan reviewer (${r.error?.message ?? "ok"})`);
  h = await historyOf(requester.c, sid);
  check(h.at(-1)?.to_status === "under_review", "riwayat 'mulai direview' terbaca pemohon");
  check((await historyOf(reviewer.c, sid)).length === 2, "reviewer yang ditugaskan membaca riwayat");
  r = await recommend(reviewer, sid, asg1, "request_changes");
  check(!r.error && (await statusOf(sid)) === "decision_pending", `rekomendasi masuk → menunggu keputusan (${r.error?.message ?? "ok"})`);
  r = await approver.c.rpc("return_for_revision", { _subject_id: sid, _rationale: "Mohon lengkapi jumlah peserta" });
  check(!r.error && (await statusOf(sid)) === "pending", `approver mengembalikan untuk revisi (${r.error?.message ?? "ok"})`);
  const { data: asgRow } = await svc.from("review_assignments").select("status").eq("id", asg1).single();
  check(asgRow?.status === "completed", "penugasan ronde pertama ditutup");
  r = await requester.c.from("review_decisions").select("decision, rationale").eq("subject_id", sid);
  check(r.data?.[0]?.decision === "return_for_revision" && r.data[0].rationale === "Mohon lengkapi jumlah peserta", "pemohon melihat permintaan revisi + catatannya");
  r = await requester.c.from("review_drafts").select("id, payload").eq("linked_subject_id", sid).eq("status", "draft");
  const reviseDraft = r.data?.[0];
  check(Boolean(reviseDraft) && reviseDraft.payload?.title?.startsWith("TDD Pelatihan MCS"), "draf revisi terbuka untuk pemohon berisi pengajuan terakhir");
  r = await approver.c.rpc("return_for_revision", { _subject_id: sid, _rationale: "lagi" });
  check(/already_awaiting_revision/.test(r.error?.message ?? ""), `tidak bisa dikembalikan dua kali (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await other.c.rpc("training_need_draft_update", { _draft_id: reviseDraft.id, _patch: patch("palsu", "1") });
  check(Boolean(r.error), `orang lain tidak bisa mengubah draf revisi (${r.error?.message ?? "TIDAK DITOLAK"})`);

  console.log("\n== kirim ulang revisi");
  r = await requester.c.rpc("training_need_draft_submit", { _draft_id: reviseDraft.id });
  check(/revision_unchanged/.test(r.error?.message ?? ""), `kirim ulang tanpa perubahan ditolak (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await requester.c.rpc("training_need_draft_update", { _draft_id: reviseDraft.id, _patch: patch(`TDD Pelatihan MCS ${stamp}`, "21–50") });
  const r2 = await requester.c.rpc("training_need_draft_submit", { _draft_id: reviseDraft.id });
  check(!r.error && !r2.error && r2.data === sid, `revisi dikirim ke pengajuan yang sama (${r.error?.message ?? r2.error?.message ?? "ok"})`);
  r = await requester.c.from("review_subject_revisions").select("revision").eq("subject_id", sid);
  check(r.data?.length === 2, "tercatat sebagai revisi ke-2");
  r = await admin.c.rpc("assign_reviewer", { _subject_id: sid, _reviewer_id: reviewer.id, _due_at: null, _template_version_id: null });
  check(!r.error && (await statusOf(sid)) === "under_review", `reviewer yang sama bisa ditugaskan lagi (${r.error?.message ?? "ok"})`);

  console.log("\n== tarik pengajuan");
  r = await other.c.rpc("training_need_withdraw", { _subject_id: sid, _reason: "x" });
  check(/subject_not_found/.test(r.error?.message ?? ""), `orang lain tidak bisa menarik (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await admin.c.rpc("training_need_withdraw", { _subject_id: sid, _reason: "x" });
  check(/subject_not_found/.test(r.error?.message ?? ""), `admin pun tidak bisa menarik milik pemohon (${r.error?.message ?? "TIDAK DITOLAK"})`);
  r = await requester.c.rpc("training_need_withdraw", { _subject_id: sid, _reason: "Sudah ada pelatihan serupa" });
  check(!r.error && (await statusOf(sid)) === "withdrawn", `pemohon menarik pengajuannya (${r.error?.message ?? "ok"})`);
  const { data: active } = await svc.from("review_assignments").select("id").eq("subject_id", sid).eq("status", "active");
  check(active?.length === 0, "penugasan aktif dibatalkan");
  check((await historyOf(requester.c, sid)).at(-1)?.to_status === "withdrawn", "riwayat 'ditarik' tercatat");
  r = await approver.c.rpc("return_for_revision", { _subject_id: sid, _rationale: "x" });
  check(/subject_not_open/.test(r.error?.message ?? ""), `pengajuan yang ditarik tidak bisa dikembalikan (${r.error?.message ?? "TIDAK DITOLAK"})`);

  console.log("\n== jalur disetujui");
  const sid2 = await submitRequest(requester, `TDD Pelatihan Budidaya ${stamp}`);
  r = await admin.c.rpc("assign_reviewer", { _subject_id: sid2, _reviewer_id: reviewer.id, _due_at: null, _template_version_id: null });
  const asg2 = r.data;
  r = await recommend(reviewer, sid2, asg2, "approve");
  r = await approver.c.rpc("finalize_decision", { _subject_id: sid2, _decision: "approve", _rationale: "Sesuai kebutuhan" });
  check(!r.error && (await statusOf(sid2)) === "approved", `approver menyetujui (${r.error?.message ?? "ok"})`);
  h = await historyOf(requester.c, sid2);
  check(h.map((x) => x.to_status).join(">") === "pending>under_review>decision_pending>approved", `riwayat lengkap: ${h.map((x) => x.to_status).join(" > ")}`);
  r = await requester.c.rpc("training_need_withdraw", { _subject_id: sid2, _reason: null });
  check(/not_withdrawable/.test(r.error?.message ?? ""), `yang sudah disetujui tidak bisa ditarik (${r.error?.message ?? "TIDAK DITOLAK"})`);
} catch (e) {
  failed++;
  console.log("  FAIL", e.message);
} finally {
  for (const p of slaBefore ?? []) {
    await svc.from("workflow_sla_policies").update({ target_hours: p.target_hours, responsible_label: p.responsible_label,
      is_active: p.is_active, updated_by: p.updated_by, updated_at: p.updated_at }).eq("subject_kind", p.subject_kind).eq("status", p.status);
  }
  const { data: subs } = await svc.from("review_subjects").select("id").in("submitted_by", created);
  const ids = (subs ?? []).map((s) => s.id);
  if (ids.length) {
    await svc.from("review_records").delete().in("subject_id", ids);
    await svc.from("review_assignments").delete().in("subject_id", ids);
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
