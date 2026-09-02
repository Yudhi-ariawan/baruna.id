// ============================================================================
// BARUNA — Knowledge Hub Demo Dataset (Single Source of Truth)
// ----------------------------------------------------------------------------
// All Knowledge Hub types (publications, learning modules, best practices,
// videos, policy briefs, infographics, case studies, toolkits) read from this
// module so the Resource Library totals always equal the sum of the parts.
// Every record is synthetic — flagged with a "DEMO DATA" badge in the UI.
// ============================================================================

import {
  DEMO_CATEGORIES,
  DEMO_EXPERTS,
  DEMO_MODULES,
  DEMO_SHORT_COURSES,
  DEMO_EVENTS,
  DEMO_COMMUNITIES,
  DEMO_PARTNERS,
  getExpertByCategory,
  type DemoCategorySlug,
  type DemoExpert,
} from "./index";
import { MASTER_MODULES } from "@/data/masterModules";
import { instructors } from "@/data/instructors";

export type KhResourceType =
  | "publications"
  | "learning-modules"
  | "best-practices"
  | "videos"
  | "policy-briefs"
  | "infographics"
  | "case-studies"
  | "toolkits";

export type KhAccessLevel =
  | "Public Access"
  | "Registered User"
  | "Course Participant"
  | "Completion Required"
  | "Restricted Internal";

export type KhStatus = "Published" | "Under Review" | "Approved" | "Archived";

export type KhResource = {
  id: string;
  type: KhResourceType;
  typeLabel: string;
  title: string;
  category: DemoCategorySlug;
  summary: string;
  abstract: string;
  author: string;
  contributor: string;
  organization: string;
  year: number;
  language: string;
  country: string;
  keywords: string[];
  access: KhAccessLevel;
  status: KhStatus;
  fileType: string;
  fileSize?: string;
  pages?: number;
  duration?: string;
  speaker?: string;
  videoKind?: string;
  version: string;
  moduleCode?: string;
  shortCourseCode?: string;
  trainingProgram?: string;
  relatedEventId?: string;
  relatedCommunitySlug?: string;
  relatedPartnerSlug?: string;
  relatedArchive?: string;
  expertId: string;
  metrics: {
    views: number;
    uniqueViewers: number;
    downloads: number;
    saves: number;
    shares: number;
  };
  citation: string;
  createdAt: string;
  updatedAt: string;
};

// ── Type registry (labels, icons, descriptions) ────────────────────────────

export const KH_TYPES: {
  slug: KhResourceType;
  label: string;
  singular: string;
  description: string;
}[] = [
  { slug: "publications", label: "Publications", singular: "Publication",
    description: "Research-based publications, technical references, and institutional knowledge." },
  { slug: "learning-modules", label: "Learning Modules", singular: "Learning Module",
    description: "Approved learning modules connected to BARUNA Self-Paced Courses." },
  { slug: "best-practices", label: "Best Practices", singular: "Best Practice",
    description: "Replicable practices from marine and fisheries capacity-building programs." },
  { slug: "videos", label: "Videos", singular: "Video",
    description: "Training videos, expert talks, demonstrations, and event recordings." },
  { slug: "policy-briefs", label: "Policy Briefs", singular: "Policy Brief",
    description: "Concise policy recommendations on marine and fisheries issues." },
  { slug: "infographics", label: "Infographics", singular: "Infographic",
    description: "Visual summaries of data, processes, and learning topics." },
  { slug: "case-studies", label: "Case Studies", singular: "Case Study",
    description: "Documented cases from training, communities, and institutional practices." },
  { slug: "toolkits", label: "Toolkits", singular: "Toolkit",
    description: "Practical templates, instruments, checklists, and implementation guides." },
];

export function labelForType(slug: KhResourceType): string {
  return KH_TYPES.find((t) => t.slug === slug)?.label ?? slug;
}

// ── Seed helpers ───────────────────────────────────────────────────────────

let counter = 0;
function mkId(prefix: string): string {
  counter++;
  return `${prefix}-${String(counter).padStart(3, "0")}`;
}

function baseMetrics(seed: number) {
  const v = 220 + (seed * 37) % 4200;
  return {
    views: v,
    uniqueViewers: Math.round(v * 0.62),
    downloads: Math.round(v * 0.28),
    saves: Math.round(v * 0.11),
    shares: Math.round(v * 0.05),
  };
}

function citation(author: string, year: number, title: string): string {
  return `${author} (${year}). ${title}. BARUNA Knowledge Hub. [DEMO DATA]`;
}

function expertOf(cat: DemoCategorySlug): DemoExpert {
  return getExpertByCategory(cat);
}

function eventForCat(cat: DemoCategorySlug) {
  return DEMO_EVENTS.find((e) => e.category === cat);
}
function communityForCat(cat: DemoCategorySlug) {
  return DEMO_COMMUNITIES.find((c) => c.category === cat);
}
function partnerForCat(cat: DemoCategorySlug) {
  return DEMO_PARTNERS.find((p) => p.supports.includes(cat));
}

function mkResource(
  type: KhResourceType,
  typeLabel: string,
  title: string,
  cat: DemoCategorySlug,
  over: Partial<KhResource> = {},
): KhResource {
  const expert = expertOf(cat);
  const module = DEMO_MODULES.find((m) => m.category === cat);
  const course = DEMO_SHORT_COURSES.find((c) => c.category === cat);
  const ev = eventForCat(cat);
  const com = communityForCat(cat);
  const partner = partnerForCat(cat);
  const id = mkId(type.slice(0, 3));
  const year = over.year ?? 2025 + (counter % 2);
  return {
    id,
    type,
    typeLabel,
    title,
    category: cat,
    summary: over.summary ?? `${typeLabel} on ${title}. Prepared for BARUNA participants and partners.`,
    abstract: over.abstract ??
      `This ${typeLabel.toLowerCase()} presents practitioner-oriented material aligned with the ${module?.title ?? "BARUNA"} module. Content is illustrative and released as DEMO DATA for platform review.`,
    author: expert.fullName,
    contributor: expert.organization,
    organization: expert.organization,
    year,
    language: "English",
    country: expert.country,
    keywords: over.keywords ?? [
      DEMO_CATEGORIES.find((c) => c.slug === cat)!.name,
      "BARUNA",
      "Capacity Building",
    ],
    access: over.access ?? "Public Access",
    status: "Published",
    fileType: over.fileType ?? "PDF",
    fileSize: over.fileSize,
    pages: over.pages,
    duration: over.duration,
    speaker: over.speaker,
    videoKind: over.videoKind,
    version: "v1.0",
    moduleCode: module?.code,
    shortCourseCode: course?.code,
    trainingProgram: "International Training on Fisheries for African Countries",
    relatedEventId: ev?.id,
    relatedCommunitySlug: com?.slug,
    relatedPartnerSlug: partner?.slug,
    relatedArchive: "Edition 2024 — Fisheries Training",
    expertId: expert.id,
    metrics: baseMetrics(counter),
    citation: citation(expert.fullName, year, title),
    createdAt: `${year}-0${1 + (counter % 9)}-1${counter % 9}`,
    updatedAt: `${year}-0${1 + (counter % 9)}-2${counter % 9}`,
    ...over,
  };
}

// ── Publications (12) ──────────────────────────────────────────────────────

const publicationsSeed: { title: string; cat: DemoCategorySlug; subtype?: string }[] = [
  { title: "Data-Based Fisheries Management: A Practical Introduction", cat: "fisheries-management", subtype: "Manual" },
  { title: "Sustainable Biofloc Aquaculture Operational Guide", cat: "aquaculture", subtype: "Manual" },
  { title: "Community-Based Marine Conservation Planning Guide", cat: "marine-conservation", subtype: "Reference Book" },
  { title: "Blue Economy Opportunities for Coastal Communities", cat: "blue-economy", subtype: "Working Paper" },
  { title: "Coastal Climate Risk Screening Handbook", cat: "climate-change", subtype: "Manual" },
  { title: "Collaborative Ocean Governance Reference Guide", cat: "ocean-governance", subtype: "Reference Book" },
  { title: "Participatory Marine Spatial Planning Manual", cat: "marine-spatial-planning", subtype: "Manual" },
  { title: "Fisheries Surveillance and Incident Documentation Guide", cat: "fisheries-surveillance", subtype: "Technical Publication" },
  { title: "Safe Fish Handling and Value Addition Guide", cat: "fish-processing-value-addition", subtype: "Manual" },
  { title: "International Fisheries Training Documentation 2024", cat: "fisheries-management", subtype: "Training Documentation" },
  { title: "BARUNA Marine and Fisheries Capacity-Building Overview", cat: "blue-economy", subtype: "Report" },
  { title: "Lessons from Regional Fisheries Training Cooperation", cat: "fisheries-management", subtype: "Proceedings" },
];

export const KH_PUBLICATIONS: KhResource[] = publicationsSeed.map((p) =>
  mkResource("publications", p.subtype ?? "Publication", p.title, p.cat, {
    pages: 40 + ((p.title.length * 3) % 120),
    fileSize: `${(1.2 + (p.title.length % 6) * 0.4).toFixed(1)} MB`,
    keywords: [p.subtype ?? "Publication", p.cat, "BARUNA"],
  }),
);

// ── Learning Modules (9 — from Master Module registry) ─────────────────────

export const KH_LEARNING_MODULES: KhResource[] = MASTER_MODULES.map((m, i) => {
  // Pick a stable demo expert for wiring (round-robin over category experts).
  const cat: DemoCategorySlug =
    m.khCategory === "Fish Processing and Value Addition"
      ? "fish-processing-value-addition"
      : "aquaculture";
  const expert = DEMO_EXPERTS.find((e) => e.category === cat) ?? DEMO_EXPERTS[0];
  const instructor = instructors.find((x) => x.slug === m.instructorSlug);
  const ev = eventForCat(cat);
  const com = communityForCat(cat);
  const partner = partnerForCat(cat);
  const id = mkId("lm");
  const year = 2026;
  const enrolments = 180 + (m.no * 43);
  const usp = Math.round(enrolments * 0.82);
  return {
    id,
    type: "learning-modules" as const,
    typeLabel: "Learning Module",
    title: m.title,
    category: cat,
    summary: m.summary,
    abstract: `${m.summary} Learning objectives: ${m.objectives.join("; ")}.`,
    author: instructor?.name ?? expert.fullName,
    contributor: instructor?.organization ?? expert.organization,
    organization: instructor?.organization ?? expert.organization,
    year,
    language: m.language,
    country: expert.country,
    keywords: [
      m.khCode, m.khCategory, m.subCategory, m.level,
      ...m.pathways, "Master Module", "BARUNA",
    ],
    access: "Completion Required",
    status: "Published",
    fileType: "Module Package",
    pages: m.hours * 12,
    version: m.version,
    // NOTE: moduleCode holds the KH module code (BARUNA-AQ-*) — that's what
    // the Knowledge Hub cards and detail page display.
    moduleCode: m.khCode,
    shortCourseCode: m.code,
    trainingProgram: "International Training on Fisheries for African Countries",
    relatedEventId: ev?.id,
    relatedCommunitySlug: com?.slug,
    relatedPartnerSlug: partner?.slug,
    relatedArchive: "Edition 2024 — Fisheries Training",
    expertId: expert.id,
    metrics: {
      views: enrolments * 4 + i * 17,
      uniqueViewers: enrolments,
      downloads: usp,
      saves: Math.round(usp * 0.2),
      shares: Math.round(usp * 0.08),
    },
    citation: citation(instructor?.name ?? expert.fullName, year, m.title),
    createdAt: `${year}-01-15`,
    updatedAt: `${year}-03-${String(10 + m.no).padStart(2, "0")}`,
  };
});

// Filter option constants for KH → Learning Modules
export const KH_LM_SUBCATEGORIES = [
  "Biofloc", "Catfish", "Tilapia", "Fish Feed", "Fish Health", "Fish Processing",
] as const;
export const KH_LM_LEVELS = ["Foundation", "Intermediate"] as const;

// ── Best Practices (9 — one per category) ──────────────────────────────────

const bestPracticesSeed: { title: string; cat: DemoCategorySlug }[] = [
  { title: "Using Simple Fisheries Data for Local Management Decisions", cat: "fisheries-management" },
  { title: "Low-Cost Biofloc System Management", cat: "aquaculture" },
  { title: "Community Participation in Coral Reef Conservation", cat: "marine-conservation" },
  { title: "Developing Inclusive Coastal Enterprises", cat: "blue-economy" },
  { title: "Community-Led Coastal Climate Risk Mapping", cat: "climate-change" },
  { title: "Multi-Stakeholder Coordination in Ocean Governance", cat: "ocean-governance" },
  { title: "Participatory Mapping for Marine Spatial Planning", cat: "marine-spatial-planning" },
  { title: "Standardized Fisheries Incident Reporting", cat: "fisheries-surveillance" },
  { title: "Improving Fish Product Quality Through Good Handling Practices", cat: "fish-processing-value-addition" },
];
export const KH_BEST_PRACTICES: KhResource[] = bestPracticesSeed.map((p) =>
  mkResource("best-practices", "Best Practice", p.title, p.cat, {
    pages: 8 + ((p.title.length * 2) % 20),
    fileSize: "0.9 MB",
  }),
);

// ── Videos (18 — 2 per category) ───────────────────────────────────────────

const videoKindsPer: { title: string; cat: DemoCategorySlug; kind: string; dur: string }[] = [
  { title: "Understanding Basic Fisheries Indicators", cat: "fisheries-management", kind: "Training Video", dur: "14:22" },
  { title: "Data-Based Fisheries Management Expert Talk", cat: "fisheries-management", kind: "Expert Talk", dur: "22:07" },
  { title: "Biofloc System Preparation Demonstration", cat: "aquaculture", kind: "Practical Demonstration", dur: "18:45" },
  { title: "Biofloc Water-Quality Monitoring Webinar", cat: "aquaculture", kind: "Webinar Recording", dur: "48:10" },
  { title: "Community Marine Conservation Planning", cat: "marine-conservation", kind: "Training Video", dur: "27:33" },
  { title: "Coral Reef Community Exchange Documentation", cat: "marine-conservation", kind: "Event Recording", dur: "12:15" },
  { title: "Blue Economy Explained", cat: "blue-economy", kind: "Expert Talk", dur: "16:40" },
  { title: "Blue Economy Knowledge Forum Highlights", cat: "blue-economy", kind: "Event Recording", dur: "31:04" },
  { title: "Coastal Climate Risk Screening Tutorial", cat: "climate-change", kind: "Training Video", dur: "24:18" },
  { title: "Coastal Resilience Field Story", cat: "climate-change", kind: "Participant Story", dur: "09:55" },
  { title: "Collaborative Ocean Governance Expert Talk", cat: "ocean-governance", kind: "Expert Talk", dur: "29:22" },
  { title: "Multi-Jurisdiction Coordination Demonstration", cat: "ocean-governance", kind: "Practical Demonstration", dur: "17:03" },
  { title: "Participatory Marine Mapping Demonstration", cat: "marine-spatial-planning", kind: "Practical Demonstration", dur: "23:41" },
  { title: "MSP Facilitation Training Video", cat: "marine-spatial-planning", kind: "Training Video", dur: "31:12" },
  { title: "Fisheries Incident Reporting Tutorial", cat: "fisheries-surveillance", kind: "Training Video", dur: "15:28" },
  { title: "At-Sea Surveillance Documentation", cat: "fisheries-surveillance", kind: "Training Documentation", dur: "20:44" },
  { title: "Safe Fish Handling Demonstration", cat: "fish-processing-value-addition", kind: "Practical Demonstration", dur: "13:18" },
  { title: "Value-Added Products Partner Story", cat: "fish-processing-value-addition", kind: "Partner Contribution", dur: "08:37" },
];
export const KH_VIDEOS: KhResource[] = videoKindsPer.map((v) =>
  mkResource("videos", v.kind, v.title, v.cat, {
    fileType: "Video (MP4)",
    duration: v.dur,
    videoKind: v.kind,
    speaker: expertOf(v.cat).fullName,
    access: "Public Access",
  }),
);

// ── Policy Briefs (8) ──────────────────────────────────────────────────────

const policyBriefsSeed: { title: string; cat: DemoCategorySlug }[] = [
  { title: "Strengthening Data Use in Fisheries Management", cat: "fisheries-management" },
  { title: "Supporting Sustainable Small-Scale Aquaculture", cat: "aquaculture" },
  { title: "Advancing Community-Based Marine Conservation", cat: "marine-conservation" },
  { title: "Enabling Inclusive Blue Economy Development", cat: "blue-economy" },
  { title: "Strengthening Coastal Climate Adaptation", cat: "climate-change" },
  { title: "Improving Coordination in Ocean Governance", cat: "ocean-governance" },
  { title: "Supporting Participatory Marine Spatial Planning", cat: "marine-spatial-planning" },
  { title: "Improving Fisheries Compliance and Reporting", cat: "fisheries-surveillance" },
];
export const KH_POLICY_BRIEFS: KhResource[] = policyBriefsSeed.map((p) =>
  mkResource("policy-briefs", "Policy Brief", p.title, p.cat, {
    pages: 4,
    fileSize: "0.6 MB",
  }),
);

// ── Infographics (15) ──────────────────────────────────────────────────────

const infographicsSeed: { title: string; cat: DemoCategorySlug }[] = [
  { title: "BARUNA Learning Ecosystem", cat: "blue-economy" },
  { title: "Fisheries Data Management Cycle", cat: "fisheries-management" },
  { title: "Biofloc Water-Quality Parameters", cat: "aquaculture" },
  { title: "Community Marine Conservation Process", cat: "marine-conservation" },
  { title: "Blue Economy Value Chain", cat: "blue-economy" },
  { title: "Coastal Climate Risk Framework", cat: "climate-change" },
  { title: "Ocean Governance Stakeholder Map", cat: "ocean-governance" },
  { title: "Marine Spatial Planning Process", cat: "marine-spatial-planning" },
  { title: "Fisheries Incident Reporting Flow", cat: "fisheries-surveillance" },
  { title: "Good Fish Handling Process", cat: "fish-processing-value-addition" },
  { title: "BARUNA Trainer Recognition Levels", cat: "ocean-governance" },
  { title: "Participant Learning Journey", cat: "fisheries-management" },
  { title: "Expert-to-Trainer Pathway", cat: "blue-economy" },
  { title: "Training Program Lifecycle", cat: "fisheries-management" },
  { title: "Knowledge-to-Impact Pathway", cat: "marine-conservation" },
];
export const KH_INFOGRAPHICS: KhResource[] = infographicsSeed.map((p) =>
  mkResource("infographics", "Infographic", p.title, p.cat, {
    fileType: "Image (PNG)",
    fileSize: "1.4 MB",
  }),
);

// ── Case Studies (10) ──────────────────────────────────────────────────────

const caseStudiesSeed: { title: string; cat: DemoCategorySlug }[] = [
  { title: "Applying Fisheries Data in a Coastal Management Unit", cat: "fisheries-management" },
  { title: "Introducing Biofloc Aquaculture to a Small Producer Group", cat: "aquaculture" },
  { title: "Community Participation in Marine Conservation", cat: "marine-conservation" },
  { title: "Developing a Coastal Blue Economy Initiative", cat: "blue-economy" },
  { title: "Climate Risk Screening in an Island Community", cat: "climate-change" },
  { title: "Improving Cross-Institutional Ocean Governance", cat: "ocean-governance" },
  { title: "Resolving Spatial Conflict Through Participatory Planning", cat: "marine-spatial-planning" },
  { title: "Improving Fisheries Surveillance Documentation", cat: "fisheries-surveillance" },
  { title: "Developing a Value-Added Fish Product", cat: "fish-processing-value-addition" },
  { title: "International Fisheries Training for African Countries 2024", cat: "fisheries-management" },
];
export const KH_CASE_STUDIES: KhResource[] = caseStudiesSeed.map((p) =>
  mkResource("case-studies", "Case Study", p.title, p.cat, {
    pages: 12 + ((p.title.length * 2) % 18),
    fileSize: "1.1 MB",
  }),
);

// ── Toolkits (9) ───────────────────────────────────────────────────────────

const toolkitsSeed: { title: string; cat: DemoCategorySlug }[] = [
  { title: "Fisheries Data Collection Toolkit", cat: "fisheries-management" },
  { title: "Biofloc Aquaculture Start-Up Toolkit", cat: "aquaculture" },
  { title: "Community Marine Conservation Planning Toolkit", cat: "marine-conservation" },
  { title: "Coastal Blue Economy Initiative Toolkit", cat: "blue-economy" },
  { title: "Coastal Climate Risk Screening Toolkit", cat: "climate-change" },
  { title: "Ocean Governance Stakeholder Mapping Toolkit", cat: "ocean-governance" },
  { title: "Participatory Marine Spatial Planning Toolkit", cat: "marine-spatial-planning" },
  { title: "Fisheries Incident Reporting Toolkit", cat: "fisheries-surveillance" },
  { title: "Fish Handling and Value Addition Toolkit", cat: "fish-processing-value-addition" },
];
export const KH_TOOLKITS: KhResource[] = toolkitsSeed.map((p) =>
  mkResource("toolkits", "Toolkit", p.title, p.cat, {
    fileType: "Toolkit (ZIP)",
    fileSize: "6.4 MB",
    keywords: ["Toolkit", "Templates", "Checklists"],
  }),
);

// ── Unified Resource Library ───────────────────────────────────────────────

export const KH_ALL: KhResource[] = [
  ...KH_PUBLICATIONS,
  ...KH_LEARNING_MODULES,
  ...KH_BEST_PRACTICES,
  ...KH_VIDEOS,
  ...KH_POLICY_BRIEFS,
  ...KH_INFOGRAPHICS,
  ...KH_CASE_STUDIES,
  ...KH_TOOLKITS,
];

export function resourcesByType(type: KhResourceType): KhResource[] {
  return KH_ALL.filter((r) => r.type === type);
}

export function countByType(type: KhResourceType): number {
  return resourcesByType(type).length;
}

export function totalPublished(): number {
  return KH_ALL.length;
}

export function getResourceById(id: string): KhResource | undefined {
  return KH_ALL.find((r) => r.id === id);
}

export function relatedResources(r: KhResource, limit = 4): KhResource[] {
  return KH_ALL.filter((x) =>
    x.id !== r.id &&
    (x.category === r.category || x.expertId === r.expertId || x.moduleCode === r.moduleCode),
  ).slice(0, limit);
}

// Extra type-specific structured content for detail pages
export const BEST_PRACTICE_STRUCTURE = {
  challenge: "Frontline practitioners lack a consistent, replicable approach in this category.",
  context: "Applied within BARUNA capacity-building cohorts across Indonesia, Africa, and the Pacific.",
  intervention: "Structured facilitation, tooling, and mentoring from a BARUNA Trainer.",
  steps: ["Assess", "Prepare", "Implement", "Monitor", "Reflect"],
  stakeholders: ["Local government", "Community leaders", "BARUNA Trainer", "Partner organisation"],
  resources: ["1 trained facilitator", "Field-day budget", "Documentation kit"],
  results: "Measurable improvement in participant confidence and downstream field practice.",
  lessons: "Consistent facilitation matters more than perfect templates.",
  replication: "High — packaged for reuse across countries and cohorts.",
  risks: "Requires refresh training if the base module version changes.",
  recommendations: "Adopt as a starter approach for new BARUNA cohorts in this category.",
};

export const CASE_STUDY_STRUCTURE = {
  background: "Piloted as part of a BARUNA capacity-building cohort.",
  problem: "A specific practitioner problem in this category.",
  stakeholders: ["Community", "Trainer", "Partner", "Local authority"],
  intervention: "Applied the BARUNA-approved module and toolkit.",
  process: ["Kick-off", "Field application", "Reflection", "Follow-up"],
  results: "Documented behaviour and outcome change over 12 weeks.",
  challenges: ["Data availability", "Coordination time"],
  lessons: "Sustained impact requires community ownership.",
  recommendations: "Institutionalise into partner programmes.",
};

export const TOOLKIT_TOOLS = [
  "Guidance document",
  "Checklist",
  "Assessment form",
  "Planning template",
  "Monitoring form",
  "Reporting template",
  "Example output",
  "Instructions for use",
];

// ── Analytics selectors ────────────────────────────────────────────────────

export function totalDownloads(): number {
  return KH_ALL.reduce((s, r) => s + r.metrics.downloads, 0);
}
export function totalViews(): number {
  return KH_ALL.reduce((s, r) => s + r.metrics.views, 0);
}
