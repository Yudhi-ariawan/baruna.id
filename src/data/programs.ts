import { academyImages } from "@/data/academy";
import { MASTER_MODULES } from "@/data/masterModules";
import { instructorBySlug } from "@/data/instructors";
import m01 from "@/assets/self-paced/m01.jpg";
import m02 from "@/assets/self-paced/m02.jpg";
import m03 from "@/assets/self-paced/m03.jpg";
import m04 from "@/assets/self-paced/m04.jpg";
import m05 from "@/assets/self-paced/m05.jpg";
import m06 from "@/assets/self-paced/m06.jpg";
import m07 from "@/assets/self-paced/m07.jpg";
import m08 from "@/assets/self-paced/m08.jpg";
import m09 from "@/assets/self-paced/m09.jpg";
import m10 from "@/assets/self-paced/m10.jpg";
import m11 from "@/assets/self-paced/m11.jpg";
import m12 from "@/assets/self-paced/m12.jpg";
import m13 from "@/assets/self-paced/m13.jpg";

export const PROGRAM_TYPES = [
  "training",
  "webinar",
  "workshop",
  "certification",
  "self-paced",
] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

export const PROGRAM_TYPE_LABEL: Record<ProgramType, string> = {
  training: "Training",
  webinar: "Webinar",
  workshop: "Workshop",
  certification: "Certification",
  "self-paced": "Self-paced",
};

export const PROGRAM_TYPE_SIDEBAR_LABEL: Record<ProgramType, string> = {
  training: "Training",
  webinar: "Webinar",
  workshop: "Workshop",
  certification: "Certification",
  "self-paced": "Self-paced Course",
};

export type Program = {
  id: string;
  type: ProgramType;
  title: string;
  description: string;
  image: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  language: string;
  duration: string;
  instructor: string;
  organization: string;
  country: string;
  startDate: string; // ISO
  participants: number;
  rating: number;
  reviews: number;
  status: string;
  keywords: string[];
  href: string;
};

const i = academyImages;

export const MODULE_HERO_BY_NO: Record<number, string> = {
  1: m01, 2: m02, 3: m03, 4: m04, 5: m05, 6: m06, 7: m07,
  8: m08, 9: m09, 10: m10, 11: m11, 12: m12, 13: m13,
};

// Consistent totals — see Counter Synchronization:
// training 9 + webinar 5 + workshop 6 + certification 4 + self-paced (7 + 13) = 41
export const programs: Program[] = [
  // ---------------- Training (9) ----------------
  { id: "tr-01", type: "training", title: "Sustainable Fisheries Management", description: "Principles and practices for responsible resource management.", image: i.seaTurtle, category: "Fisheries Management", level: "Beginner", language: "English", duration: "5 Days", instructor: "Dr. Sinta Mahardika", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-06-10", participants: 240, rating: 4.7, reviews: 98, status: "OPEN FOR REGISTRATION", keywords: ["fisheries", "quota", "MSY"], href: "/academy/training" },
  { id: "tr-02", type: "training", title: "Fisheries Data Collection and Monitoring", description: "Modern data collection and monitoring techniques.", image: i.fisheriesWorkers, category: "Fisheries Management", level: "Beginner", language: "Indonesian", duration: "3 Days", instructor: "Dr. Nara Samudra", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-07-05", participants: 320, rating: 4.8, reviews: 120, status: "OPEN FOR REGISTRATION", keywords: ["catch", "monitoring", "logbook"], href: "/academy/training" },
  { id: "tr-03", type: "training", title: "Aquaculture Systems and Management", description: "Fundamental principles and practices of aquaculture.", image: i.aquaculture, category: "Aquaculture", level: "Intermediate", language: "English", duration: "6 Days", instructor: "Ir. Raka Bimantara", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-05-20", participants: 180, rating: 4.6, reviews: 76, status: "UPCOMING", keywords: ["biofloc", "hatchery"], href: "/academy/training" },
  { id: "tr-04", type: "training", title: "International Training on Fisheries for African Countries", description: "Government-to-government capacity building for African fisheries officers.", image: i.fisheriesWorkers, category: "Fisheries Management", level: "Intermediate", language: "English", duration: "21 Days", instructor: "Dr. Aruna Pratama", organization: "BARUNA / KKP", country: "Indonesia", startDate: "2026-09-01", participants: 20, rating: 4.9, reviews: 42, status: "OPEN FOR REGISTRATION", keywords: ["africa", "capacity"], href: "/academy/apply/international-training-fisheries-african-countries" },
  { id: "tr-05", type: "training", title: "Marine Spatial Planning Practice", description: "Applied marine spatial planning workflows for coastal officers.", image: i.marineSpatial, category: "Ocean Governance", level: "Intermediate", language: "English", duration: "4 Days", instructor: "Prof. Dimas Cakrawala", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-08-12", participants: 90, rating: 4.5, reviews: 51, status: "UPCOMING", keywords: ["MSP", "zoning"], href: "/academy/training" },
  { id: "tr-06", type: "training", title: "Coastal Community Empowerment", description: "Facilitation techniques for coastal community programs.", image: i.mangrove, category: "Marine Conservation", level: "Beginner", language: "Indonesian", duration: "4 Days", instructor: "Dr. Maya Lestari", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-06-24", participants: 150, rating: 4.7, reviews: 63, status: "OPEN FOR REGISTRATION", keywords: ["community", "facilitation"], href: "/academy/training" },
  { id: "tr-07", type: "training", title: "Fish Processing and Product Development", description: "Improve product quality, safety, and market value.", image: i.fishProcessing, category: "Fish Processing and Value Addition", level: "Intermediate", language: "English", duration: "5 Days", instructor: "Dr. Larasati Pangan", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-07-18", participants: 110, rating: 4.6, reviews: 44, status: "UPCOMING", keywords: ["processing", "value"], href: "/academy/training" },
  { id: "tr-08", type: "training", title: "Vessel Safety and Sea Survival", description: "Practical safety-at-sea and survival training for small-vessel crew.", image: i.offshoreWind, category: "Fisheries Management", level: "Advanced", language: "English", duration: "3 Days", instructor: "Captain Aditya Wiratama", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-05-05", participants: 60, rating: 4.8, reviews: 29, status: "UPCOMING", keywords: ["safety", "SOLAS"], href: "/academy/training" },
  { id: "tr-09", type: "training", title: "Allocated Zones for Aquaculture", description: "Learn how to identify and plan priority areas for sustainable aquaculture using Marine Spatial Planning, spatial criteria, stakeholder analysis, and environmental monitoring.", image: i.marineSpatial, category: "Aquaculture", level: "Intermediate", language: "English", duration: "12–14 Hours", instructor: "Dr. Aruna Pratama", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-01-15", participants: 0, rating: 4.8, reviews: 26, status: "OPEN ENROLLMENT", keywords: ["AZA", "MSP", "GIS", "zoning", "aquaculture", "self-paced", "asynchronous"], href: "/academy/training/allocated-zones-for-aquaculture" },



  // ---------------- Webinar (5) ----------------
  { id: "we-01", type: "webinar", title: "Blue Economy and Sustainable Ocean Development", description: "Strategies for a sustainable blue economy across ASEAN.", image: i.offshoreWind, category: "Blue Economy", level: "Beginner", language: "English", duration: "1.5 Hours", instructor: "Dr. Kirana Wibawa", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-06-15", participants: 820, rating: 4.6, reviews: 76, status: "UPCOMING", keywords: ["blue economy"], href: "/academy/webinar" },
  { id: "we-02", type: "webinar", title: "Climate Change and Coastal Resilience", description: "Live panel with regional experts on adaptation strategies.", image: i.mangrove, category: "Marine Conservation", level: "Intermediate", language: "English", duration: "1 Hour", instructor: "Dr. Kirana Wibawa", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-05-28", participants: 640, rating: 4.5, reviews: 48, status: "UPCOMING", keywords: ["climate", "resilience"], href: "/academy/webinar" },
  { id: "we-03", type: "webinar", title: "Tuna Fisheries: Global Markets Update", description: "On-demand session covering global tuna trade signals.", image: i.seaTurtle, category: "Fisheries Management", level: "Intermediate", language: "English", duration: "45 Minutes", instructor: "Dr. Aruna Pratama", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-04-02", participants: 1120, rating: 4.7, reviews: 132, status: "ON DEMAND", keywords: ["tuna", "trade"], href: "/academy/webinar" },
  { id: "we-04", type: "webinar", title: "IUU Fishing: Enforcement Practice", description: "Live-now panel covering enforcement case studies.", image: i.fisheriesWorkers, category: "Ocean Governance", level: "Advanced", language: "English", duration: "1 Hour", instructor: "Captain Aditya Wiratama", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-05-01", participants: 410, rating: 4.8, reviews: 39, status: "LIVE NOW", keywords: ["IUU", "enforcement"], href: "/academy/webinar" },
  { id: "we-05", type: "webinar", title: "Women in Fisheries Leadership", description: "Series kickoff on gender inclusion in the sector.", image: i.mangrove, category: "Blue Economy", level: "Beginner", language: "Indonesian", duration: "1 Hour", instructor: "Dr. Sinta Mahardika", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-06-30", participants: 520, rating: 4.9, reviews: 66, status: "UPCOMING", keywords: ["gender", "leadership"], href: "/academy/webinar" },

  // ---------------- Workshop (6) ----------------
  { id: "wo-01", type: "workshop", title: "Coral Reef Monitoring Techniques", description: "Hands-on methods for monitoring coral reef health and biodiversity.", image: i.coralDiver, category: "Marine Conservation", level: "Intermediate", language: "English", duration: "3 Days", instructor: "Dr. Kirana Wibawa", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-06-24", participants: 54, rating: 4.9, reviews: 54, status: "UPCOMING", keywords: ["coral", "monitoring"], href: "/academy/workshop" },
  { id: "wo-02", type: "workshop", title: "Mangrove Rehabilitation and Restoration", description: "Restoring mangrove ecosystems through community-based conservation.", image: i.mangrove, category: "Marine Conservation", level: "Advanced", language: "English", duration: "3 Days", instructor: "Dr. Maya Lestari", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-07-29", participants: 41, rating: 4.8, reviews: 41, status: "UPCOMING", keywords: ["mangrove", "restoration"], href: "/academy/workshop" },
  { id: "wo-03", type: "workshop", title: "Sustainable Fisheries Management Practices", description: "Interactive workshop on responsible fishing and ecosystem-based management.", image: i.fisheriesWorkers, category: "Fisheries Management", level: "Beginner", language: "Indonesian", duration: "2 Days", instructor: "Dr. Nara Samudra", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-07-14", participants: 30, rating: 4.6, reviews: 30, status: "OPEN FOR REGISTRATION", keywords: ["EBFM"], href: "/academy/workshop" },
  { id: "wo-04", type: "workshop", title: "Introduction to Marine Spatial Planning", description: "Tools and approaches for marine spatial planning and ocean governance.", image: i.marineSpatial, category: "Ocean Governance", level: "Intermediate", language: "English", duration: "2 Days", instructor: "Prof. Dimas Cakrawala", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-08-11", participants: 40, rating: 4.7, reviews: 22, status: "UPCOMING", keywords: ["MSP"], href: "/academy/workshop" },
  { id: "wo-05", type: "workshop", title: "Fish Processing and Value Addition", description: "Improve product quality, safety, and market value.", image: i.fishProcessing, category: "Fish Processing and Value Addition", level: "Intermediate", language: "English", duration: "6 Hours", instructor: "Dr. Larasati Pangan", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-04-15", participants: 186, rating: 4.6, reviews: 65, status: "ON DEMAND", keywords: ["processing"], href: "/academy/workshop" },
  { id: "wo-06", type: "workshop", title: "Biofloc Pond Preparation Field Lab", description: "Practical field lab on preparing biofloc pond media.", image: i.aquaculture, category: "Aquaculture", level: "Advanced", language: "English", duration: "2 Days", instructor: "Ir. Raka Bimantara", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-06-05", participants: 28, rating: 4.8, reviews: 18, status: "UPCOMING", keywords: ["biofloc"], href: "/academy/workshop" },

  // ---------------- Certification (4) ----------------
  { id: "ce-01", type: "certification", title: "Marine Spatial Planning Fundamentals", description: "Competency-based certification in marine spatial planning.", image: i.marineSpatial, category: "Ocean Governance", level: "Intermediate", language: "English", duration: "15 Hours", instructor: "Prof. Dimas Cakrawala", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-05-10", participants: 220, rating: 4.6, reviews: 37, status: "OPEN FOR REGISTRATION", keywords: ["MSP", "cert"], href: "/academy/certification" },
  { id: "ce-02", type: "certification", title: "Fish Processing and Value Addition", description: "Recognized certification for processing and value addition.", image: i.fishProcessing, category: "Fish Processing and Value Addition", level: "Intermediate", language: "English", duration: "18 Hours", instructor: "Dr. Larasati Pangan", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-06-01", participants: 180, rating: 4.6, reviews: 65, status: "OPEN FOR REGISTRATION", keywords: ["HACCP"], href: "/academy/certification" },
  { id: "ce-03", type: "certification", title: "Aquaculture Biosecurity", description: "Certification on biosecurity practices in aquaculture.", image: i.aquaculture, category: "Aquaculture", level: "Advanced", language: "English", duration: "20 Hours", instructor: "Ir. Raka Bimantara", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-07-01", participants: 140, rating: 4.7, reviews: 48, status: "UPCOMING", keywords: ["biosecurity"], href: "/academy/certification" },
  { id: "ce-04", type: "certification", title: "Fisheries Observer Certification", description: "Standardized certification for at-sea fisheries observers.", image: i.fisheriesWorkers, category: "Fisheries Management", level: "Advanced", language: "English", duration: "24 Hours", instructor: "Captain Aditya Wiratama", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-08-05", participants: 95, rating: 4.8, reviews: 33, status: "UPCOMING", keywords: ["observer"], href: "/academy/certification" },

  // ---------------- Self-paced illustrated standalone (7) ----------------
  { id: "sp-01", type: "self-paced", title: "Aquaculture Systems Foundations", description: "Self-paced fundamentals of aquaculture systems.", image: i.aquaculture, category: "Aquaculture", level: "Beginner", language: "English", duration: "6 Hours", instructor: "Ir. Raka Bimantara", organization: "BARUNA Academy", country: "Indonesia", startDate: "2025-11-01", participants: 980, rating: 4.7, reviews: 210, status: "ONLINE", keywords: ["aquaculture"], href: "/academy/self-paced/sp-01" },
  { id: "sp-02", type: "self-paced", title: "Introduction to Blue Economy", description: "Flexible online course on blue economy concepts.", image: i.offshoreWind, category: "Blue Economy", level: "Beginner", language: "English", duration: "4 Hours", instructor: "Dr. Kirana Wibawa", organization: "BARUNA Academy", country: "Indonesia", startDate: "2025-12-10", participants: 1240, rating: 4.6, reviews: 302, status: "ONLINE", keywords: ["blue economy"], href: "/academy/self-paced/sp-02" },
  { id: "sp-03", type: "self-paced", title: "Coral Reef Ecology Essentials", description: "Learn essentials of coral reef ecology at your own pace.", image: i.coralDiver, category: "Marine Conservation", level: "Beginner", language: "English", duration: "5 Hours", instructor: "Dr. Kirana Wibawa", organization: "BARUNA Academy", country: "Indonesia", startDate: "2025-10-15", participants: 760, rating: 4.8, reviews: 165, status: "ONLINE", keywords: ["coral"], href: "/academy/self-paced/sp-03" },
  { id: "sp-04", type: "self-paced", title: "Fisheries Statistics 101", description: "Self-paced fundamentals of fisheries statistics.", image: i.fisheriesWorkers, category: "Fisheries Management", level: "Intermediate", language: "English", duration: "8 Hours", instructor: "Dr. Nara Samudra", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-01-20", participants: 540, rating: 4.5, reviews: 121, status: "ONLINE", keywords: ["statistics"], href: "/academy/self-paced/sp-04" },
  { id: "sp-05", type: "self-paced", title: "Sustainable Seafood for Buyers", description: "For buyers and retailers new to responsible sourcing.", image: i.seaTurtle, category: "Blue Economy", level: "Beginner", language: "English", duration: "3 Hours", instructor: "Dr. Sinta Mahardika", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-02-01", participants: 430, rating: 4.6, reviews: 88, status: "ONLINE", keywords: ["seafood"], href: "/academy/self-paced/sp-05" },
  { id: "sp-06", type: "self-paced", title: "Mangrove Basics", description: "Self-paced overview of mangrove ecosystems.", image: i.mangrove, category: "Marine Conservation", level: "Beginner", language: "Indonesian", duration: "2 Hours", instructor: "Dr. Maya Lestari", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-03-05", participants: 610, rating: 4.7, reviews: 140, status: "ONLINE", keywords: ["mangrove"], href: "/academy/self-paced/sp-06" },
  { id: "sp-07", type: "self-paced", title: "HACCP for Fish Processing", description: "Self-paced primer on HACCP for small processors.", image: i.fishProcessing, category: "Fish Processing and Value Addition", level: "Intermediate", language: "English", duration: "5 Hours", instructor: "Dr. Larasati Pangan", organization: "BARUNA Academy", country: "Indonesia", startDate: "2026-03-20", participants: 380, rating: 4.7, reviews: 71, status: "ONLINE", keywords: ["HACCP"], href: "/academy/self-paced/sp-07" },

  // ---------------- Self-paced Master Module courses (13) — derived below ----------------
  ...moduleSelfPacedPrograms(),
];

/** Deterministic social-proof numbers derived from module number. */
function socialProofFor(no: number) {
  const ratings = [4.6, 4.7, 4.8, 4.9, 4.7, 4.8, 4.9, 4.8, 4.7, 4.8, 4.9, 4.7, 4.8];
  const reviews = [142, 168, 205, 187, 133, 176, 219, 164, 151, 128, 197, 145, 158];
  const learners = [612, 748, 903, 826, 534, 812, 1042, 726, 618, 489, 971, 552, 641];
  const idx = (no - 1) % ratings.length;
  return { rating: ratings[idx], reviews: reviews[idx], learners: learners[idx] };
}


/** Derive the 13 module-based Self-Paced courses from the master registry so
 *  the catalogue, filters and detail views all read from the same source. */
function moduleSelfPacedPrograms(): Program[] {
  return MASTER_MODULES.map((m) => {
    const sp = socialProofFor(m.no);
    const trainer = instructorBySlug[m.instructorSlug]?.name ?? "BARUNA Instructor";
    const level: Program["level"] = m.level === "Foundation" ? "Beginner" : "Intermediate";
    return {
      id: `sp-m${String(m.no).padStart(2, "0")}`,
      type: "self-paced",
      title: m.shortCourseTitle,
      description: m.summary,
      image: MODULE_HERO_BY_NO[m.no],
      category: m.khCategory,
      level,
      language: m.language,
      duration: `${m.hours} Hours`,
      instructor: trainer,
      organization: "BARUNA Academy",
      country: "Indonesia",
      startDate: "2026-01-01",
      participants: sp.learners,
      rating: sp.rating,
      reviews: sp.reviews,
      status: "ONLINE",
      keywords: [m.subCategory.toLowerCase(), m.khCategory.toLowerCase(), m.code],
      href: `/academy/self-paced/${m.code}`,
    };
  });
}

export function programsByType(type: ProgramType): Program[] {
  return programs.filter((p) => p.type === type);
}
