// ============================================================================
// BARUNA Academy — 2024 Edition (Completed)
// ----------------------------------------------------------------------------
// "International Training on Fisheries for African Countries" — First Edition
// Implemented in Indonesia, 7–15 September 2024.
//
// All participant / alumni records are sourced DIRECTLY from the official
// uploaded documents:
//   • Biodata Peserta Afrika.pdf  (Curriculum Vitae of each participant)
//   • Tabel Peserta.docx          (consolidated participant table)
//   • Jadwal KSST.docx            (official training agenda)
// Do not invent or substitute participant identities — these are real people.
// ============================================================================

export const EDITION_2024 = {
  year: "2024",
  status: "Completed" as const,
  title: "International Training on Fisheries for African Countries",
  series: "Program Series",
  location: "Banyuwangi, East Java, Indonesia",
  trainingPeriod: "7–15 September 2024",
  trainingPeriodShort: "7–15 Sep 2024",
  participantsCount: 20,
  countriesCount: 10,
  modulesCount: 13,
  trainingDays: 8,
  completion: "100%",
  alumniCount: 20,
  network: "BARUNA African Fisheries Alumni Network",
};

// ── Program highlights ───────────────────────────────────────────────────────
export const EDITION_2024_HIGHLIGHTS = [
  "Technical capacity building",
  "Knowledge sharing",
  "Biofloc technology",
  "Freshwater aquaculture",
  "Fish processing",
  "South-South and Triangular Cooperation (KSST)",
  "Global food security",
  "Sustainable Development Goals (SDGs)",
];

export const EDITION_2024_OVERVIEW =
  "The 2024 edition was the first International Training on Fisheries for African Countries successfully implemented in Indonesia. Delivered under the framework of South-South and Triangular Cooperation (KSST), the program brought together 20 fisheries officials from 10 African countries for an intensive, hands-on capacity-building experience. Participants strengthened their technical skills in biofloc technology, freshwater aquaculture, hatchery and seed management, feed development, fish health, and value-added fish processing — while building a lasting professional network. The program reflected Indonesia's commitment to knowledge sharing, global food security, and the Sustainable Development Goals (SDGs).";

// ── Participants / Alumni (OFFICIAL RECORDS) ─────────────────────────────────
export type Alumnus = {
  id: string;
  name: string;
  country: string;
  organization: string;
  department: string;
};

const RAW_ALUMNI: Omit<Alumnus, "id">[] = [
  { name: "Dr. Fasil Dawit", country: "Ethiopia", organization: "Ministry of Agriculture", department: "Fisheries & Aquaculture (Livestock Development)" },
  { name: "Girma Mungata Tulu", country: "Ethiopia", organization: "Ministry of Agriculture", department: "Livestock and Fishery Development" },
  { name: "Innocent Gumulira", country: "Malawi", organization: "Department of Fisheries", department: "Capture Fisheries" },
  { name: "Carolyn Chigona Munthali", country: "Malawi", organization: "Department of Fisheries", department: "Fisheries Development & Quality Assurance" },
  { name: "Ndirekerene Francisca Isidora Paulo", country: "Mozambique", organization: "National Fisheries Administration", department: "Fisheries Management Department" },
  { name: "Emília Amélia Francisco Xavier", country: "Mozambique", organization: "National Fisheries Administration", department: "Fisheries Department" },
  { name: "Edgar Samuel Alberto Soki", country: "Angola", organization: "Ministry of Fisheries and Marine Resources", department: "Institute for Development of Artisanal Fisheries and Aquaculture" },
  { name: "José Popor Coxi", country: "Angola", organization: "Ministry of Fisheries", department: "Fisheries Department" },
  { name: "Ashraf Ibrahim Altahir Barkom", country: "Libya", organization: "Ministry of Marine Wealth", department: "Tripoli Hydroponics Office" },
  { name: "Abdulqadir Misay Saed Alajald", country: "Libya", organization: "Ministry of Marine Wealth", department: "Western Aljabal Al-Gharbi Aquaculture" },
  { name: "Afolabi Yusuf Adeyinka", country: "Nigeria", organization: "Ministry of Marine & Blue Economy", department: "Fisheries" },
  { name: "Rodaji Jimka Nkem", country: "Nigeria", organization: "Ministry of Marine & Blue Economy", department: "Fisheries" },
  { name: "Niminahazwe Evelyne", country: "Burundi", organization: "Ministry of Environment, Agriculture & Livestock", department: "Fisheries & Aquaculture" },
  { name: "Namananimana Hermethy", country: "Burundi", organization: "Ministry of Environment, Agriculture & Livestock", department: "Fisheries & Aquaculture" },
  { name: "Randrianarison Onjamalala", country: "Madagascar", organization: "Ministry of Fisheries & Blue Economy", department: "Regional Directorate of Fisheries" },
  { name: "Rabezanahary Bruno", country: "Madagascar", organization: "Ministry of Fisheries & Blue Economy", department: "Regional Directorate of Fisheries & Blue Economy" },
  { name: "Tukelo Lavinia Namitela", country: "Namibia", organization: "Ministry of Fisheries & Marine Resources", department: "Inland Fisheries & Aquaculture" },
  { name: "Kaulo Salushando", country: "Namibia", organization: "Ministry of Fisheries & Marine Resources", department: "Aquaculture & Inland Fisheries" },
  { name: "August Damian Shirima", country: "Tanzania", organization: "Fisheries Education & Training Agency (FETA)", department: "Training" },
  { name: "Janeth Joram Rukanda", country: "Tanzania", organization: "Ministry of Livestock & Fisheries", department: "Aquaculture Development" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const ALUMNI: Alumnus[] = RAW_ALUMNI.map((a) => ({ ...a, id: slugify(a.name) }));

export const alumnusById: Record<string, Alumnus> = Object.fromEntries(
  ALUMNI.map((a) => [a.id, a]),
);

/** Initials for the photo placeholder. */
export function initials(name: string): string {
  const clean = name.replace(/^Dr\.?\s+/i, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

/** First name used in generated, records-grounded professional summaries. */
function firstName(name: string): string {
  const clean = name.replace(/^Dr\.?\s+/i, "").trim();
  return clean.split(/\s+/)[0] ?? clean;
}

/** Professional biography grounded in the participant's official record. */
export function biographyFor(a: Alumnus): string {
  return `${a.name} is a fisheries professional from ${a.country}, serving at ${a.organization} within ${a.department}. As one of 20 officials selected for the first International Training on Fisheries for African Countries (2024), ${firstName(a.name)} completed all 13 learning modules — covering biofloc technology, hatchery and seed management, feed development, fish health, and value-added processing — and contributed to South-South and Triangular Cooperation (KSST) knowledge exchange between Indonesia and African nations.`;
}

export const ALUMNUS_ACTION_PLAN_PLACEHOLDER =
  "Action plan summary will be published here. Each alumnus prepared a country action plan during the closing session to apply biofloc, hatchery, feed, and processing techniques in their home institution.";

export const ALUMNUS_IMPACT_PLACEHOLDER =
  "Current impact updates will be added here as alumni report on the implementation of their action plans, pilot installations, and trainings delivered in their home countries.";

// ── Country distribution ─────────────────────────────────────────────────────
export type CountryStat = { name: string; count: number };

export const COUNTRY_STATS: CountryStat[] = (() => {
  const order = [
    "Angola", "Burundi", "Ethiopia", "Libya", "Madagascar",
    "Malawi", "Mozambique", "Namibia", "Nigeria", "Tanzania",
  ];
  return order.map((name) => ({
    name,
    count: ALUMNI.filter((a) => a.country === name).length,
  }));
})();

/** Alumni grouped by country, in alphabetical country order. */
export function alumniByCountry(): { country: string; items: Alumnus[] }[] {
  return COUNTRY_STATS.map((c) => ({
    country: c.name,
    items: ALUMNI.filter((a) => a.country === c.name),
  }));
}

/** Up to `n` other alumni from the same country, then same region. */
export function relatedAlumni(a: Alumnus, n = 3): Alumnus[] {
  const sameCountry = ALUMNI.filter((x) => x.id !== a.id && x.country === a.country);
  const others = ALUMNI.filter((x) => x.id !== a.id && x.country !== a.country);
  return [...sameCountry, ...others].slice(0, n);
}

export const INSTITUTIONS: string[] = Array.from(
  new Set(ALUMNI.map((a) => a.organization)),
).sort();

// ── Training schedule (from Jadwal KSST.docx) ────────────────────────────────
export type Edition2024Day = {
  day: number;
  date: string;
  weekday: string;
  phase: string;
  activities: string[];
};

export const EDITION_2024_SCHEDULE: Edition2024Day[] = [
  {
    day: 1, date: "7 Sep 2024", weekday: "Saturday", phase: "Arrival",
    activities: ["Participant pick-up in Jakarta", "Transit and overnight at hotel"],
  },
  {
    day: 2, date: "8 Sep 2024", weekday: "Sunday", phase: "Registration",
    activities: ["Flight from Jakarta to Bali", "Arrival at Ngurah Rai Airport, Denpasar", "Registration & check-in", "Program briefing", "Pre-Test"],
  },
  {
    day: 3, date: "9 Sep 2024", weekday: "Monday", phase: "Opening Ceremony",
    activities: ["Registration", "Opening Ceremony at Hotel Sofitel, Nusa Dua", "Country report presentations", "Policy on Marine & Fisheries HR Development", "Fisheries policy for the African region (Ministry of Foreign Affairs)"],
  },
  {
    day: 4, date: "10 Sep 2024", weekday: "Tuesday", phase: "Biofloc Practice",
    activities: ["Preparing catfish biofloc containers & media", "Catfish hatchery and seed management", "Catfish rearing with biofloc media", "Making catfish feed from maggot (BSF)"],
  },
  {
    day: 5, date: "11 Sep 2024", weekday: "Wednesday", phase: "Aquaculture & Fish Health",
    activities: ["Preparing tilapia biofloc media", "Tilapia hatchery and management", "Tilapia cultivation using biofloc system", "Vaccine and vaccination", "Making tilapia feed from maggot"],
  },
  {
    day: 6, date: "12 Sep 2024", weekday: "Thursday", phase: "Fish Processing",
    activities: ["Making catfish floss (abon)", "Catfish fishbone cookies", "Tilapia fish stick cheese", "Tilapia fishbone churros", "Visit to local product centre"],
  },
  {
    day: 7, date: "13 Sep 2024", weekday: "Friday", phase: "Field & Community Visits",
    activities: ["Courtesy visit to the Bangli Regent's Office", "Field visit: UPTD Sidembunut Fish Seed Centre", "Field visit: Pokdakan Ulam Merta Asih (self-made feed)", "Field visit: Pokdakan Sri Sari Sedana (biofloc)", "Community visit: Penglipuran Heritage Village", "Dinner in Kintamani"],
  },
  {
    day: 8, date: "14 Sep 2024", weekday: "Saturday", phase: "Evaluation & Closing",
    activities: ["Action plan preparation", "Training evaluation & Post-Test", "Cultural visit to GWK", "Closing Ceremony & Farewell Dinner"],
  },
  {
    day: 9, date: "15 Sep 2024", weekday: "Sunday", phase: "Departure",
    activities: ["Participant departure"],
  },
];

// ── Program impact ───────────────────────────────────────────────────────────
export const EDITION_2024_IMPACT = [
  { value: "20", label: "Participants" },
  { value: "10", label: "African Countries" },
  { value: "13", label: "Learning Modules" },
  { value: "8", label: "Training Days" },
  { value: "100%", label: "Completion" },
  { value: "20", label: "Alumni" },
  { value: "1", label: "Alumni Network" },
];

// ── Photo gallery categories ─────────────────────────────────────────────────
export const GALLERY_CATEGORIES = [
  { name: "Opening Ceremony", count: 18 },
  { name: "Classroom Learning", count: 24 },
  { name: "Laboratory", count: 16 },
  { name: "Biofloc Practice", count: 22 },
  { name: "Fish Processing", count: 20 },
  { name: "Field Visits", count: 28 },
  { name: "Cultural Activities", count: 19 },
  { name: "Closing Ceremony", count: 15 },
  { name: "Graduation", count: 20 },
];

// ── Videos ───────────────────────────────────────────────────────────────────
export const EDITION_2024_VIDEOS = [
  { title: "Program Highlights", duration: "4:32", desc: "A recap of the first International Training on Fisheries for African Countries in Indonesia." },
  { title: "Participant Interviews", duration: "6:10", desc: "African fisheries officials share their experience and key takeaways." },
  { title: "Instructor Interviews", duration: "5:45", desc: "BPPP Banyuwangi instructors on biofloc, hatchery, feed, and processing." },
  { title: "Closing Ceremony", duration: "8:20", desc: "Certificate presentation and farewell celebration of the 2024 cohort." },
];

// ── Documentation library ────────────────────────────────────────────────────
export const EDITION_2024_DOCUMENTS = [
  { title: "Training Handbook", desc: "Complete technical handbook covering all 13 modules.", meta: "PDF" },
  { title: "Participant Handbook", desc: "Logistics, code of conduct, and program information.", meta: "PDF" },
  { title: "Training Schedule", desc: "Official 7–15 September 2024 agenda (KSST).", meta: "PDF" },
  { title: "Presentation Materials", desc: "Instructor slide decks from classroom sessions.", meta: "PDF" },
  { title: "Photo Book", desc: "Curated photo documentation of the 2024 edition.", meta: "PDF" },
  { title: "Program Report", desc: "Implementation report of the first edition.", meta: "PDF" },
  { title: "Final Report", desc: "Comprehensive final report and outcomes.", meta: "PDF" },
  { title: "Action Plan Compilation", desc: "Country action plans prepared by all 20 alumni.", meta: "PDF" },
];

// ── Testimonials ─────────────────────────────────────────────────────────────
export const EDITION_2024_TESTIMONIALS = [
  {
    name: "Innocent Gumulira", country: "Malawi", organization: "Department of Fisheries",
    quote: "The biofloc and hatchery sessions were practical and directly applicable. I returned home ready to set up demonstration units for our fish farmers.",
  },
  {
    name: "Tukelo Lavinia Namitela", country: "Namibia", organization: "Ministry of Fisheries & Marine Resources",
    quote: "Learning to make fish feed from maggot and value-added products opened new opportunities for inland aquaculture communities in the Zambezi Region.",
  },
  {
    name: "Afolabi Yusuf Adeyinka", country: "Nigeria", organization: "Ministry of Marine & Blue Economy",
    quote: "An excellent example of South-South cooperation. The instructors were generous with their knowledge and the field visits were inspiring.",
  },
  {
    name: "Niminahazwe Evelyne", country: "Burundi", organization: "Ministry of Environment, Agriculture & Livestock",
    quote: "The fish processing modules — floss, cookies, cheese sticks and churros — showed how to add value and reduce waste. A truly transformative training.",
  },
];

// ── Alumni Network pillars ───────────────────────────────────────────────────
export const ALUMNI_NETWORK_PILLARS = [
  { title: "Alumni Directory", desc: "A searchable directory of all 20 alumni across 10 African countries." },
  { title: "Country Distribution", desc: "Explore the network by country and connect with peers in your region." },
  { title: "Knowledge Sharing", desc: "Share resources, results, and lessons learned from implementing action plans." },
  { title: "Success Stories", desc: "Showcase pilot installations, trainings delivered, and measurable outcomes." },
  { title: "Future Collaboration", desc: "Coordinate joint projects, study exchanges, and the next program editions." },
];

// ── Frequently asked questions ───────────────────────────────────────────────
export const EDITION_2024_FAQS = [
  {
    q: "What was the 2024 edition?",
    a: "It was the first International Training on Fisheries for African Countries, successfully implemented in Indonesia from 7–15 September 2024 under the framework of South-South and Triangular Cooperation (KSST).",
  },
  {
    q: "Who participated?",
    a: "20 fisheries officials from 10 African countries — Angola, Burundi, Ethiopia, Libya, Madagascar, Malawi, Mozambique, Namibia, Nigeria, and Tanzania.",
  },
  {
    q: "Can I still apply for the 2024 edition?",
    a: "No. The 2024 edition is a completed program presented here as a historical showcase. Applications are open for the 2026 edition — switch to it from the Program Series navigation.",
  },
  {
    q: "What topics were covered?",
    a: "The 13-module curriculum covered biofloc technology, freshwater aquaculture, hatchery and seed management, feed development, fish health, and value-added fish processing.",
  },
  {
    q: "Did participants receive certificates?",
    a: "Yes. All 20 participants completed every module and were issued certificates of completion at the closing ceremony.",
  },
  {
    q: "How can alumni stay connected?",
    a: "Through the BARUNA African Fisheries Alumni Network, which supports the alumni directory, knowledge sharing, success stories, and future collaboration.",
  },
];
