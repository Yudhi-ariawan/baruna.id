// ============================================================================
// BARUNA — Knowledge Hub resource contribution store (client-side, localStorage)
// ----------------------------------------------------------------------------
// Powers the unified "Submit a Resource" workflow and "My Contributions"
// tracker. Resources move through:
//   Draft → Submitted → Under Review → Published
//                                    → Revision Required
// Published resources surface automatically in the Knowledge Hub browse list.
// No backend required — everything persists in the browser.
// ============================================================================

import { useEffect, useState } from "react";

const STORE_KEY = "baruna:resources";
const EVENT = "baruna:resources";

// ── Taxonomy ────────────────────────────────────────────────────────────────
export type ResourceTypeGroup = {
  label: string;
  types: string[];
};

export const RESOURCE_TYPE_GROUPS: ResourceTypeGroup[] = [
  {
    label: "Learning Materials",
    types: [
      "Training Module",
      "Presentation Slides",
      "Technical Guideline",
      "SOP / Manual",
      "Handbook",
      "E-Book",
    ],
  },
  {
    label: "Research & Publications",
    types: ["Research Report", "Journal Article", "Policy Brief", "Case Study", "Best Practice"],
  },
  {
    label: "Multimedia",
    types: ["Webinar Recording", "Video", "Podcast", "Infographic", "Photo Documentation"],
  },
  {
    label: "Tools & Templates",
    types: [
      "Monitoring Template",
      "Assessment Tool",
      "Data Collection Form",
      "Checklist",
      "Spreadsheet Tool",
    ],
  },
];

export function groupForType(type: string): string {
  return RESOURCE_TYPE_GROUPS.find((g) => g.types.includes(type))?.label ?? "";
}

export const TOPIC_CATEGORIES = [
  "Aquaculture",
  "Fisheries Management",
  "Fish Health",
  "Fish Processing",
  "Marine Conservation",
  "Blue Economy",
  "Climate Change",
  "Marine Spatial Planning",
  "Monitoring, Control and Surveillance (MCS)",
  "IUU Fishing",
  "Ocean Literacy",
  "Capacity Development",
] as const;

export const LANGUAGES = [
  "English",
  "French",
  "Portuguese",
  "Arabic",
  "Swahili",
  "Spanish",
  "Indonesian",
  "Other",
] as const;

export const ACCESS_LEVELS = ["Open Access", "BARUNA Members Only", "Restricted Access"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCEPTED_FILE_TYPES =
  ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.mp4,.jpg,.jpeg,.png,.webp";

// ── Status pipeline ─────────────────────────────────────────────────────────
export const RESOURCE_STATUSES = [
  "Draft",
  "Submitted",
  "Under Review",
  "Published",
  "Revision Required",
] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

/** Linear progression used for the status tracker (excludes the Draft start). */
export const REVIEW_PIPELINE: ResourceStatus[] = ["Submitted", "Under Review", "Published"];

export type ResourceFileMeta = { name: string; size: number; type: string; uploadedAt: string };

export type Resource = {
  id: string;
  type: string;
  typeGroup: string;
  title: string;
  description: string;
  author: string;
  institution: string;
  country: string;
  year: string;
  language: string;
  keywords: string;
  topicCategory: string;
  file: ResourceFileMeta | null;
  externalUrl: string;
  accessLevel: AccessLevel;
  declaration: boolean;
  status: ResourceStatus;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResourceDraft = Omit<Resource, "id" | "status" | "createdAt" | "updatedAt">;

export const emptyResourceDraft: ResourceDraft = {
  type: "",
  typeGroup: "",
  title: "",
  description: "",
  author: "",
  institution: "",
  country: "",
  year: String(new Date().getFullYear()),
  language: "English",
  keywords: "",
  topicCategory: "",
  file: null,
  externalUrl: "",
  accessLevel: "Open Access",
  declaration: false,
};

// ── Seed examples (mirrors the BARUNA spec so the tracker is never empty) ─────
function seedResources(): Resource[] {
  const now = new Date();
  const iso = (daysAgo: number) =>
    new Date(now.getTime() - daysAgo * 86400000).toISOString();
  const base = (over: Partial<Resource>): Resource => ({
    id: "",
    type: "Handbook",
    typeGroup: "Learning Materials",
    title: "",
    description: "",
    author: "BARUNA Contributor",
    institution: "",
    country: "",
    year: String(now.getFullYear()),
    language: "English",
    keywords: "",
    topicCategory: "Aquaculture",
    file: null,
    externalUrl: "",
    accessLevel: "Open Access",
    declaration: true,
    status: "Draft",
    createdAt: iso(10),
    updatedAt: iso(10),
    ...over,
  });

  return [
    base({
      id: genId(),
      title: "Tilapia Farming Manual",
      description:
        "A complete practical manual for tilapia hatchery and grow-out using the biofloc system.",
      type: "Handbook",
      typeGroup: "Learning Materials",
      topicCategory: "Aquaculture",
      institution: "BARUNA Academy",
      country: "Indonesia",
      status: "Published",
      file: { name: "tilapia-farming-manual.pdf", size: 3_200_000, type: "application/pdf", uploadedAt: iso(20) },
      createdAt: iso(24),
      updatedAt: iso(18),
    }),
    base({
      id: genId(),
      title: "Fisheries Extension Guideline",
      description: "Field guideline for fisheries extension officers working with coastal communities.",
      type: "Technical Guideline",
      typeGroup: "Learning Materials",
      topicCategory: "Fisheries Management",
      institution: "Ministry of Marine Affairs",
      country: "Kenya",
      status: "Under Review",
      file: { name: "fisheries-extension-guideline.pdf", size: 1_800_000, type: "application/pdf", uploadedAt: iso(6) },
      createdAt: iso(8),
      updatedAt: iso(6),
    }),
    base({
      id: genId(),
      title: "Hatchery SOP",
      description: "Standard operating procedures for a small-scale freshwater fish hatchery.",
      type: "SOP / Manual",
      typeGroup: "Learning Materials",
      topicCategory: "Aquaculture",
      institution: "Lake Fisheries Institute",
      country: "Uganda",
      status: "Revision Required",
      reviewNote: "Please add a biosecurity section and update the water-quality parameters table.",
      file: { name: "hatchery-sop.docx", size: 740_000, type: "application/msword", uploadedAt: iso(12) },
      createdAt: iso(14),
      updatedAt: iso(9),
    }),
    base({
      id: genId(),
      title: "Aquaculture Training Module",
      description: "Draft training module on sustainable aquaculture for capacity-development programs.",
      type: "Training Module",
      typeGroup: "Learning Materials",
      topicCategory: "Capacity Development",
      institution: "",
      country: "",
      status: "Draft",
      createdAt: iso(2),
      updatedAt: iso(1),
    }),
  ];
}

// ── Persistence ─────────────────────────────────────────────────────────────
export function genId(): string {
  return "res-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function loadResources(): Resource[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Resource[];
    const seeded = seedResources();
    localStorage.setItem(STORE_KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return [];
  }
}

function persist(list: Resource[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function createResource(draft: ResourceDraft, status: ResourceStatus = "Submitted"): Resource {
  const now = new Date().toISOString();
  const resource: Resource = {
    ...draft,
    typeGroup: groupForType(draft.type),
    id: genId(),
    status,
    createdAt: now,
    updatedAt: now,
  };
  persist([resource, ...loadResources()]);
  return resource;
}

export function updateResource(id: string, patch: Partial<Resource>) {
  const list = loadResources().map((r) =>
    r.id === id
      ? {
          ...r,
          ...patch,
          typeGroup: patch.type ? groupForType(patch.type) : r.typeGroup,
          updatedAt: new Date().toISOString(),
        }
      : r,
  );
  persist(list);
}

export function deleteResource(id: string) {
  persist(loadResources().filter((r) => r.id !== id));
}

export function getResource(id: string): Resource | undefined {
  return loadResources().find((r) => r.id === id);
}

/** Resubmit a "Revision Required" resource back into the review pipeline. */
export function resubmitResource(id: string) {
  updateResource(id, { status: "Submitted", reviewNote: "" });
}

// ── React hooks ─────────────────────────────────────────────────────────────
export function useResources(): Resource[] {
  const [list, setList] = useState<Resource[]>(() => loadResources());
  useEffect(() => {
    const refresh = () => setList(loadResources());
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

export function usePublishedResources(): Resource[] {
  return useResources().filter((r) => r.status === "Published");
}

export function useResource(id: string): Resource | undefined {
  return useResources().find((r) => r.id === id);
}

// ── Formatting ──────────────────────────────────────────────────────────────
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

export const STATUS_STYLES: Record<ResourceStatus, string> = {
  Draft: "bg-muted text-foreground/70",
  Submitted: "bg-badge-course/15 text-badge-course",
  "Under Review": "bg-badge-workshop/15 text-badge-workshop",
  Published: "bg-eco-community/15 text-eco-community",
  "Revision Required": "bg-destructive/10 text-destructive",
};
