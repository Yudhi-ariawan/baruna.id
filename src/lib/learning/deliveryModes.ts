// ============================================================================
// BARUNA Learning Architecture — Delivery Modes
// ----------------------------------------------------------------------------
// Delivery Mode defines HOW an offering is organised and delivered. It is
// independent of the Learning Template. Any valid template × delivery mode
// combination is allowed (§5).
// ============================================================================

import type { MenuItemId } from "./templates";

export type DeliveryModeId =
  | "open-self-paced"
  | "approved-self-paced"
  | "cohort-guided"
  | "blended-cohort"
  | "live-webinar";

export interface DeliveryMode {
  id: DeliveryModeId;
  name: string;
  description: string;
  /** Feature flags used by the shared dashboard to decide what to render. */
  features: {
    application: boolean;
    invitationOnly: boolean;
    schedule: boolean;
    trainer: boolean;
    attendance: boolean;
    announcements: boolean;
    discussion: boolean;
    liveSessions: boolean;
    inPerson: boolean;
    travel: boolean;
    accessExpiry: boolean;
  };
  /** Menu items always added by this delivery mode. */
  extraMenu: ReadonlyArray<MenuItemId>;
}

export const DELIVERY_MODES: Record<DeliveryModeId, DeliveryMode> = {
  "open-self-paced": {
    id: "open-self-paced",
    name: "Open Self-Paced",
    description: "Open enrolment, individual learning, no fixed cohort or trainer.",
    features: {
      application: false,
      invitationOnly: false,
      schedule: false,
      trainer: false,
      attendance: false,
      announcements: false,
      discussion: false,
      liveSessions: false,
      inPerson: false,
      travel: false,
      accessExpiry: true,
    },
    extraMenu: [],
  },
  "approved-self-paced": {
    id: "approved-self-paced",
    name: "Approved Self-Paced",
    description: "Individual learning after application/approval or invitation.",
    features: {
      application: true,
      invitationOnly: false,
      schedule: false,
      trainer: false,
      attendance: false,
      announcements: true,
      discussion: false,
      liveSessions: false,
      inPerson: false,
      travel: false,
      accessExpiry: true,
    },
    extraMenu: ["announcements"],
  },
  "cohort-guided": {
    id: "cohort-guided",
    name: "Cohort Guided",
    description:
      "Approved participants learn in a supervised cohort with trainer, schedule, attendance and discussion.",
    features: {
      application: true,
      invitationOnly: true,
      schedule: true,
      trainer: true,
      attendance: true,
      announcements: true,
      discussion: true,
      liveSessions: true,
      inPerson: false,
      travel: false,
      accessExpiry: true,
    },
    extraMenu: ["schedule", "live-sessions", "announcements", "discussion"],
  },
  "blended-cohort": {
    id: "blended-cohort",
    name: "Blended Cohort",
    description:
      "Cohort Guided plus in-person sessions, field visits and travel logistics.",
    features: {
      application: true,
      invitationOnly: true,
      schedule: true,
      trainer: true,
      attendance: true,
      announcements: true,
      discussion: true,
      liveSessions: true,
      inPerson: true,
      travel: true,
      accessExpiry: true,
    },
    extraMenu: [
      "schedule",
      "live-sessions",
      "announcements",
      "discussion",
      "in-person",
      "travel",
    ],
  },
  "live-webinar": {
    id: "live-webinar",
    name: "Live Webinar or Workshop",
    description: "Scheduled live sessions with registration and attendance.",
    features: {
      application: false,
      invitationOnly: false,
      schedule: true,
      trainer: true,
      attendance: true,
      announcements: false,
      discussion: false,
      liveSessions: true,
      inPerson: false,
      travel: false,
      accessExpiry: false,
    },
    extraMenu: ["schedule", "live-sessions"],
  },
};

export function getDeliveryMode(id: DeliveryModeId): DeliveryMode {
  return DELIVERY_MODES[id];
}
