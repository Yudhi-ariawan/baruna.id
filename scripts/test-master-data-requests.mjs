/**
 * Live test: Data Master, Operator proposes and Approver/Admin approves (migration
 * 20261116010000; CATATAN_PERBAIKAN 2az) against the database in .env and the running
 * app (npm run dev; CONSOLE_TEST_URL or APP_BASE_URL). Uses the app's server
 * functions, as the Data Master page does.
 *
 * It WRITES test data (accounts @example.test, languages "zz-...", requests, audit
 * rows) and removes everything at the end.
 * Run: npm run test:master-data-requests
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
const stamp = Date.now();
const PASSWORD = "TddMdr!2026#";
const CODE = `zz-t${stamp.toString(36).slice(-6)}`;
const NAME = `TDD Bahasa ${stamp}`;
const created = [];
let passed = 0;
const failures = [];
const check = (c, l) => { if (c) { passed++; console.log("  ok", l); } else { failures.push(l); console.log("  FAIL", l); } };

const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function callFn(token, file, exp, data, method = "POST") {
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
const LANG = "/src/lib/governance/languages.functions.ts";
const MASTER = "/src/lib/governance/master-data.functions.ts";
const REQ = "/src/lib/governance/master-change.functions.ts";

const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries((roleRows ?? []).map((r) => [r.code, r.id]));
async function persona(label, role) {
  const email = `tdd-mdr-${label}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_mdr_test" });
  if (e) throw new Error(e.message);
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s, error: le } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (le) throw new Error(le.message);
  return { id: u.user.id, c, token: s.session.access_token };
}
const lang = async () => (await svc.from("languages_taxonomy").select("id, code, name, native_name, active").eq("code", CODE).maybeSingle()).data;
const list = async (who) => (await callFn(who.token, REQ, "listMasterChangeRequests", undefined, "GET")).data;
const pendingFor = async (who, text) => (await list(who))?.items?.find((r) => r.status === "pending" && r.summary.includes(text));

await Promise.all([LANG, MASTER, REQ].map((f) => fetch(APP + f)));
try {
  const operator = await persona("operator", "operator");
  const approver = await persona("approver", "approver");
  const approver2 = await persona("approver2", "approver");
  const peserta = await persona("peserta", "participant");

  console.log("1. Operator membuka Data Master");
  let r = await callFn(operator.token, MASTER, "getMasterData", undefined, "GET");
  check(Array.isArray(r.data?.expertise), `Operator membaca bidang keahlian dan aturan level (${r.error?.slice(0, 60) ?? "ok"})`);
  r = await callFn(operator.token, LANG, "getMasterLanguages", undefined, "GET");
  check(Array.isArray(r.data), `Operator membaca daftar bahasa (${r.error?.slice(0, 60) ?? "ok"})`);
  r = await callFn(peserta.token, MASTER, "getMasterData", undefined, "GET");
  check(Boolean(r.error), `peserta tetap ditolak (${(r.error ?? "BISA").slice(0, 50)})`);

  console.log("2. Operator mengusulkan bahasa baru");
  r = await callFn(operator.token, LANG, "saveMasterLanguage", { id: null, code: CODE, name: NAME, nativeName: null, displayOrder: null });
  check(r.data?.queued === true, `tersimpan sebagai usulan (${r.error?.slice(0, 70) ?? JSON.stringify(r.data)})`);
  check(!(await lang()), "bahasa belum masuk daftar sebelum disetujui");
  const p1 = await pendingFor(approver, NAME);
  check(Boolean(p1) && p1.requestedBy === operator.id, "Approver melihat usulan di daftar Usulan Perubahan");
  r = await callFn(operator.token, REQ, "decideMasterChangeRequest", { id: p1?.id, decision: "approve" });
  check(/Hanya Approver/.test(r.error ?? ""), `Operator tidak bisa menyetujui (${(r.error ?? "BISA").slice(0, 50)})`);

  console.log("3. Approver menyetujui");
  r = await callFn(approver.token, REQ, "decideMasterChangeRequest", { id: p1?.id, decision: "approve" });
  check(r.data?.status === "approved", `disetujui (${r.error?.slice(0, 60) ?? r.data?.status})`);
  const l1 = await lang();
  check(l1?.active === true && l1?.name === NAME, "bahasa kini ada di daftar dan aktif");
  r = await callFn(approver2.token, REQ, "decideMasterChangeRequest", { id: p1?.id, decision: "approve" });
  check(/sudah diputuskan/.test(r.error ?? ""), `disetujui dua kali ditolak (${(r.error ?? "BISA").slice(0, 50)})`);

  console.log("4. Usulan menonaktifkan ditolak dengan alasan");
  r = await callFn(operator.token, LANG, "setMasterLanguageActive", { id: l1?.id, active: false });
  check(r.data?.queued === true, "usulan nonaktifkan tersimpan");
  const p2 = await pendingFor(approver, NAME);
  check(p2?.summary?.startsWith("Nonaktifkan bahasa"), `ringkasan usulan menyebut nama bahasa (${p2?.summary})`);
  r = await callFn(approver.token, REQ, "decideMasterChangeRequest", { id: p2?.id, decision: "reject", note: "" });
  check(/alasan/.test(r.error ?? ""), "menolak tanpa alasan ditolak");
  r = await callFn(approver.token, REQ, "decideMasterChangeRequest", { id: p2?.id, decision: "reject", note: "Bahasa ini masih dipakai" });
  check(r.data?.status === "rejected" && (await lang())?.active === true, "ditolak: bahasa tetap aktif");

  console.log("5. Membatalkan usulan sendiri");
  r = await callFn(operator.token, LANG, "saveMasterLanguage", { id: l1?.id, code: CODE, name: NAME, nativeName: "Basa Uji", displayOrder: null });
  const p3 = await pendingFor(operator, NAME);
  r = await callFn(approver.token, REQ, "cancelMasterChangeRequest", { id: p3?.id });
  check(Boolean(r.error), "orang lain tidak bisa membatalkan usulan Operator");
  r = await callFn(operator.token, REQ, "cancelMasterChangeRequest", { id: p3?.id });
  check(r.data?.status === "cancelled" && !(await lang())?.native_name, "Operator membatalkan, tidak ada yang berubah");

  console.log("6. Approver tetap menyimpan langsung");
  r = await callFn(approver.token, LANG, "saveMasterLanguage", { id: l1?.id, code: CODE, name: NAME, nativeName: "Basa Langsung", displayOrder: null });
  check(r.data?.queued === false && (await lang())?.native_name === "Basa Langsung", `langsung tersimpan tanpa usulan (${r.error?.slice(0, 60) ?? "ok"})`);
  check(!(await list(approver))?.items?.some((x) => x.status === "pending" && x.summary.includes(NAME)), "tidak ada usulan baru dari simpan langsung");

  console.log("7. Data dan hak akses");
  const direct = await operator.c.from("master_data_change_requests").insert({ kind: "language_save", payload: {}, summary: "x" });
  check(Boolean(direct.error), "tabel usulan tidak bisa ditulis langsung dari browser");
  const rows = await peserta.c.from("master_data_change_requests").select("id");
  check(!rows.error && (rows.data ?? []).length === 0, "peserta tidak bisa membaca usulan");
  const audit = (await svc.from("admin_audit_log").select("event_type").eq("entity_type", "master_data_change_request").in("actor_id", created)).data ?? [];
  const kinds = new Set(audit.map((a) => a.event_type));
  check(["master_change_requested", "master_change_approved", "master_change_rejected", "master_change_cancelled"].every((k) => kinds.has(k)), `audit mencatat setiap langkah (${[...kinds].join(",")})`);
} finally {
  console.log("\nMembersihkan data uji...");
  await svc.from("languages_taxonomy").delete().eq("code", CODE);
  if (created.length) {
    await svc.from("master_data_change_requests").delete().in("requested_by", created);
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
