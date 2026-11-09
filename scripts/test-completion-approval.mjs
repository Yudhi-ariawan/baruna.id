/**
 * Live test of the completion approval (PB-ACA-05, migration 20261109010000) against
 * the database in .env: the Completion Record forms by itself when the requirements
 * are met, the participant cannot issue the certificate, a different decider approves
 * or asks for remedial, stale screens are refused, and two devices acting at once
 * produce one record and one certificate.
 *
 * It WRITES test data (accounts @example.test, course "tdd-compl-<stamp>", offerings,
 * enrolments, certificates, audit rows) and removes everything at the end.
 * Certificate serial numbers used by the test are not reused.
 * Run: npm run test:completion-approval
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
const PASSWORD = "TddCompl!2026#";
const COURSE = `tdd-compl-${stamp}`;
const code = (x) => `of-tdd-compl-${x}-${stamp}`;
const created = [];
const offeringIds = [];
let courseId = null;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };
const errOf = (r) => r.error?.message ?? "";

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-compl-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_completion_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (se) throw new Error(se.message);
  return { id: u.user.id, c, email };
}
const compOf = async (eid) => (await svc.from("course_completions").select("*").eq("enrolment_id", eid).maybeSingle()).data;
const certCount = async (eid) => (await svc.from("certificates").select("id", { count: "exact", head: true }).eq("enrolment_id", eid)).count;
const enrol = async (u, c) => (await u.c.rpc("learning_enrol", { _offering_code: c })).data?.id;
const mark = (u, e, m) => u.c.rpc("learning_progress_mark", { _enrolment_id: e, _activity_id: `module:${m}`, _status: "completed", _progress: null });
const finish = async (u, e) => { await mark(u, e, "CL-01"); await mark(u, e, "CL-02"); };
const decide = async (u, id, d, note = null, exp) => u.c.rpc("completion_decide", { _id: id, _decision: d, _note: note,
  _expected_updated_at: exp ?? (await svc.from("course_completions").select("updated_at").eq("id", id).maybeSingle()).data?.updated_at });

try {
  const tpl = (await svc.from("learning_templates").select("id").eq("code", "knowledge_course").single()).data.id;
  courseId = (await svc.from("master_courses").insert({ course_code: COURSE, title: "TDD Kelulusan", language: "en", learning_template_id: tpl, status: "active", version: 1 }).select("id").single()).data.id;
  await svc.from("master_modules").insert([{ master_course_id: courseId, module_code: "CL-01", title: "Satu", sequence: 1, learning_hours: 1 },
    { master_course_id: courseId, module_code: "CL-02", title: "Dua", sequence: 2, learning_hours: 1 }]);
  const mode = (await svc.from("delivery_modes").select("id").eq("code", "open_self_paced").single()).data.id;
  const mk = async (x, access = "free") => {
    const o = await svc.from("course_offerings").insert({ master_course_id: courseId, offering_code: code(x), offering_title: `TDD ${x}`, year: 2026, delivery_mode_id: mode,
      access_mode: "open", status: "published", learning_engine_version: "shared_v1", shared_learn_path: `/academy/course/${code(x)}`, learning_model: "self_paced",
      delivery_format: "fully_online", enrolment_access_rule: "open", classification_source: "operator", self_paced_access_model: access,
      self_paced_access_model_source: "operator", completion_evaluation_required: false }).select("id").single();
    if (o.error) throw new Error(o.error.message);
    offeringIds.push(o.data.id);
    await svc.from("learning_feature_flags").insert({ course_offering_id: o.data.id, engine_version: "shared_v1", enabled: true });
  };
  for (const x of ["a", "b", "c", "d"]) await mk(x);
  await mk("ftl", "free_to_learn");

  const peserta = await persona("peserta", "participant");
  const peserta2 = await persona("peserta2", "participant");
  const operator = await persona("operator", "operator");
  const approver = await persona("approver", "approver");
  const admin = await persona("admin", "admin");

  console.log("1. Completion Record terbentuk otomatis");
  const e1 = await enrol(peserta, code("a"));
  await mark(peserta, e1, "CL-01");
  check(!(await compOf(e1)), "modul belum lengkap: belum ada record");
  await mark(peserta, e1, "CL-02");
  let c1 = await compOf(e1);
  check(c1?.status === "pending_review", `modul terakhir selesai: ${c1?.status ?? "tidak ada record"}`);

  console.log("2. Peserta tidak bisa menerbitkan sendiri");
  let r = await peserta.c.rpc("issue_my_certificate", { _enrolment_id: e1, _certificate_type: "completion" });
  check(/certificate_requires_approval/.test(errOf(r)), `tombol lama ditolak (${errOf(r).slice(0, 45) || "TERBIT " + r.data?.certificate_number})`);
  check((await certCount(e1)) === 0, `belum ada sertifikat (${await certCount(e1)})`);
  const sw = await peserta.c.from("course_completions").update({ status: "approved" }).eq("enrolment_id", e1).select("id");
  check(Boolean(sw.error) && (await compOf(e1))?.status === "pending_review", `status tidak bisa diubah langsung (${sw.error?.message?.slice(0, 40) ?? "?"})`);

  console.log("3. Wewenang");
  if (!c1) c1 = { id: "00000000-0000-0000-0000-000000000000" };
  check(/forbidden/.test(errOf(await decide(peserta, c1.id, "approve"))), "peserta tidak bisa memutuskan");
  check(/forbidden/.test(errOf(await decide(operator, c1.id, "approve"))), "operator tidak bisa memutuskan");
  const ovO = await operator.c.rpc("completion_overview", { _status: "pending_review" });
  check(ovO.data?.canDecide === false && (ovO.data?.items ?? []).some((i) => i.id === c1.id && i.participantName === "TDD peserta"), `operator membaca antrean (${errOf(ovO).slice(0, 40) || "ok"})`);
  check(/forbidden/.test(errOf(await peserta.c.rpc("completion_overview", { _status: "pending_review" }))), "peserta tidak bisa membuka antrean");

  console.log("4. Remedial lalu persetujuan");
  check(/completion_note_required/.test(errOf(await decide(approver, c1.id, "remedial", "x"))), "remedial wajib alasan");
  check(/completion_stale/.test(errOf(await decide(approver, c1.id, "approve", null, "2000-01-01T00:00:00Z"))), "layar lama ditolak");
  r = await decide(approver, c1.id, "remedial", "Lengkapi tugas praktik");
  check(!r.error && (await compOf(e1))?.status === "remedial", `remedial tercatat ${errOf(r)}`);
  const el = (await peserta.c.rpc("check_certificate_eligibility", { _enrolment_id: e1 })).data;
  check(el?.completion_status === "remedial" && el?.decision_note === "Lengkapi tugas praktik", "peserta melihat alasan remedial");
  r = await decide(admin, c1.id, "approve", "Sudah dilengkapi");
  check(!r.error, `disetujui kemudian ${errOf(r)}`);
  c1 = await compOf(e1);
  const enr = (await svc.from("enrolments").select("completion_status").eq("id", e1).maybeSingle()).data;
  check(c1?.status === "approved" && (await certCount(e1)) === 1 && enr?.completion_status === "completed", "lulus, tepat satu sertifikat");
  const cert = (await svc.from("certificates").select("certificate_number").eq("enrolment_id", e1).maybeSingle()).data;
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const v = await anon.rpc("verify_certificate", { _number: cert?.certificate_number ?? "x" });
  check(v.data?.found === true, "sertifikat bisa diverifikasi publik");
  r = await peserta.c.rpc("issue_my_certificate", { _enrolment_id: e1, _certificate_type: "completion" });
  check(r.data?.certificate_number === cert?.certificate_number, "peserta mendapat sertifikat yang sudah ada");
  check(/completion_already_decided/.test(errOf(await decide(approver, c1?.id, "remedial", "ubah keputusan"))), "yang sudah disetujui tidak bisa diturunkan");

  console.log("5. Dua perangkat bersamaan");
  const eB = await enrol(peserta2, code("b"));
  await Promise.all([mark(peserta2, eB, "CL-01"), mark(peserta2, eB, "CL-02"), mark(peserta2, eB, "CL-02")]);
  const { count: nB } = await svc.from("course_completions").select("id", { count: "exact", head: true }).eq("enrolment_id", eB);
  check(nB === 1, `dua modul ditandai bersamaan: tepat satu record (${nB})`);
  const cB = await compOf(eB);
  const exp = cB?.updated_at;
  const both = await Promise.all([decide(approver, cB?.id, "approve", null, exp), decide(admin, cB?.id, "approve", null, exp)]);
  const okCount = both.filter((x) => !x.error).length;
  check(okCount === 1 && (await certCount(eB)) === 1, `dua pemutus bersamaan: satu berhasil, satu sertifikat (${okCount}, ${await certCount(eB)})`);

  console.log("6. Pemisahan wewenang dan persetujuan massal");
  const eC = await enrol(approver, code("c")); await finish(approver, eC);
  const cC = await compOf(eC);
  check(/completion_self_decision_forbidden/.test(errOf(await decide(approver, cC?.id, "approve"))), "approver tidak bisa memutuskan kelulusannya sendiri");
  const eD = await enrol(peserta2, code("d")); await finish(peserta2, eD);
  const cD = await compOf(eD);
  const many = await approver.c.rpc("completion_decide_many", { _ids: [cC?.id, cD?.id, c1?.id].filter(Boolean), _note: null });
  check(many.data?.approved === 1 && many.data?.skipped?.length === 2, `massal: 1 disetujui, 2 dilewati (${errOf(many).slice(0, 40) || many.data?.approved})`);
  check((await certCount(eD)) === 1 && (await certCount(eC)) === 0, "sertifikat hanya untuk yang disetujui");

  console.log("7. Pembayaran tidak menentukan kelulusan");
  const eF = await enrol(peserta2, code("ftl")); await finish(peserta2, eF);
  const cF = await compOf(eF);
  check(cF?.status === "pending_review", `course berbayar tetap masuk review (${cF?.status ?? "tidak ada"})`);
  r = await decide(approver, cF?.id, "approve");
  const fDone = await compOf(eF);
  const fEnr = (await svc.from("enrolments").select("completion_status").eq("id", eF).maybeSingle()).data;
  check(!r.error && fDone?.status === "approved" && fDone?.certificate_held_reason === "certificate_payment_required", `lulus, sertifikat ditahan ${errOf(r)}`);
  check(fEnr?.completion_status === "completed" && (await certCount(eF)) === 0, "pendaftaran selesai, tanpa sertifikat");
} finally {
  console.log("\nMembersihkan data uji...");
  const { data: offs } = await svc.from("course_offerings").select("id").ilike("offering_code", `of-tdd-compl-%${stamp}`);
  const ids = [...new Set([...offeringIds, ...(offs ?? []).map((x) => x.id)])];
  if (ids.length) {
    await svc.from("certificates").delete().in("course_offering_id", ids);
    const { data: es } = await svc.from("enrolments").select("id").in("course_offering_id", ids);
    const eids = (es ?? []).map((e) => e.id);
    if (eids.length) { await svc.from("progress_records").delete().in("enrolment_id", eids); await svc.from("enrolments").delete().in("id", eids); }
    await svc.from("course_offerings").delete().in("id", ids);
  }
  if (courseId) await svc.from("master_courses").delete().eq("id", courseId);
  if (created.length) {
    await svc.from("learning_audit_log").delete().in("actor_id", created);
    await svc.from("governance_audit_log").delete().in("actor_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) { const { error } = await svc.auth.admin.deleteUser(id); if (error) { left++; console.log("  gagal hapus user", id, error.message); } }
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-compl-%")).count;
  console.log(left || rest ? `Tersisa: ${left} akun, ${rest} course uji.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
