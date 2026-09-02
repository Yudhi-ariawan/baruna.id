/**
 * BARUNA canonical Course Offering classification (Phase 1.4 Increment 1).
 *
 * These are the ONLY approved user-facing labels. "Hybrid" is forbidden —
 * the canonical delivery format for mixed online + in-person delivery is
 * "Blended".
 */

export type LearningModel = "self_paced" | "cohort_based";
export type DeliveryFormat = "fully_online" | "blended" | "in_person";
export type EnrolmentAccessRule =
  | "open"
  | "registered"
  | "approval_required"
  | "entitlement_required";

export const LEARNING_MODEL_LABEL: Record<LearningModel, string> = {
  self_paced: "Self-Paced",
  cohort_based: "Cohort-Based",
};

export const DELIVERY_FORMAT_LABEL: Record<DeliveryFormat, string> = {
  fully_online: "Fully Online",
  blended: "Blended",
  in_person: "In-Person",
};

export const ENROLMENT_ACCESS_RULE_LABEL: Record<EnrolmentAccessRule, string> = {
  open: "Open Access",
  registered: "Registered Users",
  approval_required: "Approval Required",
  entitlement_required: "Entitlement Required",
};

export function learningModelLabel(v?: LearningModel | null) {
  return v ? LEARNING_MODEL_LABEL[v] : "—";
}

export function deliveryFormatLabel(v?: DeliveryFormat | null) {
  return v ? DELIVERY_FORMAT_LABEL[v] : "—";
}

export function enrolmentAccessRuleLabel(v?: EnrolmentAccessRule | null) {
  return v ? ENROLMENT_ACCESS_RULE_LABEL[v] : "—";
}

/**
 * Self-Paced access model (Phase 1.4 Increment 2).
 *
 * Applies ONLY to self_paced + fully_online offerings. It is a separate domain
 * from `EnrolmentAccessRule` (who may enrol) and from the Cohort financial
 * model (cohort offerings are never labelled Free).
 */
export type SelfPacedAccessModel = "free" | "paid" | "free_to_learn";

export const SELF_PACED_ACCESS_MODEL_LABEL: Record<SelfPacedAccessModel, string> = {
  free: "Free",
  paid: "Paid",
  free_to_learn: "Free to Learn",
};

/** Secondary explanatory line shown under the label. No amounts are implied. */
export const SELF_PACED_ACCESS_MODEL_HINT: Record<SelfPacedAccessModel, string> = {
  free: "Free access to learning and certificate.",
  paid: "Paid access.",
  free_to_learn: "Certificate Available for a Fee",
};

export function selfPacedAccessModelLabel(v?: SelfPacedAccessModel | null) {
  return v ? SELF_PACED_ACCESS_MODEL_LABEL[v] : "—";
}

export function selfPacedAccessModelHint(v?: SelfPacedAccessModel | null) {
  return v ? SELF_PACED_ACCESS_MODEL_HINT[v] : "";
}

/** The access model is only meaningful for self-paced, fully online offerings. */
export function isSelfPacedAccessModelApplicable(
  learningModel?: LearningModel | null,
  deliveryFormat?: DeliveryFormat | null,
) {
  return learningModel === "self_paced" && deliveryFormat === "fully_online";
}

/**
 * Resolve what to display for an offering. Cohort-based offerings return null —
 * they must never be labelled Free.
 */
export function resolveSelfPacedAccessModelDisplay(
  learningModel?: LearningModel | null,
  deliveryFormat?: DeliveryFormat | null,
  accessModel?: SelfPacedAccessModel | null,
): { label: string; hint: string } | null {
  if (!isSelfPacedAccessModelApplicable(learningModel, deliveryFormat)) return null;
  if (!accessModel) return null;
  return {
    label: SELF_PACED_ACCESS_MODEL_LABEL[accessModel],
    hint: SELF_PACED_ACCESS_MODEL_HINT[accessModel],
  };
}

/**
 * Cohort financial model (Phase 1.4 Increment 3).
 *
 * Internal institutional classification for Cohort-Based offerings only.
 * It records that the offering carries a cost — it does NOT record who pays,
 * any amount, currency, tariff, or billing mechanism. Cohort offerings are
 * never labelled Free.
 */
export type CohortFinancialModel = "fee_based";

export const COHORT_FINANCIAL_MODEL_LABEL: Record<CohortFinancialModel, string> = {
  fee_based: "Fee-Based",
};

export const COHORT_FINANCIAL_MODEL_HINT: Record<CohortFinancialModel, string> = {
  fee_based: "This cohort offering carries a cost. Payer responsibility is recorded separately.",
};

export function cohortFinancialModelLabel(v?: CohortFinancialModel | null) {
  return v ? COHORT_FINANCIAL_MODEL_LABEL[v] : "—";
}

export function cohortFinancialModelHint(v?: CohortFinancialModel | null) {
  return v ? COHORT_FINANCIAL_MODEL_HINT[v] : "";
}

/** The cohort financial model is only meaningful for cohort-based offerings. */
export function isCohortFinancialModelApplicable(learningModel?: LearningModel | null) {
  return learningModel === "cohort_based";
}

/**
 * Cohort payment responsibility (Phase 1.4 Increment 4).
 *
 * Records WHO is expected to cover or arrange the participation fee of a
 * fee-based Cohort-Based offering. It records responsibility only — never an
 * amount, tariff, invoice, billing mechanism, or payment state.
 */
export type CohortPaymentResponsibility =
  | "participant"
  | "institution"
  | "sponsor_or_partner"
  | "government_or_public_funding"
  | "cost_sharing"
  | "to_be_determined";

/** Internal (admin / management) classification labels. */
export const COHORT_PAYMENT_RESPONSIBILITY_LABEL: Record<CohortPaymentResponsibility, string> = {
  participant: "Participant",
  institution: "Institution",
  sponsor_or_partner: "Sponsor or Partner",
  government_or_public_funding: "Government or Public Funding",
  cost_sharing: "Cost Sharing",
  to_be_determined: "To Be Determined",
};

/** Participant-facing labels. Mirrors public.cohort_payment_responsibility_public_label. */
export const COHORT_PAYMENT_RESPONSIBILITY_PUBLIC_LABEL: Record<
  CohortPaymentResponsibility,
  string
> = {
  participant: "Payment Required",
  institution: "Participation Fee Covered by Institution",
  sponsor_or_partner: "Sponsored Participation",
  government_or_public_funding: "Funded Participation",
  cost_sharing: "Cost Sharing",
  to_be_determined: "Funding Arrangement to Be Confirmed",
};

export function cohortPaymentResponsibilityLabel(v?: CohortPaymentResponsibility | null) {
  return v ? COHORT_PAYMENT_RESPONSIBILITY_LABEL[v] : "—";
}

/** Only fee-based cohort offerings carry a payment responsibility. */
export function isCohortPaymentResponsibilityApplicable(
  learningModel?: LearningModel | null,
  financialModel?: CohortFinancialModel | null,
) {
  return learningModel === "cohort_based" && financialModel === "fee_based";
}

/**
 * Resolve the participant-facing label. Returns null for self-paced offerings —
 * they are governed by the self-paced access model, never by payer responsibility.
 */
export function resolveCohortPaymentResponsibilityDisplay(
  learningModel?: LearningModel | null,
  financialModel?: CohortFinancialModel | null,
  responsibility?: CohortPaymentResponsibility | null,
): string | null {
  if (!isCohortPaymentResponsibilityApplicable(learningModel, financialModel)) return null;
  if (!responsibility) return null;
  return COHORT_PAYMENT_RESPONSIBILITY_PUBLIC_LABEL[responsibility];
}

/** Combined short descriptor, e.g. "Cohort-Based · Blended". */
export function classificationLabel(
  learningModel?: LearningModel | null,
  deliveryFormat?: DeliveryFormat | null,
) {
  return [learningModelLabel(learningModel), deliveryFormatLabel(deliveryFormat)]
    .filter((s) => s !== "—")
    .join(" · ");
}

/** Only self_paced + fully_online is valid; cohort_based allows any format. */
export function isValidClassificationCombo(
  learningModel: LearningModel,
  deliveryFormat: DeliveryFormat,
) {
  return learningModel === "cohort_based" || deliveryFormat === "fully_online";
}

export type VenueComponent = { label: string; value: string };
export type VenueRule = {
  physical_venue_required: boolean;
  components: VenueComponent[];
};

export const BARUNA_TRAINING_VENUE = "Denpasar, Bali, Indonesia";

/**
 * Mirrors the database function public.offering_venue_rule/2 so the UI and the
 * backend never disagree about which venue rows to display.
 */
export function offeringVenueRule(
  learningModel?: LearningModel | null,
  deliveryFormat?: DeliveryFormat | null,
): VenueRule {
  if (!learningModel || !deliveryFormat) {
    return { physical_venue_required: false, components: [] };
  }
  if (learningModel === "self_paced") {
    return { physical_venue_required: false, components: [] };
  }
  if (deliveryFormat === "fully_online") {
    return {
      physical_venue_required: false,
      components: [{ label: "Delivery Location", value: "Online" }],
    };
  }
  if (deliveryFormat === "in_person") {
    return {
      physical_venue_required: true,
      components: [{ label: "Training Location", value: BARUNA_TRAINING_VENUE }],
    };
  }
  return {
    physical_venue_required: true,
    components: [
      { label: "Online Component", value: "Online" },
      { label: "In-Person Component", value: BARUNA_TRAINING_VENUE },
    ],
  };
}
