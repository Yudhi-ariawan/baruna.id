import {
  Fish,
  Waves,
  Sprout,
  Anchor,
  CloudRain,
  Scale,
  Compass,
  Radar,
  Factory,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { academyImages } from "./academy";
import { courseImages, expertImages } from "./pages";

const {
  seaTurtle,
  aquaculture,
  fisheriesWorkers,
  mangrove,
  fishProcessing,
  coralDiver,
  offshoreWind,
  marineSpatial,
  fishingSunset,
  plasticPollution,
} = academyImages;

const [
  courseBlueEconomy,
  courseMarineSpatial,
  courseClimate,
  courseCoralReef,
  courseTuna,
  courseGovernance,
  courseCoastal,
] = courseImages;

export type CourseCard = {
  badge: string;
  title: string;
  meta: string;
  rating: number;
  reviews: number;
  learners: string;
  image: string;
};

export type CategoryInstructor = {
  name: string;
  role: string;
  meta: string;
  avatar: string;
};

export type CategoryEvent = {
  month: string;
  day: string;
  year: string;
  title: string;
  location: string;
  type: string;
};

export type FilterCount = { label: string; count: number };

export type AcademyCategory = {
  slug: string;
  title: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  heroImage: string;
  heroAlt: string;
  stats: {
    courses: number;
    pathways: number;
    instructors: number;
    learners: string;
    countries: number;
  };
  levelCounts: FilterCount[];
  formatCounts: FilterCount[];
  courses: CourseCard[];
  instructors: CategoryInstructor[];
  events: CategoryEvent[];
  relatedTopics: string[];
};

function avatar(i: number): string {
  return expertImages[i % expertImages.length];
}

function withImages(imgs: string[], rows: Omit<CourseCard, "image">[]): CourseCard[] {
  return rows.map((r, i) => ({ ...r, image: imgs[i % imgs.length] }));
}

export const categories: AcademyCategory[] = [
  {
    slug: "fisheries-management",
    title: "Fisheries Management",
    shortLabel: "Fisheries Management",
    icon: Fish,
    description:
      "Explore courses and programs that build knowledge and skills for sustainable fisheries management, responsible practices, and resource governance.",
    heroImage: courseTuna,
    heroAlt: "Tuna fishing vessel at sea",
    stats: { courses: 24, pathways: 8, instructors: 36, learners: "1,250+", countries: 12 },
    levelCounts: [
      { label: "Beginner", count: 7 },
      { label: "Intermediate", count: 11 },
      { label: "Advanced", count: 6 },
    ],
    formatCounts: [
      { label: "Self-paced", count: 10 },
      { label: "Training", count: 6 },
      { label: "Webinar", count: 4 },
      { label: "Workshop", count: 4 },
      { label: "Certification", count: 2 },
    ],
    courses: withImages(
      [courseTuna, fishingSunset, fisheriesWorkers, courseGovernance, coralDiver, fishProcessing],
      [
        { badge: "SELF-PACED", title: "Principles of Sustainable Fisheries Management", meta: "Beginner · 3 Hours · 5 Modules", rating: 4.8, reviews: 128, learners: "1.2K learners" },
        { badge: "TRAINING", title: "Ecosystem Approach to Fisheries Management", meta: "Intermediate · 6 Hours · 8 Modules", rating: 4.7, reviews: 96, learners: "856 learners" },
        { badge: "WORKSHOP", title: "Community-Based Fisheries Management", meta: "Intermediate · 2 Days", rating: 4.9, reviews: 67, learners: "512 learners" },
        { badge: "WEBINAR", title: "Fisheries Governance and Policy Frameworks", meta: "Advanced · 1.5 Hours", rating: 4.6, reviews: 54, learners: "734 learners" },
        { badge: "SELF-PACED", title: "Stock Assessment and Fisheries Data Analysis", meta: "Advanced · 4 Hours · 6 Modules", rating: 4.6, reviews: 72, learners: "645 learners" },
        { badge: "TRAINING", title: "Rights-Based Fisheries Management (RBFM)", meta: "Intermediate · 3 Days", rating: 4.7, reviews: 41, learners: "398 learners" },
        { badge: "SELF-PACED", title: "Fisheries Co-management in Practice", meta: "Intermediate · 3 Hours · 4 Modules", rating: 4.5, reviews: 33, learners: "289 learners" },
        { badge: "WORKSHOP", title: "Developing Fisheries Management Plans", meta: "Advanced · 2 Days", rating: 4.8, reviews: 58, learners: "421 learners" },
      ],
    ),
    instructors: [
      { name: "Dr. Aruna Pratama", role: "Fisheries Management Expert", meta: "12 Courses · 2.1K Learners", avatar: avatar(0) },
      { name: "Dr. Puspa Ayu Lestari, M.Si.", role: "Marine Resource Manager", meta: "8 Courses · 1.4K Learners", avatar: avatar(1) },
      { name: "Dr. Muhammad Yusuf, Ph.D.", role: "Fisheries Policy Specialist", meta: "6 Courses · 980 Learners", avatar: avatar(2) },
    ],
    events: [
      { month: "AUG", day: "25", year: "2026", title: "Regional Workshop on Sustainable Fisheries Management", location: "Jakarta, Indonesia", type: "In-person" },
      { month: "SEP", day: "08", year: "2026", title: "Webinar: Stock Assessment Methods for Tropical Fisheries", location: "Online", type: "Online" },
    ],
    relatedTopics: ["Sustainable Fisheries", "Resource Management", "Fisheries Policy", "Marine Resources", "Fisheries Data", "Co-management"],
  },
  {
    slug: "aquaculture",
    title: "Aquaculture",
    shortLabel: "Aquaculture",
    icon: Waves,
    description:
      "Discover courses and programs to build knowledge and skills in sustainable aquaculture practices, technology, business, and resource management.",
    heroImage: aquaculture,
    heroAlt: "Aquaculture fish cages on the coast",
    stats: { courses: 22, pathways: 6, instructors: 32, learners: "980+", countries: 11 },
    levelCounts: [
      { label: "Beginner", count: 5 },
      { label: "Intermediate", count: 10 },
      { label: "Advanced", count: 7 },
    ],
    formatCounts: [
      { label: "Self-paced", count: 10 },
      { label: "Training", count: 5 },
      { label: "Webinar", count: 4 },
      { label: "Workshop", count: 3 },
    ],
    courses: withImages(
      [aquaculture, fisheriesWorkers, fishProcessing, fishingSunset, coralDiver, plasticPollution],
      [
        { badge: "SELF-PACED", title: "Introduction to Aquaculture Systems", meta: "Beginner · 2.5 Hours · 4 Modules", rating: 4.8, reviews: 128, learners: "1.1K learners" },
        { badge: "TRAINING", title: "Aquaculture Site Selection and Design", meta: "Intermediate · 6 Hours · 8 Modules", rating: 4.7, reviews: 96, learners: "856 learners" },
        { badge: "WORKSHOP", title: "Water Quality Management in Aquaculture", meta: "Intermediate · 2 Days", rating: 4.9, reviews: 67, learners: "512 learners" },
        { badge: "WEBINAR", title: "Nutrition and Feed Management", meta: "Intermediate · 1.5 Hours", rating: 4.6, reviews: 54, learners: "734 learners" },
        { badge: "SELF-PACED", title: "Shrimp Farming Best Practices", meta: "Advanced · 4 Hours · 7 Modules", rating: 4.8, reviews: 102, learners: "963 learners" },
        { badge: "SELF-PACED", title: "Recirculating Aquaculture Systems (RAS)", meta: "Advanced · 3 Hours · 5 Modules", rating: 4.7, reviews: 72, learners: "645 learners" },
        { badge: "TRAINING", title: "Fish Health Management and Disease Prevention", meta: "Intermediate · 3 Days", rating: 4.6, reviews: 58, learners: "489 learners" },
        { badge: "WORKSHOP", title: "Bivalve and Seaweed Farming", meta: "Beginner · 2 Days", rating: 4.5, reviews: 41, learners: "367 learners" },
      ],
    ),
    instructors: [
      { name: "Dr. Ir. Yuliana Setiawati, M.Sc.", role: "Aquaculture Specialist", meta: "6 Courses · 1.2K Learners", avatar: avatar(3) },
      { name: "Dr. Maya Lestari", role: "Aquaculture Expert", meta: "4 Courses · 920 Learners", avatar: avatar(0) },
      { name: "Dr. Muh. Arief Rachman, Ph.D.", role: "Fish Health Expert", meta: "5 Courses · 780 Learners", avatar: avatar(4) },
    ],
    events: [
      { month: "AUG", day: "18", year: "2026", title: "Training: Recirculating Aquaculture Systems in Practice", location: "Surabaya, Indonesia", type: "In-person" },
      { month: "SEP", day: "02", year: "2026", title: "Webinar: Sustainable Feed and Nutrition for Aquaculture", location: "Online", type: "Online" },
    ],
    relatedTopics: ["Shrimp Farming", "Fish Health", "Feed Management", "RAS", "Seaweed Culture", "Bivalve Farming"],
  },
  {
    slug: "marine-conservation",
    title: "Marine Conservation",
    shortLabel: "Marine Conservation",
    icon: Sprout,
    description:
      "Explore courses and programs focused on protecting marine ecosystems, preserving biodiversity, and promoting sustainable ocean stewardship.",
    heroImage: coralDiver,
    heroAlt: "Diver inspecting a coral reef",
    stats: { courses: 18, pathways: 5, instructors: 28, learners: "750+", countries: 14 },
    levelCounts: [
      { label: "Beginner", count: 5 },
      { label: "Intermediate", count: 7 },
      { label: "Advanced", count: 6 },
    ],
    formatCounts: [
      { label: "Self-paced", count: 6 },
      { label: "Training", count: 5 },
      { label: "Webinar", count: 4 },
      { label: "Workshop", count: 3 },
    ],
    courses: withImages(
      [coralDiver, seaTurtle, mangrove, plasticPollution, fishingSunset, courseCoralReef],
      [
        { badge: "SELF-PACED", title: "Introduction to Marine Conservation", meta: "Beginner · 2.5 Hours · 4 Modules", rating: 4.8, reviews: 128, learners: "1.1K learners" },
        { badge: "TRAINING", title: "Coral Reef Conservation and Restoration", meta: "Intermediate · 6 Hours · 8 Modules", rating: 4.7, reviews: 96, learners: "843 learners" },
        { badge: "WORKSHOP", title: "Mangrove Ecosystem Protection", meta: "Intermediate · 2 Days", rating: 4.9, reviews: 67, learners: "512 learners" },
        { badge: "WEBINAR", title: "Marine Protected Areas Management", meta: "Advanced · 1.5 Hours", rating: 4.6, reviews: 54, learners: "732 learners" },
        { badge: "SELF-PACED", title: "Marine Pollution and Waste Management", meta: "Beginner · 3 Hours · 5 Modules", rating: 4.7, reviews: 98, learners: "956 learners" },
        { badge: "TRAINING", title: "Marine Biodiversity Conservation", meta: "Advanced · 6 Hours · 7 Modules", rating: 4.8, reviews: 76, learners: "621 learners" },
        { badge: "WORKSHOP", title: "Community-Based Marine Conservation", meta: "Intermediate · 2 Days", rating: 4.6, reviews: 45, learners: "389 learners" },
        { badge: "SELF-PACED", title: "Bycatch Reduction and Species Protection", meta: "Intermediate · 3 Hours · 4 Modules", rating: 4.6, reviews: 50, learners: "421 learners" },
      ],
    ),
    instructors: [
      { name: "Dr. Ir. Yuliana Setiawati, M.Sc.", role: "Marine Conservation Specialist", meta: "6 Courses · 1.2K Learners", avatar: avatar(3) },
      { name: "Dr. Muhammad Yusuf, Ph.D.", role: "Marine Ecologist", meta: "5 Courses · 980 Learners", avatar: avatar(2) },
      { name: "Dr. Putra A. Lestari, M.Si.", role: "Coastal Ecosystems Expert", meta: "4 Courses · 760 Learners", avatar: avatar(5) },
    ],
    events: [
      { month: "AUG", day: "10", year: "2026", title: "Webinar: Innovative Approaches in Marine Conservation", location: "Online", type: "Online" },
      { month: "SEP", day: "14", year: "2026", title: "Field Workshop: Coral Reef Restoration Techniques", location: "Bali, Indonesia", type: "In-person" },
    ],
    relatedTopics: ["Coral Reef", "Mangrove", "Marine Biodiversity", "Marine Protected Area", "Marine Pollution", "Seagrass", "Climate Change", "Ocean Stewardship"],
  },
  {
    slug: "blue-economy",
    title: "Blue Economy",
    shortLabel: "Blue Economy",
    icon: Anchor,
    description:
      "Explore knowledge and solutions for sustainable economic growth derived from healthy oceans and marine resources.",
    heroImage: courseBlueEconomy,
    heroAlt: "Sustainable coastal development and marine industry",
    stats: { courses: 20, pathways: 6, instructors: 28, learners: "820+", countries: 13 },
    levelCounts: [
      { label: "Beginner", count: 5 },
      { label: "Intermediate", count: 7 },
      { label: "Advanced", count: 8 },
    ],
    formatCounts: [
      { label: "Self-paced", count: 6 },
      { label: "Training", count: 5 },
      { label: "Webinar", count: 4 },
      { label: "Workshop", count: 5 },
    ],
    courses: withImages(
      [courseBlueEconomy, offshoreWind, courseCoastal, fishingSunset, aquaculture, courseGovernance],
      [
        { badge: "SELF-PACED", title: "Introduction to Blue Economy", meta: "Beginner · 2.5 Hours · 4 Modules", rating: 4.8, reviews: 128, learners: "1.1K learners" },
        { badge: "TRAINING", title: "Sustainable Ocean Business and Innovation", meta: "Intermediate · 3 Days · 6 Modules", rating: 4.7, reviews: 96, learners: "856 learners" },
        { badge: "WORKSHOP", title: "Blue Economy Policy and Governance", meta: "Advanced · 2 Days", rating: 4.9, reviews: 67, learners: "512 learners" },
        { badge: "WEBINAR", title: "Financing the Blue Economy", meta: "Intermediate · 1.5 Hours", rating: 4.6, reviews: 54, learners: "734 learners" },
        { badge: "SELF-PACED", title: "Marine Tourism and Coastal Development", meta: "Beginner · 3 Hours · 5 Modules", rating: 4.7, reviews: 98, learners: "956 learners" },
        { badge: "WORKSHOP", title: "Value Chain Development in Marine Industries", meta: "Intermediate · 2 Days", rating: 4.6, reviews: 62, learners: "489 learners" },
        { badge: "TRAINING", title: "Blue Economy Indicators and Impact Measurement", meta: "Advanced · 3 Days · 6 Modules", rating: 4.7, reviews: 71, learners: "621 learners" },
        { badge: "SELF-PACED", title: "Investing in Sustainable Aquatic Enterprises", meta: "Intermediate · 2.5 Hours · 4 Modules", rating: 4.6, reviews: 58, learners: "388 learners" },
      ],
    ),
    instructors: [
      { name: "Dr. Ir. Yuliana Setiawati, M.Sc.", role: "Marine Economist", meta: "6 Courses · 1.2K Learners", avatar: avatar(3) },
      { name: "Dr. Muhammad Yusuf, Ph.D.", role: "Ocean Policy Expert", meta: "4 Courses · 980 Learners", avatar: avatar(2) },
      { name: "Dr. Putra A. Lestari, M.Si.", role: "Coastal Development Specialist", meta: "5 Courses · 760 Learners", avatar: avatar(5) },
    ],
    events: [
      { month: "JUL", day: "20", year: "2026", title: "International Conference on Blue Economy and Ocean Sustainability", location: "Bali, Indonesia", type: "Blended" },
      { month: "SEP", day: "05", year: "2026", title: "Webinar: Financing Sustainable Ocean Enterprises", location: "Online", type: "Online" },
    ],
    relatedTopics: ["Ocean Innovation", "Marine Industry", "Sustainable Investment", "Maritime Trade", "Coastal Development", "Ocean Energy"],
  },
  {
    slug: "climate-change",
    title: "Climate Change",
    shortLabel: "Climate Change",
    icon: CloudRain,
    description:
      "Build knowledge and skills to understand climate impacts, strengthen adaptation and resilience, and contribute to low-carbon and climate-smart ocean solutions.",
    heroImage: courseClimate,
    heroAlt: "Coastal resilience and climate adaptation landscape",
    stats: { courses: 20, pathways: 6, instructors: 27, learners: "780+", countries: 12 },
    levelCounts: [
      { label: "Beginner", count: 5 },
      { label: "Intermediate", count: 7 },
      { label: "Advanced", count: 8 },
    ],
    formatCounts: [
      { label: "Self-paced", count: 6 },
      { label: "Training", count: 5 },
      { label: "Webinar", count: 4 },
      { label: "Workshop", count: 5 },
    ],
    courses: withImages(
      [courseClimate, mangrove, coralDiver, offshoreWind, courseCoastal, fishingSunset],
      [
        { badge: "SELF-PACED", title: "Climate Change Fundamentals", meta: "Beginner · 2 Hours · 3 Modules", rating: 4.8, reviews: 128, learners: "1.1K learners" },
        { badge: "TRAINING", title: "Climate Science and Ocean Systems", meta: "Intermediate · 3 Days · 6 Modules", rating: 4.7, reviews: 96, learners: "856 learners" },
        { badge: "WORKSHOP", title: "Climate Risk Assessment for Coastal Communities", meta: "Intermediate · 2 Days", rating: 4.9, reviews: 67, learners: "512 learners" },
        { badge: "WEBINAR", title: "Mitigation Pathways and Low Carbon Solutions", meta: "Advanced · 1.5 Hours", rating: 4.6, reviews: 54, learners: "734 learners" },
        { badge: "SELF-PACED", title: "Adaptation Strategies for Marine and Coastal Areas", meta: "Intermediate · 2.5 Hours · 4 Modules", rating: 4.7, reviews: 98, learners: "963 learners" },
        { badge: "TRAINING", title: "Climate Data and Monitoring Techniques", meta: "Advanced · 3 Days · 6 Modules", rating: 4.6, reviews: 72, learners: "645 learners" },
        { badge: "WORKSHOP", title: "Integrating Traditional Knowledge in Climate Action", meta: "Beginner · 2 Days", rating: 4.7, reviews: 64, learners: "421 learners" },
        { badge: "SELF-PACED", title: "Coral Reefs in a Changing Climate", meta: "Intermediate · 2 Hours · 3 Modules", rating: 4.8, reviews: 81, learners: "612 learners" },
      ],
    ),
    instructors: [
      { name: "Dr. Iin Kurniawati, M.Sc.", role: "Climate Change Specialist", meta: "6 Courses · 1.3K Learners", avatar: avatar(3) },
      { name: "Dr. Arif Rahman, Ph.D.", role: "Climate Scientist", meta: "5 Courses · 980 Learners", avatar: avatar(4) },
      { name: "Dr. Maria Patricia, M.Si.", role: "Coastal Resilience Expert", meta: "4 Courses · 760 Learners", avatar: avatar(1) },
    ],
    events: [
      { month: "AUG", day: "28", year: "2026", title: "Workshop: Climate Risk Assessment for Coastal Communities", location: "Makassar, Indonesia", type: "In-person" },
      { month: "SEP", day: "16", year: "2026", title: "Webinar: Blue Carbon and Climate Mitigation", location: "Online", type: "Online" },
    ],
    relatedTopics: ["Climate Adaptation", "GHG Mitigation", "Ocean Acidification", "Sea Level Rise", "Climate Resilience", "Extreme Weather"],
  },
  {
    slug: "ocean-governance",
    title: "Ocean Governance",
    shortLabel: "Ocean Governance",
    icon: Scale,
    description:
      "Explore courses and programs that strengthen policy, legal frameworks, institutional capacity, and cooperative governance for healthy and sustainable oceans.",
    heroImage: courseGovernance,
    heroAlt: "International cooperation for ocean governance",
    stats: { courses: 21, pathways: 6, instructors: 28, learners: "750+", countries: 13 },
    levelCounts: [
      { label: "Beginner", count: 5 },
      { label: "Intermediate", count: 8 },
      { label: "Advanced", count: 8 },
    ],
    formatCounts: [
      { label: "Self-paced", count: 6 },
      { label: "Training", count: 5 },
      { label: "Webinar", count: 4 },
      { label: "Workshop", count: 6 },
    ],
    courses: withImages(
      [courseGovernance, courseCoastal, fishingSunset, courseBlueEconomy, marineSpatial, offshoreWind],
      [
        { badge: "TRAINING", title: "Introduction to Ocean Governance", meta: "Beginner · 2.5 Hours · 4 Modules", rating: 4.8, reviews: 128, learners: "1.1K learners" },
        { badge: "WORKSHOP", title: "Ocean Policy and Institutional Frameworks", meta: "Intermediate · 2 Days", rating: 4.7, reviews: 96, learners: "856 learners" },
        { badge: "WEBINAR", title: "International Law of the Sea", meta: "Advanced · 1.5 Hours", rating: 4.8, reviews: 72, learners: "645 learners" },
        { badge: "SELF-PACED", title: "Multi-stakeholder Engagement in Ocean Governance", meta: "Intermediate · 3 Hours · 5 Modules", rating: 4.6, reviews: 64, learners: "522 learners" },
        { badge: "TRAINING", title: "Marine Governance and Decision-Making", meta: "Intermediate · 3 Days", rating: 4.6, reviews: 58, learners: "489 learners" },
        { badge: "SELF-PACED", title: "Compliance, Enforcement and Accountability", meta: "Advanced · 2.5 Hours · 4 Modules", rating: 4.7, reviews: 61, learners: "438 learners" },
        { badge: "WORKSHOP", title: "Community Participation in Ocean Governance", meta: "Beginner · 2 Days", rating: 4.5, reviews: 54, learners: "401 learners" },
        { badge: "WEBINAR", title: "Regional Cooperation for Ocean Sustainability", meta: "Intermediate · 1.5 Hours", rating: 4.6, reviews: 50, learners: "388 learners" },
      ],
    ),
    instructors: [
      { name: "Prof. Hikmahanto Juwana, S.H., LL.M., Ph.D.", role: "Ocean Law Expert", meta: "6 Courses · 1.3K Learners", avatar: avatar(0) },
      { name: "Dr. Susan Herawati, M.Sc.", role: "Marine Policy Specialist", meta: "5 Courses · 980 Learners", avatar: avatar(1) },
      { name: "Dr. Arifsyah Nasution, M.Si.", role: "Governance & Policy Expert", meta: "4 Courses · 760 Learners", avatar: avatar(2) },
    ],
    events: [
      { month: "AUG", day: "22", year: "2026", title: "Forum: Regional Cooperation for Ocean Sustainability", location: "Jakarta, Indonesia", type: "Blended" },
      { month: "SEP", day: "10", year: "2026", title: "Webinar: International Law of the Sea Updates", location: "Online", type: "Online" },
    ],
    relatedTopics: ["Ocean Policy", "International Law of the Sea", "Marine Institutions", "Enforcement", "Regional Cooperation", "Stakeholder Engagement"],
  },
  {
    slug: "marine-spatial-planning",
    title: "Marine Spatial Planning",
    shortLabel: "Marine Spatial Planning",
    icon: Compass,
    description:
      "Discover courses and programs that build knowledge and skills to plan, manage, and balance human activities in marine spaces for sustainable ocean use.",
    heroImage: marineSpatial,
    heroAlt: "Marine spatial planning map and ocean zoning",
    stats: { courses: 19, pathways: 6, instructors: 25, learners: "720+", countries: 14 },
    levelCounts: [
      { label: "Beginner", count: 5 },
      { label: "Intermediate", count: 7 },
      { label: "Advanced", count: 7 },
    ],
    formatCounts: [
      { label: "Self-paced", count: 6 },
      { label: "Training", count: 6 },
      { label: "Webinar", count: 4 },
      { label: "Workshop", count: 3 },
    ],
    courses: withImages(
      [marineSpatial, courseMarineSpatial, courseCoastal, offshoreWind, fishingSunset, courseGovernance],
      [
        { badge: "TRAINING", title: "Introduction to Marine Spatial Planning", meta: "Beginner · 2.5 Hours · 4 Modules", rating: 4.8, reviews: 128, learners: "1.1K learners" },
        { badge: "SELF-PACED", title: "Principles and Frameworks of MSP", meta: "Beginner · 2 Hours · 3 Modules", rating: 4.7, reviews: 96, learners: "856 learners" },
        { badge: "WORKSHOP", title: "Stakeholder Engagement in MSP", meta: "Intermediate · 2 Days", rating: 4.9, reviews: 67, learners: "512 learners" },
        { badge: "WEBINAR", title: "Tools and Data for Marine Spatial Planning", meta: "Intermediate · 1.5 Hours", rating: 4.6, reviews: 54, learners: "734 learners" },
        { badge: "TRAINING", title: "Ecosystem-based Approach to MSP", meta: "Advanced · 3 Hours · 5 Modules", rating: 4.7, reviews: 98, learners: "963 learners" },
        { badge: "SELF-PACED", title: "Balancing Uses and Managing Trade-offs", meta: "Intermediate · 2.5 Hours · 4 Modules", rating: 4.6, reviews: 72, learners: "645 learners" },
        { badge: "WORKSHOP", title: "Zoning Design and Scenario Planning", meta: "Advanced · 2 Days", rating: 4.8, reviews: 64, learners: "421 learners" },
        { badge: "WEBINAR", title: "MSP Policy, Legal and Institutional Arrangements", meta: "Intermediate · 1.5 Hours", rating: 4.6, reviews: 58, learners: "489 learners" },
      ],
    ),
    instructors: [
      { name: "Dr. Fadli Syamsudin, M.Sc.", role: "Marine Spatial Planning Expert", meta: "5 Courses · 1.3K Learners", avatar: avatar(4) },
      { name: "Dr. Emilya Nurjanah, Ph.D.", role: "Coastal and Ocean Planner", meta: "4 Courses · 920 Learners", avatar: avatar(3) },
      { name: "Dr. Wahyu Adi Pratama, M.Si.", role: "Marine Policy Specialist", meta: "4 Courses · 780 Learners", avatar: avatar(2) },
    ],
    events: [
      { month: "AUG", day: "30", year: "2026", title: "Workshop: GIS Tools for Marine Spatial Planning", location: "Online (Live)", type: "Online" },
      { month: "SEP", day: "18", year: "2026", title: "Training: Ecosystem-based Marine Spatial Planning", location: "Manado, Indonesia", type: "In-person" },
    ],
    relatedTopics: ["MSP Frameworks", "Ocean Zoning", "Stakeholder Engagement", "Ecosystem Approach", "Maritime Uses", "Marine Data & GIS"],
  },
  {
    slug: "fisheries-surveillance",
    title: "Fisheries Surveillance",
    shortLabel: "Fisheries Surveillance",
    icon: Radar,
    description:
      "Explore courses and programs that strengthen monitoring, control, and surveillance systems to combat IUU fishing and ensure sustainable fisheries.",
    heroImage: fishingSunset,
    heroAlt: "Patrol vessel monitoring fishing activity at sea",
    stats: { courses: 18, pathways: 5, instructors: 24, learners: "650+", countries: 15 },
    levelCounts: [
      { label: "Beginner", count: 5 },
      { label: "Intermediate", count: 7 },
      { label: "Advanced", count: 6 },
    ],
    formatCounts: [
      { label: "Self-paced", count: 6 },
      { label: "Training", count: 5 },
      { label: "Webinar", count: 4 },
      { label: "Workshop", count: 3 },
    ],
    courses: withImages(
      [fishingSunset, offshoreWind, fisheriesWorkers, marineSpatial, courseTuna, courseGovernance],
      [
        { badge: "TRAINING", title: "Introduction to Fisheries Surveillance", meta: "Beginner · 2.5 Hours · 4 Modules", rating: 4.8, reviews: 128, learners: "1.1K learners" },
        { badge: "WEBINAR", title: "IUU Fishing: Trends, Impacts and Responses", meta: "Intermediate · 1.5 Hours", rating: 4.7, reviews: 96, learners: "856 learners" },
        { badge: "WORKSHOP", title: "Risk-based Approach to Fisheries Surveillance", meta: "Intermediate · 2 Days", rating: 4.9, reviews: 67, learners: "512 learners" },
        { badge: "SELF-PACED", title: "Satellite Monitoring for Fisheries Surveillance", meta: "Advanced · 2.5 Hours · 5 Modules", rating: 4.6, reviews: 54, learners: "734 learners" },
        { badge: "TRAINING", title: "Use of Drones in Fisheries Surveillance", meta: "Advanced · 2 Days · 6 Modules", rating: 4.7, reviews: 98, learners: "963 learners" },
        { badge: "SELF-PACED", title: "Vessel Boarding and Inspection Procedures", meta: "Intermediate · 1.5 Hours · 3 Modules", rating: 4.6, reviews: 72, learners: "645 learners" },
        { badge: "WEBINAR", title: "Legal Frameworks for Fisheries Surveillance", meta: "Intermediate · 1 Hour", rating: 4.5, reviews: 60, learners: "512 learners" },
        { badge: "SELF-PACED", title: "VMS and AIS Data Applications", meta: "Advanced · 2 Hours · 4 Modules", rating: 4.7, reviews: 81, learners: "612 learners" },
      ],
    ),
    instructors: [
      { name: "Dr. Hendra Yulistio, M.Sc.", role: "Fisheries Surveillance Expert", meta: "6 Courses · 1.2K Learners", avatar: avatar(0) },
      { name: "Capt. Arief Budiman", role: "Maritime Operations Specialist", meta: "5 Courses · 980 Learners", avatar: avatar(4) },
      { name: "Dr. Riani Putri, M.Si.", role: "Remote Sensing Specialist", meta: "4 Courses · 760 Learners", avatar: avatar(1) },
    ],
    events: [
      { month: "AUG", day: "26", year: "2026", title: "Training: Vessel Monitoring Systems and AIS Analysis", location: "Bitung, Indonesia", type: "In-person" },
      { month: "SEP", day: "12", year: "2026", title: "Webinar: Combating IUU Fishing with Satellite Data", location: "Online", type: "Online" },
    ],
    relatedTopics: ["IUU Fishing", "Vessel Monitoring System", "Satellite Monitoring", "Port State Measures", "Vessel Inspection", "Enforcement", "Compliance & Monitoring"],
  },
  {
    slug: "fish-processing-and-value-addition",
    title: "Fish Processing and Value Addition",
    shortLabel: "Fish Processing & Value Addition",
    icon: Factory,
    description:
      "Enhance knowledge and skills in post-harvest handling, processing technologies, quality control, and product development to add value to fishery products.",
    heroImage: fishProcessing,
    heroAlt: "Fish processing facility with quality control",
    stats: { courses: 20, pathways: 6, instructors: 26, learners: "680+", countries: 14 },
    levelCounts: [
      { label: "Beginner", count: 6 },
      { label: "Intermediate", count: 8 },
      { label: "Advanced", count: 6 },
    ],
    formatCounts: [
      { label: "Self-paced", count: 6 },
      { label: "Training", count: 6 },
      { label: "Webinar", count: 4 },
      { label: "Workshop", count: 4 },
    ],
    courses: withImages(
      [fishProcessing, fisheriesWorkers, aquaculture, fishingSunset, courseTuna, coralDiver],
      [
        { badge: "TRAINING", title: "Post-harvest Handling of Fish", meta: "Beginner · 2.5 Hours · 3 Modules", rating: 4.7, reviews: 89, learners: "612 learners" },
        { badge: "WORKSHOP", title: "Traditional Fish Processing Technologies", meta: "Beginner · 2 Days", rating: 4.6, reviews: 64, learners: "421 learners" },
        { badge: "SELF-PACED", title: "Fish Canning Technology and Quality Control", meta: "Intermediate · 3 Hours · 4 Modules", rating: 4.8, reviews: 92, learners: "753 learners" },
        { badge: "WEBINAR", title: "Value Addition through Fish Filleting and Portioning", meta: "Intermediate · 1.5 Hours", rating: 4.6, reviews: 57, learners: "389 learners" },
        { badge: "SELF-PACED", title: "Development of Fish Snacks and Ready-to-Eat Products", meta: "Intermediate · 2.5 Hours · 4 Modules", rating: 4.7, reviews: 73, learners: "512 learners" },
        { badge: "TRAINING", title: "Hygiene and Sanitation in Fish Processing", meta: "Beginner · 2 Hours · 3 Modules", rating: 4.6, reviews: 66, learners: "471 learners" },
        { badge: "WORKSHOP", title: "Drying and Smoking Technologies for Fish", meta: "Beginner · 2 Days", rating: 4.5, reviews: 54, learners: "401 learners" },
        { badge: "SELF-PACED", title: "Freezing and Cold Chain Management", meta: "Intermediate · 2 Hours · 3 Modules", rating: 4.7, reviews: 81, learners: "638 learners" },
      ],
    ),
    instructors: [
      { name: "Dr. Lusia Permata, M.Sc.", role: "Fish Processing Expert", meta: "6 Courses · 1.3K Learners", avatar: avatar(1) },
      { name: "Ir. Bambang Wicaksono", role: "Post-harvest Specialist", meta: "5 Courses · 980 Learners", avatar: avatar(4) },
      { name: "Dr. Sari Dewi, Ph.D.", role: "Food Technologist", meta: "4 Courses · 760 Learners", avatar: avatar(3) },
    ],
    events: [
      { month: "AUG", day: "24", year: "2026", title: "Training: HACCP and Food Safety in Fish Processing", location: "Semarang, Indonesia", type: "In-person" },
      { month: "SEP", day: "06", year: "2026", title: "Webinar: Product Innovation for Fishery Value Chains", location: "Online", type: "Online" },
    ],
    relatedTopics: ["Post-harvest Handling", "Value Addition", "Food Safety", "Fish Products", "Packaging", "By-product Utilization"],
  },
  {
    slug: "ocean-literacy",
    title: "Ocean Literacy",
    shortLabel: "Ocean Literacy",
    icon: BookOpen,
    description:
      "Build awareness, knowledge and understanding about the ocean and our connection to it, to inspire responsible actions for marine sustainability.",
    heroImage: seaTurtle,
    heroAlt: "Sea turtle swimming, inspiring ocean awareness",
    stats: { courses: 22, pathways: 6, instructors: 28, learners: "700+", countries: 16 },
    levelCounts: [
      { label: "Beginner", count: 7 },
      { label: "Intermediate", count: 9 },
      { label: "Advanced", count: 6 },
    ],
    formatCounts: [
      { label: "Self-paced", count: 7 },
      { label: "Training", count: 4 },
      { label: "Webinar", count: 6 },
      { label: "Workshop", count: 5 },
    ],
    courses: withImages(
      [seaTurtle, coralDiver, courseCoastal, mangrove, plasticPollution, courseCoralReef],
      [
        { badge: "WEBINAR", title: "Introduction to Ocean Literacy", meta: "Beginner · 1.5 Hours", rating: 4.7, reviews: 85, learners: "612 learners" },
        { badge: "SELF-PACED", title: "Our Ocean, Our Life: Why the Ocean Matters", meta: "Beginner · 2 Hours · 3 Modules", rating: 4.8, reviews: 96, learners: "721 learners" },
        { badge: "WORKSHOP", title: "Actions for a Healthy Ocean", meta: "Intermediate · 2 Days", rating: 4.6, reviews: 72, learners: "513 learners" },
        { badge: "TRAINING", title: "Exploring Marine Ecosystems", meta: "Intermediate · 2 Hours · 4 Modules", rating: 4.6, reviews: 64, learners: "489 learners" },
        { badge: "SELF-PACED", title: "Human Activities and Ocean Impacts", meta: "Intermediate · 2.5 Hours · 4 Modules", rating: 4.7, reviews: 78, learners: "601 learners" },
        { badge: "WEBINAR", title: "Ocean and Climate: A Connected Future", meta: "Advanced · 1.5 Hours", rating: 4.8, reviews: 93, learners: "745 learners" },
        { badge: "WORKSHOP", title: "Ocean Literacy in Education", meta: "Intermediate · 2 Days", rating: 4.6, reviews: 61, learners: "412 learners" },
        { badge: "SELF-PACED", title: "Traditional Knowledge and the Ocean", meta: "Intermediate · 2 Hours · 3 Modules", rating: 4.6, reviews: 56, learners: "398 learners" },
      ],
    ),
    instructors: [
      { name: "Dr. Yanuar Putri, M.Sc.", role: "Marine Education Specialist", meta: "5 Courses · 1.2K Learners", avatar: avatar(3) },
      { name: "Dr. Indra Wijaya, Ph.D.", role: "Ocean Education Expert", meta: "6 Courses · 980 Learners", avatar: avatar(2) },
      { name: "Dr. Lestari Ningsih, M.Si.", role: "Coastal Community Facilitator", meta: "4 Courses · 760 Learners", avatar: avatar(1) },
    ],
    events: [
      { month: "AUG", day: "20", year: "2026", title: "Youth Workshop: Ocean Literacy for Coastal Schools", location: "Lombok, Indonesia", type: "In-person" },
      { month: "SEP", day: "08", year: "2026", title: "Webinar: Citizen Science for Ocean Awareness", location: "Online", type: "Online" },
    ],
    relatedTopics: ["Ocean Awareness", "Marine Ecosystems", "Sustainable Ocean", "Community Engagement", "Citizen Science", "Ocean and Climate"],
  },
];

export const categoryBySlug: Record<string, AcademyCategory> = Object.fromEntries(
  categories.map((c) => [c.slug, c]),
);

export type CategoryAccent = { icon: string; chip: string; ring: string };

// Category-specific accent colors (full literal class strings so Tailwind detects them).
export const categoryAccents: Record<string, CategoryAccent> = {
  "fisheries-management": { icon: "text-ocean", chip: "bg-ocean/10", ring: "group-hover:shadow-glow group-hover:border-ocean" },
  aquaculture: { icon: "text-aqua", chip: "bg-aqua/10", ring: "group-hover:shadow-glow group-hover:border-aqua" },
  "marine-conservation": { icon: "text-turquoise", chip: "bg-turquoise/10", ring: "group-hover:shadow-glow group-hover:border-turquoise" },
  "blue-economy": { icon: "text-navy", chip: "bg-navy/10", ring: "group-hover:shadow-glow group-hover:border-navy" },
  "climate-change": { icon: "text-accent", chip: "bg-accent/15", ring: "group-hover:shadow-glow group-hover:border-accent" },
  "ocean-governance": { icon: "text-navy", chip: "bg-navy/10", ring: "group-hover:shadow-glow group-hover:border-navy" },
  "marine-spatial-planning": { icon: "text-aqua", chip: "bg-aqua/10", ring: "group-hover:shadow-glow group-hover:border-aqua" },
  "fisheries-surveillance": { icon: "text-turquoise", chip: "bg-turquoise/10", ring: "group-hover:shadow-glow group-hover:border-turquoise" },
  "fish-processing": { icon: "text-accent", chip: "bg-accent/15", ring: "group-hover:shadow-glow group-hover:border-accent" },
  "ocean-literacy": { icon: "text-aqua", chip: "bg-aqua/10", ring: "group-hover:shadow-glow group-hover:border-aqua" },
};

export const defaultCategoryAccent: CategoryAccent = {
  icon: "text-marine",
  chip: "bg-marine/10",
  ring: "group-hover:shadow-glow group-hover:border-marine",
};

export function accentFor(slug: string): CategoryAccent {
  return categoryAccents[slug] ?? defaultCategoryAccent;
}
