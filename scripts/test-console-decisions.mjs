// Uji hak keputusan di server per peran (Konsol Kurasi). Lihat test-console-roles.mjs.
// Peran yang hanya boleh membaca harus ditolak walau memanggil fungsi keputusan
// langsung (tombolnya disembunyikan; ini pemeriksaan server di baliknya). Memakai
// ID pengajuan acak, jadi tidak ada data yang berubah: pemutus lolos cek hak lalu
// gagal "tidak ditemukan"; peran lain ditolak di cek hak lebih dulu.
// Pakai: jalankan aplikasi (npm run dev), lalu npm run test:console-decisions
import { createClient } from "@supabase/supabase-js";
import { toJSONAsync } from "seroval";

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// Running app (npm run dev). Default: APP_BASE_URL from .env.
const APP = (process.env.CONSOLE_TEST_URL || process.env.APP_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const stamp = Date.now(), PASSWORD = `Tdd-${stamp}-x!`;
const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");
const FILES = {
  module: ["/src/lib/admin/modules.functions.ts", "recordAdminModuleDecision"],
  publication: ["/src/lib/admin/publications.functions.ts", "recordAdminPublicationDecision"],
  expert: ["/src/lib/admin/experts.functions.ts", "recordAdminExpertDecision"],
  training: ["/src/lib/governance/governance.functions.ts", "recordFinalDecision"],
  enrollment: ["/src/lib/admin/enrollments.functions.ts", "decideCourseEnrollment"],
};
for (const [file] of Object.values(FILES)) await fetch(APP + file);

async function post(token, [file, exp], data) {
  const res = await fetch(`${APP}/_serverFn/${fnId(file, exp)}`, {
    method: "POST",
    headers: { "x-tsr-serverFn": "true", accept: "application/json", "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(await toJSONAsync({ data })),
  });
  return res.text();
}
const FAKE = "00000000-0000-4000-8000-000000000000";
const isRoleRefusal = (t) => /forbidden|Akses ditolak|Akses tidak mencukupi|hanya Approver|42501|tidak memiliki izin/i.test(t);

const { data: roleRows } = await admin.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));
const EXPECT_DECIDE = {
  reviewer: { module: false, publication: false, expert: false, training: false },
  verifier: { module: false, publication: false, expert: false, training: false },
  operator: { module: false, publication: false, expert: false, training: false },
  approver: { module: true, publication: true, expert: true, training: true },
};
let failures = 0;
const created = [];
try {
  for (const [persona, expect] of Object.entries(EXPECT_DECIDE)) {
    const email = `tdd.decide.${persona}.${stamp}@example.test`;
    const { data: u, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: `TDD ${persona}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
    if (error) throw new Error(error.message);
    created.push(u.user.id);
    await admin.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[persona], is_primary: false, status: "active", reason: "tdd_decision_test" });
    const c = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: s } = await c.auth.signInWithPassword({ email, password: PASSWORD });
    const token = s.session.access_token;
    console.log(`\n== ${persona}`);
    for (const kind of ["module", "publication", "expert", "training"]) {
      const text = await post(token, FILES[kind], { subjectId: FAKE, decision: "approve", rationale: "uji hak keputusan" });
      const refused = isRoleRefusal(text);
      const ok = expect[kind] ? !refused : refused;
      if (!ok) failures++;
      const msg = (text.match(/"s":"([^"]{8,160})"/g) ?? []).map((m) => m.slice(5, -1)).find((m) => /[a-z]{4}/i.test(m)) ?? text.slice(0, 120);
      console.log(`${ok ? "OK  " : "FAIL"} ${kind}: ${expect[kind] ? "lolos cek hak" : "ditolak cek hak"} -> ${msg}`);
    }
  }
} finally {
  for (const id of created) {
    await admin.from("rbac_user_roles").delete().eq("user_id", id);
    await admin.from("profiles").delete().eq("id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log("cleanup", error.message);
  }
}
console.log(failures ? `\n${failures} pengecekan GAGAL` : "\nSemua pengecekan lulus");
process.exitCode = failures ? 1 : 0;
