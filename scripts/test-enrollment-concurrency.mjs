/**
 * Live concurrency test of enrolment applications (PB-ACA-03, KESIAPAN_RILIS bagian E:
 * "uji serentak pendaftaran belum ada"). Requests are sent at the same moment from
 * separate sessions (two devices of one participant, or two administrators), each its
 * own HTTP request and database transaction, and the end state is checked:
 * one application row, one audit entry per real change, one enrolment, no mixed result.
 *
 * It WRITES test data (accounts @example.test, course "tdd-conc-<stamp>", an offering,
 * applications, enrolments, audit rows) and removes everything at the end.
 * Run: npm run test:enrollment-concurrency
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
const PASSWORD = "TddConc!2026#";
const COURSE = `tdd-conc-${stamp}`, OFF = `of-tdd-conc-${stamp}`;
const created = [];
let courseId = null;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function session(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(error.message);
  return c;
}
/** A persona with `devices` separate sessions (separate logins, like separate devices). */
async function persona(label, role, devices = 1) {
  const email = `tdd-conc-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_conc_test" });
    if (e) throw new Error(e.message);
  }
  const c = [];
  for (let i = 0; i < devices; i++) c.push(await session(email));
  return { id: u.user.id, c };
}
const apply = (client) => client.rpc("course_enrollment_apply", { _course_id: OFF, _course_title: "TDD Serentak", _notes: null });
const decide = (admin, user, d, n = null) => admin.c[0].rpc("admin_course_enrollment_decide", { _user_id: user.id, _course_id: OFF, _decision: d, _notes: n });
const app = async (u) => (await svc.from("course_enrollment_applications").select("id, status").eq("user_id", u.id).eq("course_id", OFF)).data ?? [];
const audits = async (u, type) => (await svc.from("admin_audit_log").select("id", { count: "exact", head: true })
  .eq("target_user_id", u.id).eq("entity_id", OFF).eq("event_type", type)).count ?? -1;
let offeringId = null;
const enrolments = async (u) => (await svc.from("enrolments").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("course_offering_id", offeringId)).count ?? -1;
const errOf = (r) => r.error?.message ?? "";

try {
  const tpl = (await svc.from("learning_templates").select("id").eq("code", "knowledge_course").single()).data.id;
  courseId = (await svc.from("master_courses").insert({ course_code: COURSE, title: "TDD Serentak", language: "en", learning_template_id: tpl, status: "active", version: 1 }).select("id").single()).data.id;
  await svc.from("master_modules").insert([{ master_course_id: courseId, module_code: "TC-01", title: "Satu", sequence: 1, learning_hours: 1 }]);
  const mode = (await svc.from("delivery_modes").select("id").eq("code", "blended_cohort").single()).data.id;
  const o = await svc.from("course_offerings").insert({ master_course_id: courseId, offering_code: OFF, offering_title: "Angkatan Serentak", year: 2026, delivery_mode_id: mode,
    access_mode: "application-required", status: "published", learning_engine_version: "shared_v1", shared_learn_path: `/academy/course/${OFF}`, learning_model: "cohort_based",
    delivery_format: "blended", enrolment_access_rule: "approval_required", classification_source: "operator", cohort_financial_model: "fee_based",
    cohort_financial_model_source: "operator", cohort_payment_responsibility: "government_or_public_funding", cohort_payment_responsibility_source: "operator",
    completion_evaluation_required: false, required_documents: [] }).select("id").single();
  if (o.error) throw new Error(o.error.message);
  offeringId = o.data.id;
  await svc.from("learning_feature_flags").insert({ course_offering_id: offeringId, engine_version: "shared_v1", enabled: true });

  const operator = await persona("operator", "operator");
  const approver = await persona("approver", "approver");
  const P = [];
  for (let i = 0; i < 6; i++) P.push(await persona(`p${i}`, "participant", 3));

  console.log("1. Satu peserta mengajukan dari tiga perangkat sekaligus (6 peserta)");
  const res1 = await Promise.all(P.map((u) => Promise.all(u.c.map((c) => apply(c)))));
  for (let i = 0; i < P.length; i++) {
    const rows = await app(P[i]);
    const changed = res1[i].filter((r) => r.data?.changed === true).length;
    const errs = res1[i].filter((r) => r.error).map(errOf);
    check(rows.length === 1 && rows[0].status === "pending" && changed === 1 && errs.length === 0 && (await audits(P[i], "course_enrollment_requested")) === 1,
      `p${i}: satu pengajuan, satu perubahan, satu catatan audit (${rows.length} baris, ${changed} berubah, ${errs.join(",") || "tanpa error"})`);
  }

  console.log("2. Dua admin memutuskan bersamaan: setujui lawan tolak (3 peserta)");
  for (const u of P.slice(0, 3)) {
    const [a, b] = await Promise.all([decide(approver, u, "approve"), decide(operator, u, "reject", "Kuota penuh")]);
    const ok = [a, b].filter((r) => !r.error).length;
    const status = (await app(u))[0]?.status;
    const decisions = (await audits(u, "course_enrollment_approved")) + (await audits(u, "course_enrollment_rejected"));
    const enr = await enrolments(u);
    const loserMsg = [a, b].find((r) => r.error) ? errOf([a, b].find((r) => r.error)) : "";
    check(ok === 1 && /decision_already_final/.test(loserMsg) && decisions === 1 && (status === "approved" ? enr === 1 : enr === 0),
      `satu keputusan menang (${status}), yang lain ditolak "sudah diputuskan", 1 audit, pendaftaran ${enr}`);
  }

  console.log("3. Dua admin menyetujui bersamaan");
  {
    const u = P[3];
    const [a, b] = await Promise.all([decide(approver, u, "approve"), decide(operator, u, "approve")]);
    const enr = await enrolments(u);
    check(!a.error && !b.error && (await app(u))[0]?.status === "approved" && (await audits(u, "course_enrollment_approved")) === 1 && enr === 1,
      `keduanya selesai tanpa error, tetap satu audit dan satu pendaftaran (${errOf(a) || errOf(b) || "ok"}, pendaftaran ${enr})`);
  }

  console.log("4. Minta perbaikan lawan setujui bersamaan");
  {
    const u = P[4];
    const [a, b] = await Promise.all([decide(operator, u, "request_revision", "Lengkapi data instansi"), decide(approver, u, "approve")]);
    const status = (await app(u))[0]?.status;
    const ok = [a, b].filter((r) => !r.error).length;
    const enr = await enrolments(u);
    check(ok === 1 && ["revision_requested", "approved"].includes(status) && (status === "approved" ? enr === 1 : enr === 0),
      `satu menang (${status}), tidak campur (pendaftaran ${enr})`);
  }

  console.log("5. Kirim ulang dari tiga perangkat sekaligus setelah diminta perbaikan");
  {
    const u = P[5];
    const r = await decide(operator, u, "request_revision", "Lengkapi data instansi");
    check(!r.error, `operator meminta perbaikan (${errOf(r) || "ok"})`);
    const before = await audits(u, "course_enrollment_requested");
    const res = await Promise.all(u.c.map((c) => apply(c)));
    const changed = res.filter((x) => x.data?.changed === true).length;
    check((await app(u))[0]?.status === "pending" && changed === 1 && (await audits(u, "course_enrollment_requested")) === before + 1,
      `satu kiriman ulang tercatat, yang lain tidak menggandakan (${changed} berubah)`);
  }

  console.log("6. Peserta mengirim ulang tepat saat admin menekan Setujui");
  {
    const u = P[5];
    const r = await decide(operator, u, "request_revision", "Sekali lagi, lengkapi data");
    check(!r.error, `operator meminta perbaikan lagi (${errOf(r) || "ok"})`);
    const [resend, approve] = await Promise.all([apply(u.c[0]), decide(approver, u, "approve")]);
    const status = (await app(u))[0]?.status;
    const enr = await enrolments(u);
    const consistent = status === "approved" ? enr === 1 && !resend.error : status === "pending" && /application_awaiting_revision/.test(errOf(approve)) && enr === 0;
    check(!resend.error && consistent, `hasilnya salah satu urutan yang sah (${status}; setujui: ${errOf(approve) || "ok"}; pendaftaran ${enr})`);
  }
} finally {
  console.log("\nMembersihkan data uji...");
  if (offeringId) {
    await svc.from("enrolments").delete().eq("course_offering_id", offeringId);
    await svc.from("learning_feature_flags").delete().eq("course_offering_id", offeringId);
    await svc.from("course_offerings").delete().eq("id", offeringId);
  }
  if (created.length) await svc.from("course_enrollment_applications").delete().in("user_id", created);
  if (courseId) await svc.from("master_courses").delete().eq("id", courseId);
  if (created.length) {
    await svc.from("admin_audit_log").delete().in("actor_id", created);
    await svc.from("admin_audit_log").delete().in("target_user_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) { const { error } = await svc.auth.admin.deleteUser(id); if (error) { left++; console.log("  gagal hapus user", id, error.message); } }
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-conc-%")).count;
  console.log(left || rest ? `Tersisa: ${left} akun, ${rest} course uji.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
