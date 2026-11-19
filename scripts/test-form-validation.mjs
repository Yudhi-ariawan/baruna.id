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

// ===== Trainer: pengajuan modul (CATATAN_PERBAIKAN 2bm) =====
console.log("\n== Trainer: pengajuan modul ==");
const { moduleStepErrors, firstModuleStepWithErrors, moduleTitleError, quizProblems } = await jiti.import("@/components/baruna/experts/submit-module/validation");
const modFull = {
  title: "Marine Protected Area Management", topic: "Konservasi", competency: "Zonasi", deliveryFormat: "Self-paced", hours: 8,
  level: "Intermediate", language: "Bahasa Indonesia", summary: "Ringkasan.", targetParticipants: "Peneliti", objectives: "1. Memahami",
  outcomes: "Mampu merancang", assessment: "Kuis", passingScore: 70, copyrightHolder: "Budi", licensing: "CC BY-NC-SA 4.0",
};
const q = (o = {}) => ({ id: 1, question: "Apa itu MPA?", options: ["A", "B", "", ""], correctAnswer: 0, ...o });
const modAll = (f, quiz = [], decl = true) => [1, 2, 4].flatMap((st) => Object.keys(moduleStepErrors(st, f, quiz, decl, true)));
ok("modul lengkap: tidak ada yang ditandai", firstModuleStepWithErrors(modFull, [q()], true, true) === null);
// Server/database title rule: 3-240 after trimming (ModuleSubmission + trainer_module_save).
const serverTitleOk = (t) => t.trim().length >= 3 && t.trim().length <= 240;
for (const t of ["", "AB", "  AB  ", "ABC", "a".repeat(240), "a".repeat(241)]) {
  ok(`modul judul ${t.length} karakter: layar ${moduleTitleError(t, true) ? "menandai" : "menerima"} sama dengan server`,
    Boolean(moduleTitleError(t, true)) === !serverTitleOk(t));
}
ok("modul kosong: langkah 1 menandai judul, topik, kompetensi, bahasa, target, ringkasan",
  ["title", "topic", "competency", "language", "targetParticipants", "summary"].every((k) => k in moduleStepErrors(1, { ...modFull, title: "", topic: "", competency: "", language: "", targetParticipants: "", summary: "" }, [], true, true)));
ok("modul jam 0 ditandai", modAll({ ...modFull, hours: 0 }).includes("hours"));
ok("modul nilai kelulusan 101 ditandai", modAll({ ...modFull, passingScore: 101 }).includes("passingScore"));
ok("modul tanpa tujuan/capaian/metode ditandai", ["objectives", "outcomes", "assessment"].every((k) => modAll({ ...modFull, objectives: "", outcomes: " ", assessment: "" }).includes(k)));
ok("modul soal tanpa teks ditandai", quizProblems([q({ question: " " })], true).length === 1);
ok("modul soal dengan 1 pilihan ditandai", quizProblems([q({ options: ["A", "", "", ""] })], true).length === 1);
ok("modul kunci jawaban ke pilihan kosong ditandai", quizProblems([q({ correctAnswer: 3 })], true)[0]?.includes("kunci jawaban"));
ok("modul pesan kuis menyebut nomor soal", modAll(modFull, [q(), q({ question: "" })]).includes("quiz") &&
  moduleStepErrors(2, modFull, [q(), q({ question: "" })], true, true).quiz.includes("Soal #2"));
ok("modul tanpa kuis: lolos (kuis opsional)", !modAll(modFull, []).includes("quiz"));
ok("modul pemegang hak cipta kosong ditandai (dulu bertanda wajib tapi tidak dicek)", modAll({ ...modFull, copyrightHolder: "" }).includes("copyrightHolder"));
ok("modul pernyataan belum dicentang ditandai", modAll(modFull, [], false).includes("declarations"));
ok("modul langkah pertama yang salah: kuis -> langkah 2", firstModuleStepWithErrors(modFull, [q({ question: "" })], true, true)?.step === 2);

// ===== Portal Admin: Tambah User (CATATAN_PERBAIKAN 2bm) =====
console.log("\n== Portal Admin: Tambah User ==");
const { z } = await import("zod");
const { createUserErrors, emailTakenMessage } = await jiti.import("@/components/admin/users/create-user-validation");
// Same schema as createUser (src/lib/admin/users.functions.ts).
const CreateUserServer = z.object({
  email: z.string().trim().email().max(254), password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(120), organization: z.string().trim().max(160).optional(),
  jobTitle: z.string().trim().max(120).optional(), phone: z.string().trim().max(40).optional(), roles: z.array(z.string()).min(1),
});
const userFull = { displayName: "Dr. Budi", email: "budi@kkp.go.id", password: "Rahasia123", organization: "KKP", jobTitle: "Staf", phone: "+6281", roles: ["registered_user"] };
const screenOk = (f) => Object.keys(createUserErrors(f)).length === 0;
const serverOk = (f) => CreateUserServer.safeParse({ ...f, organization: f.organization || undefined, jobTitle: f.jobTitle || undefined, phone: f.phone || undefined }).success;
const userCases = [
  ["lengkap", {}], ["nama kosong", { displayName: "" }], ["nama 1 huruf", { displayName: "B" }], ["nama 121", { displayName: "a".repeat(121) }],
  ["email kosong", { email: "" }], ["email salah", { email: "budi@" }], ["email 255", { email: `${"a".repeat(245)}@kkp.go.id` }],
  ["sandi 7", { password: "1234567" }], ["sandi 8", { password: "12345678" }], ["sandi 129", { password: "a".repeat(129) }],
  ["institusi 161", { organization: "a".repeat(161) }], ["jabatan 121", { jobTitle: "a".repeat(121) }], ["telepon 41", { phone: "1".repeat(41) }],
  ["tanpa peran", { roles: [] }], ["institusi kosong (opsional)", { organization: "" }],
];
for (const [name, patch] of userCases) {
  const f = { ...userFull, ...patch };
  ok(`Tambah User ${name}: layar ${screenOk(f) ? "menerima" : "menandai"} sama dengan server`, screenOk(f) === serverOk(f));
}
ok("Tambah User email sudah terdaftar dipetakan ke kolom email", Boolean(emailTakenMessage("A user with this email address has already been registered")));
ok("Tambah User error lain tidak dipetakan ke email", emailTakenMessage("role_assignment_forbidden") === null);

// ===== Pendaftaran Full Training (CATATAN_PERBAIKAN 2bm) =====
console.log("\n== Pendaftaran Full Training ==");
const { applyFormErrors } = await jiti.import("@/components/baruna/academy/apply-validation");
const pFull = { fullName: "Amina Bello", gender: "Female", nationality: "Nigerian", dob: "", passportNumber: "", email: "amina@fish.ng", phone: "+234" };
const prFull = { organization: "NIOMR", position: "Researcher", country: "Nigeria", experience: "6–10 years", sector: "" };
const motiv = "Saya ingin belajar budidaya.";
ok("Full Training lengkap: tidak ada yang ditandai", Object.keys(applyFormErrors(pFull, prFull, "Intermediate", motiv)).length === 0);
const emptyP = Object.fromEntries(Object.keys(pFull).map((k) => [k, ""]));
const emptyPr = Object.fromEntries(Object.keys(prFull).map((k) => [k, ""]));
const eEmpty = applyFormErrors(emptyP, emptyPr, "", "");
ok("Full Training kosong: 11 isian wajib ditandai",
  ["fullName", "gender", "nationality", "email", "phone", "organization", "position", "country", "experience", "english", "motivation"].every((k) => k in eEmpty) && Object.keys(eEmpty).length === 11);
ok("Full Training kolom opsional tidak ditandai", !["dob", "passportNumber", "sector"].some((k) => k in eEmpty));
ok("Full Training email salah ditandai", "email" in applyFormErrors({ ...pFull, email: "amina@" }, prFull, "Basic", motiv));
ok("Full Training motivasi 10 karakter ditandai (aturan lama: lebih dari 10)", "motivation" in applyFormErrors(pFull, prFull, "Basic", "a".repeat(10)));
ok("Full Training motivasi 11 karakter diterima", !("motivation" in applyFormErrors(pFull, prFull, "Basic", "a".repeat(11))));
ok("Full Training motivasi 1.001 karakter ditandai (server menyimpan maks. 1.000)", "motivation" in applyFormErrors(pFull, prFull, "Basic", "a".repeat(1001)));
// ---- Dynamic CMS (CATATAN_PERBAIKAN 2br, 2bs): screen rules = database rules of _cms_block_problem
console.log("\n== Dynamic CMS ==");
const { pageErrors, urlOk } = await jiti.import("@/lib/cms/cms-validation");
const { cmsMarkdownLines } = await jiti.import("@/lib/cms/cms-markdown");
const IMG = "cms/" + "b".repeat(32) + ".png";
const cmsPage = (blocks) => ({ domain: "about", slug: "uji-halaman", title_id: "Halaman Uji", title_en: "", summary_id: "", summary_en: "", blocks });
const pe = (blocks) => pageErrors(cmsPage(blocks), { isNew: true, usedSlugs: [], formSlugs: [] });
ok("CMS: halaman tanpa blok ditandai", "blocks" in pe([]));
ok("CMS: tautan javascript: di tombol ajakan ditandai", "block.0.url" in pe([{ type: "cta", title_id: "Ayo", button_id: "Klik", url: "javascript:alert(1)" }]));
ok("CMS: tautan http:// (tanpa s) ditolak, https:// dan /academy diterima", !urlOk("http://kkp.go.id") && urlOk("https://kkp.go.id") && urlOk("/academy"));
ok("CMS: slug menu lain (community) untuk menu About ditandai", "slug" in pageErrors({ ...cmsPage([{ type: "text", body_id: "Isi" }]), slug: "community" }, { isNew: true, usedSlugs: [], formSlugs: [] }));
ok("CMS teks+gambar: tanpa gambar ditandai di kolom gambar", "block.0.image" in pe([{ type: "media", body_id: "Isi", image: null }]));
ok("CMS teks+gambar: tanpa isi ditandai", "block.0.body_id" in pe([{ type: "media", body_id: "", image: IMG }]));
ok("CMS teks+gambar lengkap diterima", Object.keys(pe([{ type: "media", body_id: "Isi", image: IMG, image_side: "left" }])).length === 0);
ok("CMS galeri: > 8 foto ditandai", "block.0.items" in pe([{ type: "gallery", items: Array.from({ length: 9 }, () => ({ image: IMG })) }]));
ok("CMS galeri: foto tanpa gambar ditandai", "block.0.items.1.image" in pe([{ type: "gallery", items: [{ image: IMG }, { image: null }] }]));
ok("CMS galeri: keterangan 161 karakter ditandai", "block.0.items.0.caption_id" in pe([{ type: "gallery", items: [{ image: IMG, caption_id: "x".repeat(161) }] }]));
ok("CMS galeri lengkap diterima", Object.keys(pe([{ type: "gallery", items: [{ image: IMG, caption_id: "Laut" }, { image: IMG }] }])).length === 0);
ok("CMS teks: baris setelah daftar menjadi paragraf sendiri", cmsMarkdownLines("- satu\n- dua\nKunjungi kami.") === "- satu\n- dua\n\nKunjungi kami.");
ok("CMS teks: dua baris biasa tetap dua baris", cmsMarkdownLines("Baris satu\nBaris dua") === "Baris satu  \nBaris dua");
ok("CMS teks: lanjutan menjorok tetap di poin daftar", cmsMarkdownLines("- poin\n  lanjutan") === "- poin\n  lanjutan");
console.log(`\n${pass}/${pass + fail} lulus`);
process.exit(fail ? 1 : 0);
