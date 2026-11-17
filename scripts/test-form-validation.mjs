/**
 * Field-level form checks (CATATAN_PERBAIKAN 2bj): what the form marks in red must
 * match what the server schema rejects, so a user never passes the screen and then
 * gets a general error. No database, no network. Run: npm run test:form-validation
 */
import { createJiti } from "jiti";
import path from "node:path";
const jiti = createJiti(import.meta.url, { alias: { "@": path.resolve("src") } });
const { emptyTrainingDraft, demoTrainingDraft } = await jiti.import("@/lib/trainingRequests");
const { TrainingRequestPayload } = await jiti.import("@/lib/training-requests/payload");
const { trainingRequestStepErrors, firstStepWithErrors } = await jiti.import("@/components/baruna/academy/training-requests/validation");

console.log("== Request a Training ==");

let pass = 0, fail = 0;
const ok = (name, c) => { c ? pass++ : fail++; console.log(`${c ? "LULUS" : "GAGAL"}  ${name}`); };
const toPayload = (d) => ({ ...d, preferredLearningApproach: d.preferredLearningApproach || "self_paced", location: "" });

// 1. empty form: step 1 asks name/email/country/organization/type
const e1 = trainingRequestStepErrors(1, emptyTrainingDraft);
ok("form kosong: langkah 1 menandai nama, email, negara, organisasi, jenis", ["fullName","email","country","organization","organizationType"].every((k) => k in e1));
ok("form kosong: langkah pertama yang salah = 1", firstStepWithErrors(emptyTrainingDraft)?.step === 1);
// 2. Individual: organization not required
const ind = { ...emptyTrainingDraft, requesterType: "Individual" };
const e1i = trainingRequestStepErrors(1, ind);
ok("Individual: organisasi tidak wajib", !("organization" in e1i) && !("organizationType" in e1i));
ok("Individual: target audience tidak wajib", !("targetAudience" in trainingRequestStepErrors(3, ind)));
// 3. email format matches server
const bad = { ...demoTrainingDraft, email: "nama@" };
ok("email salah ditandai di layar", "email" in trainingRequestStepErrors(1, bad));
ok("email salah juga ditolak server", !TrainingRequestPayload.safeParse(toPayload(bad)).success);
// 4. demo draft (complete) passes every step and the server schema
ok("draf lengkap: tidak ada langkah yang salah", firstStepWithErrors(demoTrainingDraft) === null);
ok("draf lengkap: diterima server", TrainingRequestPayload.safeParse(toPayload(demoTrainingDraft)).success);
// 5. every server length limit is caught on screen first
const limits = [
  ["fullName",201,1],["position",201,1],["organization",301,1],["country",101,1],["phone",61,1],["website",501,1],
  ["trainingTopic",301,2],["objectives",4001,2],["needs",4001,2],["outcomes",4001,2],["challenges",4001,2],["supportingExplanation",4001,2],
  ["organizationalLevel",121,3],["participantProfile",2001,3],["geographicContext",201,3],
  ["trainingPeriod",201,5],["existingPartners",1001,5],["remarks",4001,5],
];
for (const [k, n, step] of limits) {
  const d = { ...demoTrainingDraft, [k]: "a".repeat(n) };
  const screen = k in trainingRequestStepErrors(step, d);
  const server = !TrainingRequestPayload.safeParse(toPayload(d)).success;
  ok(`${k} ${n} karakter: layar menandai (${screen}) dan server menolak (${server})`, screen && server);
}
// 6. facilitated needs funding; self-paced does not
ok("facilitated tanpa sumber dana ditandai", "fundingPreference" in trainingRequestStepErrors(5, { ...demoTrainingDraft, fundingPreference: "" }));
ok("self-paced: langkah 5 tidak menuntut apa pun", Object.keys(trainingRequestStepErrors(5, { ...demoTrainingDraft, preferredLearningApproach: "self_paced", fundingPreference: "" })).length === 0);
ok("tanpa pendekatan belajar ditandai di langkah 4", "preferredLearningApproach" in trainingRequestStepErrors(4, { ...demoTrainingDraft, preferredLearningApproach: "" }));
// 7. spaces only count as empty
ok("nama berisi spasi saja dianggap kosong", "fullName" in trainingRequestStepErrors(1, { ...demoTrainingDraft, fullName: "   " }));

// ===== Become an Expert (/experts/join, CATATAN_PERBAIKAN 2bk) =====
console.log("\n== Become an Expert ==");
const { emptyExpertApplication } = await jiti.import("@/lib/experts");
const { ExpertPayloadSchema, getExpertPayloadIncompleteFields } = await jiti.import("@/lib/experts/application-validation");
const { expertJoinStepErrors, firstExpertStepWithErrors } = await jiti.import("@/components/baruna/experts/join-validation");
// The server: SaveInput (name 2-160 + payload schema), completeness gate, database max 20 bidang.
const serverRejects = (f) =>
  !ExpertPayloadSchema.safeParse(f).success ||
  f.fullName.trim().length < 2 || f.fullName.trim().length > 160 ||
  getExpertPayloadIncompleteFields(f).length > 0 ||
  f.expertise.length > 20;
const fullExpert = {
  ...emptyExpertApplication, fullName: "Dr. Budi Santoso", title: "Researcher", institution: "BRIN", country: "Indonesia",
  email: "budi@brin.go.id", expertise: ["Fisheries Management"], roles: ["Trainer"], biography: "Peneliti perikanan 10 tahun.",
};
const all = (f) => [1, 2, 3].flatMap((s) => Object.keys(expertJoinStepErrors(s, f, true)));
ok("expert kosong: langkah 1 menandai nama, jabatan, institusi, negara, email",
  ["fullName", "title", "institution", "country", "email"].every((k) => k in expertJoinStepErrors(1, emptyExpertApplication, true)));
ok("expert lengkap: tidak ada yang ditandai", firstExpertStepWithErrors(fullExpert, true) === null);
ok("expert lengkap: diterima server", !serverRejects(fullExpert));
// every field the server's completeness gate asks for is marked on screen
for (const [k, empty] of [["fullName", ""], ["title", ""], ["institution", ""], ["country", ""], ["email", ""], ["expertise", []], ["roles", []], ["biography", " "]]) {
  const f = { ...fullExpert, [k]: empty };
  ok(`expert tanpa ${k}: layar menandai dan server menolak`, all(f).includes(k) && serverRejects(f));
}
// every length limit is caught on screen before the server rejects
for (const [k, n] of [["fullName", 161], ["title", 161], ["institution", 201], ["country", 81], ["phone", 41], ["linkedin", 301], ["website", 301], ["biography", 20001], ["yearsExperience", 21]]) {
  const f = { ...fullExpert, [k]: "a".repeat(n) };
  ok(`expert ${k} ${n} karakter: layar menandai dan server menolak`, all(f).includes(k) && serverRejects(f));
}
const emailLong = { ...fullExpert, email: `${"a".repeat(250)}@x.id` };
ok("expert email 255 karakter: layar menandai dan server menolak", all(emailLong).includes("email") && serverRejects(emailLong));
const oneChar = { ...fullExpert, fullName: "A" };
ok("expert nama 1 huruf: layar menandai (server menolak saat simpan draf)", all(oneChar).includes("fullName") && serverRejects(oneChar));
const many = { ...fullExpert, expertise: Array.from({ length: 21 }, (_, i) => `Bidang ${i}`) };
ok("expert 21 bidang keahlian: layar menandai dan database menolak", all(many).includes("expertise") && serverRejects(many));
for (const [k, n] of [["structuredLanguages", 21], ["structuredProjects", 31], ["structuredPublications", 51]]) {
  const f = { ...fullExpert, [k]: Array.from({ length: n }, (_, i) => ({ id: String(i) })) };
  ok(`expert ${k} ${n} butir: layar menandai dan server menolak`, all(f).includes(k) && serverRejects(f));
}
ok("expert email salah ditandai di layar", all({ ...fullExpert, email: "budi@" }).includes("email"));
ok("pesan ikut bahasa halaman", expertJoinStepErrors(1, emptyExpertApplication, false).fullName === "Enter your full name.");

// ===== Knowledge Hub: Submit a Resource (CATATAN_PERBAIKAN 2bl) =====
console.log("\n== Knowledge Hub: Submit a Resource ==");
const { emptyResourceDraft, emptyBestPracticeStructure } = await jiti.import("@/lib/resources");
const { khSubmitStepErrors, firstKhStepWithErrors, EXTERNAL_URL, BEST_PRACTICE_REQUIRED } = await jiti.import("@/components/baruna/knowledge/submit-validation");
const khFull = {
  ...emptyResourceDraft, type: "Research Report", typeGroup: "Publications", title: "Panduan Budidaya Nila", description: "Ringkasan.",
  author: "Budi", institution: "BRIN", country: "Indonesia", year: "2025", language: "Indonesian", keywords: "nila, budidaya",
  topicCategory: "Aquaculture", externalUrl: "https://doi.org/10.1/abc", declaration: true,
};
const khAll = (f) => [1, 2, 3, 4].flatMap((st) => Object.keys(khSubmitStepErrors(st, f)));
ok("KH kosong: langkah 1 menandai jenis resource", "type" in khSubmitStepErrors(1, emptyResourceDraft));
// (an empty draft already has this year and "English" as defaults)
ok("KH kosong: langkah 2 menandai 7 kolom wajib, tahun dan bahasa bawaan tidak ditandai",
  ["title", "description", "author", "institution", "country", "keywords", "topicCategory"].every((k) => k in khSubmitStepErrors(2, emptyResourceDraft)) &&
  !("year" in khSubmitStepErrors(2, emptyResourceDraft)) && !("language" in khSubmitStepErrors(2, emptyResourceDraft)));
ok("KH tahun dan bahasa dikosongkan: ditandai",
  ["year", "language"].every((k) => k in khSubmitStepErrors(2, { ...emptyResourceDraft, year: "", language: "" })));
ok("KH lengkap: tidak ada yang ditandai", firstKhStepWithErrors(khFull) === null);
// The database rules (_kr_payload_problem) that the screen must catch first.
ok("KH judul 301 karakter ditandai (database: kr_title_too_long)", khAll({ ...khFull, title: "a".repeat(301) }).includes("title"));
ok("KH tanpa berkas dan tautan ditandai (kr_file_or_url_required)", khAll({ ...khFull, externalUrl: "" }).includes("file"));
ok("KH berkas saja tanpa tautan: lolos", !khAll({ ...khFull, externalUrl: "", file: { name: "a.pdf", size: 1, type: "application/pdf", uploadedAt: "", storagePath: "users/x/a.pdf" } }).length);
for (const bad of ["doi.org/10.1/abc", "www.youtube.com/watch?v=1", "https://a b.com", "ftp://x.org/a", "https://"]) {
  ok(`KH tautan "${bad}" ditandai (kr_external_url_invalid)`, khAll({ ...khFull, externalUrl: bad }).includes("externalUrl"));
}
for (const good of ["https://doi.org/10.1/abc", "HTTP://contoh.go.id/a?b=1", "https://youtu.be/abc"]) {
  ok(`KH tautan "${good}" diterima`, !khAll({ ...khFull, externalUrl: good }).includes("externalUrl"));
}
ok("KH pola tautan sama dengan database (^https?://[^\\s]+$, tanpa beda huruf besar)", EXTERNAL_URL.source === "^https?:\\/\\/\\S+$" && EXTERNAL_URL.flags.includes("i"));
ok("KH tautan > 2000 karakter ditandai", khAll({ ...khFull, externalUrl: "https://x.org/" + "a".repeat(2000) }).includes("externalUrl"));
ok("KH tanpa topik dan bahasa ditandai (kr_topic_required, kr_language_required)",
  ["topicCategory", "language"].every((k) => khAll({ ...khFull, topicCategory: "", language: "" }).includes(k)));
const bp = { ...khFull, type: "Best Practice", practiceStructure: { ...emptyBestPracticeStructure } };
ok("KH Best Practice kosong: keenam bagian wajib ditandai (kr_best_practice_incomplete)",
  BEST_PRACTICE_REQUIRED.every((k) => khAll(bp).includes(`ps.${k}`)) && !khAll(bp).includes("ps.stakeholders") && !khAll(bp).includes("ps.replication"));
const bpFull = { ...bp, practiceStructure: Object.fromEntries(Object.keys(emptyBestPracticeStructure).map((k) => [k, "isi"])) };
ok("KH Best Practice lengkap: lolos", firstKhStepWithErrors(bpFull) === null);
ok("KH bagian Best Practice berisi spasi saja ditandai", khAll({ ...bpFull, practiceStructure: { ...bpFull.practiceStructure, lessons: "  " } }).includes("ps.lessons"));
for (const y of ["1979", "2101", "25", "20a5"]) ok(`KH tahun "${y}" ditandai`, khAll({ ...khFull, year: y }).includes("year"));
ok("KH tanpa centang pernyataan ditandai", khAll({ ...khFull, declaration: false }).includes("declaration"));
ok("KH langkah pertama yang salah dipilih benar (tautan salah -> langkah 3)", firstKhStepWithErrors({ ...khFull, externalUrl: "doi.org" })?.step === 3);
console.log(`\n${pass}/${pass + fail} lulus`);
process.exit(fail ? 1 : 0);
