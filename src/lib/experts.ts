// ============================================================================
// BARUNA — Expert Engagement store (client-side, localStorage)
// ----------------------------------------------------------------------------
// Powers the unified "Request an Expert" workflow, "My Requests" tracker,
// "Join as an Expert" registration, and "My Expert Profile".
//
// Expert requests move through:
//   Draft → Submitted → Under Review → Expert Matching → Confirmed → Completed
//
// Expert applications move through:
//   Applied → Under Review → Approved Expert → Published
// Only "Published" experts appear in the public directory.
//
// No backend required — everything persists in the browser.
// ============================================================================

import { useEffect, useState } from "react";
import { isPresentationMode } from "./demoMode";

// ── Keys ─────────────────────────────────────────────────────────────────────
const REQUESTS_KEY = "baruna:expert-requests";
const REQUESTS_EVENT = "baruna:expert-requests";
const EXPERTS_KEY = "baruna:expert-applications";
const EXPERTS_EVENT = "baruna:expert-applications";

export const ACCEPTED_FILE_TYPES =
  ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.mp4,.jpg,.jpeg,.png,.webp";
export const MAX_BYTES = 50 * 1024 * 1024;

export type FileMeta = { name: string; size: number; type: string; uploadedAt: string };

// ============================================================================
// REQUEST AN EXPERT
// ============================================================================
export type RequestType = "speaker" | "trainer" | "reviewer" | "mentor" | "technical";

export type FieldType = "text" | "textarea" | "date" | "select" | "file" | "number";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly string[];
  required?: boolean;
  placeholder?: string;
};

export type RequestTypeConfig = {
  type: RequestType;
  label: string;
  purpose: string;
  fields: FieldDef[];
};

const FORMAT_OPTIONS = ["Online", "Blended", "Onsite"] as const;

export const REVIEW_DOCUMENT_TYPES = [
  "Research Proposal",
  "Research Report",
  "Journal Article",
  "Policy Brief",
  "Training Curriculum",
  "Training Module",
  "Technical Guideline",
] as const;

export const TECHNICAL_CATEGORIES = [
  "Aquaculture",
  "Hatchery Management",
  "Fish Health",
  "Feed Development",
  "Fish Processing",
  "Quality Assurance",
  "Certification",
  "Marine Conservation",
  "Blue Economy",
  "Climate Change",
  "Fisheries Management",
  "Community Development",
] as const;

export const REQUEST_TYPE_CONFIG: Record<RequestType, RequestTypeConfig> = {
  speaker: {
    type: "speaker",
    label: "Speaker",
    purpose:
      "Invite experts for conferences, seminars, webinars, workshops, panel discussions, keynote speeches, or guest lectures.",
    fields: [
      { key: "organization", label: "Organization Name", type: "text", required: true },
      { key: "country", label: "Country", type: "text", required: true },
      { key: "eventName", label: "Event Name", type: "text", required: true },
      { key: "eventDate", label: "Event Date", type: "date", required: true },
      { key: "eventFormat", label: "Event Format", type: "select", options: FORMAT_OPTIONS, required: true },
      { key: "topic", label: "Topic Required", type: "text", required: true },
      { key: "preferredExpert", label: "Preferred Expert (optional)", type: "text" },
      { key: "audience", label: "Expected Audience", type: "text", required: true },
      { key: "budget", label: "Budget Available", type: "text" },
      { key: "additionalInfo", label: "Additional Information", type: "textarea" },
    ],
  },
  trainer: {
    type: "trainer",
    label: "Trainer",
    purpose: "Request trainers for capacity building and professional development programs.",
    fields: [
      { key: "organization", label: "Organization Name", type: "text", required: true },
      { key: "country", label: "Country", type: "text", required: true },
      { key: "trainingTitle", label: "Training Title", type: "text", required: true },
      { key: "trainingTopic", label: "Training Topic", type: "text", required: true },
      { key: "trainingDates", label: "Training Dates", type: "text", required: true, placeholder: "e.g. 10–14 Aug 2026" },
      { key: "participants", label: "Number of Participants", type: "number", required: true },
      { key: "deliveryMode", label: "Delivery Mode", type: "select", options: FORMAT_OPTIONS, required: true },
      { key: "language", label: "Language", type: "text", required: true },
      { key: "budget", label: "Budget Available", type: "text" },
      { key: "additionalRequirements", label: "Additional Requirements", type: "textarea" },
    ],
  },
  reviewer: {
    type: "reviewer",
    label: "Reviewer",
    purpose: "Request expert review of documents and technical outputs.",
    fields: [
      { key: "organization", label: "Organization Name", type: "text", required: true },
      { key: "documentType", label: "Document Type", type: "select", options: REVIEW_DOCUMENT_TYPES, required: true },
      { key: "subjectArea", label: "Subject Area", type: "text", required: true },
      { key: "completionDate", label: "Expected Completion Date", type: "date", required: true },
      { key: "document", label: "Upload Document", type: "file", required: true },
      { key: "scope", label: "Scope of Review", type: "textarea", required: true },
      { key: "additionalNotes", label: "Additional Notes", type: "textarea" },
    ],
  },
  mentor: {
    type: "mentor",
    label: "Mentor",
    purpose:
      "Request mentoring support for individuals, projects, institutions, startups, or professional development.",
    fields: [
      { key: "organization", label: "Organization Name", type: "text", required: true },
      { key: "country", label: "Country", type: "text", required: true },
      { key: "objective", label: "Mentoring Objective", type: "textarea", required: true },
      { key: "duration", label: "Expected Duration", type: "text", required: true, placeholder: "e.g. 6 months" },
      { key: "language", label: "Preferred Language", type: "text", required: true },
      { key: "preferredExpert", label: "Preferred Expert", type: "text" },
      { key: "expectedOutcomes", label: "Expected Outcomes", type: "textarea", required: true },
      { key: "additionalInfo", label: "Additional Information", type: "textarea" },
    ],
  },
  technical: {
    type: "technical",
    label: "Technical Assistance",
    purpose: "Request technical support from BARUNA experts.",
    fields: [
      { key: "organization", label: "Organization Name", type: "text", required: true },
      { key: "country", label: "Country", type: "text", required: true },
      { key: "category", label: "Category", type: "select", options: TECHNICAL_CATEGORIES, required: true },
      { key: "technicalIssue", label: "Technical Issue", type: "text", required: true },
      { key: "detailedDescription", label: "Detailed Description", type: "textarea", required: true },
      { key: "expectedSupport", label: "Expected Support", type: "textarea", required: true },
      { key: "timeline", label: "Timeline", type: "text", required: true, placeholder: "e.g. Within 4 weeks" },
      { key: "files", label: "Upload Supporting Files", type: "file" },
    ],
  },
};

export const REQUEST_TYPE_ORDER: RequestType[] = [
  "speaker",
  "trainer",
  "reviewer",
  "mentor",
  "technical",
];

// ── Request status pipeline ───────────────────────────────────────────────────
export const REQUEST_STATUSES = [
  "Draft",
  "Submitted",
  "Under Review",
  "Expert Matching",
  "Confirmed",
  "Completed",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Linear progression for the tracker (excludes the Draft start). */
export const REQUEST_PIPELINE: RequestStatus[] = [
  "Submitted",
  "Under Review",
  "Expert Matching",
  "Confirmed",
  "Completed",
];

export const REQUEST_STATUS_STYLES: Record<RequestStatus, string> = {
  Draft: "bg-muted text-foreground/70",
  Submitted: "bg-badge-course/15 text-badge-course",
  "Under Review": "bg-badge-workshop/15 text-badge-workshop",
  "Expert Matching": "bg-marine/15 text-marine",
  Confirmed: "bg-accent/20 text-accent-foreground",
  Completed: "bg-eco-community/15 text-eco-community",
};

export type ExpertRequest = {
  id: string;
  type: RequestType;
  values: Record<string, string>;
  files: Record<string, FileMeta>;
  status: RequestStatus;
  assignedExpert: string;
  createdAt: string;
  updatedAt: string;
};

export type RequestDraft = {
  type: RequestType;
  values: Record<string, string>;
  files: Record<string, FileMeta>;
};

export function emptyRequestDraft(type: RequestType): RequestDraft {
  return { type, values: {}, files: {} };
}

// ── Seed examples so the tracker is never empty ───────────────────────────────
function seedRequests(): ExpertRequest[] {
  const now = Date.now();
  const iso = (d: number) => new Date(now - d * 86400000).toISOString();
  return [
    {
      id: genId("req"),
      type: "speaker",
      values: {
        organization: "SEAFDEC",
        country: "Thailand",
        eventName: "Regional Webinar on Sustainable Aquaculture",
        eventDate: "2026-09-12",
        eventFormat: "Online",
        topic: "Biofloc systems for smallholder farmers",
        audience: "120 fisheries officers",
      },
      files: {},
      status: "Confirmed",
      assignedExpert: "Dr. Sinta Mahardika",
      createdAt: iso(18),
      updatedAt: iso(3),
    },
    {
      id: genId("req"),
      type: "trainer",
      values: {
        organization: "Ministry of Fisheries, Kenya",
        country: "Kenya",
        trainingTitle: "Hatchery Management for Tilapia",
        trainingTopic: "Hatchery & seed production",
        trainingDates: "10–14 Aug 2026",
        participants: "25",
        deliveryMode: "Blended",
        language: "English",
      },
      files: {},
      status: "Expert Matching",
      assignedExpert: "",
      createdAt: iso(9),
      updatedAt: iso(2),
    },
    {
      id: genId("req"),
      type: "reviewer",
      values: {
        organization: "Lake Fisheries Institute",
        documentType: "Training Module",
        subjectArea: "Aquaculture",
        completionDate: "2026-07-30",
        scope: "Technical accuracy and pedagogical structure review.",
      },
      files: {
        document: { name: "aquaculture-module-draft.pdf", size: 2_100_000, type: "application/pdf", uploadedAt: iso(6) },
      },
      status: "Under Review",
      assignedExpert: "",
      createdAt: iso(6),
      updatedAt: iso(5),
    },
  ];
}

// ============================================================================
// JOIN AS AN EXPERT
// ============================================================================
export const EXPERTISE_AREAS = [
  "Aquaculture",
  "Hatchery Management",
  "Fish Health",
  "Feed Development",
  "Fish Processing",
  "Quality Assurance",
  "Fisheries Management",
  "Marine Conservation",
  "Blue Economy",
  "Climate Change",
  "Marine Spatial Planning",
  "Monitoring, Control and Surveillance (MCS)",
  "IUU Fishing",
  "Ocean Literacy",
  "Capacity Development",
] as const;

export const EXPERT_ROLES = ["Speaker", "Trainer", "Reviewer", "Mentor", "Technical Expert"] as const;
export type ExpertRole = (typeof EXPERT_ROLES)[number];

export const EXPERT_STATUSES = ["Applied", "Under Review", "Approved Expert", "Published"] as const;
export type ExpertStatus = (typeof EXPERT_STATUSES)[number];

export const EXPERT_PIPELINE: ExpertStatus[] = [
  "Applied",
  "Under Review",
  "Approved Expert",
  "Published",
];

export const EXPERT_STATUS_STYLES: Record<ExpertStatus, string> = {
  Applied: "bg-badge-course/15 text-badge-course",
  "Under Review": "bg-badge-workshop/15 text-badge-workshop",
  "Approved Expert": "bg-marine/15 text-marine",
  Published: "bg-eco-community/15 text-eco-community",
};

export type ExpertApplication = {
  id: string;
  // Section 1 — Personal Information
  fullName: string;
  title: string;
  institution: string;
  country: string;
  email: string;
  phone: string;
  linkedin: string;
  website: string;
  // Section 2 — Areas of Expertise
  expertise: string[];
  // Section 3 — Available Roles
  roles: ExpertRole[];
  // Section 4 — Professional Profile
  biography: string;
  yearsExperience: string;
  keyProjects: string;
  publications: string;
  languages: string;
  // Section 5 — Documents
  cv: FileMeta | null;
  photo: FileMeta | null;
  certifications: FileMeta | null;
  supporting: FileMeta | null;
  // Workflow + profile
  status: ExpertStatus;
  available: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExpertApplicationDraft = Omit<
  ExpertApplication,
  "id" | "status" | "available" | "createdAt" | "updatedAt"
>;

export const emptyExpertApplication: ExpertApplicationDraft = {
  fullName: "",
  title: "",
  institution: "",
  country: "",
  email: "",
  phone: "",
  linkedin: "",
  website: "",
  expertise: [],
  roles: [],
  biography: "",
  yearsExperience: "",
  keyProjects: "",
  publications: "",
  languages: "",
  cv: null,
  photo: null,
  certifications: null,
  supporting: null,
};

// ============================================================================
// PERSISTENCE
// ============================================================================
export function genId(prefix = "id"): string {
  return (
    prefix.toUpperCase() +
    "-" +
    Date.now().toString(36).slice(-5).toUpperCase() +
    Math.random().toString(36).slice(2, 5).toUpperCase()
  );
}

function load<T>(key: string, seed?: () => T[]): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T[];
    if (seed) {
      const seeded = seed();
      localStorage.setItem(key, JSON.stringify(seeded));
      return seeded;
    }
    return [];
  } catch {
    return [];
  }
}

function persist<T>(key: string, event: string, list: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(event));
}

// ── Requests ──────────────────────────────────────────────────────────────────
export function loadRequests(): ExpertRequest[] {
  return load<ExpertRequest>(REQUESTS_KEY, seedRequests);
}

export function createRequest(draft: RequestDraft, status: RequestStatus = "Submitted"): ExpertRequest {
  const now = new Date().toISOString();
  const request: ExpertRequest = {
    id: genId("req"),
    type: draft.type,
    values: draft.values,
    files: draft.files,
    status,
    assignedExpert: "",
    createdAt: now,
    updatedAt: now,
  };
  // Presentation Mode: simulate the submission without writing to the store.
  if (isPresentationMode()) return request;
  persist(REQUESTS_KEY, REQUESTS_EVENT, [request, ...loadRequests()]);
  return request;
}

export function updateRequest(id: string, patch: Partial<ExpertRequest>) {
  const list = loadRequests().map((r) =>
    r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r,
  );
  persist(REQUESTS_KEY, REQUESTS_EVENT, list);
}

export function deleteRequest(id: string) {
  persist(REQUESTS_KEY, REQUESTS_EVENT, loadRequests().filter((r) => r.id !== id));
}

export function getRequest(id: string): ExpertRequest | undefined {
  return loadRequests().find((r) => r.id === id);
}

export function useRequests(): ExpertRequest[] {
  const [list, setList] = useState<ExpertRequest[]>(() => loadRequests());
  useEffect(() => {
    const refresh = () => setList(loadRequests());
    refresh();
    window.addEventListener(REQUESTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(REQUESTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return list;
}

// ── Expert applications ─────────────────────────────────────────────────────────
export function loadExpertApplications(): ExpertApplication[] {
  return load<ExpertApplication>(EXPERTS_KEY);
}

export function createExpertApplication(
  draft: ExpertApplicationDraft,
  status: ExpertStatus = "Applied",
): ExpertApplication {
  const now = new Date().toISOString();
  const app: ExpertApplication = {
    ...draft,
    id: genId("exp"),
    status,
    available: true,
    createdAt: now,
    updatedAt: now,
  };
  // Presentation Mode: simulate the application without writing to the store.
  if (isPresentationMode()) return app;
  persist(EXPERTS_KEY, EXPERTS_EVENT, [app, ...loadExpertApplications()]);
  return app;
}

export function updateExpertApplication(id: string, patch: Partial<ExpertApplication>) {
  const list = loadExpertApplications().map((a) =>
    a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a,
  );
  persist(EXPERTS_KEY, EXPERTS_EVENT, list);
}

export function useExpertApplications(): ExpertApplication[] {
  const [list, setList] = useState<ExpertApplication[]>(() => loadExpertApplications());
  useEffect(() => {
    const refresh = () => setList(loadExpertApplications());
    refresh();
    window.addEventListener(EXPERTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EXPERTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return list;
}

/** The current participant's expert profile (most recent application). */
export function useMyExpertProfile(): ExpertApplication | undefined {
  return useExpertApplications()[0];
}

// ============================================================================
// FORMATTING
// ============================================================================
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
