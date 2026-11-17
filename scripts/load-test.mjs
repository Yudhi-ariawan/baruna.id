/**
 * Simple load test against the Supabase project in .env (KESIAPAN_RILIS bagian C,
 * "banyak user bersamaan"; CATATAN_PERBAIKAN 2bi). Simulates N concurrent users for
 * S seconds with the queries the app makes most: 60% anonymous visitors (catalog,
 * modules, Knowledge Hub, expert directory, home counts) and 40% signed-in
 * participants (own applications, enrolments, progress, certificates, attendance,
 * notification marks), all through RLS like the app. Think time 0.5-1.5 s.
 *
 * It uses real quota (egress) of the target project and briefly loads it. It runs
 * only with --yes. Creates 5 accounts @example.test and deletes them at the end.
 * Run: npm run load-test -- --yes [--users=50] [--seconds=120]
 */
import { createClient } from "@supabase/supabase-js";

const arg = (name, def) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def);
const USERS = arg("users", 50), SECONDS = arg("seconds", 120);
if (!process.argv.includes("--yes")) {
  console.error(`Uji beban memakai kuota project Supabase di .env. Jalankan dengan --yes (pengguna=${USERS}, detik=${SECONDS}).`);
  process.exit(1);
}
const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !SERVICE || !ANON) { console.error("Missing SUPABASE_URL / keys"); process.exit(1); }
const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now(), PASSWORD = "TddLoad!2026#";
const created = [];

// ---- signed-in participants (few accounts, each signs in once)
const { data: roleRows } = await svc.from("rbac_roles").select("id, code");
const participantRole = roleRows?.find((r) => r.code === "participant")?.id;
const sessions = [];
for (let i = 0; i < 5; i++) {
  const email = `tdd-load-${i}-${stamp}@example.test`;
  const { data: u, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true,
    user_metadata: { display_name: `TDD Load ${i}`, organization: "KKP", job_title: "Staf", phone: "+6281234567890" } });
  if (error) throw new Error(error.message);
  created.push(u.user.id);
  if (participantRole) await svc.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: participantRole, is_primary: false, status: "active", reason: "tdd_load_test" });
}
await new Promise((r) => setTimeout(r, 1500));
for (let i = 0; i < 5; i++) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: `tdd-load-${i}-${stamp}@example.test`, password: PASSWORD });
  if (error) throw new Error(error.message);
  sessions.push({ c, id: created[i] });
}
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
const offering = (await svc.from("course_offerings").select("id").eq("status", "published").limit(1).maybeSingle()).data?.id;

// ---- the requests (small pages, like the app's lists)
const VISITOR = {
  "katalog offering": () => anon.from("course_offerings").select("id, offering_code, offering_title, status").eq("status", "published").limit(20),
  "modul publik": () => anon.from("module_registry_public_v").select("id, title, summary").limit(12),
  "Knowledge Hub": () => anon.from("knowledge_resources_public_v").select("id, title, resource_type").limit(12),
  "direktori expert": () => anon.from("experts_directory_v").select("id, display_name, slug").limit(12),
  "angka beranda": () => anon.from("knowledge_resources_public_v").select("id", { count: "exact", head: true }),
};
const PARTICIPANT = {
  "pengajuan saya": (s) => s.c.from("course_enrollment_applications").select("id, course_id, status").eq("user_id", s.id).limit(20),
  "course saya": (s) => s.c.from("enrolments").select("id, course_offering_id, enrolment_status").eq("user_id", s.id).limit(20),
  "progres saya": (s) => s.c.from("progress_records").select("id").limit(20),
  "sertifikat saya": (s) => s.c.from("certificates").select("id, certificate_number").eq("learner_id", s.id).limit(10),
  "kehadiran saya": (s) => s.c.rpc("my_attendance", { _offering_id: offering }),
  "tanda notifikasi": (s) => s.c.from("notification_reads").select("notification_id").eq("user_id", s.id).limit(50),
};

const stats = {};
const record = (name, ms, ok, status) => {
  const s = (stats[name] ??= { n: 0, err: 0, ms: [], codes: {} });
  s.n++; s.ms.push(ms); if (!ok) { s.err++; s.codes[status] = (s.codes[status] ?? 0) + 1; }
};
const pick = (o) => { const k = Object.keys(o); return k[Math.floor(Math.random() * k.length)]; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = Date.now() + SECONDS * 1000;

async function user(i) {
  const signedIn = i % 5 < 2; // 40%
  const s = sessions[i % sessions.length];
  await sleep(Math.random() * 2000); // staggered start
  while (Date.now() < until) {
    const name = signedIn ? pick(PARTICIPANT) : pick(VISITOR);
    const t0 = performance.now();
    let ok = false, status = 0;
    try {
      const res = await (signedIn ? PARTICIPANT[name](s) : VISITOR[name]());
      status = res.status ?? 0; ok = !res.error;
      if (res.error) status = res.status || res.error.code || "error";
    } catch (e) { status = String(e.message).slice(0, 30); }
    record(name, performance.now() - t0, ok, status);
    await sleep(500 + Math.random() * 1000);
  }
}

console.log(`Uji beban: ${USERS} pengguna bersamaan selama ${SECONDS} detik ke ${new URL(URL_).hostname.split(".")[0]}...`);
const started = Date.now();
try {
  await Promise.all(Array.from({ length: USERS }, (_, i) => user(i)));
} finally {
  const pct = (a, p) => { const x = [...a].sort((m, n) => m - n); return x[Math.min(x.length - 1, Math.floor(x.length * p))] ?? 0; };
  let total = 0, errs = 0; const all = [];
  console.log("\nPermintaan             jumlah  error  rata2   p95    maks (ms)");
  for (const [name, s] of Object.entries(stats).sort()) {
    total += s.n; errs += s.err; all.push(...s.ms);
    const avg = s.ms.reduce((a, b) => a + b, 0) / s.ms.length;
    console.log(`${name.padEnd(22)} ${String(s.n).padStart(6)} ${String(s.err).padStart(6)} ${avg.toFixed(0).padStart(6)} ${pct(s.ms, 0.95).toFixed(0).padStart(6)} ${Math.max(...s.ms).toFixed(0).padStart(7)}${s.err ? "  " + JSON.stringify(s.codes) : ""}`);
  }
  const secs = (Date.now() - started) / 1000;
  console.log(`\nTotal ${total} permintaan dalam ${secs.toFixed(0)} detik (${(total / secs).toFixed(1)}/detik), error ${errs} (${total ? ((errs / total) * 100).toFixed(2) : 0}%), p95 semua ${pct(all, 0.95).toFixed(0)} ms, p99 ${pct(all, 0.99).toFixed(0)} ms`);
  console.log("\nMembersihkan akun uji...");
  if (created.length) await svc.from("rbac_user_roles").delete().in("user_id", created);
  for (const id of created) await svc.auth.admin.deleteUser(id);
  console.log("Selesai: akun uji dihapus.");
}
