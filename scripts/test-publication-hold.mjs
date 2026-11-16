/**
 * Live test: Publisher takes content down temporarily and puts it back (migration
 * 20261116020000; CATATAN_PERBAIKAN 2ba) against the database in .env and the running
 * app (npm run dev; CONSOLE_TEST_URL or APP_BASE_URL). Checks the real public readers
 * (public views, the catalog query, applying for an offering).
 *
 * It WRITES test data (accounts @example.test, one offering, one publication, one
 * module and one expert profile marked "TDD Tayang <stamp>", audit rows) and removes
 * everything at the end.
 * Run: npm run test:publication-hold
 */
import { createClient } from "@supabase/supabase-js";
import { toJSONAsync, fromCrossJSON } from "seroval";

const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const APP = (process.env.CONSOLE_TEST_URL || process.env.APP_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
if (!URL_ || !SERVICE || !ANON) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}
const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
const stamp = Date.now();
const PASSWORD = "TddPub!2026#";
const TAG = `TDD Tayang ${stamp}`;
const COURSE = `tdd-pub-${stamp}`, OFF = `of-tdd-pub-${stamp}`;
const created = [];
const fixtures = {};
let courseId = null;
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };

const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function callFn(token, exp, data, method = "POST") {
  const file = "/src/lib/governance/publishing.functions.ts";
  const headers = { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${token}` };
  const payload = JSON.stringify(await toJSONAsync({ data }));
  const res = method === "GET"
    ? await fetch(`${APP}/_serverFn/${fnId(file, exp)}?payload=${encodeURIComponent(payload)}`, { headers })
    : await fetch(`${APP}/_serverFn/${fnId(file, exp)}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: payload });
  const text = await res.text();
  try {
    const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] });
    return v?.result !== undefined ? { data: v.result } : { error: String(v?.error?.message ?? text.slice(0, 120)) };
  } catch {
    const m = text.match(/"message":\{"t":1,"s":"((?:[^"\\]|\\.)*)"\}/);
    return { error: m ? JSON.parse(`"${m[1]}"`) : text.slice(0, 160) };
  }
}

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-pub-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_pub_test" });
  if (e) throw new Error(e.message);
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: le } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (le) throw new Error(le.message);
  return { id: u.user.id, c, token: s.session.access_token };
}
/** Copy the enum-valued governance columns of an existing published row. */
async function governanceOf(table, extra = "") {
  const { data } = await svc.from(table).select(`source_type, verification_status${extra}`).eq("current_status", "published").limit(1).maybeSingle();
  return data ?? {};
}
const visible = {
  knowledge_resource: async () => ((await anon.from("knowledge_resources_public_v").select("id").eq("id", fixtures.knowledge_resource)).data ?? []).length > 0,
  module: async () => ((await anon.from("module_registry_public_v").select("id").eq("id", fixtures.module)).data ?? []).length > 0,
  expert: async () => ((await anon.from("experts_directory_v").select("id").eq("id", fixtures.expert)).data ?? []).length > 0,
  // The public catalog query (src/lib/academy/catalog.functions.ts).
  course_offering: async () => ((await svc.from("course_offerings").select("id").eq("id", fixtures.course_offering).eq("status", "published")).data ?? []).length > 0,
};

await fetch(APP + "/src/lib/governance/publishing.functions.ts");
try {
  const publisher = await persona("publisher", "publisher");
  const approver = await persona("approver", "approver");
  const peserta = await persona("peserta", "participant");

  // Fixtures, all live.
  const tpl = (await svc.from("learning_templates").select("id").eq("code", "knowledge_course").single()).data.id;
  courseId = (await svc.from("master_courses").insert({ course_code: COURSE, title: TAG, language: "en", learning_template_id: tpl, status: "active", version: 1 }).select("id").single()).data.id;
  const mode = (await svc.from("delivery_modes").select("id").eq("code", "blended_cohort").single()).data.id;
  const o = await svc.from("course_offerings").insert({ master_course_id: courseId, offering_code: OFF, offering_title: TAG, year: 2026, delivery_mode_id: mode,
    access_mode: "application-required", status: "published", learning_engine_version: "shared_v1", shared_learn_path: `/academy/course/${OFF}`, learning_model: "cohort_based",
    delivery_format: "blended", enrolment_access_rule: "approval_required", classification_source: "operator", cohort_financial_model: "fee_based",
    cohort_financial_model_source: "operator", cohort_payment_responsibility: "government_or_public_funding", cohort_payment_responsibility_source: "operator",
    completion_evaluation_required: false }).select("id").single();
  if (o.error) throw new Error(`offering: ${o.error.message}`);
  fixtures.course_offering = o.data.id;
  const base = (g) => ({ ...g, created_by: publisher.id, current_status: "published", visibility: "public" });
  const kr = await svc.from("knowledge_resources").insert({ ...base(await governanceOf("knowledge_resources", ", resource_type")), title: TAG, language: "en" }).select("id").single();
  if (kr.error) throw new Error(`publikasi: ${kr.error.message}`);
  fixtures.knowledge_resource = kr.data.id;
  const md = await svc.from("module_registry").insert({ ...base(await governanceOf("module_registry")), title: TAG, language: "en" }).select("id").single();
  if (md.error) throw new Error(`modul: ${md.error.message}`);
  fixtures.module = md.data.id;
  const ex = await svc.from("experts").insert({ ...base(await governanceOf("experts")), display_name: TAG, slug: `tdd-pub-${stamp}` }).select("id").single();
  if (ex.error) throw new Error(`expert: ${ex.error.message}`);
  fixtures.expert = ex.data.id;
  const kinds = Object.keys(fixtures);
  check((await Promise.all(kinds.map((k) => visible[k]()))).every(Boolean), "keempat konten uji tampil di halaman publik");

  console.log("1. Daftar Penayangan dan hak akses");
  let r = await callFn(publisher.token, "listPublications", undefined, "GET");
  check(kinds.every((k) => (r.data ?? []).some((i) => i.id === fixtures[k] && i.live)), `Publisher melihat keempatnya sebagai Tayang (${r.error?.slice(0, 60) ?? "ok"})`);
  r = await callFn(approver.token, "holdPublication", { kind: "module", id: fixtures.module, reason: "Coba turunkan" });
  check(/Hanya Publisher/.test(r.error ?? ""), `Approver tidak bisa menurunkan (${(r.error ?? "BISA").slice(0, 50)})`);

  console.log("2. Turunkan sementara");
  for (const k of kinds) {
    r = await callFn(publisher.token, "holdPublication", { kind: k, id: fixtures[k], reason: "Data keliru, diperbaiki dulu" });
    check(r.data?.held === true && !(await visible[k]()), `${k}: diturunkan dan hilang dari publik (${r.error?.slice(0, 60) ?? "ok"})`);
  }
  r = await peserta.c.rpc("course_enrollment_apply", { _course_id: OFF, _course_title: "x", _notes: null });
  check(/offering_closed/.test(r.error?.message ?? ""), `offering yang diturunkan tidak menerima pengajuan (${r.error?.message?.slice(0, 40) ?? "DITERIMA"})`);
  r = await approver.c.rpc("program_set_status", { _kind: "course_offering", _id: fixtures.course_offering, _status: "published", _note: "Coba tayangkan" });
  check(!(await visible.course_offering()), `tombol status Program Academy tidak menayangkan ulang (${r.error?.message?.slice(0, 40) ?? "tetap ditutup"})`);
  r = await callFn(publisher.token, "listPublications", undefined, "GET");
  const heldRow = (r.data ?? []).find((i) => i.id === fixtures.module);
  check(heldRow?.heldAt && heldRow.heldReason === "Data keliru, diperbaiki dulu" && heldRow.heldByName, "daftar menampilkan alasan, waktu, dan siapa yang menurunkan");

  console.log("3. Tayangkan lagi");
  for (const k of kinds) {
    r = await callFn(publisher.token, "releasePublication", { kind: k, id: fixtures[k] });
    check(r.data?.live === true && (await visible[k]()), `${k}: tayang lagi (${r.error?.slice(0, 60) ?? "ok"})`);
  }
  r = await callFn(publisher.token, "releasePublication", { kind: "module", id: fixtures.module });
  check(/tidak sedang diturunkan/.test(r.error ?? ""), "ditayangkan dua kali ditolak");

  console.log("4. Audit");
  const audit = (await svc.from("admin_audit_log").select("event_type").eq("actor_id", publisher.id)).data ?? [];
  check(audit.filter((a) => a.event_type === "publication_held").length === 4 && audit.filter((a) => a.event_type === "publication_released").length === 4, `setiap turunkan dan tayangkan tercatat (${audit.length})`);
} finally {
  console.log("\nMembersihkan data uji...");
  if (fixtures.knowledge_resource) await svc.from("knowledge_resources").delete().eq("id", fixtures.knowledge_resource);
  if (fixtures.module) await svc.from("module_registry").delete().eq("id", fixtures.module);
  if (fixtures.expert) await svc.from("experts").delete().eq("id", fixtures.expert);
  const { data: offs } = await svc.from("course_offerings").select("id").eq("offering_code", OFF);
  const ids = (offs ?? []).map((x) => x.id);
  if (ids.length) {
    await svc.from("learning_feature_flags").delete().in("course_offering_id", ids);
    await svc.from("course_offerings").delete().in("id", ids);
  }
  if (courseId) await svc.from("master_courses").delete().eq("id", courseId);
  if (created.length) {
    await svc.from("course_enrollment_applications").delete().in("user_id", created);
    await svc.from("admin_audit_log").delete().in("actor_id", created);
    await svc.from("governance_audit_log").delete().in("actor_id", created);
    await svc.from("rbac_user_roles").delete().in("user_id", created);
  }
  let left = 0;
  for (const id of created) { const { error } = await svc.auth.admin.deleteUser(id); if (error) { left++; console.log("  gagal hapus user", id, error.message); } }
  console.log(left ? `Tersisa: ${left} akun.` : "Selesai: database bersih.");
}
console.log(failures.length ? `\nGAGAL: ${failures.length} (${failures.join("; ").slice(0, 400)}), lulus ${passed}` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failures.length ? 1 : 0);
