import trainingBali from "@/assets/academy/training-bali.jpg";
import venueExterior from "@/assets/venue/lrpt-exterior.jpg";
import venueLobby from "@/assets/venue/lrpt-lobby.jpg";
import venueAuditorium from "@/assets/venue/lrpt-auditorium.jpg";
import venueMeeting from "@/assets/venue/lrpt-meeting.jpg";
import { academyImages } from "@/data/academy";
import { expertImages } from "@/data/pages";

export type CurriculumModule = {
  no: number;
  module: string;
  topics: string;
  hours: number;
};

export type ScheduleDay = {
  day: string;
  date: string;
  weekday: string;
  dateISO: string;
  theme: string;
  activities: string[];
  hours: number;
};

export type VenueInfo = {
  name: string;
  agency: string;
  addressLines: string[];
  description: string;
  facilities: string[];
  photos: { src: string; caption: string }[];
  exterior: string;
  mapQuery: string;
  googleMapsUrl: string;
  mapLabel: string;
};

export type Review = {
  name: string;
  country: string;
  role: string;
  rating: number;
  text: string;
};

export type TrainingProgram = {
  slug: string;
  type: string;
  badge: string;
  title: string;
  subtitle: string;
  overview: string;
  hero: string;
  bannerLabel: string;
  location: string;
  language: string;
  duration: string;
  rating: number;
  reviews: number;
  certificate: boolean;
  participants: string;
  applicationDeadline: string;
  elearningPeriod: string;
  inPersonTraining: string;
  travelPeriod: string;
  postCourse: string;
  certificateIssued: string;
  topics: string[];
  modules: string[];
  curriculum: CurriculumModule[];
  outcomes: string[];
  instructors: { name: string; role: string; avatar: string }[];
  instructorStats: { instructors: number; experience: string; institutions: number; areas: number };
  expertiseCoverage: string[];
  whoWillTeach: { area: string; instructor: string }[];
  schedule: { day: string; title: string; detail: string }[];
  scheduleDays: ScheduleDay[];
  venue: VenueInfo;
  reviewsList: Review[];
  ratingBreakdown: { stars: number; count: number }[];
  travelSupport: { period: string; includes: string[] };
  timeline: { title: string; period: string; items?: string[]; tone: string }[];
  faqs: { q: string; a: string; category: string }[];
  totalDuration: string;
  timeZones: string[];
};

export const trainingPrograms: TrainingProgram[] = [
  {
    slug: "international-training-fisheries-african-countries",
    type: "Blended Training",
    badge: "BLENDED TRAINING",
    title: "International Training on Fisheries for African Countries",
    subtitle:
      "Enhance aquaculture capacity through biofloc technology, hatchery management, feed development, fish health, and value-added processing.",
    overview:
      "A capacity-building program designed for fisheries professionals from African countries to strengthen knowledge and practical skills in sustainable aquaculture, biofloc technology, hatchery management, feed development, fish health, and value-added fisheries products. The program combines online learning and in-person training in Bali, Indonesia.",
    hero: trainingBali,
    bannerLabel: "IN-PERSON TRAINING IN BALI",
    location: "Bali, Indonesia",
    language: "English",
    duration: "Blended Program",
    rating: 4.8,
    reviews: 64,
    certificate: true,
    participants: "20 Participants from African Countries",
    applicationDeadline: "31 July 2026",
    elearningPeriod: "1–12 September 2026",
    inPersonTraining: "21–26 September 2026",
    travelPeriod: "13–20 September 2026",
    postCourse: "27 September – 10 October 2026",
    certificateIssued: "October 2026",
    topics: [
      "Biofloc Technology",
      "Hatchery & Nursery",
      "Aquaculture Management",
      "Feed Development",
      "Fish Health",
      "Value Added Processing",
    ],
    modules: [
      "Preparing Biofloc Containers and Media",
      "Preparation of Biofloc Pond Media",
      "Catfish Hatchery and Seed Management",
      "Catfish Aquaculture",
      "Making Catfish Feed from Maggot",
      "Tilapia Hatchery and Management",
      "Tilapia Cultivation Using Biofloc System",
      "Vaccine and Vaccination in Tilapia Farming",
      "Making Tilapia Feed from Maggot",
      "Making Catfish Floss",
      "Fishbone Cookies",
      "Fish Stick Cheese",
      "Fish Bone Churros Making Technique",
    ],
    curriculum: [
      { no: 1, module: "Preparing Biofloc Containers and Media", topics: "Materials, container preparation, water quality", hours: 3 },
      { no: 2, module: "Preparation of Biofloc Pond Media", topics: "Carbon source, C/N ratio, probiotic, water management", hours: 3 },
      { no: 3, module: "Catfish Hatchery and Seed Management", topics: "Broodstock, spawning, larval rearing, seed quality", hours: 4 },
      { no: 4, module: "Catfish Aquaculture", topics: "Pond management, biofloc application, growth monitoring", hours: 4 },
      { no: 5, module: "Making Catfish Feed from Maggot", topics: "BSF cultivation, feed formulation, processing", hours: 3 },
      { no: 6, module: "Tilapia Hatchery and Management", topics: "Broodstock, spawning, larval rearing, seed quality", hours: 4 },
      { no: 7, module: "Tilapia Cultivation Using Biofloc System", topics: "System preparation, water quality, maintenance", hours: 4 },
      { no: 8, module: "Vaccine and Vaccination in Tilapia Farming", topics: "Fish health, vaccines, immunization techniques", hours: 3 },
      { no: 9, module: "Making Tilapia Feed from Maggot", topics: "Feed formulation, mixing, pelletizing", hours: 3 },
      { no: 10, module: "Making Catfish Floss", topics: "Raw material preparation, cooking, shredding, seasoning, packaging", hours: 3 },
      { no: 11, module: "Fishbone Cookies", topics: "Fish bone preparation, mixing, baking, packaging", hours: 2 },
      { no: 12, module: "Fish Stick Cheese", topics: "Fish processing, cheese formulation, shaping, coating, frying, packaging", hours: 3 },
      { no: 13, module: "Fish Bone Churros Making Technique", topics: "Fish bone flour preparation, dough making, frying, coating, packaging", hours: 3 },
    ],
    outcomes: [
      "Apply biofloc technology for better water quality and productivity",
      "Manage hatchery operations and improve seed quality",
      "Improve aquaculture management for catfish and tilapia",
      "Implement fish health management including vaccination",
      "Process fish into value-added products with higher value",
      "Build networks and collaborations across African countries",
    ],
    instructors: [
      { name: "Dr. Maya Lestari", role: "Aquaculture & Biofloc Specialist", avatar: expertImages[0] },
      { name: "Dr. Putu Ayu Brahmini, S.Pi., M.Si.", role: "Hatchery & Seed Management", avatar: expertImages[1] },
      { name: "Dr. Gede Mahiswara, S.Pi., M.T.", role: "Feed Development & Maggot Culture", avatar: expertImages[2] },
      { name: "Dr. Ni Wayan Suryati, S.Kel., M.Sc.", role: "Fish Health & Vaccination", avatar: expertImages[3] },
    ],
    instructorStats: { instructors: 12, experience: "150+", institutions: 3, areas: 4 },
    expertiseCoverage: [
      "Aquaculture Production",
      "Hatchery Management",
      "Fish Health & Vaccination",
      "Maggot-Based Feed Production",
      "Biofloc Technology",
      "Fish Processing",
      "Value-Added Products",
      "Capacity Development",
    ],
    whoWillTeach: [
      { area: "Biofloc Technology", instructor: "I Putu Suarma" },
      { area: "Catfish Production", instructor: "Firman Pra Setia Nugraha" },
      { area: "Tilapia Production", instructor: "Herison Lingga" },
      { area: "Fish Health & Vaccination", instructor: "Achmad Suhermanto" },
      { area: "Fish Processing & Value Addition", instructor: "Erika Arisetiana Dewi" },
      { area: "Training Methodology", instructor: "Sri Astutik" },
      { area: "Entrepreneurship & Community Development", instructor: "Emi Wati" },
    ],
    schedule: [
      { day: "Day 1", title: "Biofloc System Setup", detail: "Preparing biofloc containers, pond media, and water quality basics." },
      { day: "Day 2", title: "Catfish Hatchery & Aquaculture", detail: "Hatchery, seed management, and grow-out practices for catfish." },
      { day: "Day 3", title: "Tilapia Cultivation", detail: "Tilapia hatchery, management, and biofloc-based cultivation." },
      { day: "Day 4", title: "Fish Health & Feed", detail: "Vaccination practices and making feed from maggot." },
      { day: "Day 5", title: "Value-Added Processing", detail: "Catfish floss, fishbone cookies, fish stick cheese, and churros." },
      { day: "Day 6", title: "Field Visit & Closing", detail: "Field visit, country presentations, and certificate ceremony." },
    ],
    scheduleDays: [
      {
        day: "1",
        date: "21 Sep 2026",
        weekday: "Mon",
        dateISO: "2026-09-21",
        theme: "Opening Ceremony, Country Presentations & Indonesian Fisheries Development",
        activities: ["Opening Ceremony", "Country Presentations", "Overview of Indonesian Fisheries Sector", "Program Orientation"],
        hours: 8,
      },
      {
        day: "2",
        date: "22 Sep 2026",
        weekday: "Tue",
        dateISO: "2026-09-22",
        theme: "Catfish Production System",
        activities: ["Biofloc preparation", "Catfish hatchery", "Catfish culture", "Feed from maggot (practice)"],
        hours: 8,
      },
      {
        day: "3",
        date: "23 Sep 2026",
        weekday: "Wed",
        dateISO: "2026-09-23",
        theme: "Tilapia Production System",
        activities: ["Biofloc preparation", "Tilapia hatchery", "Tilapia culture", "Fish health & vaccination", "Feed from maggot (practice)"],
        hours: 8,
      },
      {
        day: "4",
        date: "24 Sep 2026",
        weekday: "Thu",
        dateISO: "2026-09-24",
        theme: "Processing & Value Addition I",
        activities: ["Making Catfish Floss", "Fish Bone Cookies"],
        hours: 7,
      },
      {
        day: "5",
        date: "25 Sep 2026",
        weekday: "Fri",
        dateISO: "2026-09-25",
        theme: "Processing & Value Addition II",
        activities: ["Making Fish Stick Cheese", "Fish Bone Churros"],
        hours: 7,
      },
      {
        day: "6",
        date: "26 Sep 2026",
        weekday: "Sat",
        dateISO: "2026-09-26",
        theme: "Field Visit & Program Closing",
        activities: ["Field visit to aquaculture facilities", "Action Plan Presentation", "Post-Test", "Closing Ceremony"],
        hours: 6,
      },
    ],
    venue: {
      name: "Research Station for Tuna Fisheries",
      agency:
        "The Agency for Marine and Fisheries Extension and Human Resources Development — Ministry of Marine Affairs and Fisheries",
      addressLines: ["140 Mertasari Street, Suwung Kangin, Sidakarya,", "South Denpasar, Bali 80224, Indonesia"],
      description:
        "The Research Station for Tuna Fisheries is a center for research, training, and development in tuna fisheries. It provides comprehensive facilities to support capacity building programs for fisheries professionals.",
      facilities: [
        "Modern Training Classrooms",
        "Laboratory & Demonstration Units",
        "Accommodation & Dining Facilities",
        "Meeting & Discussion Rooms",
        "Easy Access from Ngurah Rai Airport (approx. 20 minutes)",
      ],
      photos: [
        { src: venueLobby, caption: "Reception & Lobby" },
        { src: venueAuditorium, caption: "Training Auditorium" },
        { src: venueMeeting, caption: "Meeting & Discussion Room" },
      ],
      exterior: venueExterior,
      mapQuery: "Research Station for Tuna Fisheries, Mertasari Street, Sidakarya, South Denpasar, Bali 80224, Indonesia",
      googleMapsUrl:
        "https://www.google.com/maps/search/?api=1&query=Mertasari+Street+Sidakarya+South+Denpasar+Bali+80224+Indonesia",
      mapLabel: "Denpasar",
    },
    reviewsList: [
      { name: "Amara O.", country: "Nigeria", role: "Fisheries Officer", rating: 5, text: "Outstanding hands-on training. The biofloc and value-added processing sessions were game-changing for our cooperative back home." },
      { name: "Kwame B.", country: "Ghana", role: "Aquaculture Entrepreneur", rating: 5, text: "Excellent instructors and great visa support. The blended format made it easy to prepare before traveling to Bali." },
      { name: "Fatima D.", country: "Senegal", role: "Hatchery Manager", rating: 5, text: "I learned practical hatchery and feed development skills I now apply daily. Highly recommended for African professionals." },
      { name: "Tendai M.", country: "Zimbabwe", role: "Extension Officer", rating: 4, text: "Very well organized. The field visit to aquaculture facilities was the highlight — real systems we could replicate." },
      { name: "Lerato K.", country: "South Africa", role: "Researcher", rating: 5, text: "The vaccination and fish health module was excellent. Instructors were knowledgeable and patient with every question." },
      { name: "Yonas T.", country: "Ethiopia", role: "Cooperative Lead", rating: 5, text: "From feed-from-maggot to fish processing, every session was practical. The certificate is recognized by our ministry." },
    ],
    ratingBreakdown: [
      { stars: 5, count: 52 },
      { stars: 4, count: 9 },
      { stars: 3, count: 2 },
      { stars: 2, count: 1 },
      { stars: 1, count: 0 },
    ],
    travelSupport: {
      period: "11 Aug – 31 Aug 2026",
      includes: [
        "Visa application assistance",
        "Travel arrangement guidance",
        "Flight booking support",
        "Insurance information",
        "Pre-departure briefing",
      ],
    },
    timeline: [
      { title: "Application & Selection", period: "July – August 2026", tone: "marine" },
      { title: "Pre-Course E-Learning", period: "1–12 September 2026", items: ["13 Modules", "Pre-Test", "Country Assignment"], tone: "green" },
      { title: "Pre-Departure Preparation", period: "13–20 September 2026", items: ["Travel Arrangement", "Country Presentation Preparation"], tone: "amber" },
      { title: "In-Person Training in Bali", period: "21–26 September 2026", items: ["6 Days Intensive Training", "Field Visits", "Hands-on Practice"], tone: "marine" },
      { title: "Post-Course Assignment", period: "27 September – 10 October 2026", items: ["Reflection Paper", "Knowledge Sharing Report"], tone: "rose" },
      { title: "International Certificate", period: "October 2026", tone: "amber" },
    ],
    faqs: [
      {
        category: "Eligibility",
        q: "Who can apply for this training?",
        a: "Fisheries professionals from African countries — including officers, extension workers, hatchery managers, researchers, and aquaculture entrepreneurs — who want to strengthen their capacity in sustainable aquaculture. A total of 20 participants will be selected.",
      },
      {
        category: "Application Process",
        q: "How do I apply and when is the deadline?",
        a: "Submit your application through the BARUNA Academy portal before the application deadline of 31 July 2026. Selected candidates will be notified in August 2026 and invited to begin the pre-course e-learning.",
      },
      {
        category: "Application Process",
        q: "Is the training fully in-person?",
        a: "No. It is a blended program combining online e-learning (1–12 September 2026) and 6 days of in-person training in Bali (21–26 September 2026), followed by a post-course assignment.",
      },
      {
        category: "Visa Support",
        q: "What support is provided for visa and travel?",
        a: "We provide visa application assistance, travel arrangement guidance, flight booking support, insurance information, and a pre-departure briefing during the Travel & Visa Support Period (11–31 August 2026).",
      },
      {
        category: "Accommodation",
        q: "Is accommodation provided during the in-person training?",
        a: "Yes. Accommodation and dining facilities are arranged for all participants in Bali for the duration of the in-person training, close to the venue at the Research Station for Tuna Fisheries.",
      },
      {
        category: "Language",
        q: "What language is used during the program?",
        a: "All training sessions, materials, and assessments are delivered in English. Online sessions are scheduled to accommodate both West Africa Time (WAT) and Western Indonesia Time (WIB).",
      },
      {
        category: "Certification",
        q: "Will I receive a certificate?",
        a: "Yes. An international certificate is issued in October 2026 after completing the e-learning, the in-person training, and the post-course assignment (reflection paper and knowledge-sharing report).",
      },
      {
        category: "Travel Arrangements",
        q: "Who arranges flights and airport transfers?",
        a: "Flight booking support is provided, and transfers from Ngurah Rai International Airport (approximately 20 minutes from the venue) are coordinated as part of the pre-departure and arrival arrangements.",
      },
    ],
    totalDuration: "Approximately 40 Days",
    timeZones: ["WAT (West Africa Time)", "WIB (Western Indonesia Time)"],
  },
];

export const trainingBySlug: Record<string, TrainingProgram> = Object.fromEntries(
  trainingPrograms.map((p) => [p.slug, p]),
);

// Listing-summary used on the All Training page card
export const featuredTrainingCard = {
  slug: "international-training-fisheries-african-countries",
  badge: "BLENDED",
  image: trainingBali,
  title: "International Training on Fisheries for African Countries",
  desc: "A capacity-building program for fisheries professionals from African countries — biofloc technology, hatchery management, feed development, fish health, and value-added processing.",
  duration: "Blended Program",
  level: "All Levels",
  mode: "Bali, Indonesia + Online",
  language: "English",
  instructor: "Dr. Maya Lestari",
  avatar: expertImages[0],
  rating: 4.8,
  reviews: 64,
  date: { top: "SEP", big: "21 – 26", year: "2026", tone: "marine" as const },
};

// Reference so the academyImages import stays meaningful for future cards
export const trainingGallery = [academyImages.aquaculture, academyImages.fishProcessing];
