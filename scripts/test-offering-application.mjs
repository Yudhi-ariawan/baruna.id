/**
 * Live test of applications for Course Offerings that require approval
 * (PB-ACA-03, migration 20261110010000) against the database in .env:
 * apply -> Persetujuan Peserta (reject / re-apply / approve) -> enrolled -> learning,
 * plus the guards on the application (offering must ask for it, be published and
 * open for enrolment; the title comes from the database) and the admin form rules.
 *
 * It WRITES test data (accounts @example.test, course "tdd-apply-<stamp>", offerings,
 * applications, enrolments, drafts, audit rows) and removes everything at the end.
 * Run: npm run test:offering-application
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
const PASSWORD = "TddApply!2026#";
const COURSE = `tdd-apply-${stamp}`;
const code = (x) => `of-tdd-apply-${x}-${stamp}`;
const created = [];
let courseId = null;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const errOf = (r) => r.error?.message ?? "";

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-apply-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_apply_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(se.message);
  return { id: u.user.id, c };
}
const apply = (u, c, title = "Judul palsu dari browser") => u.c.rpc("course_enrollment_apply", { _course_id: c, _course_title: title, _notes: null });
const appOf = async (u, c) => (await svc.from("course_enrollment_applications").select("status, course_title, decision_notes").eq("user_id", u.id).eq("course_id", c).maybeSingle()).data;

try {
  const tpl = (await svc.from("learning_templates").select("id").eq("code", "knowledge_course").single()).data.id;
  courseId = (await svc.from("master_courses").insert({ course_code: COURSE, title: "TDD Pengajuan", language: "en", learning_template_id: tpl, status: "active", version: 1 }).select("id").single()).data.id;
  await svc.from("master_modules").insert([{ master_course_id: courseId, module_code: "AP-01", title: "Satu", sequence: 1, learning_hours: 1 },
    { master_course_id: courseId, module_code: "AP-02", title: "Dua", sequence: 2, learning_hours: 1 }]);
  const mode = (await svc.from("delivery_modes").select("id").eq("code", "blended_cohort").single()).data.id;
  const mk = async (x, rule, extra = {}) => {
    const o = await svc.from("course_offerings").insert({ master_course_id: courseId, offering_code: code(x), offering_title: `Angkatan ${x}`, year: 2026,
      delivery_mode_id: mode, access_mode: rule === "open" ? "open" : "application-required", status: "published", learning_engine_version: "shared_v1",
      shared_learn_path: `/academy/course/${code(x)}`, learning_model: "cohort_based", delivery_format: "blended", enrolment_access_rule: rule,
      classification_source: "operator", cohort_financial_model: "fee_based", cohort_financial_model_source: "operator",
      cohort_payment_responsibility: "government_or_public_funding", cohort_payment_responsibility_source: "operator",
      completion_evaluation_required: false, ...extra }).select("id").single();
    if (o.error) throw new Error(`offering ${x}: ${o.error.message}`);
    await svc.from("learning_feature_flags").insert({ course_offering_id: o.data.id, engine_version: "shared_v1", enabled: true });
  };
  await mk("a", "approval_required");
  await mk("b", "open");
  await mk("c", "approval_required", { status: "completed" });
  await mk("d", "approval_required", { enrolment_start_date: "2020-01-01", enrolment_end_date: "2020-01-31" });

  const newbie = await persona("newbie");
  const peserta = await persona("peserta", "participant");
  const operator = await persona("operator", "operator");
  const admin = await persona("admin", "admin");

  console.log("1. Pengajuan");
  check(/biodata_required/.test(errOf(await apply(newbie, code("a")))), "akun tanpa biodata diminta mengisi biodata");
  check(/approval_required/.test(errOf(await peserta.c.rpc("learning_enrol", { _offering_code: code("a") }))), "langsung daftar ditolak: wajib disetujui");
  let r = await apply(peserta, code("a"));
  check(!r.error && r.data?.status === "pending", `pengajuan tercatat menunggu ${errOf(r)}`);
  check((await appOf(peserta, code("a")))?.course_title === "TDD Pengajuan — Angkatan a", `judul diambil dari database (${(await appOf(peserta, code("a")))?.course_title})`);
  r = await apply(peserta, code("a"));
  check(r.data?.status === "pending" && r.data?.changed === false, "klik ulang tidak membuat pengajuan ganda");

  console.log("2. Kelayakan offering");
  check(/offering_no_application/.test(errOf(await apply(peserta, code("b")))), `offering terbuka tidak menerima pengajuan (${errOf(await apply(peserta, code("b"))).slice(0, 30) || "DITERIMA"})`);
  check(/offering_closed/.test(errOf(await apply(peserta, code("c")))), "offering yang sudah selesai ditolak");
  check(/enrolment_window_closed/.test(errOf(await apply(peserta, code("d")))), "masa pendaftaran lewat ditolak");

  console.log("3. Persetujuan Peserta");
  const decideApp = (u, decision, notes) => u.c.rpc("admin_course_enrollment_decide", { _user_id: peserta.id, _course_id: code("a"), _decision: decision, _notes: notes });
  check(/forbidden/.test(errOf(await peserta.c.rpc("admin_course_enrollment_decide", { _user_id: peserta.id, _course_id: code("a"), _decision: "approve", _notes: null }))), "peserta tidak bisa menyetujui dirinya");
  r = await decideApp(operator, "reject", "Lengkapi surat tugas");
  check(!r.error && (await appOf(peserta, code("a")))?.status === "rejected", `operator menolak dengan alasan ${errOf(r)}`);
  r = await apply(peserta, code("a"));
  check(r.data?.status === "pending", "peserta bisa mengajukan lagi");
  r = await decideApp(admin, "approve", null);
  check(!r.error && r.data?.offeringLinked === true, `admin menyetujui, terhubung ke offering ${errOf(r)}`);
  const offId = (await svc.from("course_offerings").select("id").eq("offering_code", code("a")).single()).data.id;
  const enr = (await svc.from("enrolments").select("id, enrolment_status").eq("user_id", peserta.id).eq("course_offering_id", offId).maybeSingle()).data;
  check(enr?.enrolment_status === "enrolled", "peserta otomatis terdaftar di offering");

  console.log("4. Belajar sampai antrean kelulusan");
  for (const m of ["AP-01", "AP-02"]) await peserta.c.rpc("learning_progress_mark", { _enrolment_id: enr?.id, _activity_id: `module:${m}`, _status: "completed", _progress: null });
  const comp = (await svc.from("course_completions").select("status").eq("enrolment_id", enr?.id ?? "00000000-0000-0000-0000-000000000000").maybeSingle()).data;
  check(comp?.status === "pending_review", `masuk Persetujuan Kelulusan (${comp?.status ?? "tidak ada"})`);

  console.log("5. Formulir offering di Program Academy");
  const opPrograms = await persona("programs", "operator");
  const draft = async (patch) => {
    const d = (await opPrograms.c.rpc("program_draft_open", { _kind: "course_offering", _target_id: null })).data;
    const row = (await svc.from("academy_program_drafts").select("updated_at").eq("id", d).single()).data;
    await opPrograms.c.rpc("program_draft_save", { _draft_id: d, _expected_updated_at: row.updated_at, _payload: { master_course_id: courseId,
      offering_code: code(`f${Math.random().toString(36).slice(2, 6)}`), offering_title: "Draf uji", year: 2026, delivery_mode_code: "blended_cohort",
      learning_model: "cohort_based", delivery_format: "blended", enrolment_access_rule: "approval_required", cohort_payment_responsibility: "participant",
      completion_evaluation_required: false, ...patch } });
    const res = await opPrograms.c.rpc("program_draft_submit", { _draft_id: d });
    return res;
  };
  r = await draft({});
  check(!r.error, `"Wajib disetujui admin" diterima ${errOf(r).slice(0, 50)}`);
  r = await draft({ enrolment_access_rule: "entitlement_required" });
  check(/program_access_rule_unsupported/.test(errOf(r)), "\"Wajib hak akses khusus\" tetap ditolak");
  r = await draft({ delivery_mode_code: "approved_self_paced", learning_model: "self_paced", delivery_format: "fully_online", cohort_payment_responsibility: null,
    self_paced_access_model: "free", enrolment_access_rule: "open" });
  check(/program_access_rule_mode_mismatch/.test(errOf(r)), `Approved Self-Paced dengan aturan terbuka ditolak (${errOf(r).slice(0, 40)})`);
  r = await draft({ delivery_mode_code: "approved_self_paced", learning_model: "self_paced", delivery_format: "fully_online", cohort_payment_responsibility: null,
    self_paced_access_model: "free" });
  check(!r.error, `Approved Self-Paced dengan "Wajib disetujui admin" diterima ${errOf(r).slice(0, 50)}`);
} finally {
  console.log("\nMembersihkan data uji...");
  const { data: offs } = await svc.from("course_offerings").select("id").ilike("offering_code", `of-tdd-apply-%${stamp}`);
  const ids = (offs ?? []).map((x) => x.id);
  if (ids.length) {
    await svc.from("certificates").delete().in("course_offering_id", ids);
    const { data: es } = await svc.from("enrolments").select("id").in("course_offering_id", ids);
    const eids = (es ?? []).map((e) => e.id);
    if (eids.length) { await svc.from("progress_records").delete().in("enrolment_id", eids); await svc.from("enrolments").delete().in("id", eids); }
    await svc.from("course_offerings").delete().in("id", ids);
  }
  if (created.length) {
    await svc.from("course_enrollment_applications").delete().in("user_id", created);
    await svc.from("academy_program_drafts").delete().in("created_by", created);
  }
  if (courseId) await svc.from("master_courses").delete().eq("id", courseId);
  if (created.length) {
    await svc.from("admin_audit_log").delete().in("actor_id", created);
    await svc.from("admin_audit_log").delete().in("target_user_id", created);
    await svc.from("learning_audit_log").delete().in("actor_id", created);
    await svc.from("governance_audit_log").delete().in("actor_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) { const { error } = await svc.auth.admin.deleteUser(id); if (error) { left++; console.log("  gagal hapus user", id, error.message); } }
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-apply-%")).count;
  console.log(left || rest ? `Tersisa: ${left} akun, ${rest} course uji.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
