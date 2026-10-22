// ============================================================================
// Request a Training — wizard form ⇄ review_drafts payload (PB-ACA-06)
// ----------------------------------------------------------------------------
// One mapping for both directions so a revised request (return_for_revision →
// edit → resubmit) round-trips through the same shape the first submission
// used, and "My Training Requests" can show what was actually submitted.
// ============================================================================
import { z } from "zod";
import type { TrainingRequestDraft } from "@/lib/trainingRequests";

// UI-friendly funding label → canonical backend enum (training_needs.funding_preference).
// The public wizard never surfaces PNBP / tariff / NTPN wording.
const FUNDING_LABEL_TO_CODE: Record<string, string> = {
  "Government-funded / No Participant Charge": "government_funded",
  "Institution-Funded": "requesting_institution_funded",
  "Sponsor or Partner Funded": "sponsor_or_partner_funded",
  "Cost Sharing": "cost_sharing",
  "Participant-Funded": "participant_paid_potential_pnbp",
  "Scholarship or Approved Support": "scholarship_or_approved_support",
  "Funding Not Yet Determined": "not_yet_determined",
};
const FUNDING_CODE_TO_LABEL = Object.fromEntries(
  Object.entries(FUNDING_LABEL_TO_CODE).map(([label, code]) => [code, label]),
);

// UI attendance-format label → canonical delivery_preference enum.
const ATTENDANCE_TO_DELIVERY: Record<string, string> = {
  Online: "online",
  "In-Person": "in_person",
  Blended: "hybrid",
  Flexible: "no_preference",
};

export const TrainingRequestPayload = z.object({
  // Requester
  requesterType: z.string(),
  fullName: z.string().trim().min(1).max(200),
  position: z.string().max(200).optional().default(""),
  organization: z.string().max(300).optional().default(""),
  organizationType: z.string().max(100).optional().default(""),
  country: z.string().max(100).optional().default(""),
  email: z.string().trim().email().max(255),
  phone: z.string().max(60).optional().default(""),
  website: z.string().max(500).optional().default(""),
  // Training need
  trainingTopic: z.string().trim().min(1).max(300),
  trainingCategory: z.string().max(120).optional().default(""),
  objectives: z.string().max(4000).optional().default(""),
  needs: z.string().max(4000).optional().default(""),
  outcomes: z.string().max(4000).optional().default(""),
  challenges: z.string().max(4000).optional().default(""),
  currentCompetencyLevel: z.string().max(80).optional().default(""),
  desiredCompetencyLevel: z.string().max(80).optional().default(""),
  urgency: z.string().max(80).optional().default(""),
  supportingExplanation: z.string().max(4000).optional().default(""),
  // Participants
  targetAudience: z.string().max(120).optional().default(""),
  participantCount: z.string().max(60).optional().default(""),
  participantProfile: z.string().max(2000).optional().default(""),
  organizationalLevel: z.string().max(120).optional().default(""),
  geographicContext: z.string().max(200).optional().default(""),
  // Learning approach (required)
  preferredLearningApproach: z.enum(["self_paced", "facilitated"]),
  participantChargePreference: z
    .enum(["no_participant_charge", "to_be_determined", ""])
    .optional()
    .default(""),
  // Facilitated-only
  deliveryPreference: z.string().max(120).optional().default(""),
  attendanceFormat: z.string().max(60).optional().default(""),
  duration: z.string().max(60).optional().default(""),
  trainingPeriod: z.string().max(200).optional().default(""),
  language: z.string().max(60).optional().default(""),
  location: z.string().max(200).optional().default(""),
  fundingPreference: z.string().max(120).optional().default(""),
  supportRequested: z.array(z.string().max(80)).max(20).optional().default([]),
  existingPartners: z.string().max(1000).optional().default(""),
  remarks: z.string().max(4000).optional().default(""),
});

export type TrainingRequestPayloadInput = z.infer<typeof TrainingRequestPayload>;

/** The patch merged into the training_need draft (keys follow training_needs columns). */
export function buildTrainingNeedPatch(data: TrainingRequestPayloadInput) {
  const fundingCode = FUNDING_LABEL_TO_CODE[data.fundingPreference] ?? null;
  const deliveryCode =
    data.preferredLearningApproach === "self_paced"
      ? "self_paced"
      : (ATTENDANCE_TO_DELIVERY[data.attendanceFormat] ?? null);

  const chargePreference =
    data.preferredLearningApproach !== "facilitated"
      ? "no_participant_charge"
      : fundingCode === "government_funded"
        ? "no_participant_charge"
        : (data.participantChargePreference || "to_be_determined");

  return {
    title: data.trainingTopic,
    summary: data.objectives,
    target_participants: data.targetAudience,
    competency_gap: data.needs,
    proposed_topics: data.trainingCategory ? [data.trainingCategory] : [],
    geographic_focus: data.country ? [data.country] : [],
    delivery_preference: deliveryCode,
    requester_selected_learning_path: data.preferredLearningApproach,
    self_paced_alternative_found: false,
    funding_preference: fundingCode,
    participant_charge_preference: chargePreference,
    logistics_requirements: {
      preferred_delivery: data.deliveryPreference || null,
      attendance_format: data.attendanceFormat || null,
      duration: data.duration || null,
      training_period: data.trainingPeriod || null,
      language: data.language || null,
      location: data.location || null,
      support_requested: data.supportRequested,
      existing_partners: data.existingPartners || null,
      remarks: data.remarks || null,
    },
    metadata: {
      requester: {
        type: data.requesterType,
        full_name: data.fullName,
        position: data.position,
        organization: data.organization,
        organization_type: data.organizationType,
        country: data.country,
        email: data.email,
        phone: data.phone,
        website: data.website,
      },
      training_need: {
        expected_outcomes: data.outcomes,
        current_challenges: data.challenges,
        current_competency: data.currentCompetencyLevel,
        desired_competency: data.desiredCompetencyLevel,
        urgency: data.urgency,
        supporting_explanation: data.supportingExplanation,
      },
      participants: {
        count: data.participantCount,
        profile: data.participantProfile,
        organizational_level: data.organizationalLevel,
        geographic_context: data.geographicContext,
      },
    },
  };
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const first = (v: unknown): string => (Array.isArray(v) ? str(v[0]) : "");

/** Rebuild the wizard form from a stored payload (latest revision or the open revision draft). */
export function payloadToRequestForm(payload: unknown): TrainingRequestDraft {
  const p = obj(payload);
  const logistics = obj(p.logistics_requirements);
  const meta = obj(p.metadata);
  const requester = obj(meta.requester);
  const need = obj(meta.training_need);
  const participants = obj(meta.participants);
  const approach = str(p.requester_selected_learning_path);
  const charge = str(p.participant_charge_preference);
  const support = Array.isArray(logistics.support_requested)
    ? logistics.support_requested.map(str).filter(Boolean)
    : [];

  return {
    requesterType: (str(requester.type) || "Organization / Institution") as TrainingRequestDraft["requesterType"],
    fullName: str(requester.full_name),
    position: str(requester.position),
    organization: str(requester.organization),
    organizationType: str(requester.organization_type),
    country: str(requester.country) || first(p.geographic_focus),
    email: str(requester.email),
    phone: str(requester.phone),
    website: str(requester.website),
    trainingTopic: str(p.title),
    trainingCategory: first(p.proposed_topics),
    objectives: str(p.summary),
    needs: str(p.competency_gap),
    outcomes: str(need.expected_outcomes),
    challenges: str(need.current_challenges),
    currentCompetencyLevel: str(need.current_competency),
    desiredCompetencyLevel: str(need.desired_competency),
    urgency: str(need.urgency),
    supportingExplanation: str(need.supporting_explanation),
    targetAudience: str(p.target_participants),
    participantCount: str(participants.count),
    participantProfile: str(participants.profile),
    organizationalLevel: str(participants.organizational_level),
    geographicContext: str(participants.geographic_context),
    preferredLearningApproach: approach === "self_paced" || approach === "facilitated" ? approach : "",
    participantChargePreference:
      approach === "facilitated" && (charge === "no_participant_charge" || charge === "to_be_determined")
        ? charge
        : "",
    deliveryPreference: str(logistics.preferred_delivery),
    attendanceFormat: str(logistics.attendance_format),
    duration: str(logistics.duration),
    trainingPeriod: str(logistics.training_period),
    language: str(logistics.language),
    location: str(logistics.location),
    fundingPreference: FUNDING_CODE_TO_LABEL[str(p.funding_preference)] ?? "",
    supportRequested: support,
    existingPartners: str(logistics.existing_partners),
    remarks: str(logistics.remarks),
    competencyLevel: "",
    deliveryMode: "",
    fundingStatus: "",
  };
}
