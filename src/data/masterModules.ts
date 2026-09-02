// ============================================================================
// BARUNA Academy — Master Module Registry (Single Source of Truth)
// ----------------------------------------------------------------------------
// Every learning module in BARUNA — whether delivered inside a Full Training
// Program (e.g. "International Training on Fisheries for African Countries")
// or as a Standalone Short Course, published to the Knowledge Hub, or issued
// as a Certificate of Completion — refers back to this registry via its
// stable codes:
//
//   • code         → Master / Short Course code   (BARUNA-SC-AQ-001)
//   • khCode       → Knowledge Hub module code    (BARUNA-AQ-BF-001)
//
// Hours and Jam Pelajaran (JP, 1 JP = 45 min) are defined ONCE here so:
//   • Full trainings and Short Courses always show consistent durations
//   • Short Course completion can be recognised as credit inside a Full
//     Training Program (same code = same learning outcome)
//   • Knowledge Hub / Analytics / Certificates never diverge
// ============================================================================

import { LMS_MODULES, type LmsModule } from "@/data/lms";

/** 1 JP = 45 minutes of learning time. */
export const MINUTES_PER_JP = 45;

export type ModuleKhCategory =
  | "Aquaculture"
  | "Fish Processing and Value Addition";

export type ModuleSubCategory =
  | "Biofloc"
  | "Catfish"
  | "Tilapia"
  | "Fish Feed"
  | "Fish Health"
  | "Fish Processing";

export type ModuleLevel = "Foundation" | "Intermediate";
export type ModulePathway =
  | "Biofloc & Catfish"
  | "Tilapia"
  | "Fish Processing and Value Addition";

export type MasterModule = {
  /** Stable Master / Short Course code (BARUNA-SC-AQ-001). Used for enrollment,
   * credit recognition, and as the URL parameter for the Short Course. */
  code: string;
  /** Knowledge Hub module code (BARUNA-AQ-BF-001). Displayed on KH cards
   * and the module detail page. */
  khCode: string;
  /** Reference back to the LMS module id (e.g. "m1"). */
  lmsId: string;
  no: number;
  /** Master Module title (used inside the Full Training Program & Certificate). */
  title: string;
  /** Short Course title (may differ slightly from the Master title). */
  shortCourseTitle: string;
  /** Legacy training category (from the LMS). */
  category: string;
  /** Knowledge Hub top-level category. */
  khCategory: ModuleKhCategory;
  /** Filterable sub-category badge. */
  subCategory: ModuleSubCategory;
  level: ModuleLevel;
  language: string;
  pathways: ModulePathway[];
  /** Instructor slug from `src/data/instructors.ts`. */
  instructorSlug: string;
  summary: string;
  /** Canonical duration in clock hours. */
  hours: number;
  /** Canonical duration in Jam Pelajaran (JP, 1 JP = 45 minutes). */
  jp: number;
  objectives: string[];
  /** Version — bump to v2.0 when learning outcomes change materially. */
  version: string;
  /** Whether this module is also available as a standalone Short Course. */
  standalone: boolean;
};

function toJp(hours: number): number {
  return Math.round((hours * 60) / MINUTES_PER_JP);
}

// Per-module Knowledge Hub / Short Course metadata (one entry per LMS module).
// Ordered by module number 1..13.
type ModuleMeta = {
  khCode: string;
  scCode: string;
  shortCourseTitle: string;
  khCategory: ModuleKhCategory;
  subCategory: ModuleSubCategory;
  level: ModuleLevel;
  pathways: ModulePathway[];
  instructorSlug: string;
};

const META: ModuleMeta[] = [
  { khCode: "BARUNA-AQ-BF-001", scCode: "BARUNA-SC-AQ-001",
    shortCourseTitle: "Preparing Biofloc Containers and Media",
    khCategory: "Aquaculture", subCategory: "Biofloc", level: "Foundation",
    pathways: ["Biofloc & Catfish", "Tilapia"], instructorSlug: "herison-lingga" },
  { khCode: "BARUNA-AQ-BF-002", scCode: "BARUNA-SC-AQ-002",
    shortCourseTitle: "Preparing Biofloc Pond Media",
    khCategory: "Aquaculture", subCategory: "Biofloc", level: "Foundation",
    pathways: ["Biofloc & Catfish", "Tilapia"], instructorSlug: "herison-lingga" },
  { khCode: "BARUNA-AQ-CF-003", scCode: "BARUNA-SC-AQ-003",
    shortCourseTitle: "Catfish Hatchery and Seed Management",
    khCategory: "Aquaculture", subCategory: "Catfish", level: "Foundation",
    pathways: ["Biofloc & Catfish"], instructorSlug: "firman-pra-setia-nugraha" },
  { khCode: "BARUNA-AQ-CF-004", scCode: "BARUNA-SC-AQ-004",
    shortCourseTitle: "Fundamentals of Catfish Aquaculture",
    khCategory: "Aquaculture", subCategory: "Catfish", level: "Foundation",
    pathways: ["Biofloc & Catfish"], instructorSlug: "sumartin" },
  { khCode: "BARUNA-AQ-CF-005", scCode: "BARUNA-SC-AQ-005",
    shortCourseTitle: "Producing Catfish Feed from Maggot",
    khCategory: "Aquaculture", subCategory: "Fish Feed", level: "Intermediate",
    pathways: ["Biofloc & Catfish"], instructorSlug: "sumartin" },
  { khCode: "BARUNA-AQ-TL-006", scCode: "BARUNA-SC-AQ-006",
    shortCourseTitle: "Tilapia Hatchery and Seed Management",
    khCategory: "Aquaculture", subCategory: "Tilapia", level: "Foundation",
    pathways: ["Tilapia"], instructorSlug: "firman-pra-setia-nugraha" },
  { khCode: "BARUNA-AQ-TL-007", scCode: "BARUNA-SC-AQ-007",
    shortCourseTitle: "Tilapia Cultivation Using a Biofloc System",
    khCategory: "Aquaculture", subCategory: "Tilapia", level: "Intermediate",
    pathways: ["Tilapia"], instructorSlug: "herison-lingga" },
  { khCode: "BARUNA-AQ-TL-008", scCode: "BARUNA-SC-AQ-008",
    shortCourseTitle: "Vaccine and Vaccination in Tilapia Farming",
    khCategory: "Aquaculture", subCategory: "Fish Health", level: "Intermediate",
    pathways: ["Tilapia"], instructorSlug: "achmad-suhermanto" },
  { khCode: "BARUNA-AQ-TL-009", scCode: "BARUNA-SC-AQ-009",
    shortCourseTitle: "Producing Tilapia Feed from Maggot",
    khCategory: "Aquaculture", subCategory: "Fish Feed", level: "Intermediate",
    pathways: ["Tilapia"], instructorSlug: "sumartin" },
  { khCode: "BARUNA-FPVA-CF-010", scCode: "BARUNA-SC-FPVA-010",
    shortCourseTitle: "Making Catfish Floss",
    khCategory: "Fish Processing and Value Addition", subCategory: "Fish Processing", level: "Foundation",
    pathways: ["Fish Processing and Value Addition"], instructorSlug: "erika-arisetiana-dewi" },
  { khCode: "BARUNA-FPVA-FB-011", scCode: "BARUNA-SC-FPVA-011",
    shortCourseTitle: "Producing Fishbone Cookies",
    khCategory: "Fish Processing and Value Addition", subCategory: "Fish Processing", level: "Foundation",
    pathways: ["Fish Processing and Value Addition"], instructorSlug: "emi-wati" },
  { khCode: "BARUNA-FPVA-FS-012", scCode: "BARUNA-SC-FPVA-012",
    shortCourseTitle: "Producing Fish Stick with Cheese",
    khCategory: "Fish Processing and Value Addition", subCategory: "Fish Processing", level: "Foundation",
    pathways: ["Fish Processing and Value Addition"], instructorSlug: "ricky-aditya-saputra" },
  { khCode: "BARUNA-FPVA-FB-013", scCode: "BARUNA-SC-FPVA-013",
    shortCourseTitle: "Producing Fish Bone Churros",
    khCategory: "Fish Processing and Value Addition", subCategory: "Fish Processing", level: "Intermediate",
    pathways: ["Fish Processing and Value Addition"], instructorSlug: "iman-setya-dwi-ardani" },
];

/**
 * Build the master registry from the LMS module definitions and the per-module
 * metadata above. Every fisheries module is available as a Short Course and
 * published in the Knowledge Hub → Learning Modules.
 */
export const MASTER_MODULES: MasterModule[] = LMS_MODULES.map((m: LmsModule, i) => {
  const meta = META[i];
  return {
    code: meta.scCode,
    khCode: meta.khCode,
    lmsId: m.id,
    no: m.no,
    title: m.title,
    shortCourseTitle: meta.shortCourseTitle,
    category: m.category,
    khCategory: meta.khCategory,
    subCategory: meta.subCategory,
    level: meta.level,
    language: "English",
    pathways: meta.pathways,
    instructorSlug: meta.instructorSlug,
    summary: m.summary,
    hours: m.hours,
    jp: toJp(m.hours),
    objectives: m.objectives,
    version: "v1.0",
    standalone: true,
  };
});

export const masterByCode: Record<string, MasterModule> = Object.fromEntries(
  MASTER_MODULES.map((m) => [m.code, m]),
);

export const masterByKhCode: Record<string, MasterModule> = Object.fromEntries(
  MASTER_MODULES.map((m) => [m.khCode, m]),
);

export const masterByLmsId: Record<string, MasterModule> = Object.fromEntries(
  MASTER_MODULES.map((m) => [m.lmsId, m]),
);

/** Convert an LMS module id (m1..m13) to its Master Module (Short Course) code. */
export function codeForLmsId(lmsId: string): string | undefined {
  return masterByLmsId[lmsId]?.code;
}

/** Resolve a module by any known code (short course code, KH code, or LMS id). */
export function resolveMaster(anyCode: string): MasterModule | undefined {
  return masterByCode[anyCode] ?? masterByKhCode[anyCode] ?? masterByLmsId[anyCode];
}
