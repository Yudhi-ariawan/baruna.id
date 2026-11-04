/**
 * Live test of Program Academy (migration 20261104010000) against the database in
 * .env: Master Course + Master Module + Course Offering drafts, approval by a
 * different approver, versioning, locks once participants exist, legacy programs
 * read-only, and status changes.
 *
 * It WRITES test data (accounts @example.test, one course "tdd-<stamp>", its
 * offering, drafts, audit rows) and removes everything at the end.
 * Run: npm run test:academy-programs
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
const PASSWORD = "TddPrograms!2026#";
const created = [];
const COURSE_CODE = `tdd-${stamp}`;
const OFFERING_CODE = `of-tdd-${stamp}`;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const errOf = (r) => r.error?.message ?? "";

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));

async function persona(label, role) {
  const email = `tdd-programs-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_programs_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(se.message);
  return { id: u.user.id, c };
}
const draftRow = async (id) => (await svc.from("academy_program_drafts").select("*").eq("id", id).maybeSingle()).data;
const save = async (u, id, payload) => u.c.rpc("program_draft_save", { _draft_id: id, _payload: payload, _expected_updated_at: (await draftRow(id))?.updated_at });
const decide = async (u, id, decision, note = null) => u.c.rpc("program_draft_decide", { _draft_id: id, _decision: decision, _note: note, _expected_updated_at: (await draftRow(id))?.updated_at });

try {
  const operator = await persona("operator", "operator");
  const approver = await persona("approver", "approver");
  const admin = await persona("admin", "admin");
  const plain = await persona("plain");

  console.log("1. Hak akses & tulis langsung");
  check(/forbidden/.test(errOf(await plain.c.rpc("program_overview"))), `pengguna biasa ditolak (${errOf(await plain.c.rpc("program_overview")).slice(0, 60) || "TIDAK DITOLAK"})`);
  const ocean = (await svc.from("master_courses").select("id, title").eq("course_code", "ocean-literacy-foundations").maybeSingle()).data;
  const w = await approver.c.from("master_courses").update({ title: ocean?.title ?? "x" }).eq("id", ocean?.id ?? "00000000-0000-0000-0000-000000000000").select("id");
  check(Boolean(w.error) || (w.data?.length ?? 0) === 0, `approver tidak bisa menulis master_courses langsung (${w.error?.message?.slice(0, 50) ?? `${w.data?.length} baris`})`);
  const ov = await operator.c.rpc("program_overview");
  check(!ov.error && ov.data?.courses?.length >= 3 && ov.data.canDecide === false, `operator membuka ringkasan, tanpa hak keputusan (${ov.error?.message ?? "ok"})`);
  const aza = ov.data?.offerings?.find((o) => o.code === "of-aza-open-2026");
  check(aza?.legacy === true && /program_legacy_readonly/.test(errOf(await operator.c.rpc("program_draft_open", { _kind: "course_offering", _target_id: aza?.id }))),
    "offering lama (AZA, isi di kode) hanya baca");

  console.log("2. Master Course baru");
  const { data: c1, error: e1 } = await operator.c.rpc("program_draft_open", { _kind: "master_course", _target_id: null });
  check(!e1 && c1, `operator membuka draf course (${e1?.message ?? "ok"})`);
  const course = { course_code: COURSE_CODE, title: `TDD Course ${stamp}`, description: "Uji otomatis", language: "id", learning_template_code: "knowledge_course",
    modules: [{ module_code: "TDD-01", title: "Modul satu", learning_hours: 1.5 }, { module_code: "TDD-02", title: "Modul dua", learning_hours: 2 }] };
  await save(operator, c1, { ...course, modules: [] });
  check(/program_modules_required/.test(errOf(await operator.c.rpc("program_draft_submit", { _draft_id: c1 }))), "tanpa modul ditolak saat dikirim");
  await save(operator, c1, course);
  check(!errOf(await operator.c.rpc("program_draft_submit", { _draft_id: c1 })), "draf lengkap dikirim");
  check(/forbidden/.test(errOf(await decide(operator, c1, "approve"))), "operator tidak bisa memutuskan");
  let r = await decide(approver, c1, "approve");
  check(!r.error, `approver menyetujui (${r.error?.message ?? "ok"})`);
  const live = (await svc.from("master_courses").select("id, status, version").eq("course_code", COURSE_CODE).maybeSingle()).data;
  const mods = (await svc.from("master_modules").select("module_code, sequence").eq("master_course_id", live?.id ?? "00000000-0000-0000-0000-000000000000").order("sequence")).data ?? [];
  check(live?.status === "active" && live.version === 1 && mods.map((m) => m.module_code).join() === "TDD-01,TDD-02", "course aktif v1 dengan 2 modul berurutan");

  console.log("3. Pemisahan wewenang");
  const { data: c2 } = await approver.c.rpc("program_draft_open", { _kind: "master_course", _target_id: live?.id });
  await save(approver, c2, { ...course, title: `TDD Course ${stamp} v2` });
  await approver.c.rpc("program_draft_submit", { _draft_id: c2 });
  check(/program_self_decision_forbidden/.test(errOf(await decide(approver, c2, "approve"))), "approver tidak bisa menyetujui drafnya sendiri");
  check(!errOf(await decide(admin, c2, "approve")), "admin lain menyetujui");
  check((await svc.from("master_courses").select("version, title").eq("id", live?.id).maybeSingle()).data?.version === 2, "versi naik ke 2");

  console.log("4. Course Offering baru");
  const { data: o1 } = await operator.c.rpc("program_draft_open", { _kind: "course_offering", _target_id: null });
  const offering = { master_course_id: live?.id, offering_code: OFFERING_CODE, offering_title: `TDD Offering ${stamp}`, year: 2026,
    delivery_mode_code: "blended_cohort", learning_model: "cohort_based", delivery_format: "blended", enrolment_access_rule: "approval_required",
    cohort_payment_responsibility: "government_or_public_funding", completion_evaluation_required: true, completion_evaluation_context: "training",
    opening_date: "2026-12-01", closing_date: "2026-12-20", enrolment_start_date: "2026-11-10", enrolment_end_date: "2026-11-30" };
  await save(operator, o1, { ...offering, delivery_mode_code: "open_self_paced" });
  check(/program_delivery_mode_mismatch/.test(errOf(await operator.c.rpc("program_draft_submit", { _draft_id: o1 }))), "delivery mode tidak cocok ditolak");
  await save(operator, o1, offering);
  check(!errOf(await operator.c.rpc("program_draft_submit", { _draft_id: o1 })), "offering dikirim");
  r = await decide(approver, o1, "approve");
  check(!r.error, `approver menyetujui offering (${r.error?.message ?? "ok"})`);
  const of = (await svc.from("course_offerings").select("id, status, learning_engine_version, shared_learn_path, cohort_financial_model").eq("offering_code", OFFERING_CODE).maybeSingle()).data;
  const flag = (await svc.from("learning_feature_flags").select("engine_version, enabled").eq("course_offering_id", of?.id ?? "00000000-0000-0000-0000-000000000000").maybeSingle()).data;
  check(of?.status === "published" && of.learning_engine_version === "shared_v1" && flag?.engine_version === "shared_v1" && of.cohort_financial_model === "fee_based",
    "offering tayang di mesin belajar bersama, lolos semua batasan database");

  console.log("5. Setelah ada pendaftar");
  await svc.from("course_enrollment_applications").insert({ user_id: plain.id, course_id: of?.id, course_title: `TDD Offering ${stamp}`, status: "pending" }).then((x) => x.error && console.log("   (insert aplikasi:", x.error.message, ")"));
  const inUse = (await operator.c.rpc("program_overview")).data?.offerings?.find((o) => o.id === of?.id)?.inUse;
  const { data: c3 } = await operator.c.rpc("program_draft_open", { _kind: "master_course", _target_id: live?.id });
  const p3 = (await draftRow(c3))?.payload;
  await save(operator, c3, { ...p3, modules: [...(p3?.modules ?? []), { module_code: "TDD-03", title: "Tambahan", learning_hours: 1 }] });
  check(inUse === true && /program_modules_locked_in_use/.test(errOf(await operator.c.rpc("program_draft_submit", { _draft_id: c3 }))),
    "modul tidak bisa ditambah setelah ada pendaftar");
  await operator.c.rpc("program_draft_withdraw", { _draft_id: c3 });

  console.log("6. Status");
  check(/program_course_has_published_offerings/.test(errOf(await approver.c.rpc("program_set_status", { _kind: "master_course", _id: live?.id, _status: "archived", _note: "Uji arsip" }))),
    "course dengan offering tayang tidak bisa diarsipkan");
  check(!errOf(await approver.c.rpc("program_set_status", { _kind: "course_offering", _id: of?.id, _status: "closed", _note: "Uji tutup offering" })), "approver menutup offering");
  const audit = (await svc.from("governance_audit_log").select("event_type").in("actor_id", created)).data?.map((x) => x.event_type) ?? [];
  check(["program_draft_opened", "program_draft_submitted", "program_draft_approved", "program_status_changed"].every((e) => audit.includes(e)), "audit trail tercatat");
} catch (e) {
  console.error("Kesalahan:", e);
  failures.push(String(e?.message ?? e));
} finally {
  console.log("\nMembersihkan data uji...");
  const { data: offs } = await svc.from("course_offerings").select("id").eq("offering_code", OFFERING_CODE);
  const offIds = (offs ?? []).map((x) => x.id);
  if (offIds.length) {
    await svc.from("course_enrollment_applications").delete().in("course_id", offIds);
    await svc.from("course_offerings").delete().in("id", offIds);
  }
  await svc.from("academy_program_drafts").delete().in("created_by", created);
  const { data: cs } = await svc.from("master_courses").select("id").eq("course_code", COURSE_CODE);
  if (cs?.length) await svc.from("master_courses").delete().in("id", cs.map((x) => x.id));
  await svc.from("governance_audit_log").delete().in("actor_id", created);
  await svc.from("rbac_user_roles").delete().in("user_id", created);
  let left = 0;
  for (const id of created) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) { left++; console.log("  gagal hapus user", id, error.message); }
  }
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-%")).count;
  console.log(left || rest ? `Tersisa: ${left} akun, ${rest} course uji.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ")}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
