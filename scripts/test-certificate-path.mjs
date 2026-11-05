/**
 * Live test of the certificate path (migrations 20261105010000 + 20261105020000)
 * against the database in .env, exactly as a participant would use it:
 * enrol, complete modules, (send the completion evaluation), issue the certificate.
 * Also: the old empty-evaluation shortcut is closed, and an offering that requires
 * a completion evaluation must name an active template of the same context.
 *
 * It WRITES test data (accounts @example.test, course "tdd-certpath-<stamp>", its
 * offerings, enrolments, evaluations, certificates, drafts, audit rows) and removes
 * everything at the end. Certificate serial numbers used by the test are not reused.
 * Run: npm run test:certificate-path
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
const PASSWORD = "TddCertPath!2026#";
const COURSE = `tdd-certpath-${stamp}`;
const OFF_PLAIN = `of-tdd-certpath-plain-${stamp}`, OFF_EVAL = `of-tdd-certpath-eval-${stamp}`, OFF_DRAFT = `of-tdd-certpath-draft-${stamp}`;
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
  const email = `tdd-certpath-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (role) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_certpath_test" });
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
const elig = async (u, eid) => (await u.c.rpc("check_certificate_eligibility", { _enrolment_id: eid })).data ?? {};

/** Answers for every required question of a template, in the format save_completion_evaluation_draft expects. */
async function answersFor(templateId) {
  const { data: qs } = await svc.from("completion_evaluation_questions").select("id, question_type, is_required, choices, rating_min, rating_max")
    .eq("template_id", templateId).eq("active", true);
  const out = {};
  for (const q of qs ?? []) {
    if (!q.is_required) continue;
    const first = Array.isArray(q.choices) && q.choices.length ? (typeof q.choices[0] === "object" ? q.choices[0].value ?? q.choices[0].label : q.choices[0]) : "ok";
    out[q.id] = q.question_type === "rating_scale" ? (q.rating_max ?? 5)
      : q.question_type === "yes_no" ? true
      : q.question_type === "multiple_choice" ? [first]
      : q.question_type === "single_choice" ? first
      : "Uji otomatis";
  }
  return out;
}

try {
  const tplCourse = (await svc.from("completion_evaluation_templates").select("id").eq("status", "active").eq("context", "course").limit(1).maybeSingle()).data?.id;
  const tplTraining = (await svc.from("completion_evaluation_templates").select("id").eq("status", "active").eq("context", "training").limit(1).maybeSingle()).data?.id;
  if (!tplCourse || !tplTraining) throw new Error("template evaluasi aktif (course/training) tidak ditemukan");

  // Course + two live offerings (setup by service role, like an approved program).
  const tpl = (await svc.from("learning_templates").select("id").eq("code", "knowledge_course").single()).data.id;
  courseId = (await svc.from("master_courses").insert({ course_code: COURSE, title: "TDD Cert Path", language: "en", learning_template_id: tpl, status: "active", version: 1 }).select("id").single()).data.id;
  await svc.from("master_modules").insert([{ master_course_id: courseId, module_code: "CP-01", title: "Satu", sequence: 1, learning_hours: 1 },
    { master_course_id: courseId, module_code: "CP-02", title: "Dua", sequence: 2, learning_hours: 1 }]);
  const mode = (await svc.from("delivery_modes").select("id").eq("code", "blended_cohort").single()).data.id;
  const base = { master_course_id: courseId, year: 2026, delivery_mode_id: mode, access_mode: "open", status: "published", learning_engine_version: "shared_v1",
    learning_model: "cohort_based", delivery_format: "blended", enrolment_access_rule: "open", classification_source: "operator",
    cohort_financial_model: "fee_based", cohort_financial_model_source: "operator", cohort_payment_responsibility: "participant", cohort_payment_responsibility_source: "operator" };
  for (const [code, extra] of [[OFF_PLAIN, { completion_evaluation_required: false }],
    [OFF_EVAL, { completion_evaluation_required: true, completion_evaluation_context: "course", completion_evaluation_template_id: tplCourse, completion_evaluation_source: "operator" }]]) {
    const o = await svc.from("course_offerings").insert({ ...base, ...extra, offering_code: code, offering_title: code, shared_learn_path: `/academy/course/${code}` }).select("id").single();
    if (o.error) throw new Error(`offering: ${o.error.message}`);
    offeringIds.push(o.data.id);
    await svc.from("learning_feature_flags").insert({ course_offering_id: o.data.id, engine_version: "shared_v1", enabled: true });
  }

  const p = await persona("peserta");
  const finish = async (eid) => { for (const m of ["CP-01", "CP-02"]) await p.c.rpc("learning_progress_mark", { _enrolment_id: eid, _activity_id: `module:${m}`, _status: "completed", _progress: null }); };

  console.log("1. Offering tanpa evaluasi akhir");
  const e1 = (await p.c.rpc("learning_enrol", { _offering_code: OFF_PLAIN })).data?.id;
  check(Boolean(e1), "peserta mendaftar");
  await finish(e1);
  let r = await elig(p, e1);
  check(r.eligible === true, `semua modul selesai: memenuhi syarat (${r.reason ?? "eligible"})`);
  let iss = await p.c.rpc("issue_my_certificate", { _enrolment_id: e1, _certificate_type: "completion" });
  check(Boolean(iss.data?.certificate_number), `sertifikat terbit lewat tombol (${errOf(iss) || iss.data?.certificate_number})`);

  console.log("2. Jalur evaluasi lama ditutup");
  const ev = await p.c.rpc("learning_evaluation_submit", { _enrolment_id: e1, _evaluation_type: "course", _response: {} });
  check(/permission denied/.test(errOf(ev)), `evaluasi kosong {} tidak bisa dikirim langsung (${errOf(ev).slice(0, 50) || "DITERIMA"})`);

  console.log("3. Offering wajib evaluasi akhir");
  const e2 = (await p.c.rpc("learning_enrol", { _offering_code: OFF_EVAL })).data?.id;
  await finish(e2);
  r = await elig(p, e2);
  check(r.reason === "completion_evaluation_missing", `modul selesai, evaluasi belum dikirim: ${r.reason}`);
  iss = await p.c.rpc("issue_my_certificate", { _enrolment_id: e2, _certificate_type: "completion" });
  check(/not_eligible:completion_evaluation_missing/.test(errOf(iss)), `tombol sertifikat ditolak (${errOf(iss).slice(0, 60) || "TERBIT"})`);
  const st = await p.c.rpc("start_completion_evaluation", { _enrolment_id: e2 });
  const subId = st.data?.submission_id;
  check(Boolean(subId), `evaluasi akhir dimulai di tab Evaluation (${errOf(st) || "ok"})`);
  const sw = await p.c.from("completion_evaluation_submissions").update({ status: "submitted" }).eq("id", subId).select("id");
  const after = (await svc.from("completion_evaluation_submissions").select("status").eq("id", subId).maybeSingle()).data;
  check(Boolean(sw.error) || after?.status === "draft", `status evaluasi tidak bisa diubah langsung (${sw.error?.message?.slice(0, 40) ?? "tidak berubah"})`);
  const sv = await p.c.rpc("save_completion_evaluation_draft", { _submission_id: subId, _expected_version: st.data?.draft_version ?? 0, _answers: await answersFor(tplCourse) });
  check(!sv.error, `jawaban disimpan ${errOf(sv)}`);
  const sb = await p.c.rpc("submit_completion_evaluation", { _submission_id: subId, _expected_version: sv.data?.draft_version ?? null });
  check(!sb.error, `evaluasi dikirim ${errOf(sb)}`);
  r = await elig(p, e2);
  check(r.eligible === true && r.completion_evaluation_submitted === true, `setelah evaluasi dikirim: memenuhi syarat (${r.reason ?? "eligible"})`);
  iss = await p.c.rpc("issue_my_certificate", { _enrolment_id: e2, _certificate_type: "completion" });
  check(Boolean(iss.data?.certificate_number), `sertifikat terbit (${errOf(iss) || iss.data?.certificate_number})`);

  console.log("5. Jenis sertifikat (20261105030000)");
  iss = await p.c.rpc("issue_my_certificate", { _enrolment_id: e1, _certificate_type: "competency" });
  check(/certificate_type_not_available/.test(errOf(iss)), `peserta tidak bisa memilih sertifikat kompetensi sendiri (${errOf(iss).slice(0, 50) || "TERBIT " + iss.data?.certificate_number})`);
  const { count: certCount } = await svc.from("certificates").select("id", { count: "exact", head: true }).eq("enrolment_id", e1);
  check(certCount === 1, `satu pendaftaran hanya punya satu sertifikat (${certCount})`);

  console.log("6. Offering mandiri dengan sertifikat berbayar (20261105030000)");
  const spMode = (await svc.from("delivery_modes").select("id").eq("code", "open_self_paced").single()).data.id;
  for (const model of ["free_to_learn", "paid"]) {
    const code = `of-tdd-certpath-${model}-${stamp}`;
    const o = await svc.from("course_offerings").insert({ master_course_id: courseId, offering_code: code, offering_title: code, year: 2026, delivery_mode_id: spMode,
      access_mode: "open", status: "published", learning_engine_version: "shared_v1", shared_learn_path: `/academy/course/${code}`, learning_model: "self_paced",
      delivery_format: "fully_online", enrolment_access_rule: "open", classification_source: "operator", self_paced_access_model: model,
      self_paced_access_model_source: "operator", completion_evaluation_required: false }).select("id").single();
    if (o.error) throw new Error(`offering ${model}: ${o.error.message}`);
    offeringIds.push(o.data.id);
    await svc.from("learning_feature_flags").insert({ course_offering_id: o.data.id, engine_version: "shared_v1", enabled: true });
    const e = (await p.c.rpc("learning_enrol", { _offering_code: code })).data?.id;
    await finish(e);
    r = await elig(p, e);
    check(r.reason === "certificate_payment_required", `${model}: sertifikat tidak terbit gratis selama pembayaran belum ada (${r.reason ?? "eligible"})`);
    iss = await p.c.rpc("issue_my_certificate", { _enrolment_id: e, _certificate_type: "completion" });
    check(Boolean(iss.error), `${model}: tombol sertifikat ditolak (${errOf(iss).slice(0, 50) || "TERBIT"})`);
  }

  console.log("4. Template evaluasi di draf offering");
  const operator = await persona("operator", "operator");
  const approver = await persona("approver", "approver");
  const d = (await operator.c.rpc("program_draft_open", { _kind: "course_offering", _target_id: null })).data;
  const off = (o = {}) => ({ master_course_id: courseId, offering_code: OFF_DRAFT, offering_title: "TDD Draft", year: 2026, delivery_mode_code: "blended_cohort",
    learning_model: "cohort_based", delivery_format: "blended", enrolment_access_rule: "open", cohort_payment_responsibility: "participant",
    completion_evaluation_required: true, completion_evaluation_context: "training", ...o });
  await save(operator, d, off());
  r = await operator.c.rpc("program_draft_submit", { _draft_id: d });
  check(/program_evaluation_template_required/.test(errOf(r)), `wajib evaluasi tanpa template ditolak (${errOf(r).slice(0, 50) || "DITERIMA"})`);
  if (!r.error) { await operator.c.rpc("program_draft_withdraw", { _draft_id: d }); }
  const d2 = r.error ? d : (await operator.c.rpc("program_draft_open", { _kind: "course_offering", _target_id: null })).data;
  await save(operator, d2, off({ completion_evaluation_template_id: tplCourse }));
  r = await operator.c.rpc("program_draft_submit", { _draft_id: d2 });
  check(/program_evaluation_template_invalid/.test(errOf(r)), `template konteks lain ditolak (${errOf(r).slice(0, 50) || "DITERIMA"})`);
  const d3 = r.error ? d2 : (await (async () => { await operator.c.rpc("program_draft_withdraw", { _draft_id: d2 }); return (await operator.c.rpc("program_draft_open", { _kind: "course_offering", _target_id: null })).data; })());
  await save(operator, d3, off({ completion_evaluation_template_id: tplTraining }));
  r = await operator.c.rpc("program_draft_submit", { _draft_id: d3 });
  check(!r.error, `template yang cocok diterima ${errOf(r)}`);
  r = await decide(approver, d3, "approve");
  check(!r.error, `disetujui orang lain ${errOf(r)}`);
  const live = (await svc.from("course_offerings").select("id, completion_evaluation_template_id").eq("offering_code", OFF_DRAFT).maybeSingle()).data;
  if (live) offeringIds.push(live.id);
  check(live?.completion_evaluation_template_id === tplTraining, `offering tayang memakai template itu (${live?.completion_evaluation_template_id ?? "kosong"})`);

  console.log("7. Jalur ubah template lama dan model akses berbayar (20261105030000)");
  // A template id that does not exist: before the fix the call reaches "template not found" (callable),
  // after it the database refuses the call itself. No real template is ever touched.
  r = await approver.c.rpc("set_completion_evaluation_template_status", { _template_id: "00000000-0000-0000-0000-0000000000aa", _status: "retired", _reason: "uji" });
  check(/permission denied/.test(errOf(r)), `approver tidak bisa menonaktifkan template langsung (${errOf(r).slice(0, 50) || "BERHASIL"})`);
  const ds = (await operator.c.rpc("program_draft_open", { _kind: "course_offering", _target_id: null })).data;
  await save(operator, ds, off({ offering_code: `${OFF_DRAFT}-sp`, delivery_mode_code: "open_self_paced", learning_model: "self_paced", delivery_format: "fully_online",
    cohort_payment_responsibility: null, self_paced_access_model: "free_to_learn", completion_evaluation_required: false, completion_evaluation_context: null }));
  r = await operator.c.rpc("program_draft_submit", { _draft_id: ds });
  check(/program_access_model_unsupported/.test(errOf(r)), `offering mandiri "sertifikat berbayar" ditolak di layar admin (${errOf(r).slice(0, 50) || "DITERIMA"})`);
  if (!r.error) await operator.c.rpc("program_draft_withdraw", { _draft_id: ds });
} finally {
  console.log("\nMembersihkan data uji...");
  const { data: offs } = await svc.from("course_offerings").select("id").like("offering_code", `of-tdd-certpath-%${stamp}%`);
  const ids = [...new Set([...offeringIds, ...(offs ?? []).map((x) => x.id)])];
  if (ids.length) {
    await svc.from("certificates").delete().in("course_offering_id", ids);
    const { data: es } = await svc.from("enrolments").select("id").in("course_offering_id", ids);
    const eids = (es ?? []).map((e) => e.id);
    if (eids.length) {
      const { data: subs } = await svc.from("completion_evaluation_submissions").select("id").in("enrolment_id", eids);
      const sids = (subs ?? []).map((s) => s.id);
      if (sids.length) {
        await svc.from("completion_evaluation_responses").delete().in("submission_id", sids);
        await svc.from("completion_evaluation_submissions").delete().in("id", sids);
      }
      await svc.from("evaluations").delete().in("enrolment_id", eids);
      await svc.from("progress_records").delete().in("enrolment_id", eids);
      await svc.from("enrolments").delete().in("id", eids);
    }
    await svc.from("course_offerings").delete().in("id", ids);
  }
  await svc.from("academy_program_drafts").delete().in("created_by", created);
  if (courseId) await svc.from("master_courses").delete().eq("id", courseId);
  if (created.length) {
    await svc.from("platform_events").delete().in("actor_id", created);
    await svc.from("learning_audit_log").delete().in("actor_id", created);
    await svc.from("governance_audit_log").delete().in("actor_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) { left++; console.log("  gagal hapus user", id, error.message); }
  }
  const rest = (await svc.from("master_courses").select("id", { count: "exact", head: true }).ilike("course_code", "tdd-certpath-%")).count;
  console.log(left || rest ? `Tersisa: ${left} akun, ${rest} course uji.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ")}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
