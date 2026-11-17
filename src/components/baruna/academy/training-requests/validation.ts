// Field-level checks for the Request a Training wizard, per step. The required
// fields are the wizard's own rules; the lengths and the e-mail format are the same
// as the server schema (TrainingRequestPayload), which stays the authority.
import { z } from "zod";
import type { TrainingRequestDraft } from "@/lib/trainingRequests";

export type FieldErrors = Partial<Record<keyof TrainingRequestDraft, string>>;
type Key = keyof TrainingRequestDraft;

const EMAIL = z.string().trim().email();

export const TRAINING_REQUEST_LABELS: Record<string, string> = {
  requesterType: "Requester Type", fullName: "Full Name", position: "Position", organization: "Organization",
  organizationType: "Organization Type", country: "Country", email: "Email", phone: "Phone Number", website: "Website",
  trainingTopic: "Training Topic", trainingCategory: "Training Category", objectives: "Training Objectives",
  needs: "Learning need / competency gap", outcomes: "Expected Learning Outcomes", challenges: "Current challenges",
  currentCompetencyLevel: "Current Competency", desiredCompetencyLevel: "Desired Competency",
  supportingExplanation: "Supporting explanation", targetAudience: "Intended for", organizationalLevel: "Organizational level",
  participantProfile: "Participant profile", geographicContext: "Geographic context",
  preferredLearningApproach: "Learning Approach", trainingPeriod: "Training period", fundingPreference: "Funding Source",
  existingPartners: "Partners", remarks: "Additional remarks",
};

export function trainingRequestStepErrors(step: number, d: TrainingRequestDraft): FieldErrors {
  const e: FieldErrors = {};
  const individual = d.requesterType === "Individual";
  const need = (k: Key, msg: string) => {
    const v = d[k];
    if (typeof v === "string" && !v.trim()) e[k] = msg;
  };
  const max = (k: Key, n: number) => {
    const v = d[k];
    if (!e[k] && typeof v === "string" && v.length > n) e[k] = `Maximum ${n.toLocaleString("en")} characters (now ${v.length.toLocaleString("en")}).`;
  };

  if (step === 1) {
    need("requesterType", "Choose who is requesting.");
    need("fullName", "Enter your full name.");
    need("email", "Enter your e-mail address.");
    if (!e.email && !EMAIL.safeParse(d.email).success) e.email = "Enter a valid e-mail address, e.g. name@example.org.";
    need("country", "Enter the country.");
    if (!individual) {
      need("organization", "Enter the organization name.");
      need("organizationType", "Choose the organization type.");
    }
    max("fullName", 200); max("position", 200); max("organization", 300); max("country", 100);
    max("email", 255); max("phone", 60); max("website", 500);
  }
  if (step === 2) {
    need("trainingTopic", "Enter the training topic.");
    need("trainingCategory", "Choose a training category.");
    need("objectives", "Describe the training objectives.");
    need("needs", "Describe the learning need or competency gap.");
    need("currentCompetencyLevel", "Choose the current competency level.");
    need("desiredCompetencyLevel", "Choose the desired competency level.");
    max("trainingTopic", 300); max("objectives", 4000); max("needs", 4000); max("outcomes", 4000);
    max("challenges", 4000); max("supportingExplanation", 4000);
  }
  if (step === 3) {
    if (!individual) need("targetAudience", "Choose who the training is intended for.");
    max("organizationalLevel", 120); max("participantProfile", 2000); max("geographicContext", 200);
  }
  if (step === 4) need("preferredLearningApproach", "Choose a learning approach.");
  if (step === 5 && d.preferredLearningApproach === "facilitated") {
    need("fundingPreference", "Choose the proposed funding source.");
    max("trainingPeriod", 200); max("existingPartners", 1000); max("remarks", 4000);
  }
  // Same order as on screen (the labels list follows the form), for the summary.
  const order = Object.keys(TRAINING_REQUEST_LABELS);
  const sorted: FieldErrors = {};
  for (const k of (Object.keys(e) as Key[]).sort((a, b) => order.indexOf(a) - order.indexOf(b))) sorted[k] = e[k];
  return sorted;
}

/** First step (1-5) that still has a field to fix, with its errors; null when all are fine. */
export function firstStepWithErrors(d: TrainingRequestDraft): { step: number; errors: FieldErrors } | null {
  for (let step = 1; step <= 5; step++) {
    const errors = trainingRequestStepErrors(step, d);
    if (Object.keys(errors).length) return { step, errors };
  }
  return null;
}
