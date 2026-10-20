// Uji per peran Konsol Kurasi (/governance) lewat aplikasi yang berjalan.
// Membuat akun uji @example.test per peran (peserta, reviewer, verifier, approver,
// operator, publisher, admin), login, memanggil getGovernanceConsoleAccess dan
// gerbang server, membandingkan dengan matriks Slide 16, lalu menghapus akunnya.
// Pakai: jalankan aplikasi (npm run dev), lalu npm run test:console-roles
// (alamat aplikasi dari CONSOLE_TEST_URL atau APP_BASE_URL di .env).
import { createClient } from "@supabase/supabase-js";
import { toJSONAsync, fromCrossJSON } from "seroval";

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_PUBLISHABLE_KEY, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Running app (npm run dev). Default: APP_BASE_URL from .env.
const APP = (process.env.CONSOLE_TEST_URL || process.env.APP_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const PASSWORD = `Tdd-${stamp}-x!`;
const fnId = (file, exp) => Buffer.from(JSON.stringify({ file: `${file}?tss-serverfn-split`, export: `${exp}_createServerFn_handler` })).toString("base64url");

async function callFn(token, file, exp, data, method = "GET") {
  const id = fnId(file, exp);
  const headers = { "x-tsr-serverFn": "true", accept: "application/json", authorization: `Bearer ${token}` };
  let res;
  if (method === "GET") {
    const qs = data === undefined ? "" : `?payload=${encodeURIComponent(JSON.stringify(await toJSONAsync({ data })))}`;
    res = await fetch(`${APP}/_serverFn/${id}${qs}`, { headers });
  } else {
    res = await fetch(`${APP}/_serverFn/${id}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(await toJSONAsync({ data })) });
  }
  const text = await res.text();
  return { status: res.status, text };
}
// seroval JSON is nested; pull booleans/arrays out with a tolerant parse of the plain-JSON fallback.
function decodeResult(text) {
  try { const v = fromCrossJSON(JSON.parse(text), { refs: new Map(), plugins: [] }); return { result: v?.result, error: v?.error }; } catch (e) { return { error: { message: "decode: " + e.message + " " + text.slice(0, 120) } }; }
}
function decodeAccess(text) {
  const { result, error } = decodeResult(text);
  if (!result) return { error: error?.message ?? String(error) };
  return { ...result.menus, isAdmin: result.isAdmin, roles: result.roles };
}

const PERSONAS = {
  participant: ["participant"],
  reviewer: ["reviewer"],
  verifier: ["verifier"],
  approver: ["approver"],
  operator: ["operator"],
  publisher: ["publisher"],
  admin: ["admin"],
};
// Expected from Slide 16 + the existing server rules (rancangan konsol).
const R = (read, decide) => ({ read, decide });
const EXPECT = {
  participant: { experts: R(false, false), modules: R(false, false), publications: R(false, false), enrollments: R(false, false), trainingNeeds: R(false, false), console: false },
  reviewer: { experts: R(true, false), modules: R(true, false), publications: R(true, false), enrollments: R(false, false), trainingNeeds: R(true, false), console: true },
  verifier: { experts: R(true, false), modules: R(true, false), publications: R(true, false), enrollments: R(false, false), trainingNeeds: R(false, false), console: true },
  approver: { experts: R(true, true), modules: R(true, true), publications: R(true, true), enrollments: R(true, true), trainingNeeds: R(true, true), console: true },
  operator: { experts: R(false, false), modules: R(false, false), publications: R(false, false), enrollments: R(true, true), trainingNeeds: R(false, false), console: true },
  publisher: { experts: R(false, false), modules: R(false, false), publications: R(false, false), enrollments: R(false, false), trainingNeeds: R(false, false), console: true },
  admin: { experts: R(true, true), modules: R(true, true), publications: R(true, true), enrollments: R(true, true), trainingNeeds: R(true, true), console: true },
};

// Dev mode registers a server function once its module was loaded by the client graph.
for (const m of ["/src/lib/governance/console-access.functions.ts", "/src/lib/admin/modules.functions.ts", "/src/lib/admin/users.functions.ts"]) await fetch(APP + m);
let failures = 0;
const check = (label, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`); };
const { data: roleRows } = await admin.from("rbac_roles").select("id, code");
const roleId = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));
const created = [];

try {
  for (const [persona, roles] of Object.entries(PERSONAS)) {
    const email = `tdd.console.${persona}.${stamp}@example.test`;
    const { data: u, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: `TDD ${persona}`, organization: "Kementerian Kelautan dan Perikanan", job_title: "Staf Teknis", phone: "+6281234567890" } });
    if (error) throw new Error(`createUser ${persona}: ${error.message}`);
    created.push(u.user.id);
    for (const code of roles) {
      const { error: e } = await admin.from("rbac_user_roles").insert({ user_id: u.user.id, role_id: roleId[code], is_primary: false, status: "active", reason: "tdd_console_test" });
      if (e) throw new Error(`grant ${code}: ${e.message}`);
    }
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: s, error: se } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    if (se) throw new Error(`signIn ${persona}: ${se.message}`);
    const token = s.session.access_token;

    const res = await callFn(token, "/src/lib/governance/console-access.functions.ts", "getGovernanceConsoleAccess");
    const got = decodeAccess(res.text);
    const exp = EXPECT[persona];
    const accessError = got.error; if (accessError) console.log("   error:", accessError);
    const anyRead = ["experts", "modules", "publications", "enrollments", "trainingNeeds"].some((k) => got[k]?.read);
    const consoleOpen = anyRead || (got.roles ?? []).includes("publisher");
    console.log(`\n== ${persona} (${roles.join(",")}) HTTP ${res.status}${got.experts ? "" : " raw=" + got.raw}`);
    for (const k of ["experts", "modules", "publications", "enrollments", "trainingNeeds"]) {
      check(`${persona} ${k}: read=${exp[k].read} decide=${exp[k].decide}`, got[k] && got[k].read === exp[k].read && got[k].decide === exp[k].decide, JSON.stringify(got[k]));
    }
    check(`${persona} konsol terbuka=${exp.console}`, consoleOpen === exp.console);
    check(`${persona} isAdmin=${persona === "admin"}`, got.isAdmin === (persona === "admin"));

    // Server gate of a queue matches the menu: module queue list.
    const list = await callFn(token, "/src/lib/admin/modules.functions.ts", "listAdminModuleSubmissions", {});
    const listRes = decodeResult(list.text); const listOk = list.status === 200 && !listRes.error;
    check(`${persona} server antrean modul ${exp.modules.read ? "terbuka" : "ditolak"}`, listOk === exp.modules.read, listRes.error ? String(listRes.error.message ?? listRes.error).slice(0, 90) : "ok");
    // Admin portal gate (users.read).
    const adm = await callFn(token, "/src/lib/admin/users.functions.ts", "getAdminAccess");
    const canReadUsers = Boolean(decodeResult(adm.text).result?.canReadUsers);
    check(`${persona} portal /admin ${persona === "admin" ? "terbuka" : "tertutup"}`, canReadUsers === (persona === "admin"));
  }
} finally {
  for (const id of created) {
    await admin.from("rbac_user_roles").delete().eq("user_id", id);
    await admin.from("profiles").delete().eq("id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log("cleanup", id, error.message);
  }
}
console.log(failures ? `\n${failures} pengecekan GAGAL` : "\nSemua pengecekan lulus");
process.exitCode = failures ? 1 : 0;
