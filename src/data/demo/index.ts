// ============================================================================
// BARUNA — Shared Demonstration Dataset (Single Source of Truth)
// ----------------------------------------------------------------------------
// Every demo page across Academy / Knowledge Hub / Experts / Events /
// Community / Partnership / Fellowship / Analytics reads from THIS module so
// numbers agree everywhere. All records are synthetic; certificates render
// with a "SAMPLE — NOT VALID" watermark and no data is ever written to a
// production store.
// ============================================================================

export type DemoCategorySlug =
  | "fisheries-management"
  | "aquaculture"
  | "marine-conservation"
  | "blue-economy"
  | "climate-change"
  | "ocean-governance"
  | "marine-spatial-planning"
  | "fisheries-surveillance"
  | "fish-processing-value-addition";

export type TrainerLevel = "certified" | "advanced" | "senior" | "master";

export const LEVEL_LABEL: Record<TrainerLevel, string> = {
  certified: "BARUNA Certified Trainer",
  advanced: "BARUNA Advanced Trainer",
  senior: "BARUNA Senior Trainer",
  master: "BARUNA Master Trainer",
};

export const LEVEL_THRESHOLD: Record<TrainerLevel, number> = {
  certified: 30,
  advanced: 100,
  senior: 1000,
  master: 10001,
};

export function nextLevel(l: TrainerLevel): TrainerLevel | null {
  const order: TrainerLevel[] = ["certified", "advanced", "senior", "master"];
  const i = order.indexOf(l);
  return i < order.length - 1 ? order[i + 1] : null;
}

// ---------- Categories --------------------------------------------------------

export type DemoCategory = {
  slug: DemoCategorySlug;
  name: string;
  tagline: string;
  colorClass: string;
};

export const DEMO_CATEGORIES: DemoCategory[] = [
  { slug: "fisheries-management", name: "Fisheries Management", tagline: "Data-based, sustainable fisheries.", colorClass: "bg-marine/10 text-marine" },
  { slug: "aquaculture", name: "Aquaculture", tagline: "Productive, low-impact fish farming.", colorClass: "bg-eco-community/10 text-eco-community" },
  { slug: "marine-conservation", name: "Marine Conservation", tagline: "Coastal ecosystems, protected together.", colorClass: "bg-teal-500/10 text-teal-700" },
  { slug: "blue-economy", name: "Blue Economy", tagline: "Coastal prosperity that sustains the sea.", colorClass: "bg-amber-500/10 text-amber-700" },
  { slug: "climate-change", name: "Climate Change", tagline: "Coastal resilience in a changing climate.", colorClass: "bg-rose-500/10 text-rose-700" },
  { slug: "ocean-governance", name: "Ocean Governance", tagline: "Collaborative rules for shared seas.", colorClass: "bg-indigo-500/10 text-indigo-700" },
  { slug: "marine-spatial-planning", name: "Marine Spatial Planning", tagline: "Participatory planning for coastal futures.", colorClass: "bg-sky-500/10 text-sky-700" },
  { slug: "fisheries-surveillance", name: "Fisheries Surveillance", tagline: "Frontline monitoring and reporting.", colorClass: "bg-cyan-600/10 text-cyan-700" },
  { slug: "fish-processing-value-addition", name: "Fish Processing & Value Addition", tagline: "Safer handling, higher value.", colorClass: "bg-orange-500/10 text-orange-700" },
];

// ---------- Experts / Trainers -----------------------------------------------

export type DemoExpert = {
  id: string;
  slug: string;
  fullName: string;
  title: string;
  organization: string;
  country: string;
  category: DemoCategorySlug;
  bio: string;
  verified: true;
  approvedTrainer: true;
  approvedAt: string;
  level: TrainerLevel;
  usp: number;              // Unique Successful Participants
  averageRating: number;    // out of 5
  completionRatePct: number;
  hasUnresolvedComplaint: false;
  moduleCode: string;
  shortCourseCode: string;
  instructionalHours: number;
};

export const DEMO_EXPERTS: DemoExpert[] = [
  { id: "e1", slug: "aruna-pratama", fullName: "Dr. Aruna Pratama", title: "Fisheries Scientist", organization: "Nusantara Fisheries Institute", country: "Indonesia",
    category: "fisheries-management", bio: "Two decades applying stock-assessment methods with small-scale fishers across the archipelago.",
    verified: true, approvedTrainer: true, approvedAt: "2024-08-12", level: "certified", usp: 42, averageRating: 4.6, completionRatePct: 84, hasUnresolvedComplaint: false,
    moduleCode: "BARUNA-FM-001", shortCourseCode: "BARUNA-FM-001", instructionalHours: 3 },
  { id: "e2", slug: "maya-lestari", fullName: "Dr. Maya Lestari", title: "Aquaculture Specialist", organization: "Marine Biotech Center Bali", country: "Indonesia",
    category: "aquaculture", bio: "Designs low-impact biofloc systems for smallholder farmers.",
    verified: true, approvedTrainer: true, approvedAt: "2024-05-30", level: "advanced", usp: 128, averageRating: 4.7, completionRatePct: 88, hasUnresolvedComplaint: false,
    moduleCode: "BARUNA-AQ-001", shortCourseCode: "BARUNA-AQ-001", instructionalHours: 4 },
  { id: "e3", slug: "nara-samudra", fullName: "Dr. Nara Samudra", title: "Marine Conservation Lead", organization: "Coral Archipelago Trust", country: "Indonesia",
    category: "marine-conservation", bio: "Community-based MPA design across eastern Indonesia.",
    verified: true, approvedTrainer: true, approvedAt: "2023-11-04", level: "senior", usp: 1240, averageRating: 4.8, completionRatePct: 91, hasUnresolvedComplaint: false,
    moduleCode: "BARUNA-MC-001", shortCourseCode: "BARUNA-MC-001", instructionalHours: 5 },
  { id: "e4", slug: "dimas-cakrawala", fullName: "Prof. Dimas Cakrawala", title: "Professor of Blue Economy", organization: "Ocean Prosperity Institute", country: "Indonesia",
    category: "blue-economy", bio: "Author of the national blue-economy roadmap; teaches practitioners worldwide.",
    verified: true, approvedTrainer: true, approvedAt: "2022-06-18", level: "master", usp: 10480, averageRating: 4.9, completionRatePct: 92, hasUnresolvedComplaint: false,
    moduleCode: "BARUNA-BE-001", shortCourseCode: "BARUNA-BE-001", instructionalHours: 3 },
  { id: "e5", slug: "kirana-wibawa", fullName: "Dr. Kirana Wibawa", title: "Climate Risk Analyst", organization: "Maritime Climate Resilience Network", country: "Indonesia",
    category: "climate-change", bio: "Applies climate-risk screening to coastal villages and small islands.",
    verified: true, approvedTrainer: true, approvedAt: "2024-09-01", level: "certified", usp: 76, averageRating: 4.6, completionRatePct: 86, hasUnresolvedComplaint: false,
    moduleCode: "BARUNA-CC-001", shortCourseCode: "BARUNA-CC-001", instructionalHours: 3 },
  { id: "e6", slug: "sinta-mahardika", fullName: "Dr. Sinta Mahardika", title: "Ocean Governance Advisor", organization: "Indo-Pacific Governance Forum", country: "Indonesia",
    category: "ocean-governance", bio: "Facilitates cross-jurisdiction fisheries agreements in the Indo-Pacific.",
    verified: true, approvedTrainer: true, approvedAt: "2024-02-14", level: "advanced", usp: 315, averageRating: 4.7, completionRatePct: 89, hasUnresolvedComplaint: false,
    moduleCode: "BARUNA-OG-001", shortCourseCode: "BARUNA-OG-001", instructionalHours: 4 },
  { id: "e7", slug: "raka-bimantara", fullName: "Ir. Raka Bimantara", title: "Marine Spatial Planner", organization: "Coastal Planning Directorate", country: "Indonesia",
    category: "marine-spatial-planning", bio: "Leads participatory MSP for provincial governments.",
    verified: true, approvedTrainer: true, approvedAt: "2023-04-22", level: "senior", usp: 1860, averageRating: 4.8, completionRatePct: 90, hasUnresolvedComplaint: false,
    moduleCode: "BARUNA-MSP-001", shortCourseCode: "BARUNA-MSP-001", instructionalHours: 5 },
  { id: "e8", slug: "aditya-wiratama", fullName: "Captain Aditya Wiratama", title: "Fisheries Surveillance Officer", organization: "Directorate of Marine Surveillance", country: "Indonesia",
    category: "fisheries-surveillance", bio: "Twenty years at sea; trains new surveillance crews in incident reporting.",
    verified: true, approvedTrainer: true, approvedAt: "2024-10-05", level: "certified", usp: 98, averageRating: 4.7, completionRatePct: 87, hasUnresolvedComplaint: false,
    moduleCode: "BARUNA-FS-001", shortCourseCode: "BARUNA-FS-001", instructionalHours: 4 },
  { id: "e9", slug: "larasati-pangan", fullName: "Dr. Larasati Pangan", title: "Food Technology Researcher", organization: "Fisheries Product Research Center", country: "Indonesia",
    category: "fish-processing-value-addition", bio: "Safety and value addition for smallholder fish processors.",
    verified: true, approvedTrainer: true, approvedAt: "2023-08-19", level: "advanced", usp: 540, averageRating: 4.7, completionRatePct: 89, hasUnresolvedComplaint: false,
    moduleCode: "BARUNA-FPVA-001", shortCourseCode: "BARUNA-FPVA-001", instructionalHours: 4 },
];

export function getExpertBySlug(slug: string) {
  return DEMO_EXPERTS.find((e) => e.slug === slug);
}
export function getExpertByCategory(cat: DemoCategorySlug) {
  return DEMO_EXPERTS.find((e) => e.category === cat)!;
}

// ---------- Approved Master Modules ------------------------------------------

export type DemoModule = {
  code: string;
  title: string;
  category: DemoCategorySlug;
  instructionalHours: number;
  version: string;
  status: "Approved & Current";
  lastReviewed: string;
  nextReviewDue: string;
  learningOutcomes: string[];
  summary: string;
  trainerId: string;
};

export const DEMO_MODULES: DemoModule[] = [
  { code: "BARUNA-FM-001", title: "Fundamentals of Data-Based Fisheries Management", category: "fisheries-management", instructionalHours: 3, version: "v1.2", status: "Approved & Current", lastReviewed: "2025-09-10", nextReviewDue: "2026-09-10",
    learningOutcomes: ["Interpret catch and effort data", "Apply simple stock indicators", "Communicate findings to fisher groups"],
    summary: "Introduces the data foundations used to keep small-scale fisheries productive.", trainerId: "e1" },
  { code: "BARUNA-AQ-001", title: "Introduction to Sustainable Biofloc Aquaculture", category: "aquaculture", instructionalHours: 4, version: "v1.3", status: "Approved & Current", lastReviewed: "2025-11-02", nextReviewDue: "2026-11-02",
    learningOutcomes: ["Explain biofloc principles", "Prepare pond media", "Monitor water quality"],
    summary: "Practical biofloc production for smallholder catfish and tilapia farmers.", trainerId: "e2" },
  { code: "BARUNA-MC-001", title: "Community-Based Marine Conservation Planning", category: "marine-conservation", instructionalHours: 5, version: "v2.0", status: "Approved & Current", lastReviewed: "2025-10-14", nextReviewDue: "2026-10-14",
    learningOutcomes: ["Facilitate community mapping", "Design co-managed MPAs", "Track ecological indicators"],
    summary: "Co-management foundations for locally-led marine protected areas.", trainerId: "e3" },
  { code: "BARUNA-BE-001", title: "Blue Economy Principles for Coastal Development", category: "blue-economy", instructionalHours: 3, version: "v1.5", status: "Approved & Current", lastReviewed: "2025-08-30", nextReviewDue: "2026-08-30",
    learningOutcomes: ["Frame blue-economy trade-offs", "Assess coastal investment options", "Translate policy into local action"],
    summary: "Strategic framing for policy-makers and coastal development officers.", trainerId: "e4" },
  { code: "BARUNA-CC-001", title: "Climate Risk Screening for Coastal Communities", category: "climate-change", instructionalHours: 3, version: "v1.1", status: "Approved & Current", lastReviewed: "2025-12-01", nextReviewDue: "2026-12-01",
    learningOutcomes: ["Run a rapid climate-risk screening", "Prioritise adaptation actions", "Engage community stakeholders"],
    summary: "A hands-on rapid method for practitioners working with coastal villages.", trainerId: "e5" },
  { code: "BARUNA-OG-001", title: "Introduction to Collaborative Ocean Governance", category: "ocean-governance", instructionalHours: 4, version: "v1.2", status: "Approved & Current", lastReviewed: "2025-07-19", nextReviewDue: "2026-07-19",
    learningOutcomes: ["Map ocean-governance actors", "Design collaborative processes", "Prevent and resolve conflicts"],
    summary: "Working with multiple jurisdictions and communities across shared seas.", trainerId: "e6" },
  { code: "BARUNA-MSP-001", title: "Fundamentals of Participatory Marine Spatial Planning", category: "marine-spatial-planning", instructionalHours: 5, version: "v1.4", status: "Approved & Current", lastReviewed: "2025-06-05", nextReviewDue: "2026-06-05",
    learningOutcomes: ["Structure a participatory MSP process", "Reconcile competing sea uses", "Present zoning options"],
    summary: "A step-by-step approach to participatory zoning of coastal waters.", trainerId: "e7" },
  { code: "BARUNA-FS-001", title: "Basic Fisheries Surveillance and Incident Reporting", category: "fisheries-surveillance", instructionalHours: 4, version: "v1.0", status: "Approved & Current", lastReviewed: "2025-11-25", nextReviewDue: "2026-11-25",
    learningOutcomes: ["Identify common IUU indicators", "Complete incident reports", "Coordinate with the authorities"],
    summary: "Essentials for frontline surveillance crews and coastal patrols.", trainerId: "e8" },
  { code: "BARUNA-FPVA-001", title: "Good Handling Practices for Value-Added Fish Products", category: "fish-processing-value-addition", instructionalHours: 4, version: "v1.2", status: "Approved & Current", lastReviewed: "2025-09-28", nextReviewDue: "2026-09-28",
    learningOutcomes: ["Apply safe handling from catch to product", "Design simple value-added products", "Meet basic hygiene standards"],
    summary: "Turning quality catches into safe, marketable food products.", trainerId: "e9" },
];

export function getModuleByCode(code: string) {
  return DEMO_MODULES.find((m) => m.code === code);
}

// ---------- Published Short Courses ------------------------------------------

export type DemoShortCourse = {
  code: string;        // matches module code for credit recognition
  title: string;
  moduleCode: string;
  trainerId: string;
  category: DemoCategorySlug;
  instructionalHours: number;
  enrollments: number;
  activeLearners: number;
  usp: number;
  completionRatePct: number;
  averageRating: number;
  averageScorePct: number;
  certificatesIssued: number;
  cohorts: number;
};

export const DEMO_SHORT_COURSES: DemoShortCourse[] = DEMO_EXPERTS.map((e) => {
  const mod = DEMO_MODULES.find((m) => m.code === e.moduleCode)!;
  const enrollments = Math.round(e.usp / (e.completionRatePct / 100));
  return {
    code: e.shortCourseCode,
    title: shortCourseTitle(e.category),
    moduleCode: mod.code,
    trainerId: e.id,
    category: e.category,
    instructionalHours: e.instructionalHours,
    enrollments,
    activeLearners: Math.max(6, Math.round(enrollments * 0.08)),
    usp: e.usp,
    completionRatePct: e.completionRatePct,
    averageRating: e.averageRating,
    averageScorePct: 78 + Math.round((e.averageRating - 4.5) * 20),
    certificatesIssued: e.usp,
    cohorts: Math.max(1, Math.round(e.usp / 40)),
  };
});

function shortCourseTitle(cat: DemoCategorySlug): string {
  switch (cat) {
    case "fisheries-management": return "Data-Based Fisheries Management: An Introduction";
    case "aquaculture": return "Sustainable Biofloc Aquaculture for Beginners";
    case "marine-conservation": return "Designing Community-Based Marine Conservation Initiatives";
    case "blue-economy": return "Applying Blue Economy Principles in Coastal Communities";
    case "climate-change": return "Practical Climate Risk Screening for Coastal Areas";
    case "ocean-governance": return "Collaborative Ocean Governance in Practice";
    case "marine-spatial-planning": return "Participatory Marine Spatial Planning Fundamentals";
    case "fisheries-surveillance": return "Fisheries Surveillance and Incident Reporting Essentials";
    case "fish-processing-value-addition": return "Safe Handling and Value Addition for Fish Products";
  }
}

export function getShortCourseByCode(code: string) {
  return DEMO_SHORT_COURSES.find((c) => c.code === code);
}

// ---------- Named participants (8 per short course = 72 total) ---------------

export type ParticipantStatus =
  | "Application Submitted" | "Under Review" | "Accepted" | "Enrolled"
  | "In Progress" | "Assessment Pending" | "Successfully Completed"
  | "Failed Assessment" | "Withdrawn" | "Certificate Issued" | "Alumni";

export type DemoParticipant = {
  id: string;
  fullName: string;
  country: string;
  organization: string;
  professionalTitle: string;
  courseCode: string;
  category: DemoCategorySlug;
  cohort: string;
  enrolledAt: string;
  startedAt: string;
  completedAt?: string;
  progressPct: number;
  preTestPct?: number;
  quizPct?: number;
  finalPct?: number;
  evaluationSubmitted: boolean;
  status: ParticipantStatus;
  certificateNumber?: string;
  isAlumni: boolean;
};

// Compact seed: 8 named per course. Statuses vary; 6 of 8 are "Successfully
// Completed / Certificate Issued / Alumni" so drill-down totals feel real.
const NAMED_PER_COURSE: Record<DemoCategorySlug, { name: string; country: string; org: string; title: string }[]> = {
  "fisheries-management": [
    { name: "Ayu Sekarini", country: "Indonesia", org: "Ministry of Marine Affairs", title: "Fisheries Officer" },
    { name: "Daniel Kofi Mensah", country: "Ghana", org: "Ghana Fisheries Commission", title: "Extension Officer" },
    { name: "Lani Moana", country: "Fiji", org: "Pacific Fisheries Agency", title: "Community Liaison" },
    { name: "Ahmad Firdaus Rahman", country: "Malaysia", org: "Fisheries Development Authority", title: "Data Analyst" },
    { name: "Maria Celeste Ramos", country: "Philippines", org: "BFAR Regional Office", title: "Fisheries Technologist" },
    { name: "Samuel Okeke", country: "Nigeria", org: "Federal Fisheries Department", title: "Programme Officer" },
    { name: "Putri Adelia", country: "Indonesia", org: "Provincial Fisheries Agency", title: "Field Coordinator" },
    { name: "Nimal Perera", country: "Sri Lanka", org: "National Aquatic Resources Agency", title: "Research Officer" },
  ],
  "aquaculture": [
    { name: "Bunga Maharani", country: "Indonesia", org: "Nusantara Aqua Farm", title: "Farm Manager" },
    { name: "Samuel Chibwe", country: "Zambia", org: "Zambia Aquaculture Initiative", title: "Extension Officer" },
    { name: "Amina Diallo", country: "Senegal", org: "Senegal Coastal Development Agency", title: "Aquaculture Specialist" },
    { name: "Nguyen Minh An", country: "Viet Nam", org: "Mekong Aquaculture Cooperative", title: "Production Lead" },
    { name: "Rahmawati Putra", country: "Indonesia", org: "Cirebon Fish Farmers Group", title: "Cooperative Chair" },
    { name: "Joseph Banda", country: "Malawi", org: "Malawi Fisheries Department", title: "Research Officer" },
    { name: "Sok Dara", country: "Cambodia", org: "Cambodia Freshwater Institute", title: "Field Scientist" },
    { name: "Grace Abena Owusu", country: "Ghana", org: "Volta Aqua Cooperative", title: "Farm Supervisor" },
  ],
  "marine-conservation": [
    { name: "Intan Purnamasari", country: "Indonesia", org: "Coral Archipelago Trust", title: "Field Coordinator" },
    { name: "Grace Njeri Mwangi", country: "Kenya", org: "Kenya Marine Conservancy", title: "Conservation Officer" },
    { name: "Mateo Reyes", country: "Philippines", org: "Palawan MPA Network", title: "MPA Manager" },
    { name: "Ana Taufua", country: "Tonga", org: "Tonga Coastal Communities Alliance", title: "Community Facilitator" },
    { name: "David Mussa", country: "Tanzania", org: "Zanzibar Marine Programme", title: "Ranger Coordinator" },
    { name: "Nabila Paramesti", country: "Indonesia", org: "Raja Ampat Conservation Forum", title: "Programme Officer" },
    { name: "Sofia Valdez", country: "Chile", org: "Patagonia Marine Trust", title: "Research Lead" },
    { name: "Peter Kallon", country: "Sierra Leone", org: "Sierra Leone Coastal Alliance", title: "Field Ecologist" },
  ],
  "blue-economy": [
    { name: "Surya Mahendra", country: "Indonesia", org: "Ocean Prosperity Institute", title: "Policy Analyst" },
    { name: "Fatou Camara", country: "The Gambia", org: "Gambia Coastal Development Board", title: "Planning Officer" },
    { name: "Joseph Mbeki", country: "South Africa", org: "Cape Blue Economy Forum", title: "Economic Advisor" },
    { name: "Sofia Marquez", country: "Chile", org: "Ministry of Economy — Blue Cell", title: "Programme Officer" },
    { name: "Ayanda Dlamini", country: "Eswatini", org: "Regional Blue Economy Council", title: "Policy Fellow" },
    { name: "Made Anggara", country: "Indonesia", org: "Bali Sustainable Coasts", title: "Coastal Planner" },
    { name: "Elena Santos", country: "Timor-Leste", org: "Ministry of Fisheries — Timor-Leste", title: "Economic Analyst" },
    { name: "Michael Ofori", country: "Ghana", org: "West Africa Blue Economy Alliance", title: "Programme Lead" },
  ],
  "climate-change": [
    { name: "Citra Wardani", country: "Indonesia", org: "Climate Resilience Bureau", title: "Adaptation Officer" },
    { name: "Emmanuel Boateng", country: "Ghana", org: "Ghana Climate Cell", title: "Risk Analyst" },
    { name: "Mereani Vula", country: "Fiji", org: "Pacific Community Resilience Unit", title: "Programme Officer" },
    { name: "Leila Hassan", country: "Tanzania", org: "Zanzibar Climate Office", title: "Adaptation Specialist" },
    { name: "Putu Aryani", country: "Indonesia", org: "Bali Climate Task Force", title: "Field Coordinator" },
    { name: "Kabiru Musa", country: "Nigeria", org: "Nigeria Coastal Risk Unit", title: "Climate Analyst" },
    { name: "Maria Lopes", country: "Timor-Leste", org: "Timor Climate Programme", title: "Field Officer" },
    { name: "Esther Nkomo", country: "Zimbabwe", org: "SADC Climate Resilience", title: "Programme Fellow" },
  ],
  "ocean-governance": [
    { name: "Ratri Kencana", country: "Indonesia", org: "Ministry of Marine Affairs", title: "Legal Officer" },
    { name: "Kwame Owusu", country: "Ghana", org: "Ghana Maritime Authority", title: "Policy Advisor" },
    { name: "Maria Elena Cruz", country: "Philippines", org: "Philippines Ocean Council", title: "Policy Officer" },
    { name: "Ibrahim Suleiman", country: "Nigeria", org: "Nigeria Maritime Directorate", title: "Governance Specialist" },
    { name: "Ni Luh Apsari", country: "Indonesia", org: "Bali Provincial Government", title: "Coastal Coordinator" },
    { name: "Grace Chanda", country: "Zambia", org: "Zambia Inland Waters Authority", title: "Programme Officer" },
    { name: "Thomas Kofi Adu", country: "Ghana", org: "West Africa Fisheries Commission", title: "Regional Advisor" },
    { name: "Amelia Rosario", country: "Mozambique", org: "Mozambique Ministry of the Sea", title: "Legal Fellow" },
  ],
  "marine-spatial-planning": [
    { name: "Bayu Angkasa", country: "Indonesia", org: "Coastal Planning Directorate", title: "Senior Planner" },
    { name: "Naomi Wanjiku", country: "Kenya", org: "Kenya Coastal Development Programme", title: "MSP Officer" },
    { name: "Tran Thi Lan", country: "Viet Nam", org: "Viet Nam Coastal Planning Unit", title: "Spatial Analyst" },
    { name: "Pedro Santos", country: "Timor-Leste", org: "Timor Coastal Directorate", title: "Planner" },
    { name: "Nia Permatasari", country: "Indonesia", org: "West Java Marine Bureau", title: "GIS Analyst" },
    { name: "Omar Hassan", country: "Tanzania", org: "Zanzibar MSP Task Force", title: "Coordinator" },
    { name: "Carlos Mendes", country: "Cabo Verde", org: "Cabo Verde Ocean Directorate", title: "Planning Fellow" },
    { name: "Mei Lin Tan", country: "Malaysia", org: "Sabah Marine Authority", title: "Regional Planner" },
  ],
  "fisheries-surveillance": [
    { name: "Yoga Pranata", country: "Indonesia", org: "Directorate of Marine Surveillance", title: "Patrol Officer" },
    { name: "Abdul Kamara", country: "Sierra Leone", org: "Sierra Leone Maritime Wing", title: "Patrol Lead" },
    { name: "Thandiwe Phiri", country: "Malawi", org: "Malawi Lake Patrol Unit", title: "Surveillance Officer" },
    { name: "Jose Manuel Dela Cruz", country: "Philippines", org: "Philippine Coast Guard — BFAR", title: "Enforcement Officer" },
    { name: "Dewa Raka Putra", country: "Indonesia", org: "Bali Provincial Surveillance", title: "Field Coordinator" },
    { name: "Nelson Chirwa", country: "Zambia", org: "Zambia Lake Patrol", title: "Patrol Officer" },
    { name: "Fatima Conteh", country: "Guinea", org: "Guinea Maritime Directorate", title: "Reporting Officer" },
    { name: "Musa Abdullahi", country: "Nigeria", org: "Nigeria Maritime Enforcement", title: "Regional Officer" },
  ],
  "fish-processing-value-addition": [
    { name: "Dewi Ambarwati", country: "Indonesia", org: "Cirebon Fish Products Cooperative", title: "Processing Lead" },
    { name: "Esther Moyo", country: "Zimbabwe", org: "Kariba Fish Processors Assoc.", title: "Quality Officer" },
    { name: "Mariam Bah", country: "Guinea", org: "Guinea Coastal Processors", title: "Cooperative Chair" },
    { name: "Sokha Chan", country: "Cambodia", org: "Tonle Sap Processors Group", title: "Production Officer" },
    { name: "Luh Ayu Prameswari", country: "Indonesia", org: "Bali Sea Products SME", title: "SME Owner" },
    { name: "Josephine Banda", country: "Malawi", org: "Malawi Women in Fisheries", title: "Programme Officer" },
    { name: "Aisha Jallow", country: "The Gambia", org: "Gambia Fish Products Union", title: "Quality Lead" },
    { name: "Nguyen Hoang Mai", country: "Viet Nam", org: "Mekong Value-Add Cooperative", title: "Processing Manager" },
  ],
};

const STATUS_ROTATION: ParticipantStatus[] = [
  "Alumni", "Certificate Issued", "Successfully Completed",
  "In Progress", "Assessment Pending",
  "Enrolled", "Under Review", "Withdrawn",
];

export const DEMO_PARTICIPANTS: DemoParticipant[] = (() => {
  const out: DemoParticipant[] = [];
  let counter = 1;
  for (const cat of DEMO_CATEGORIES) {
    const list = NAMED_PER_COURSE[cat.slug];
    const course = DEMO_SHORT_COURSES.find((c) => c.category === cat.slug)!;
    list.forEach((p, i) => {
      const status = STATUS_ROTATION[i];
      const completed = status === "Alumni" || status === "Certificate Issued" || status === "Successfully Completed";
      const id = `demo-p-${String(counter).padStart(4, "0")}`;
      counter++;
      out.push({
        id,
        fullName: p.name,
        country: p.country,
        organization: p.org,
        professionalTitle: p.title,
        courseCode: course.code,
        category: cat.slug,
        cohort: `${course.code}-C${String(1 + Math.floor(i / 3))}`,
        enrolledAt: "2025-11-04",
        startedAt: "2025-11-11",
        completedAt: completed ? "2025-12-19" : undefined,
        progressPct: completed ? 100 : status === "In Progress" ? 62 : status === "Assessment Pending" ? 85 : status === "Enrolled" ? 8 : status === "Withdrawn" ? 42 : 0,
        preTestPct: status === "Under Review" ? undefined : 68,
        quizPct: completed || status === "Assessment Pending" ? 82 : status === "In Progress" ? 74 : undefined,
        finalPct: completed ? 86 : status === "Assessment Pending" ? undefined : undefined,
        evaluationSubmitted: completed,
        status,
        certificateNumber: completed ? `BARUNA-DEMO-${id.slice(-4)}` : undefined,
        isAlumni: status === "Alumni",
      });
    });
  }
  return out;
})();

export function getParticipant(id: string) {
  return DEMO_PARTICIPANTS.find((p) => p.id === id);
}
export function participantsByCourse(code: string) {
  return DEMO_PARTICIPANTS.filter((p) => p.courseCode === code);
}
export function participantsByCategory(cat: DemoCategorySlug) {
  return DEMO_PARTICIPANTS.filter((p) => p.category === cat);
}

// ---------- Partners ---------------------------------------------------------

export type DemoPartner = {
  id: string; slug: string; name: string; country: string; type: string;
  areas: string[]; supports: DemoCategorySlug[]; summary: string;
  participantsSupported: number; joinedAt: string;
};
export const DEMO_PARTNERS: DemoPartner[] = [
  { id: "p1", slug: "nusantara-marine-capacity-network", name: "Nusantara Marine Capacity Network", country: "Indonesia", type: "National Network", areas: ["Capacity building", "Curriculum"], supports: ["fisheries-management", "marine-conservation", "fisheries-surveillance"], summary: "Coordinates national trainer networks and provincial cohorts.", participantsSupported: 3200, joinedAt: "2023-04-08" },
  { id: "p2", slug: "indo-pacific-aquaculture-learning-alliance", name: "Indo-Pacific Aquaculture Learning Alliance", country: "Regional", type: "Regional Alliance", areas: ["Aquaculture innovation", "Farmer-to-farmer exchange"], supports: ["aquaculture", "fish-processing-value-addition"], summary: "Regional network connecting extension services and cooperatives.", participantsSupported: 2100, joinedAt: "2024-01-22" },
  { id: "p3", slug: "coral-archipelago-conservation-forum", name: "Coral Archipelago Conservation Forum", country: "Indonesia", type: "Civil Society Forum", areas: ["Community MPAs", "Reef monitoring"], supports: ["marine-conservation", "climate-change"], summary: "Forum of practitioners running community MPAs across eastern Indonesia.", participantsSupported: 1500, joinedAt: "2022-10-11" },
  { id: "p4", slug: "ocean-prosperity-partnership-centre", name: "Ocean Prosperity Partnership Centre", country: "Regional", type: "Policy Centre", areas: ["Blue economy policy", "Executive learning"], supports: ["blue-economy", "ocean-governance"], summary: "Executive learning and policy dialogues on the blue economy.", participantsSupported: 4800, joinedAt: "2022-05-17" },
  { id: "p5", slug: "maritime-climate-resilience-network", name: "Maritime Climate Resilience Network", country: "Regional", type: "Climate Network", areas: ["Climate risk", "Adaptation planning"], supports: ["climate-change", "marine-spatial-planning", "ocean-governance"], summary: "Climate resilience network working with coastal governments.", participantsSupported: 1900, joinedAt: "2023-09-02" },
];
export function getPartner(slug: string) { return DEMO_PARTNERS.find((p) => p.slug === slug); }

// ---------- Fellowships ------------------------------------------------------

export type DemoFellowship = {
  id: string; slug: string; title: string; category: DemoCategorySlug;
  duration: string; countries: string[]; window: string; description: string;
  eligibility: string[]; documents: string[]; stages: string[];
};
export const DEMO_FELLOWSHIPS: DemoFellowship[] = [
  { id: "f1", slug: "marine-fisheries-leadership", title: "Marine Fisheries Leadership Fellowship", category: "fisheries-management",
    duration: "6 months", countries: ["Ghana", "Nigeria", "Kenya", "Fiji", "Philippines"], window: "March – August 2026",
    description: "A leadership programme for mid-career fisheries professionals combining online modules, mentorship, and a two-week residency in Bali.",
    eligibility: ["Mid-career civil servant or NGO leader", "5+ years in fisheries", "Nomination letter"],
    documents: ["CV", "Motivation letter", "Nomination letter", "Passport copy"],
    stages: ["Draft", "Submitted", "Under Review", "Shortlisted", "Accepted", "Rejected", "Completed"] },
  { id: "f2", slug: "sustainable-aquaculture-exchange", title: "Sustainable Aquaculture Technical Exchange", category: "aquaculture",
    duration: "3 weeks", countries: ["Senegal", "Zambia", "Cambodia", "Viet Nam", "Ghana"], window: "May 2026",
    description: "Peer-to-peer exchange between aquaculture cooperatives with hands-on time at Indonesian biofloc farms.",
    eligibility: ["Aquaculture cooperative leader or extension officer", "Working in smallholder aquaculture"],
    documents: ["CV", "Cooperative profile", "Motivation letter"],
    stages: ["Draft", "Submitted", "Under Review", "Shortlisted", "Accepted", "Rejected", "Completed"] },
  { id: "f3", slug: "coastal-resilience-study-visit", title: "Coastal Resilience Study Visit", category: "climate-change",
    duration: "10 days", countries: ["Fiji", "Timor-Leste", "Tanzania", "Nigeria"], window: "September 2026",
    description: "A study visit to Indonesia's climate-adaptation projects across coastal villages and small islands.",
    eligibility: ["Coastal-planning practitioner", "Nominated by government or civil-society organisation"],
    documents: ["CV", "Nomination letter", "Motivation letter"],
    stages: ["Draft", "Submitted", "Under Review", "Shortlisted", "Accepted", "Rejected", "Completed"] },
];
export function getFellowship(slug: string) { return DEMO_FELLOWSHIPS.find((f) => f.slug === slug); }

// ---------- Events -----------------------------------------------------------

export type DemoEvent = {
  id: string; slug: string; title: string; kind: "Webinar" | "Workshop" | "Expert Session" | "Community Event" | "Conference";
  date: string; timezone: string; format: "Online" | "Onsite" | "Blended"; location: string;
  category: DemoCategorySlug; expertId: string; relatedCourse: string;
  registrations: number; attended: number; certificateEligible: boolean;
  description: string;
};
export const DEMO_EVENTS: DemoEvent[] = [
  { id: "ev1", slug: "webinar-data-fisheries", title: "Webinar: Data for Sustainable Fisheries Management", kind: "Webinar", date: "2026-02-11 14:00", timezone: "WITA (UTC+8)", format: "Online", location: "Zoom", category: "fisheries-management", expertId: "e1", relatedCourse: "BARUNA-FM-001", registrations: 320, attended: 268, certificateEligible: true, description: "One-hour introduction to catch and effort data for practitioners." },
  { id: "ev2", slug: "workshop-biofloc-clinic", title: "Workshop: Biofloc Aquaculture Practical Clinic", kind: "Workshop", date: "2026-03-05 09:00", timezone: "WITA (UTC+8)", format: "Onsite", location: "Marine Biotech Center, Bali", category: "aquaculture", expertId: "e2", relatedCourse: "BARUNA-AQ-001", registrations: 45, attended: 42, certificateEligible: true, description: "Two-day hands-on clinic with cooperative farmers." },
  { id: "ev3", slug: "expert-collab-ocean-governance", title: "Expert Session: Collaborative Ocean Governance", kind: "Expert Session", date: "2026-02-25 15:00", timezone: "WITA (UTC+8)", format: "Blended", location: "Denpasar + Zoom", category: "ocean-governance", expertId: "e6", relatedCourse: "BARUNA-OG-001", registrations: 180, attended: 155, certificateEligible: false, description: "Live conversation with practitioners across Indo-Pacific." },
  { id: "ev4", slug: "community-conservation-exchange", title: "Community Event: Marine Conservation Community Exchange", kind: "Community Event", date: "2026-04-12 10:00", timezone: "WITA (UTC+8)", format: "Onsite", location: "Raja Ampat", category: "marine-conservation", expertId: "e3", relatedCourse: "BARUNA-MC-001", registrations: 90, attended: 82, certificateEligible: false, description: "Cross-village exchange between community MPAs." },
  { id: "ev5", slug: "conference-blue-economy-forum", title: "Conference: Blue Economy Knowledge Forum", kind: "Conference", date: "2026-05-20 09:00", timezone: "WITA (UTC+8)", format: "Blended", location: "Jakarta + Online", category: "blue-economy", expertId: "e4", relatedCourse: "BARUNA-BE-001", registrations: 1200, attended: 980, certificateEligible: true, description: "Flagship annual gathering on blue-economy policy and practice." },
];
export function getEvent(slug: string) { return DEMO_EVENTS.find((e) => e.slug === slug); }

// ---------- Communities of Practice ------------------------------------------

export type DemoCommunity = {
  id: string; slug: string; name: string; category: DemoCategorySlug;
  members: number; posts: number; expertId: string; description: string;
};
export const DEMO_COMMUNITIES: DemoCommunity[] = DEMO_CATEGORIES.slice(0, 5).map((c, i) => ({
  id: `com${i + 1}`,
  slug: `${c.slug}-community`,
  name:
    c.slug === "fisheries-management" ? "Fisheries Management Community of Practice" :
    c.slug === "aquaculture" ? "Sustainable Aquaculture Community" :
    c.slug === "marine-conservation" ? "Marine Conservation Practitioners Network" :
    c.slug === "blue-economy" ? "Blue Economy Collaboration Forum" :
    "Coastal Climate Resilience Community",
  category: c.slug,
  members: [640, 812, 1120, 2340, 480][i],
  posts: [128, 210, 305, 512, 96][i],
  expertId: getExpertByCategory(c.slug).id,
  description: `Discussion, resources and expert answers on ${c.name.toLowerCase()}.`,
}));
export function getCommunity(slug: string) { return DEMO_COMMUNITIES.find((c) => c.slug === slug); }

// ---------- Analytics selectors (derived; always consistent) -----------------

export function totalUsp() {
  return DEMO_SHORT_COURSES.reduce((s, c) => s + c.usp, 0);
}
export function totalPLHG() {
  return DEMO_SHORT_COURSES.reduce((s, c) => s + c.instructionalHours * c.usp, 0);
}
export function plhgByCategory(cat: DemoCategorySlug) {
  const c = DEMO_SHORT_COURSES.find((x) => x.category === cat)!;
  return c.instructionalHours * c.usp;
}
export function levelDistribution() {
  const d = { certified: 0, advanced: 0, senior: 0, master: 0 };
  DEMO_EXPERTS.forEach((e) => { d[e.level]++; });
  return d;
}
export function uniqueCountries() {
  return Array.from(new Set(DEMO_PARTICIPANTS.map((p) => p.country)));
}
export function alumniList() {
  return DEMO_PARTICIPANTS.filter((p) => p.isAlumni || p.status === "Certificate Issued" || p.status === "Successfully Completed");
}

export function getPublicAnalytics() {
  return {
    registeredParticipants: DEMO_PARTICIPANTS.length + 8200,   // seed + aggregate
    activeLearners: DEMO_SHORT_COURSES.reduce((s, c) => s + c.activeLearners, 0),
    uniqueSuccessfulParticipants: totalUsp(),
    countriesReached: uniqueCountries().length + 12,
    organizations: 640,
    verifiedExperts: DEMO_EXPERTS.length,
    approvedTrainers: DEMO_EXPERTS.length,
    approvedModules: DEMO_MODULES.length,
    publishedShortCourses: DEMO_SHORT_COURSES.length,
    fullTrainingPrograms: 2,
    certificatesIssued: DEMO_SHORT_COURSES.reduce((s, c) => s + c.certificatesIssued, 0),
    participantLearningHoursGenerated: totalPLHG(),
    eventsConducted: DEMO_EVENTS.length + 18,
    communityMembers: DEMO_COMMUNITIES.reduce((s, c) => s + c.members, 0),
    knowledgeResources: DEMO_MODULES.length + 42,
    activePartners: DEMO_PARTNERS.length,
    fellowshipParticipants: 36,
    alumni: alumniList().length,
    trainingArchiveRecords: 3,
    levelDistribution: levelDistribution(),
  };
}
