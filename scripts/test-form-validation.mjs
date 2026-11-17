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
console.log(`\n${pass}/${pass + fail} lulus`);
process.exit(fail ? 1 : 0);
