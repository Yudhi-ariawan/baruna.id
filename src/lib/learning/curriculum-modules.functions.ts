import { createServerFn } from "@tanstack/react-start";

export type CurriculumModuleDoc = {
  no: number;
  title: string;
  pdfUrl: string | null;
  fileName: string | null;
  source: "database" | "lms";
  moduleDbId: string | null;
};

// 13 Official Modules Keyword Matchers
const CURRICULUM_MATCH_RULES: Array<{
  no: number;
  title: string;
  keywords: string[];
}> = [
  {
    no: 1,
    title: "Preparing Biofloc Containers and Media",
    keywords: ["container", "biofloc container", "starter media", "biofloc containers and media"],
  },
  {
    no: 2,
    title: "Preparation of Biofloc Pond Media",
    keywords: ["pond media", "biofloc pond", "c/n ratio", "probiotic", "preparation of biofloc pond"],
  },
  {
    no: 3,
    title: "Catfish Hatchery and Seed Management",
    keywords: ["catfish hatchery", "catfish seed", "broodstock", "induced spawning"],
  },
  {
    no: 4,
    title: "Catfish Aquaculture",
    keywords: ["catfish aquaculture", "catfish culture", "catfish grow-out", "density"],
  },
  {
    no: 5,
    title: "Making Catfish Feed from Maggot",
    keywords: ["catfish feed from maggot", "catfish feed", "bsf", "maggot"],
  },
  {
    no: 6,
    title: "Tilapia Hatchery and Management",
    keywords: ["tilapia hatchery", "tilapia seed", "sex reversal", "fry collection"],
  },
  {
    no: 7,
    title: "Tilapia Cultivation Using Biofloc System",
    keywords: ["tilapia cultivation using biofloc", "tilapia cultivation", "tilapia biofloc"],
  },
  {
    no: 8,
    title: "Vaccine and Vaccination in Tilapia Farming",
    keywords: ["vaccine", "vaccination", "tilapia farming", "fish health"],
  },
  {
    no: 9,
    title: "Making Tilapia Feed from Maggot",
    keywords: ["making tilapia feed from maggot", "tilapia feed", "maggot meal"],
  },
  {
    no: 10,
    title: "Making Catfish Floss",
    keywords: ["making catfish floss", "catfish floss", "abon", "floss"],
  },
  {
    no: 11,
    title: "Fishbone Cookies",
    keywords: ["fishbone cookies", "bone cookies", "calcium", "cookies"],
  },
  {
    no: 12,
    title: "Fish Stick Cheese",
    keywords: ["fish stick cheese", "stick cheese", "cheese", "processing method of fish stick cheese"],
  },
  {
    no: 13,
    title: "Fish Bone Churros Making Technique",
    keywords: ["fish bone churros", "churros", "flour preparation"],
  },
];

/**
 * The 13 official curriculum modules as shown on the public program pages.
 *
 * Titles only: module material is for approved participants (PB-ACA-03), so this
 * public function returns no download links. It previously signed the PDF of
 * every published database module and slotted them into the curriculum in
 * upload order, which exposed trainer modules to anyone and could show an
 * unrelated module as "Module 1".
 */
export const getCurriculumPdfMap = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<number, CurriculumModuleDoc>> => {
    const result: Record<number, CurriculumModuleDoc> = {};
    for (const rule of CURRICULUM_MATCH_RULES) {
      result[rule.no] = {
        no: rule.no,
        title: rule.title,
        pdfUrl: null,
        fileName: null,
        source: "lms",
        moduleDbId: null,
      };
    }
    return result;
  },
);
