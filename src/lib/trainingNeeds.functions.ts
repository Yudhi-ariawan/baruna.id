// ============================================================================
// BARUNA — Training Needs intake server functions (Phase 1.3)
// ----------------------------------------------------------------------------
// Thin wrapper over the atomic `training_need_draft_*` SECURITY DEFINER RPCs.
// The wizard submits an entire request in one call: create → update → submit.
// All privileged state transitions happen inside the RPCs; this file only
// orchestrates the three-step handshake and maps UI labels to backend codes.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

// UI attendance-format label → canonical delivery_preference enum.
const ATTENDANCE_TO_DELIVERY: Record<string, string> = {
  Online: "online",
  "In-Person": "in_person",
  Blended: "hybrid",
  Flexible: "no_preference",
};

const RequestPayload = z.object({
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

export type TrainingNeedRequestPayload = z.infer<typeof RequestPayload>;

/**
 * Submit a training request from the public wizard. Runs the full
 * draft_create → draft_update → draft_submit RPC pipeline atomically from the
 * caller's perspective, returning the resulting governance subject id.
 */
export const submitTrainingNeedRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RequestPayload.parse(d))
  .handler(async ({ data, context }) => {
    // 1) Create empty draft.
    const { data: draftId, error: e1 } = await context.supabase.rpc(
      "training_need_draft_create",
      { _title: data.trainingTopic, _source_type: "external_submission" },
    );
    if (e1 || !draftId) throw new Error(e1?.message ?? "Failed to create draft");

    // 2) Build the canonical patch. Only whitelisted keys are hydrated by the
    //    publish RPC — extra keys are safely ignored, but we keep the shape
    //    close to `training_needs` column names for auditability.
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

    const patch = {
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

    // 3) Merge the payload into the draft.
    const { error: e2 } = await context.supabase.rpc("training_need_draft_update", {
      _draft_id: draftId,
      _patch: patch,
    });
    if (e2) throw new Error(e2.message);

    // 4) Submit the draft into the governance workflow.
    const { data: subjectId, error: e3 } = await context.supabase.rpc(
      "training_need_draft_submit",
      { _draft_id: draftId },
    );
    if (e3 || !subjectId) throw new Error(e3?.message ?? "Failed to submit draft");

    return { draftId: draftId as string, subjectId: subjectId as string };
  });
