// ============================================================================
// BARUNA Academy — Learning Management System (LMS) content
// ----------------------------------------------------------------------------
// Defines the full learning structure for the training program
// "International Training on Fisheries for African Countries":
//   Welcome → 13 Learning Modules → Assessment → Assignments → Completion
// Modules 1–10 link to the official PDF modules already uploaded to the CDN.
// Modules 11–13 carry realistic placeholders until materials are uploaded.
// Each module exposes 5 resource slots: Video, PDF, PowerPoint, Reading, Quiz.
// ============================================================================

import m01 from "@/assets/modules/module-01-preparing-biofloc-containers-and-media.pdf.asset.json";
import m02 from "@/assets/modules/module-02-preparation-of-biofloc-pond-media.pdf.asset.json";
import m03 from "@/assets/modules/module-03-catfish-hatchery-and-seed-management.pdf.asset.json";
import m04 from "@/assets/modules/module-04-catfish-aquaculture.pdf.asset.json";
import m05 from "@/assets/modules/module-05-making-catfish-feed-from-maggot.pdf.asset.json";
import m06 from "@/assets/modules/module-06-tilapia-hatchery-and-management.pdf.asset.json";
import m07 from "@/assets/modules/module-07-tilapia-cultivation-using-biofloc-system.pdf.asset.json";
import m08 from "@/assets/modules/module-08-vaccine-and-vaccination.pdf.asset.json";
import m09 from "@/assets/modules/module-09-making-tilapia-feed-from-maggot.pdf.asset.json";
import m10 from "@/assets/modules/module-10-making-catfish-floss.pdf.asset.json";
import m11 from "@/assets/modules/module-11-fishbone-cookies.pdf.asset.json";
import m12 from "@/assets/modules/module-12-fish-stick-cheese.pdf.asset.json";
import m13 from "@/assets/modules/module-13-fish-bone-churros.pdf.asset.json";

// The training slug this LMS belongs to.
export const LMS_TRAINING_SLUG = "international-training-fisheries-african-countries";

export type ResourceKind = "video" | "pdf" | "ppt" | "reading" | "quiz";

export type ModuleResource = {
  kind: ResourceKind;
  title: string;
  /** Real material URL when available, otherwise null (placeholder). */
  url: string | null;
  /** Short descriptor shown under the resource title. */
  meta: string;
};

export type LmsModule = {
  id: string;
  no: number;
  title: string;
  category: string;
  summary: string;
  hours: number;
  objectives: string[];
  resources: Record<ResourceKind, ModuleResource>;
};

function makeResources(opts: {
  videoMin: number;
  pdf: string | null;
  pdfPages: string;
  pptSlides: string;
  reading: string;
  quizQuestions: number;
}): Record<ResourceKind, ModuleResource> {
  return {
    video: {
      kind: "video",
      title: "Module Video Lecture",
      url: null,
      meta: `Video · ~${opts.videoMin} min · uploading soon`,
    },
    pdf: {
      kind: "pdf",
      title: "PDF Module Handbook",
      url: opts.pdf,
      meta: opts.pdf ? `PDF · ${opts.pdfPages}` : `PDF · ${opts.pdfPages} · uploading soon`,
    },
    ppt: {
      kind: "ppt",
      title: "PowerPoint Presentation",
      url: null,
      meta: `Slides · ${opts.pptSlides} · uploading soon`,
    },
    reading: {
      kind: "reading",
      title: "Additional Reading",
      url: null,
      meta: opts.reading,
    },
    quiz: {
      kind: "quiz",
      title: "Module Quiz",
      url: null,
      meta: `${opts.quizQuestions} questions · pass mark 70%`,
    },
  };
}

export const LMS_MODULES: LmsModule[] = [
  {
    id: "m1",
    no: 1,
    title: "Preparing Biofloc Containers and Media",
    category: "Biofloc Technology",
    summary:
      "Set up biofloc containers and prepare the starter media, covering material selection, container sanitation, aeration, and baseline water quality.",
    hours: 3,
    objectives: [
      "Select and sanitize suitable biofloc containers",
      "Install aeration and water circulation systems",
      "Prepare starter media and measure baseline water quality",
    ],
    resources: makeResources({ videoMin: 22, pdf: m01.url, pdfPages: "official module", pptSlides: "24 slides", reading: "Water quality parameters reference sheet", quizQuestions: 10 }),
  },
  {
    id: "m2",
    no: 2,
    title: "Preparation of Biofloc Pond Media",
    category: "Biofloc Technology",
    summary:
      "Build and balance pond media for biofloc culture: carbon sources, C/N ratio management, probiotic inoculation, and floc development monitoring.",
    hours: 3,
    objectives: [
      "Calculate and apply the correct C/N ratio",
      "Inoculate and grow beneficial microbial communities",
      "Monitor floc volume and adjust management accordingly",
    ],
    resources: makeResources({ videoMin: 24, pdf: m02.url, pdfPages: "official module", pptSlides: "26 slides", reading: "Carbon source dosing guide", quizQuestions: 10 }),
  },
  {
    id: "m3",
    no: 3,
    title: "Catfish Hatchery and Seed Management",
    category: "Hatchery & Seed",
    summary:
      "Manage catfish broodstock, induced spawning, egg incubation, larval rearing, and seed grading to produce healthy, uniform fingerlings.",
    hours: 4,
    objectives: [
      "Select and condition quality broodstock",
      "Perform induced spawning and egg incubation",
      "Rear larvae and grade seed for grow-out",
    ],
    resources: makeResources({ videoMin: 28, pdf: m03.url, pdfPages: "official module", pptSlides: "30 slides", reading: "Larval feeding schedule chart", quizQuestions: 10 }),
  },
  {
    id: "m4",
    no: 4,
    title: "Catfish Aquaculture",
    category: "Aquaculture Production",
    summary:
      "Grow-out management for catfish in biofloc systems: stocking density, feeding regimes, water quality control, and growth monitoring.",
    hours: 4,
    objectives: [
      "Determine optimal stocking density and feeding rate",
      "Maintain water quality during grow-out",
      "Monitor growth and estimate feed conversion ratio",
    ],
    resources: makeResources({ videoMin: 26, pdf: m04.url, pdfPages: "official module", pptSlides: "28 slides", reading: "Feeding and growth monitoring log template", quizQuestions: 10 }),
  },
  {
    id: "m5",
    no: 5,
    title: "Making Catfish Feed from Maggot",
    category: "Feed Development",
    summary:
      "Produce sustainable catfish feed using black soldier fly (BSF) maggots: BSF cultivation, harvesting, feed formulation, and pelletizing.",
    hours: 3,
    objectives: [
      "Cultivate and harvest BSF larvae",
      "Formulate balanced maggot-based feed",
      "Process and store feed pellets correctly",
    ],
    resources: makeResources({ videoMin: 21, pdf: m05.url, pdfPages: "official module", pptSlides: "22 slides", reading: "Feed formulation worksheet", quizQuestions: 10 }),
  },
  {
    id: "m6",
    no: 6,
    title: "Tilapia Hatchery and Management",
    category: "Hatchery & Seed",
    summary:
      "Operate a tilapia hatchery from broodstock conditioning through spawning, fry collection, sex reversal basics, and nursery management.",
    hours: 4,
    objectives: [
      "Condition tilapia broodstock for spawning",
      "Collect and incubate eggs and fry",
      "Manage the nursery phase for strong fingerlings",
    ],
    resources: makeResources({ videoMin: 27, pdf: m06.url, pdfPages: "official module", pptSlides: "30 slides", reading: "Hatchery record-keeping forms", quizQuestions: 10 }),
  },
  {
    id: "m7",
    no: 7,
    title: "Tilapia Cultivation Using Biofloc System",
    category: "Aquaculture Production",
    summary:
      "Apply the biofloc system to tilapia grow-out: system preparation, stocking, water quality maintenance, and routine operation.",
    hours: 4,
    objectives: [
      "Prepare a biofloc system for tilapia",
      "Manage stocking and daily water quality",
      "Maintain the system through the production cycle",
    ],
    resources: makeResources({ videoMin: 26, pdf: m07.url, pdfPages: "official module", pptSlides: "28 slides", reading: "Daily water quality checklist", quizQuestions: 10 }),
  },
  {
    id: "m8",
    no: 8,
    title: "Vaccine and Vaccination in Tilapia Farming",
    category: "Fish Health",
    summary:
      "Protect tilapia stocks through vaccination: common diseases, vaccine types, administration techniques, and biosecurity practices.",
    hours: 3,
    objectives: [
      "Identify common tilapia diseases and risks",
      "Select appropriate vaccines and dosages",
      "Apply vaccination and biosecurity protocols",
    ],
    resources: makeResources({ videoMin: 23, pdf: m08.url, pdfPages: "official module", pptSlides: "24 slides", reading: "Biosecurity protocol summary", quizQuestions: 10 }),
  },
  {
    id: "m9",
    no: 9,
    title: "Making Tilapia Feed from Maggot",
    category: "Feed Development",
    summary:
      "Formulate and produce tilapia feed from maggot meal: ingredient mixing, pelletizing, drying, and quality control.",
    hours: 3,
    objectives: [
      "Formulate maggot-based tilapia feed",
      "Mix, pelletize and dry the feed",
      "Apply quality control and storage practices",
    ],
    resources: makeResources({ videoMin: 21, pdf: m09.url, pdfPages: "official module", pptSlides: "22 slides", reading: "Pelletizing and drying guide", quizQuestions: 10 }),
  },
  {
    id: "m10",
    no: 10,
    title: "Making Catfish Floss",
    category: "Value-Added Processing",
    summary:
      "Process catfish into shelf-stable floss (abon): raw material handling, cooking, shredding, seasoning, frying, and packaging.",
    hours: 3,
    objectives: [
      "Prepare and cook raw catfish for processing",
      "Shred, season and fry to produce floss",
      "Package and label the finished product",
    ],
    resources: makeResources({ videoMin: 20, pdf: m10.url, pdfPages: "official module", pptSlides: "20 slides", reading: "Floss processing flowchart", quizQuestions: 10 }),
  },
  {
    id: "m11",
    no: 11,
    title: "Fishbone Cookies",
    category: "Value-Added Processing",
    summary:
      "Turn fish bones into nutritious calcium-rich cookies: bone preparation, flour production, dough mixing, baking, and packaging.",
    hours: 2,
    objectives: [
      "Process fish bones into edible flour",
      "Mix dough and bake the cookies",
      "Package and present the value-added product",
    ],
    resources: makeResources({ videoMin: 18, pdf: m11.url, pdfPages: "official module", pptSlides: "18 slides", reading: "Calcium enrichment reference", quizQuestions: 10 }),
  },
  {
    id: "m12",
    no: 12,
    title: "Fish Stick Cheese",
    category: "Value-Added Processing",
    summary:
      "Develop fish stick cheese snacks: fish processing, cheese formulation, shaping, coating, frying, and packaging.",
    hours: 3,
    objectives: [
      "Process fish into a workable paste",
      "Formulate, shape and coat fish stick cheese",
      "Fry, package and store the product",
    ],
    resources: makeResources({ videoMin: 19, pdf: m12.url, pdfPages: "official module", pptSlides: "20 slides", reading: "Coating and frying best practices", quizQuestions: 10 }),
  },
  {
    id: "m13",
    no: 13,
    title: "Fish Bone Churros Making Technique",
    category: "Value-Added Processing",
    summary:
      "Create fish bone churros: fish bone flour preparation, dough making, piping, frying, coating, and packaging.",
    hours: 3,
    objectives: [
      "Prepare fish bone flour for baking",
      "Make and pipe the churros dough",
      "Fry, coat and package the churros",
    ],
    resources: makeResources({ videoMin: 19, pdf: m13.url, pdfPages: "official module", pptSlides: "20 slides", reading: "Dough hydration guide", quizQuestions: 10 }),
  },
];

export const LMS_MODULE_IDS = LMS_MODULES.map((m) => m.id);

export const LMS_TOTAL_HOURS = LMS_MODULES.reduce((sum, m) => sum + m.hours, 0);

/** Official training period shown on the certificate and transcript. */
export const TRAINING_DATES = "10 – 28 August 2026";

// ── Welcome section ──────────────────────────────────────────────────────────
export type WelcomeItem = {
  key: string;
  title: string;
  desc: string;
  kind: "video" | "guide" | "journey" | "handbook";
  meta: string;
};

export const WELCOME_ITEMS: WelcomeItem[] = [
  {
    key: "welcome-video",
    title: "Welcome Video",
    desc: "A warm introduction to the program, the BARUNA Academy team, and your instructors for the weeks ahead.",
    kind: "video",
    meta: "Video · ~6 min · uploading soon",
  },
  {
    key: "program-guide",
    title: "Program Guide",
    desc: "How the hybrid learning journey works, key dates, expectations, and how to get the most out of the platform.",
    kind: "guide",
    meta: "PDF guide · downloadable",
  },
  {
    key: "learning-journey",
    title: "Learning Journey",
    desc: "Your roadmap from pre-course e-learning to in-person training in Bali and post-course follow-up.",
    kind: "journey",
    meta: "Interactive overview",
  },
  {
    key: "participant-handbook",
    title: "Participant Handbook",
    desc: "Logistics, code of conduct, certification requirements, and contacts you will need throughout the program.",
    kind: "handbook",
    meta: "PDF handbook · downloadable",
  },
];

// ── Assessment section ───────────────────────────────────────────────────────
export type AssessmentItem = {
  key: "preTest" | "postTest";
  title: string;
  desc: string;
  questions: number;
  meta: string;
};

export const PRE_TEST: AssessmentItem = {
  key: "preTest",
  title: "Pre-Test",
  desc: "Baseline knowledge assessment taken before Module 1 to measure your starting point. Your score is stored but does not affect graduation.",
  questions: 20,
  meta: "20 questions · randomized · 1 attempt · no pass mark",
};

export const POST_TEST: AssessmentItem = {
  key: "postTest",
  title: "Post-Test",
  desc: "Comprehensive assessment taken after Module 13 to measure the knowledge gained during the training. Required for certification.",
  questions: 20,
  meta: "20 questions · randomized · pass mark 70% · 3 attempts",
};

/** Final Examination — comprehensive timed exam covering all modules. */
export const FINAL_EXAM: AssessmentItem = {
  key: "postTest",
  title: "Final Examination",
  desc: "Comprehensive assessment covering all training topics. Randomized, timed, and required to unlock the Action Plan assignment.",
  questions: 30,
  meta: "30 questions · randomized · pass mark 70% · 45 min · 2 attempts",
};


// ── Assignments section ──────────────────────────────────────────────────────
export type AssignmentDef = {
  key: string;
  title: string;
  desc: string;
  accept: string;
  hint: string;
};

export const LMS_ASSIGNMENTS: AssignmentDef[] = [
  {
    key: "country",
    title: "Country Assignment",
    desc: "Prepare a fisheries and aquaculture profile of your country, including key species, challenges, and opportunities.",
    accept: ".pdf,.ppt,.pptx,.doc,.docx",
    hint: "PDF, PPT or DOC",
  },
  {
    key: "reflection",
    title: "Reflection Assignment",
    desc: "Reflect on your key learnings from the modules and how they apply to your professional context.",
    accept: ".pdf,.doc,.docx",
    hint: "PDF or DOC",
  },
  {
    key: "actionPlan",
    title: "Action Plan Submission",
    desc: "Develop a practical action plan to implement biofloc, hatchery, feed, or processing techniques back home.",
    accept: ".pdf,.doc,.docx",
    hint: "PDF or DOC",
  },
];
