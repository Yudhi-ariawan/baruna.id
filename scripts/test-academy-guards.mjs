/**
 * Live test of the Program Academy guards added by migration 20261104030000, against
 * the database in .env:
 *  1. The older offering setter RPCs (set_offering_classification,
 *     set_self_paced_access_model, set_cohort_financial_model,
 *     set_cohort_payment_responsibility) must not let one approver/admin change a
 *     live offering outside the draft + second-approver flow.
 *  2. Offerings managed from the admin screen may only use the access rules the
 *     shared learning page can serve (open / registered): participants have no way
 *     yet to apply for approval_required / entitlement_required ones.
 *
 * It WRITES test data (accounts @example.test, course "tdd-guard-<stamp>", its
 * offering, drafts, audit rows) and removes everything at the end.
 * Run: npm run test:academy-guards
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
const PASSWORD = "TddGuards!2026#";
const COURSE_CODE = `tdd-guard-${stamp}`;
const OFFERING_CODE = `of-tdd-guard-${stamp}`;
const created = [];
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const errOf = (r) => r.error?.message ?? "";

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-guard-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_guards_test" });
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
const offering = (courseId, o = {}) => ({ master_course_id: courseId, offering_code: OFFERING_CODE, offering_title: "TDD Guard Angkatan 1",
  cohort_name: null, batch_number: null, year: 2026, delivery_mode_code: "blended_cohort", learning_model: "cohort_based",
  delivery_format: "blended", enrolment_access_rule: "open", self_paced_access_model: null,
  cohort_payment_responsibility: "participant", completion_evaluation_required: false, completion_evaluation_context: null,
  opening_date: null, closing_date: null, enrolment_start_date: null, enrolment_end_date: null, ...o });

try {
  const operator = await persona("operator", "operator");
  const approver = await persona("approver", "approver");
  const admin = await persona("admin", "admin");

  console.log("0. Siapkan course dan offering tayang lewat alur resmi");
  const dc = (await operator.c.rpc("program_draft_open", { _kind: "master_course", _target_id: null })).data;
  await save(operator, dc, { course_code: COURSE_CODE, title: "TDD Guard Course", description: "uji", language: "en",
    learning_template_code: "knowledge_course", modules: [{ module_code: "G-01", title: "Satu", learning_hours: 1 }] });
  await operator.c.rpc("program_draft_submit", { _draft_id: dc });
  check(!(await decide(approver, dc, "approve")).error, "course disetujui");
  const courseId = (await svc.from("master_courses").select("id").eq("course_code", COURSE_CODE).maybeSingle()).data?.id;

  console.log("1. Aturan pendaftaran yang belum bisa dilayani halaman course");
  // Since 20261110010000 "approval_required" works through the participant application;
  // only "entitlement_required" stays refused.
  for (const rule of ["entitlement_required"]) {
    const d = (await operator.c.rpc("program_draft_open", { _kind: "course_offering", _target_id: null })).data;
    await save(operator, d, offering(courseId, { enrolment_access_rule: rule }));
    const r = await operator.c.rpc("program_draft_submit", { _draft_id: d });
    check(/program_access_rule_unsupported/.test(errOf(r)), `offering baru dengan aturan ${rule} ditolak (${errOf(r).slice(0, 60) || "DITERIMA"})`);
    if (!r.error) await operator.c.rpc("program_draft_withdraw", { _draft_id: d });
    else await operator.c.rpc("program_draft_withdraw", { _draft_id: d });
  }
  const dof = (await operator.c.rpc("program_draft_open", { _kind: "course_offering", _target_id: null })).data;
  await save(operator, dof, offering(courseId));
  let r = await operator.c.rpc("program_draft_submit", { _draft_id: dof });
  check(!r.error, `offering terbuka tetap bisa dikirim ${errOf(r)}`);
  check(!(await decide(approver, dof, "approve")).error, "offering terbuka disetujui");
  const off = (await svc.from("course_offerings").select("id, admin_version, enrolment_access_rule, cohort_payment_responsibility").eq("offering_code", OFFERING_CODE).maybeSingle()).data;
  check(off?.admin_version === 1 && off.enrolment_access_rule === "open", "offering tayang v1, aturan terbuka");

  console.log("2. Jalur lama tidak bisa mengubah offering tanpa persetujuan");
  r = await approver.c.rpc("set_offering_classification", { _offering_id: off.id, _learning_model: "cohort_based",
    _delivery_format: "in_person", _enrolment_access_rule: "approval_required", _expected_version: null, _reason: "uji jalur lama" });
  check(Boolean(r.error), `approver tidak bisa mengubah klasifikasi lewat RPC lama (${errOf(r).slice(0, 50) || "BERHASIL MENGUBAH"})`);
  r = await admin.c.rpc("set_cohort_payment_responsibility", { _offering_id: off.id, _responsibility: "sponsor_or_partner",
    _expected_version: null, _reason: "uji jalur lama", _source: "operator" });
  check(Boolean(r.error), `admin tidak bisa mengubah penanggung biaya lewat RPC lama (${errOf(r).slice(0, 50) || "BERHASIL MENGUBAH"})`);
  r = await admin.c.rpc("set_cohort_financial_model", { _offering_id: off.id, _financial_model: "fee_based",
    _expected_version: null, _reason: "uji jalur lama", _source: "operator" });
  check(Boolean(r.error), `admin tidak bisa memanggil set_cohort_financial_model (${errOf(r).slice(0, 50) || "BERHASIL"})`);
  r = await admin.c.rpc("set_self_paced_access_model", { _offering_id: off.id, _access_model: "free", _expected_version: null, _reason: "uji" });
  check(/permission denied|Could not find/.test(errOf(r)), `admin tidak bisa memanggil set_self_paced_access_model (${errOf(r).slice(0, 50) || "BERHASIL"})`);
  const after = (await svc.from("course_offerings").select("delivery_format, enrolment_access_rule, cohort_payment_responsibility, admin_version").eq("id", off.id).maybeSingle()).data;
  check(after?.delivery_format === "blended" && after.enrolment_access_rule === "open" && after.cohort_payment_responsibility === "participant",
    `offering tayang tidak berubah (${JSON.stringify(after)})`);

  console.log("3. Perubahan resmi tetap jalan");
  const de = (await operator.c.rpc("program_draft_open", { _kind: "course_offering", _target_id: off.id })).data;
  await save(operator, de, offering(courseId, { enrolment_access_rule: "registered", cohort_payment_responsibility: "institution" }));
  r = await operator.c.rpc("program_draft_submit", { _draft_id: de });
  check(!r.error, `perubahan lewat draf dikirim ${errOf(r)}`);
  check(!(await decide(approver, de, "approve")).error, "perubahan disetujui orang lain");
  const v2 = (await svc.from("course_offerings").select("enrolment_access_rule, cohort_payment_responsibility, admin_version").eq("id", off.id).maybeSingle()).data;
  check(v2?.admin_version === 2 && v2.enrolment_access_rule === "registered" && v2.cohort_payment_responsibility === "institution", "offering v2 sesuai draf");
} finally {
  console.log("\nMembersihkan data uji...");
  const { data: offs } = await svc.from("course_offerings").select("id").eq("offering_code", OFFERING_CODE);
  const offIds = (offs ?? []).map((x) => x.id);
  if (offIds.length) {
    await svc.from("enrolments").delete().in("course_offering_id", offIds);
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
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-guard-%")).count;
  console.log(left || rest ? `Tersisa: ${left} akun, ${rest} course uji.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ")}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
