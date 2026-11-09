/**
 * Live test of the participant learning RPCs (migration 20261020010000) against the
 * real Supabase database in .env. It creates its OWN test course (master course,
 * modules, one open and one approval-required offering) and test accounts, then
 * deletes everything it created, even when a check fails. Real courses are not used.
 * Run: npm run test:participant-rpc   (--keep leaves the data for inspection)
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
const password = "TddLearnRpc!2026#";
const keep = process.argv.includes("--keep");
const users = [];
const created = { masterCourseId: null, offeringIds: [] };
let passed = 0;
const failures = [];
const ok = (cond, label) => {
  if (cond) { passed++; console.log("  ok", label); } else { failures.push(label); console.log("  FAIL", label); }
};
const rejects = async (promise, pattern, label) => {
  const { error } = await promise;
  const good = Boolean(error) && pattern.test(error.message);
  if (!good) console.log("   got:", error ? error.message : "no error");
  ok(good, label);
};

async function mkUser(tag) {
  const email = `tdd.learnrpc.${tag}.${stamp}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: `TDD ${tag}`, organization: "Instansi Uji", job_title: "Staf Uji", phone: "+6280000000000" },
  });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  users.push(data.user.id);
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(`signIn ${tag}: ${signErr.message}`);
  return { id: data.user.id, client };
}

async function setupCourse() {
  const { data: mc, error } = await admin.from("master_courses")
    .insert({ course_code: `tdd-learn-${stamp}`, title: `TDD Learn ${stamp}` }).select("id").single();
  if (error) throw new Error(`master course: ${error.message}`);
  created.masterCourseId = mc.id;
  const { error: mErr } = await admin.from("master_modules").insert([
    { master_course_id: mc.id, module_code: "TDD-01", title: "Modul 1", sequence: 1 },
    { master_course_id: mc.id, module_code: "TDD-02", title: "Modul 2", sequence: 2 },
  ]);
  if (mErr) throw new Error(`modules: ${mErr.message}`);
  // Copy the classification columns of two real, valid offerings (one open, one approval
  // required) so every database check constraint on course_offerings is satisfied.
  const { data: templates, error: tErr } = await admin.from("course_offerings")
    .select("*").in("offering_code", ["of-ocean-literacy-open-2026", "of-africa-fisheries-2026"]);
  if (tErr || templates?.length !== 2) throw new Error(`offering templates: ${tErr?.message ?? "not found"}`);
  const open = templates.find((t) => t.offering_code === "of-ocean-literacy-open-2026");
  const approval = templates.find((t) => t.offering_code === "of-africa-fisheries-2026");
  const clone = (t, code, title) => {
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = t;
    return { ...rest, master_course_id: mc.id, offering_code: code, offering_title: title, status: "published",
             enrolment_start_date: null, enrolment_end_date: null };
  };
  const offerings = [clone(open, `tdd-open-${stamp}`, `TDD Open ${stamp}`), clone(approval, `tdd-approval-${stamp}`, `TDD Approval ${stamp}`)];
  const { data: offs, error: oErr } = await admin.from("course_offerings").insert(offerings).select("id, offering_code");
  if (oErr) throw new Error(`offerings: ${oErr.message}`);
  created.offeringIds = offs.map((o) => o.id);
  return { open: offs[0].offering_code, approval: offs[1].offering_code };
}

async function cleanup() {
  console.log("\nMembersihkan data uji...");
  if (created.offeringIds.length) {
    await admin.from("certificates").delete().in("course_offering_id", created.offeringIds);
    const { data: enr } = await admin.from("enrolments").select("id").in("course_offering_id", created.offeringIds);
    const enrIds = (enr ?? []).map((e) => e.id);
    if (enrIds.length) {
      await admin.from("progress_records").delete().in("enrolment_id", enrIds);
      await admin.from("evaluations").delete().in("enrolment_id", enrIds);
      const { data: subs } = await admin.from("completion_evaluation_submissions").select("id").in("enrolment_id", enrIds);
      const subIds = (subs ?? []).map((x) => x.id);
      if (subIds.length) {
        await admin.from("completion_evaluation_responses").delete().in("submission_id", subIds);
        await admin.from("completion_evaluation_submissions").delete().in("id", subIds);
      }
      await admin.from("enrolments").delete().in("id", enrIds);
    }
    await admin.from("course_offerings").delete().in("id", created.offeringIds);
  }
  if (created.masterCourseId) {
    await admin.from("master_modules").delete().eq("master_course_id", created.masterCourseId);
    await admin.from("master_courses").delete().eq("id", created.masterCourseId);
  }
  if (users.length) {
    await admin.from("learning_audit_log").delete().in("actor_id", users);
    await admin.from("course_enrollment_applications").delete().in("user_id", users);
    await admin.from("admin_audit_log").delete().in("actor_id", users);
    await admin.from("admin_audit_log").delete().in("target_user_id", users);
    await admin.from("governance_audit_log").delete().in("actor_id", users);
    await admin.from("rbac_user_roles").delete().in("user_id", users);
  }
  let left = 0;
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) { left++; console.log("  gagal hapus user", id, error.message); }
  }
  console.log(left ? `Selesai dengan ${left} akun tersisa.` : "Selesai: database bersih.");
}

async function run() {
  const codes = await setupCourse();
  const budi = await mkUser("budi");
  const rina = await mkUser("rina");
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  console.log("Kursus uji dan akun uji dibuat");

  console.log("\n1. Tulis langsung dari browser ditutup");
  const { data: offOpen } = await admin.from("course_offerings").select("id").eq("offering_code", codes.open).single();
  ok(Boolean((await budi.client.from("enrolments").insert({ user_id: budi.id, course_offering_id: offOpen.id })).error), "insert enrolment langsung ditolak");
  ok(Boolean((await budi.client.from("learning_audit_log").insert({ event_type: "palsu", actor_id: budi.id })).error), "log audit palsu ditolak");

  console.log("\n2. Pendaftaran mengikuti aturan kursus");
  const e1 = await budi.client.rpc("learning_enrol", { _offering_code: codes.open });
  ok(!e1.error && e1.data?.created === true, "kursus terbuka bisa didaftari sendiri");
  const e1b = await budi.client.rpc("learning_enrol", { _offering_code: codes.open });
  ok(!e1b.error && e1b.data?.id === e1.data?.id && e1b.data?.created === false, "daftar dua kali = enrolment yang sama");
  await rejects(budi.client.rpc("learning_enrol", { _offering_code: codes.approval }), /approval_required/, "kursus wajib persetujuan ditolak tanpa persetujuan");
  await admin.from("course_enrollment_applications").insert({ user_id: budi.id, course_id: codes.approval, course_title: "TDD", status: "approved" });
  const e2 = await budi.client.rpc("learning_enrol", { _offering_code: codes.approval });
  ok(!e2.error && e2.data?.created === true, "setelah disetujui admin, kursus bisa dimasuki");
  const enrolmentId = e1.data.id;

  console.log("\n3. Progres hanya untuk modul asli");
  await rejects(budi.client.rpc("learning_progress_mark", { _enrolment_id: enrolmentId, _activity_id: "palsu" }), /activity_not_in_course/, "aktivitas karangan ditolak");
  await rejects(rina.client.rpc("learning_progress_mark", { _enrolment_id: enrolmentId, _activity_id: "module:TDD-01" }), /enrolment_not_found/, "tidak bisa menandai enrolment orang lain");
  ok(Boolean((await budi.client.from("progress_records").insert({ enrolment_id: enrolmentId, learning_activity_id: "x", status: "completed" })).error), "insert progres langsung ditolak");
  const p1 = await budi.client.rpc("learning_progress_mark", { _enrolment_id: enrolmentId, _activity_id: "module:TDD-01" });
  ok(!p1.error && p1.data?.status === "completed", "modul 1 selesai");

  console.log("\n4. Sertifikat");
  await rejects(budi.client.rpc("issue_my_certificate", { _enrolment_id: enrolmentId }), /not_eligible:modules_incomplete/, "belum layak (1 dari 2 modul)");
  await budi.client.rpc("learning_progress_mark", { _enrolment_id: enrolmentId, _activity_id: "module:TDD-02" });
  // Offering ini (salinan Ocean Literacy) mewajibkan evaluasi akhir: sejak 20261105010000 yang dihitung
  // adalah evaluasi akhir yang dikirim di tab Evaluation; jalur evaluasi lama ditutup.
  await rejects(budi.client.rpc("issue_my_certificate", { _enrolment_id: enrolmentId }), /not_eligible:completion_evaluation_missing/, "evaluasi akhir masih wajib");
  const evOld = await budi.client.rpc("learning_evaluation_submit", { _enrolment_id: enrolmentId, _evaluation_type: "course_feedback", _response: { rating: 5 } });
  ok(/permission denied/.test(evOld.error?.message ?? ""), "jalur evaluasi lama ditutup");
  const st = await budi.client.rpc("start_completion_evaluation", { _enrolment_id: enrolmentId });
  const tplId = (await admin.from("completion_evaluation_submissions").select("template_id").eq("id", st.data?.submission_id ?? "00000000-0000-0000-0000-000000000000").maybeSingle()).data?.template_id;
  const { data: qs } = await admin.from("completion_evaluation_questions").select("id, question_type, is_required, choices, rating_max").eq("template_id", tplId ?? "00000000-0000-0000-0000-000000000000").eq("active", true);
  const answers = {};
  for (const q of qs ?? []) {
    if (!q.is_required) continue;
    const first = Array.isArray(q.choices) && q.choices.length ? (typeof q.choices[0] === "object" ? q.choices[0].value ?? q.choices[0].label : q.choices[0]) : "ok";
    answers[q.id] = q.question_type === "rating_scale" ? (q.rating_max ?? 5) : q.question_type === "yes_no" ? true
      : q.question_type === "multiple_choice" ? [first] : q.question_type === "single_choice" ? first : "Uji otomatis";
  }
  const sv = await budi.client.rpc("save_completion_evaluation_draft", { _submission_id: st.data?.submission_id, _expected_version: st.data?.draft_version ?? 0, _answers: answers });
  const sb = await budi.client.rpc("submit_completion_evaluation", { _submission_id: st.data?.submission_id, _expected_version: sv.data?.draft_version ?? null });
  ok(!st.error && !sv.error && !sb.error, `evaluasi akhir dikirim lewat tab Evaluation ${st.error?.message ?? sv.error?.message ?? sb.error?.message ?? ""}`);
  // Since 20261109010000 the certificate is issued when a different decider approves the completion.
  await rejects(budi.client.rpc("issue_my_certificate", { _enrolment_id: enrolmentId }), /certificate_requires_approval/, "peserta tidak bisa menerbitkan sendiri");
  const approver = await mkUser("approver");
  const { data: approverRole } = await admin.from("rbac_roles").select("id").eq("code", "approver").single();
  await admin.from("rbac_user_roles").insert({ user_id: approver.id, role_id: approverRole.id, is_primary: false, status: "active", reason: "tdd_participant_rpc" });
  const comp = (await admin.from("course_completions").select("id, updated_at").eq("enrolment_id", enrolmentId).maybeSingle()).data;
  const decided = await approver.client.rpc("completion_decide", { _id: comp?.id, _decision: "approve", _note: null, _expected_updated_at: comp?.updated_at });
  ok(!decided.error, `kelulusan disetujui orang lain ${decided.error?.message ?? ""}`);
  const [c1, c2] = await Promise.all([
    budi.client.rpc("issue_my_certificate", { _enrolment_id: enrolmentId }),
    budi.client.rpc("issue_my_certificate", { _enrolment_id: enrolmentId }),
  ]);
  ok(!c1.error && !c2.error, "dua klik bersamaan sama-sama berhasil");
  ok(c1.data?.certificate_number && c1.data.certificate_number === c2.data?.certificate_number, `nomor sama untuk dua klik (${c1.data?.certificate_number})`);
  const { count } = await admin.from("certificates").select("id", { count: "exact", head: true }).eq("course_offering_id", offOpen.id);
  ok(count === 1, "tepat satu baris sertifikat");
  await rejects(rina.client.rpc("issue_my_certificate", { _enrolment_id: enrolmentId }), /enrolment_not_found/, "orang lain tidak bisa menerbitkan");

  console.log("\n5. Verifikasi publik (tanpa login)");
  const v = await anon.rpc("verify_certificate", { _number: c1.data.certificate_number });
  ok(!v.error && v.data?.found === true && v.data?.status === "issued", "nomor asli terverifikasi");
  ok(v.data?.holder && !v.data.holder.includes("budi"), `nama disamarkan (${v.data?.holder})`);
  const vOld = await anon.rpc("verify_certificate", { _number: "B.589/BDA/RSDM.510/V/2026" });
  ok(!vOld.error && vOld.data?.found === false, "nomor konstan lama tidak dinyatakan sah");
  ok(Boolean((await anon.rpc("issue_my_certificate", { _enrolment_id: enrolmentId })).error), "pengunjung tanpa login tidak bisa menerbitkan");

  console.log("\n6. Mundur dari kursus");
  const w = await budi.client.rpc("learning_enrolment_withdraw", { _enrolment_id: enrolmentId, _reason: "uji" });
  ok(!w.error && w.data?.changed === true, "mundur berhasil");
  await rejects(budi.client.rpc("learning_progress_mark", { _enrolment_id: enrolmentId, _activity_id: "module:TDD-01" }), /enrolment_not_active/, "tidak ada progres setelah mundur");

  console.log("\n7. Hak akses isi modul (P3, migrasi 20261020020000)");
  const { data: mod } = await admin.from("module_registry").select("id")
    .eq("current_status", "published").eq("visibility", "public").limit(1).maybeSingle();
  if (!mod) {
    console.log("  (dilewati: tidak ada modul tayang di database ini)");
    return;
  }
  const can = async (u) => (await admin.rpc("can_access_module_content", { _uid: u, _module_id: mod.id })).data;
  ok((await can(budi.id)) === false, "belum mendaftar: tidak boleh");
  await admin.from("course_enrollment_applications").insert({ user_id: rina.id, course_id: mod.id, course_title: "TDD", status: "pending" });
  ok((await can(rina.id)) === false, "pendaftaran masih menunggu: tidak boleh");
  await admin.from("course_enrollment_applications").update({ status: "approved" }).eq("user_id", rina.id).eq("course_id", mod.id);
  ok((await can(rina.id)) === true, "pendaftaran disetujui: boleh");
  ok(Boolean((await budi.client.rpc("can_access_module_content", { _uid: budi.id, _module_id: mod.id })).error), "browser tidak bisa memanggil pengecek akses langsung");
}

try {
  await run();
} catch (e) {
  console.error("\nUJI BERHENTI KARENA ERROR:", e);
  failures.push("error tak terduga: " + (e?.message ?? e));
} finally {
  if (!keep) {
    try { await cleanup(); } catch (e) { console.error("Gagal membersihkan:", e); failures.push("cleanup gagal"); }
  } else console.log("\n--keep: data uji dipertahankan.");
}
console.log(`\n${failures.length ? "GAGAL" : "LULUS"}: ${passed} pengecekan lulus, ${failures.length} gagal`);
if (failures.length) { console.log(failures.map((f) => " - " + f).join("\n")); process.exit(1); }
