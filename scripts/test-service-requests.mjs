// Live test: Penugasan Expert (PB-EXP-03, Slide 38) against the database in .env.
// The whole flow through the RPCs: request -> check / ask for info -> match -> assign
// (only then does the expert see it) -> expert asks, declines (back to the team) or
// accepts -> schedule -> complete (one facilitation history row). Also the guards:
// stale writes, conflict of interest, who may read what, closed requests.
// Migration 20261120010000 (review before an assignment is active) is required.
// Creates temporary accounts (@example.test), two trainer profiles and requests,
// and deletes everything afterwards.
// Run: npm run test:service-requests
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !ANON || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const svc = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = `Tdd-${Math.random().toString(36).slice(2)}-Aa1!`, stamp = Date.now();
const created = [], experts = [];
let passed = 0, failed = 0;
const check = (cond, label) => { if (cond) { passed++; console.log("  ok  ", label); } else { failed++; console.log("  FAIL", label); } };
const errOf = (r) => r.error?.message ?? "";

async function retry(fn, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= tries || !/fetch failed|timeout|ECONNRESET/i.test(String(e?.message ?? e))) throw e; await new Promise((r) => setTimeout(r, 1500 * i)); }
  }
}

const { data: roleRows, error: roleErr } = await svc.from("rbac_roles").select("id, code");
if (roleErr) throw new Error(roleErr.message);
const roleId = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));

async function persona(label, roles = []) {
  const email = `tdd-sr-${label}-${stamp}@example.test`;
  const { data: u, error } = await retry(() => svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD SR ${label}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } }));
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  for (const role of roles) {
    const { error: e } = await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[role], is_primary: false, status: "active", reason: "tdd_service_request_test" });
    if (e) throw new Error(e.message);
  }
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: se } = await retry(() => c.auth.signInWithPassword({ email, password: PASSWORD }));
  if (se) throw new Error(se.message);
  return { id: u.user.id, c, name: `TDD SR ${label}` };
}
/** Expert-role user with a public profile and an active trainer status (= has a request inbox). */
async function trainer(label) {
  const p = await persona(label, ["expert"]);
  const slug = `tdd-sr-${label}-${stamp}`;
  const { data: ex, error } = await svc.from("experts").insert({ source_type: "external_submission", original_contributor_id: p.id,
    created_by: p.id, display_name: `TDD Expert ${label} ${stamp}`, slug, current_status: "published",
    visibility: "public", verification_status: "governance_verified" }).select("id, display_name").single();
  if (error) throw new Error(error.message);
  experts.push(ex.id);
  const { error: e2 } = await svc.from("expert_trainer_status").insert({ expert_id: ex.id, trainer_status: "active", trainer_level: "certified", rationale: "tdd_service_request_test" });
  if (e2) throw new Error(e2.message);
  return { ...p, expertId: ex.id, expertName: ex.display_name, slug };
}

const payload = (title) => ({ values: { eventName: `${title} ${stamp}`, organization: "Dinas Kelautan Uji", country: "Indonesia", eventDate: "2026-12-10" }, files: {} });
const create = (u, title, slug = null, status = "submitted") =>
  u.c.rpc("expert_service_request_create", { _request_type: "speaker", _status: status, _target_expert_slug: slug, _payload: payload(title) });
const row = async (id) => (await svc.from("expert_service_requests").select("*").eq("id", id).single()).data;
async function act(a, id, action, extra = {}) {
  const r = await row(id);
  return a.c.rpc("admin_service_request_transition", { _request_id: id, _action: action, _expected_updated_at: r.updated_at,
    _message: extra.message ?? null, _expert_id: extra.expertId ?? null, _completion: extra.completion ?? null });
}
const respond = (t, id, action, message = null) => t.c.rpc("trainer_service_request_respond", { _request_id: id, _action: action, _message: message });
const inbox = async (t) => ((await t.c.rpc("trainer_service_requests")).data ?? []).map((x) => x.id);
const adminItem = async (a, id, status = "all") =>
  ((await a.c.rpc("admin_service_requests_list", { _status: status, _search: String(stamp), _limit: 200, _offset: 0 })).data?.items ?? []).find((x) => x.id === id);

try {
  console.log("Menyiapkan akun uji...");
  const requester = await persona("pemohon");
  const admin = await persona("admin", ["admin"]);
  const outsider = await persona("lain");
  const t1 = await trainer("ahli1");
  const t2 = await trainer("ahli2");

  console.log("1. Pemohon memilih expert: belum aktif sebelum ditinjau dan ditugaskan admin");
  let r = await create(requester, "Narasumber Seminar Mangrove", t1.slug);
  check(!r.error && r.data?.status === "submitted", `permintaan terkirim (${errOf(r) || r.data?.requestNumber})`);
  const id = r.data?.id;
  const dup = await create(requester, "Narasumber Seminar Mangrove", t1.slug);
  check(dup.data?.id === id, "klik kirim dua kali tidak membuat permintaan ganda");
  check(!(await inbox(t1)).includes(id), "expert pilihan pemohon BELUM melihat permintaan di portalnya");
  const peek = await t1.c.from("expert_service_requests").select("id").eq("id", id);
  check((peek.data ?? []).length === 0, "expert pilihan tidak bisa membaca baris permintaan langsung (RLS)");
  const peekEv = await t1.c.from("expert_service_request_events").select("id").eq("request_id", id);
  check((peekEv.data ?? []).length === 0, "expert pilihan tidak bisa membaca riwayatnya (RLS)");
  r = await respond(t1, id, "accept");
  check(/request_not_found/.test(errOf(r)), `expert pilihan tidak bisa langsung menerima (${errOf(r) || "diterima!"})`);
  let item = await adminItem(admin, id);
  check(item && !item.assignedExpert && item.preferredExpert === t1.expertName, `admin melihat "pilihan pemohon: ${item?.preferredExpert}", belum ditugaskan`);
  check(Boolean(await adminItem(admin, id, "unassigned")), "permintaan masuk filter Belum Ada Expert");
  const mine = ((await requester.c.rpc("expert_service_requests_my")).data ?? []).find((x) => x.id === id);
  check(mine && !mine.assignedExpert && mine.preferredExpert === t1.expertName, "pemohon melihat expert pilihannya, belum sebagai expert yang ditugaskan");

  console.log("2. Cek kelengkapan: admin meminta info, pemohon membalas");
  r = await act(admin, id, "review");
  check(!r.error && (await row(id)).status === "under_review", `Mulai Review (${errOf(r) || "under_review"})`);
  r = await act(admin, id, "request_info");
  check(/message_required/.test(errOf(r)), "minta info tanpa pesan ditolak");
  r = await act(admin, id, "request_info", { message: "Mohon lampirkan kerangka acara seminar." });
  check(!r.error && (await row(id)).status === "information_requested", `minta info ke pemohon (${errOf(r) || "information_requested"})`);
  r = await requester.c.rpc("expert_service_request_reply", { _request_id: id, _message: "Kerangka acara: pembukaan, sesi 1, diskusi." });
  check(!r.error && r.data?.status === "under_review", `balasan pemohon mengembalikan ke Under Review (${errOf(r) || r.data?.status})`);
  const stale = await admin.c.rpc("admin_service_request_transition", { _request_id: id, _action: "matching", _expected_updated_at: "2020-01-01T00:00:00+00:00", _message: null, _expert_id: null, _completion: null });
  check(/stale_request/.test(errOf(stale)), "tindakan dengan data lama (tab lain) ditolak");
  r = await act(admin, id, "matching");
  check(!r.error && (await row(id)).status === "expert_matching", "Mulai Pencocokan");

  console.log("3. Admin menugaskan: baru sekarang expert melihat dan menjawab");
  r = await act(admin, id, "assign", { expertId: t1.expertId });
  let cur = await row(id);
  check(!r.error && cur.status === "expert_contacted" && cur.assigned_at && cur.target_expert_id === t1.expertId, `ditugaskan ke expert 1 (${errOf(r) || cur.status})`);
  check((await inbox(t1)).includes(id), "permintaan kini muncul di portal expert 1");
  check(((await t1.c.from("expert_service_requests").select("id").eq("id", id)).data ?? []).length === 1, "expert 1 kini bisa membaca barisnya (RLS)");
  check(!(await inbox(t2)).includes(id), "expert lain tidak melihatnya");
  r = await respond(t1, id, "request_info", "Berapa jumlah peserta seminar?");
  check(!r.error && (await row(id)).status === "information_requested", "expert bertanya ke pemohon");
  r = await requester.c.rpc("expert_service_request_reply", { _request_id: id, _message: "Sekitar 80 peserta dari dinas." });
  check(!r.error && r.data?.status === "expert_contacted", `balasan pemohon kembali ke expert (${r.data?.status})`);

  console.log("4. Expert menolak: permintaan kembali ke tim, bukan ditutup");
  r = await respond(t1, id, "decline");
  check(/decline_reason_required/.test(errOf(r)), "menolak tanpa alasan ditolak");
  r = await respond(t1, id, "decline", "Bentrok jadwal dinas luar.");
  cur = await row(id);
  check(!r.error && cur.status === "expert_matching" && !cur.target_expert_id && !cur.assigned_at, `status kembali ke Pencocokan tanpa expert (${errOf(r) || cur.status})`);
  check(!(await inbox(t1)).includes(id), "permintaan hilang dari portal expert 1");
  r = await respond(t1, id, "decline", "Bentrok jadwal dinas luar.");
  check(!r.error && r.data?.status === "expert_matching", `klik tolak kedua kali tidak error (${errOf(r) || "ok"})`);
  const evs = (await svc.from("expert_service_request_events").select("actor_role, action, message").eq("request_id", id)).data ?? [];
  check(evs.some((e) => e.actor_role === "expert" && e.action === "decline" && /Bentrok/.test(e.message ?? "")), "alasan penolakan tercatat di riwayat");
  check(Boolean(await adminItem(admin, id, "unassigned")), "permintaan kembali ke filter Belum Ada Expert");

  console.log("5. Ditugaskan ke expert lain, diterima, dijadwalkan, selesai");
  r = await act(admin, id, "assign", { expertId: t2.expertId });
  check(!r.error && (await row(id)).status === "expert_contacted", "ditugaskan ke expert 2");
  r = await respond(t2, id, "accept");
  check(!r.error && (await row(id)).status === "confirmed", "expert 2 menerima");
  r = await respond(t2, id, "accept");
  check(!r.error, "klik terima kedua kali tidak error");
  r = await respond(t2, id, "request_info", "Pertanyaan setelah diterima");
  check(/request_not_respondable/.test(errOf(r)), "expert tidak bisa bertanya lagi setelah menerima");
  r = await act(admin, id, "schedule");
  check(!r.error && (await row(id)).status === "scheduled", "admin menandai terjadwal");
  r = await act(admin, id, "complete", { completion: {} });
  check(/activity_title_required/.test(errOf(r)), "selesai tanpa judul kegiatan ditolak");
  r = await act(admin, id, "complete", { completion: { activityTitle: `Seminar Mangrove ${stamp}`, organizer: "Dinas Kelautan Uji", startDate: "2026-12-10", endDate: "2026-12-10", participantCount: "80", country: "Indonesia" } });
  cur = await row(id);
  check(!r.error && cur.status === "completed" && cur.facilitation_history_id, `selesai dan tertaut riwayat fasilitasi (${errOf(r) || cur.status})`);
  r = await act(admin, id, "complete", { completion: { activityTitle: "Lagi" } });
  check(/invalid_transition/.test(errOf(r)), "menyelesaikan dua kali ditolak");
  const hist = (await svc.from("expert_training_facilitation_history").select("id, expert_id, participant_count").eq("service_request_id", id)).data ?? [];
  check(hist.length === 1 && hist[0].expert_id === t2.expertId && hist[0].participant_count === 80, "tepat satu baris riwayat fasilitasi, milik expert 2, 80 peserta");
  r = await requester.c.rpc("expert_service_request_cancel", { _request_id: id, _reason: "uji" });
  check(/request_not_cancellable/.test(errOf(r)), "permintaan selesai tidak bisa dibatalkan pemohon");

  console.log("6. Penjagaan: konflik kepentingan, hak baca, penolakan oleh admin");
  r = await create(t1, "Minta diri sendiri", t1.slug);
  check(/cannot_request_own_profile/.test(errOf(r)), "expert tidak bisa meminta profilnya sendiri");
  r = await create(admin, "Permintaan milik admin");
  const ownId = r.data?.id;
  r = await act(admin, ownId, "review");
  check(/cannot_process_own_request/.test(errOf(r)), "admin tidak bisa memproses permintaannya sendiri");
  r = await create(t2, "Permintaan dari expert 2");
  const t2req = r.data?.id;
  r = await act(admin, t2req, "assign", { expertId: t2.expertId });
  check(/conflict_of_interest/.test(errOf(r)), "expert tidak bisa ditugaskan ke permintaannya sendiri");
  r = await outsider.c.rpc("admin_service_requests_list", { _status: "all", _search: null, _limit: 10, _offset: 0 });
  check(/forbidden/.test(errOf(r)), "pengguna biasa tidak bisa membuka daftar admin");
  check(((await outsider.c.from("expert_service_requests").select("id").eq("id", id)).data ?? []).length === 0, "pengguna lain tidak bisa membaca permintaan orang");
  r = await act(admin, t2req, "decline");
  check(/message_required/.test(errOf(r)), "admin menolak tanpa alasan ditolak");
  r = await act(admin, t2req, "decline", { message: "Di luar cakupan layanan BARUNA." });
  check(!r.error && (await row(t2req)).status === "declined", "admin menutup permintaan dengan alasan");
  const draft = await create(requester, "Draf saja", null, "draft");
  check(!(await adminItem(admin, draft.data?.id)), "draf pemohon tidak tampil di antrean admin");
} catch (e) {
  failed++;
  console.log("  FAIL (error)", e?.message ?? e);
} finally {
  console.log("\nMembersihkan data uji...");
  const reqs = (await svc.from("expert_service_requests").select("id").in("requester_id", created)).data ?? [];
  const reqIds = reqs.map((x) => x.id);
  if (experts.length) await svc.from("expert_training_facilitation_history").delete().in("expert_id", experts);
  if (reqIds.length) {
    await svc.from("admin_audit_log").delete().in("entity_id", reqIds);
    const { error } = await svc.from("expert_service_requests").delete().in("id", reqIds);
    if (error) console.log("  cleanup requests", error.message);
  }
  await svc.from("admin_audit_log").delete().in("actor_id", created);
  await svc.from("admin_audit_log").delete().in("target_user_id", created);
  if (experts.length) {
    await svc.from("expert_trainer_status").delete().in("expert_id", experts);
    const { error } = await svc.from("experts").delete().in("id", experts);
    if (error) console.log("  cleanup experts", error.message);
  }
  await svc.from("governance_audit_log").delete().in("actor_id", created);
  for (const uid of created) await svc.from("rbac_user_roles").delete().eq("user_id", uid);
  let left = 0;
  for (const uid of created) {
    await svc.from("profiles").delete().eq("id", uid);
    const { error } = await retry(() => svc.auth.admin.deleteUser(uid));
    if (error) { left++; console.log("  cleanup user", uid, error.message); }
  }
  console.log(left ? `Tersisa: ${left} akun.` : "Selesai: database bersih.");
}
console.log(failed ? `\nGAGAL: ${failed} gagal, ${passed} lulus` : `\nLULUS: ${passed} pengecekan lulus, 0 gagal`);
process.exit(failed ? 1 : 0);
