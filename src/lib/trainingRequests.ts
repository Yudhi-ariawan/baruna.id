// ============================================================================
// BARUNA — Training Demand Management store (client-side, localStorage)
// ----------------------------------------------------------------------------
// Powers the "Request a Training" workflow, the "My Training Requests" tracker,
// and the per-request status timeline.
//
// Requests move through:
//   Submitted → Under Review → Needs Clarification → Approved → Scheduled →
//   Completed → Closed
//
// No backend required — everything persists in the browser.
// ============================================================================

import { useEffect, useState } from "react";
import { isPresentationMode, presentationReference } from "./demoMode";

const STORE_KEY = "baruna:training-requests";
const SEQ_KEY = "baruna:training-requests-seq";
const EVENT = "baruna:training-requests";

// ── Option lists ──────────────────────────────────────────────────────────────
export const REQUESTER_TYPES = [
  "Individual",
  "Organization / Institution",
  "Group / Community",
] as const;
export type RequesterType = (typeof REQUESTER_TYPES)[number];

// Public wizard exposes exactly two options. `undecided` (legacy
// `open_to_recommendation`) is intentionally NOT surfaced but the type keeps
// the value so historical records continue to type-check.
export const LEARNING_APPROACHES = [
  {
    key: "self_paced",
    label: "Self-Paced Learning",
    description:
      "Learning independently through online learning materials and activities when a suitable course becomes available.",
  },
  {
    key: "facilitated",
    label: "Facilitated Training",
    description:
      "Training supported by trainers, facilitators, schedules, classes, technical practice, or customized delivery.",
  },
] as const;
export type LearningApproach = "self_paced" | "facilitated" | "undecided";


export const PREFERRED_DELIVERY_OPTIONS = [
  "Cohort Guided",
  "Blended Cohort",
  "Live Webinar / Workshop",
  "Classroom or Technical Practice",
  "Customized Training",
  "To Be Determined",
] as const;

export const ATTENDANCE_FORMATS = ["Online", "In-Person", "Blended", "Flexible"] as const;

export const URGENCY_LEVELS = [
  "Low — flexible timing",
  "Medium — within this year",
  "High — within 3 months",
  "Critical — immediate need",
] as const;

export const ORGANIZATION_TYPES = [
  "Government",
  "University",
  "Research Institute",
  "NGO",
  "Development Partner",
  "Private Sector",
  "Community Organization",
  "International Organization",
  "Other",
] as const;

export const TRAINING_CATEGORIES = [
  "Fisheries Management",
  "Aquaculture",
  "Marine Conservation",
  "Blue Economy",
  "Climate Change",
  "Marine Spatial Planning",
  "Fish Processing",
  "Fish Health",
  "Fisheries Technology",
  "Ocean Literacy",
  "Coastal Community Development",
  "Monitoring, Control & Surveillance",
  "Leadership & Capacity Development",
  "Other",
] as const;

export const COMPETENCY_LEVELS = [
  "None / Beginner",
  "Basic",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;

export const TARGET_AUDIENCES = [
  "Government Officers",
  "Researchers",
  "Lecturers",
  "Students",
  "Community Leaders",
  "Fisher Groups",
  "Aquaculture Farmers",
  "Private Sector",
  "Mixed Participants",
] as const;

export const PARTICIPANT_COUNTS = [
  "1–10",
  "11–20",
  "21–50",
  "51–100",
  "More than 100",
] as const;

// "Blended" replaces the former "Hybrid" everywhere in the wizard.
export const DELIVERY_MODES = ["Online", "In-Person", "Blended"] as const;

export const DURATIONS = ["1 Day", "2–3 Days", "1 Week", "2 Weeks", "Flexible"] as const;

export const LANGUAGES = [
  "English",
  "Bahasa Indonesia",
  "French",
  "Spanish",
  "Other",
] as const;

// Public-facing Funding Preference options (facilitated training only).
// Contains NO PNBP / tariff / billing / NTPN wording. Public → backend code
// mapping lives in src/lib/trainingNeeds.functions.ts.
export const FUNDING_PREFERENCES = [
  "Government-funded / No Participant Charge",
  "Institution-Funded",
  "Sponsor or Partner Funded",
  "Cost Sharing",
  "Participant-Funded",
  "Scholarship or Approved Support",
  "Funding Not Yet Determined",
] as const;

// Legacy alias kept so historical seed rows still type-check.
export const FUNDING_STATUSES = FUNDING_PREFERENCES;

export const SUPPORT_OPTIONS = [
  "Curriculum Development",
  "Expert Recommendation",
  "Trainer",
  "Reviewer",
  "Mentor",
  "Technical Assistance",
  "Venue Arrangement",
  "Certification",
  "Learning Materials",
  "Travel Coordination",
  "Interpretation",
  "Other",
] as const;

// ── Status pipeline ─────────────────────────────────────────────────────────
export const REQUEST_STATUSES = [
  "Submitted",
  "Under Review",
  "Needs Clarification",
  "Approved",
  "Scheduled",
  "Completed",
  "Closed",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_STYLES: Record<RequestStatus, string> = {
  Submitted: "bg-badge-course/15 text-badge-course",
  "Under Review": "bg-badge-workshop/15 text-badge-workshop",
  "Needs Clarification": "bg-destructive/15 text-destructive",
  Approved: "bg-marine/15 text-marine",
  Scheduled: "bg-accent/20 text-accent-foreground",
  Completed: "bg-eco-community/15 text-eco-community",
  Closed: "bg-muted text-foreground/70",
};

// ── Status timeline ───────────────────────────────────────────────────────────
export const TIMELINE_STAGES = [
  "Submitted",
  "Initial Review",
  "Expert Assessment",
  "Coordination",
  "Approved",
  "Training Scheduled",
  "Completed",
] as const;
export type TimelineStage = (typeof TIMELINE_STAGES)[number];

/** Maps the current status to how far along the 7-stage timeline it has reached. */
export function timelineReachedIndex(status: RequestStatus): number {
  switch (status) {
    case "Submitted":
      return 0;
    case "Needs Clarification":
    case "Under Review":
      return 2;
    case "Approved":
      return 4;
    case "Scheduled":
      return 5;
    case "Completed":
    case "Closed":
      return 6;
    default:
      return 0;
  }
}

// ── Model ─────────────────────────────────────────────────────────────────────
export type TrainingRequest = {
  id: string;
  reference: string;
  // Requester
  requesterType: RequesterType;
  fullName: string;
  position: string;
  organization: string;
  organizationType: string;
  country: string;
  email: string;
  phone: string;
  website: string;
  // Training need
  trainingTopic: string;
  trainingCategory: string;
  objectives: string;
  needs: string;
  outcomes: string;
  challenges: string;
  currentCompetencyLevel: string;
  desiredCompetencyLevel: string;
  urgency: string;
  supportingExplanation: string;
  // Learner / Participants
  targetAudience: string;
  participantCount: string;
  participantProfile: string;
  organizationalLevel: string;
  geographicContext: string;
  // Preferred learning approach
  preferredLearningApproach: LearningApproach | "";
  participantChargePreference: "" | "no_participant_charge" | "to_be_determined";
  // Facilitated-only
  deliveryPreference: string;
  attendanceFormat: string;
  duration: string;
  trainingPeriod: string;
  language: string;
  location: string;
  fundingPreference: string;
  supportRequested: string[];
  existingPartners: string;
  remarks: string;
  // Legacy fields kept for backward compat with seed rows and older UI.
  competencyLevel: string;
  deliveryMode: string;
  fundingStatus: string;
  // System
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type TrainingRequestDraft = Omit<
  TrainingRequest,
  "id" | "reference" | "status" | "createdAt" | "updatedAt"
>;

export const emptyTrainingDraft: TrainingRequestDraft = {
  requesterType: "Organization / Institution",
  fullName: "",
  position: "",
  organization: "",
  organizationType: "",
  country: "",
  email: "",
  phone: "",
  website: "",
  trainingTopic: "",
  trainingCategory: "",
  objectives: "",
  needs: "",
  outcomes: "",
  challenges: "",
  currentCompetencyLevel: "",
  desiredCompetencyLevel: "",
  urgency: "Medium — within this year",
  supportingExplanation: "",
  targetAudience: "",
  participantCount: "",
  participantProfile: "",
  organizationalLevel: "",
  geographicContext: "",
  preferredLearningApproach: "",
  participantChargePreference: "",
  deliveryPreference: "",
  attendanceFormat: "",
  duration: "",
  trainingPeriod: "",
  language: "English",
  location: "",
  fundingPreference: "",
  supportRequested: [],
  existingPartners: "",
  remarks: "",
  competencyLevel: "",
  deliveryMode: "",
  fundingStatus: "",
};

// ── Reference number ──────────────────────────────────────────────────────────
function nextSequence(): number {
  if (typeof window === "undefined") return 1;
  const current = Number(localStorage.getItem(SEQ_KEY) || "0") + 1;
  localStorage.setItem(SEQ_KEY, String(current));
  return current;
}

export function formatReference(seq: number, year = new Date().getFullYear()): string {
  return `BARUNA-TR-${year}-${String(seq).padStart(4, "0")}`;
}

export function genId(): string {
  return "tr-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

// ── Formatting helpers ────────────────────────────────────────────────────────
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Seed examples so the tracker is never empty ───────────────────────────────
function seedRequests(): TrainingRequest[] {
  const now = Date.now();
  const iso = (d: number) => new Date(now - d * 86400000).toISOString();
  const base = (over: Partial<TrainingRequest>): TrainingRequest => ({
    ...emptyTrainingDraft,
    id: genId(),
    reference: "",
    status: "Submitted",
    createdAt: iso(5),
    updatedAt: iso(5),
    ...over,
  });

  return [
    base({
      reference: "BARUNA-TR-2026-0003",
      fullName: "Dr. Amara Okonkwo",
      position: "Director of Capacity Development",
      organization: "Nigerian Federal Ministry of Fisheries",
      organizationType: "Government",
      country: "Nigeria",
      email: "a.okonkwo@fisheries.gov.ng",
      phone: "+234 803 555 0192",
      trainingTopic: "National Catfish Biofloc Aquaculture Programme",
      trainingCategory: "Aquaculture",
      objectives:
        "Equip extension officers with practical biofloc hatchery and grow-out skills for catfish.",
      needs:
        "We need a structured program covering hatchery management, water quality, feed formulation and biosecurity.",
      outcomes: "Officers able to set up and manage biofloc systems and train farmers nationally.",
      challenges: "Low survival rates and inconsistent feed quality in existing smallholder systems.",
      competencyLevel: "Intermediate",
      targetAudience: "Government Officers",
      participantCount: "21–50",
      participantProfile: "Fisheries extension officers from all 36 states.",
      deliveryMode: "Blended",
      duration: "2 Weeks",
      trainingPeriod: "September – October 2026",
      language: "English",
      location: "Abuja, Nigeria & Online",
      fundingStatus: "Government-funded",
      supportRequested: ["Curriculum Development", "Trainer", "Learning Materials", "Certification"],
      existingPartners: "WorldFish, SEAFDEC",
      remarks: "Hoping to align with BARUNA's existing biofloc training modules.",
      status: "Scheduled",
      createdAt: iso(34),
      updatedAt: iso(4),
    }),
    base({
      reference: "BARUNA-TR-2026-0002",
      fullName: "Prof. Léa Mbeki",
      position: "Head, Marine Science Department",
      organization: "University of Cape Coast",
      organizationType: "University",
      country: "Ghana",
      email: "l.mbeki@ucc.edu.gh",
      phone: "+233 24 555 0148",
      trainingTopic: "Marine Spatial Planning for Coastal Universities",
      trainingCategory: "Marine Spatial Planning",
      objectives: "Build faculty capacity to teach and apply marine spatial planning.",
      needs: "A train-the-trainer program with applied GIS and stakeholder engagement components.",
      outcomes: "Faculty integrate MSP into curricula and run regional workshops.",
      challenges: "Limited access to MSP tools and up-to-date teaching materials.",
      competencyLevel: "Advanced",
      targetAudience: "Lecturers",
      participantCount: "11–20",
      participantProfile: "Marine science and geography lecturers.",
      deliveryMode: "In-Person",
      duration: "1 Week",
      trainingPeriod: "November 2026",
      language: "English",
      location: "Cape Coast, Ghana",
      fundingStatus: "Donor-funded",
      supportRequested: ["Expert Recommendation", "Trainer", "Learning Materials"],
      existingPartners: "IOC-UNESCO",
      remarks: "",
      status: "Under Review",
      createdAt: iso(12),
      updatedAt: iso(3),
    }),
    base({
      reference: "BARUNA-TR-2026-0001",
      fullName: "Samuel Adeyemi",
      position: "Programme Coordinator",
      organization: "Blue Coast Community Trust",
      organizationType: "NGO",
      country: "Kenya",
      email: "samuel@bluecoasttrust.org",
      phone: "+254 712 555 0177",
      trainingTopic: "Community-Based Fish Processing & Value Addition",
      trainingCategory: "Fish Processing",
      objectives: "Reduce post-harvest losses for coastal fisher groups.",
      needs: "Hands-on training in hygienic processing, drying, smoking and packaging.",
      outcomes: "Fisher groups produce higher-value, market-ready products.",
      challenges: "High post-harvest losses and limited cold-chain access.",
      competencyLevel: "Beginner",
      targetAudience: "Fisher Groups",
      participantCount: "51–100",
      participantProfile: "Women-led fisher cooperatives.",
      deliveryMode: "In-Person",
      duration: "2–3 Days",
      trainingPeriod: "Flexible — Q3 2026",
      language: "English",
      location: "Mombasa, Kenya",
      fundingStatus: "Under Discussion",
      supportRequested: ["Trainer", "Learning Materials", "Venue Arrangement", "Certification"],
      existingPartners: "",
      remarks: "Open to co-funding opportunities.",
      status: "Submitted",
      createdAt: iso(2),
      updatedAt: iso(2),
    }),
  ];
}

// ── Persistence ─────────────────────────────────────────────────────────────
export function loadRequests(): TrainingRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as TrainingRequest[];
    const seeded = seedRequests();
    localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
    if (!localStorage.getItem(SEQ_KEY)) localStorage.setItem(SEQ_KEY, "3");
    return seeded;
  } catch {
    return [];
  }
}

function persist(list: TrainingRequest[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function createRequest(draft: TrainingRequestDraft): TrainingRequest {
  const now = new Date().toISOString();

  // Presentation Mode: simulate a successful submission WITHOUT persisting
  // anything. Returns a realistic demo tracking number and never touches the
  // store, so production data and history are untouched.
  if (isPresentationMode()) {
    return {
      ...draft,
      id: genId(),
      reference: presentationReference("TR", 6),
      status: "Submitted",
      createdAt: now,
      updatedAt: now,
    };
  }

  loadRequests(); // ensure seed + sequence initialised
  const request: TrainingRequest = {
    ...draft,
    id: genId(),
    reference: formatReference(nextSequence()),
    status: "Submitted",
    createdAt: now,
    updatedAt: now,
  };
  persist([request, ...loadRequests()]);
  return request;
}

// ── Presentation Mode demo draft ────────────────────────────────────────────
/** Realistic sample data used to pre-fill the request form during a demo. */
export const demoTrainingDraft: TrainingRequestDraft = {
  ...emptyTrainingDraft,
  requesterType: "Organization / Institution",
  fullName: "Dr. Wanjiru Kamau",
  position: "Director of Capacity Development",
  organization: "Ministry of Fisheries of Kenya",
  organizationType: "Government",
  country: "Kenya",
  email: "w.kamau@fisheries.go.ke",
  phone: "+254 712 555 0188",
  website: "https://fisheries.go.ke",
  trainingTopic: "Biofloc Aquaculture for Tilapia",
  trainingCategory: "Aquaculture",
  objectives:
    "Equip national extension officers with practical biofloc skills for sustainable tilapia production.",
  needs:
    "A structured, hands-on program covering hatchery management, water quality, feed formulation and biosecurity for biofloc systems.",
  outcomes:
    "Officers able to establish and manage biofloc tilapia systems and train smallholder farmers nationwide.",
  challenges:
    "Low survival rates, high feed costs and inconsistent water quality in existing smallholder systems.",
  currentCompetencyLevel: "Basic",
  desiredCompetencyLevel: "Advanced",
  urgency: "Medium — within this year",
  targetAudience: "Government Officers",
  participantCount: "21–50",
  participantProfile: "Fisheries extension officers from coastal and inland counties.",
  preferredLearningApproach: "facilitated",
  deliveryPreference: "Blended Cohort",
  attendanceFormat: "Blended",
  duration: "2 Weeks",
  trainingPeriod: "October 2026",
  language: "English",
  location: "Nairobi, Kenya & Online",
  fundingPreference: "Sponsor or Partner Funded",
  supportRequested: ["Curriculum Development", "Trainer", "Learning Materials", "Certification"],
  existingPartners: "WorldFish, FAO",
  remarks: "Hoping to align with BARUNA's biofloc training modules.",
};

export function deleteRequest(id: string) {
  persist(loadRequests().filter((r) => r.id !== id));
}

export function getRequest(id: string): TrainingRequest | undefined {
  return loadRequests().find((r) => r.id === id);
}

// ── React hooks ─────────────────────────────────────────────────────────────
export function useRequests(): TrainingRequest[] {
  const [list, setList] = useState<TrainingRequest[]>(() => loadRequests());
  useEffect(() => {
    const refresh = () => setList(loadRequests());
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return list;
}

export function useRequest(id: string): TrainingRequest | undefined {
  const list = useRequests();
  return list.find((r) => r.id === id);
}
