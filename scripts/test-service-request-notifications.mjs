// Live test (CATATAN_PERBAIKAN 2bz): Penugasan Expert bell notifications for requester,
// admin and expert, read through the running app (npm run dev, or CONSOLE_TEST_URL).
// Creates temporary accounts (@example.test), one trainer profile and one request,
// and deletes everything afterwards. Run: npm run test:service-request-notifications
import { createClient } from "@supabase/supabase-js";
import { toJSONAsync, fromCrossJSON } from "seroval";
const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_PUBLISHABLE_KEY, APP = (process.env.CONSOLE_TEST_URL || process.env.APP_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now(), PW = "SrNotif!2026#", users = [], experts = [];
const { data: roles } = await svc.from("rbac_roles").select("id, code");
let ok = 0, bad = 0;
const check = (c, l) => { c ? ok++ : bad++; console.log(c ? "  ok  " : "  FAIL", l); };
async function persona(label, roleCodes = []) {
  const email = `tdd-srn-${label}-${stamp}@example.test`;
  const { data: u } = await svc.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: { display_name: `TDD ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  users.push(u.user.id);
  for (const code of roleCodes) await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roles.find((r) => r.code === code).id, is_primary: false, status: "active", reason: "tdd_srn" });
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: s } = await c.auth.signInWithPassword({ email, password: PW });
  return { id: u.user.id, c, token: s.session.access_token };
}
const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
async function bell(p) {
  const payload = JSON.stringify(await toJSONAsync({ data: undefined }));
  const t = await (await fetch(`${APP}/_serverFn/${fnId("/src/lib/notifications/notifications.functions.ts", "listMyNotifications")}?payload=${encodeURIComponent(payload)}`, { headers: { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${p.token}` } })).text();
  const v = fromCrossJSON(JSON.parse(t), { refs: new Map(), plugins: [] });
  return (v.result ?? []).filter((n) => n.subjectKind === "service_request").map((n) => n.title);
}
const row = async (id) => (await svc.from("expert_service_requests").select("updated_at").eq("id", id).single()).data;
const act = async (a, id, action, extra = {}) => a.c.rpc("admin_service_request_transition", { _request_id: id, _action: action, _expected_updated_at: (await row(id)).updated_at, _message: extra.message ?? null, _expert_id: extra.expertId ?? null, _completion: null });
try {
  const R = await persona("pemohon"), A = await persona("admin", ["admin"]), T = await persona("ahli", ["expert"]);
  const { data: ex } = await svc.from("experts").insert({ source_type: "external_submission", original_contributor_id: T.id, created_by: T.id, display_name: `TDD Ahli ${stamp}`, slug: `tdd-srn-${stamp}`, current_status: "published", visibility: "public", verification_status: "governance_verified" }).select("id").single();
  experts.push(ex.id);
  await svc.from("expert_trainer_status").insert({ expert_id: ex.id, trainer_status: "active", trainer_level: "certified", rationale: "tdd_srn" });
  const r = await R.c.rpc("expert_service_request_create", { _request_type: "speaker", _status: "submitted", _target_expert_slug: null, _payload: { values: { eventName: `Seminar Notif ${stamp}` }, files: {} } });
  const id = r.data.id, no = r.data.requestNumber;
  let b = await bell(R); check(b.some((t) => t.includes("Permintaan expert terkirim") && t.includes(no)), `pemohon: tanda terima kiriman (${b[0]})`);
  b = await bell(A); check(b.some((t) => t.includes("Permintaan expert baru") && t.includes(no)), `admin: permintaan baru (${b.find((t) => t.includes(no))})`);
  await act(A, id, "request_info", { message: "Mohon kirim jadwal." });
  await R.c.rpc("expert_service_request_reply", { _request_id: id, _message: "Jadwal 10 Des." });
  b = await bell(A); check(b.some((t) => t.includes("Pemohon menjawab pertanyaan Anda")), "admin: pemohon menjawab");
  await act(A, id, "assign", { expertId: ex.id });
  b = await bell(T); check(b.some((t) => t.includes("Permintaan layanan baru untuk Anda")), "expert: ditugaskan");
  await T.c.rpc("trainer_service_request_respond", { _request_id: id, _action: "decline", _message: "Bentrok jadwal." });
  b = await bell(A); check(b.some((t) => t.includes("Expert menolak penugasan")), "admin: expert menolak");
  b = await bell(R); check(b.some((t) => t.includes("Expert berhalangan")), "pemohon: expert berhalangan");
  await act(A, id, "assign", { expertId: ex.id });
  await T.c.rpc("trainer_service_request_respond", { _request_id: id, _action: "accept", _message: null });
  b = await bell(A); check(b.some((t) => t.includes("Expert menerima penugasan")), "admin: expert menerima");
  b = await bell(R); check(b.some((t) => t.includes("Expert menerima permintaan Anda")), "pemohon: expert menerima");
  b = await bell(R); check(!b.some((t) => t.includes("Expert menolak penugasan") || t.includes("Permintaan expert baru")), "pemohon tidak menerima notifikasi khusus admin");
  b = await bell(T); check(!b.some((t) => t.includes("Permintaan expert baru")), "expert tidak menerima notifikasi khusus admin");
} catch (e) { bad++; console.log("ERROR", e.message); }
finally {
  const reqs = (await svc.from("expert_service_requests").select("id").in("requester_id", users)).data ?? [];
  if (reqs.length) { await svc.from("admin_audit_log").delete().in("entity_id", reqs.map((x) => x.id)); await svc.from("expert_service_requests").delete().in("id", reqs.map((x) => x.id)); }
  await svc.from("admin_audit_log").delete().in("actor_id", users);
  await svc.from("admin_audit_log").delete().in("target_user_id", users);
  if (experts.length) { await svc.from("expert_trainer_status").delete().in("expert_id", experts); await svc.from("experts").delete().in("id", experts); }
  await svc.from("rbac_user_roles").delete().in("user_id", users);
  for (const uid of users) await svc.auth.admin.deleteUser(uid);
  console.log("Selesai: database bersih.");
}
console.log(bad ? `\nGAGAL: ${bad} gagal, ${ok} lulus` : `\nLULUS: ${ok} pengecekan lulus, 0 gagal`);
process.exit(bad ? 1 : 0);

