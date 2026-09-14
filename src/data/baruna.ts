import heroOcean from "@/assets/hero-ocean.jpg";
import courseBlueEconomy from "@/assets/course-blue-economy.jpg";
import courseMarineSpatial from "@/assets/course-marine-spatial.jpg";
import courseClimate from "@/assets/course-climate.jpg";
import courseCoralReef from "@/assets/course-coral-reef.jpg";
import courseTuna from "@/assets/course-tuna.jpg";
import courseGovernance from "@/assets/course-governance.jpg";
import courseCoastal from "@/assets/course-coastal.jpg";
import expert1 from "@/assets/expert-1.jpg";
import expert2 from "@/assets/expert-2.jpg";
import expert3 from "@/assets/expert-3.jpg";

import {
  GraduationCap,
  BookOpen,
  Users,
  Globe,
  MessagesSquare,
  CalendarDays,
  Handshake,
  type LucideIcon,
} from "lucide-react";

export const images = {
  heroOcean,
};

export const navItems = [
  { label: "Home", href: "/" },
  { label: "Academy", href: "/academy" },
  { label: "Knowledge Hub", href: "/knowledge-hub" },
  { label: "Experts", href: "/experts" },
  { label: "Fellowship & Exchange", href: "/fellowship" },
  { label: "Community", href: "/community" },
  { label: "Events", href: "/events" },
  { label: "Partnership", href: "/partnership" },
];

export type ContinueCourse = {
  title: string;
  tag: "COURSE" | "TRAINING" | "WEBINAR";
  image: string;
  progress: number;
};

export const continueLearning: ContinueCourse[] = [
  {
    title: "Blue Economy Fundamentals",
    tag: "COURSE",
    image: courseBlueEconomy,
    progress: 75,
  },
  {
    title: "Marine Spatial Planning",
    tag: "TRAINING",
    image: courseMarineSpatial,
    progress: 42,
  },
  {
    title: "Climate Adaptation for Coastal Areas",
    tag: "WEBINAR",
    image: courseClimate,
    progress: 18,
  },
];

export type RecommendedCourse = {
  title: string;
  category: "COURSE" | "TRAINING" | "WEBINAR" | "WORKSHOP";
  level: "Beginner" | "Intermediate" | "Advanced";
  rating: number;
  reviews: number;
  image: string;
};

export const recommended: RecommendedCourse[] = [
  {
    title: "Coral Reef Monitoring and Management",
    category: "COURSE",
    level: "Beginner",
    rating: 4.7,
    reviews: 86,
    image: courseCoralReef,
  },
  {
    title: "Tuna Fisheries Management",
    category: "TRAINING",
    level: "Intermediate",
    rating: 4.6,
    reviews: 72,
    image: courseTuna,
  },
  {
    title: "Ocean Governance in Practice",
    category: "WEBINAR",
    level: "Intermediate",
    rating: 4.8,
    reviews: 64,
    image: courseGovernance,
  },
  {
    title: "Climate Adaptation for Coastal Communities",
    category: "WORKSHOP",
    level: "Beginner",
    rating: 4.5,
    reviews: 58,
    image: courseCoastal,
  },
];

export type EcosystemItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  href: string;
};

export const ecosystem: EcosystemItem[] = [
  {
    title: "Academy",
    description: "Training programs, courses, webinars, workshops, and certifications.",
    icon: GraduationCap,
    color: "eco-academy",
    href: "/academy",
  },
  {
    title: "Knowledge Hub",
    description: "Publications, modules, best practices, videos, policy briefs, and more.",
    icon: BookOpen,
    color: "eco-knowledge",
    href: "/knowledge-hub",
  },
  {
    title: "Experts",
    description: "Directory of experts, lecturers, researchers, and practitioners.",
    icon: Users,
    color: "eco-experts",
    href: "/experts",
  },
  {
    title: "Fellowship & Exchange",
    description: "Fellowships, internships, study visits, exchange programs, and more.",
    icon: Globe,
    color: "eco-fellowship",
    href: "/fellowship",
  },
  {
    title: "Community",
    description: "Communities of practice, discussions, Q&A, and professional groups.",
    icon: MessagesSquare,
    color: "eco-community",
    href: "/community",
  },
  {
    title: "Events",
    description: "Seminars, workshops, conferences, trainings, and capacity building events.",
    icon: CalendarDays,
    color: "eco-events",
    href: "/events",
  },
  {
    title: "Partnership",
    description:
      "Collaboration with government, academia, organizations, and development partners.",
    icon: Handshake,
    color: "eco-partnership",
    href: "/partnership",
  },
];

export type EventItem = {
  month: string;
  day: string;
  year: string;
  title: string;
  location: string;
  type: "Blended" | "Online" | "In-person";
};

export const events: EventItem[] = [
  {
    month: "AUG",
    day: "20",
    year: "2026",
    title: "International Conference on Blue Economy and Ocean Sustainability",
    location: "Bali, Indonesia",
    type: "Blended",
  },
  {
    month: "SEP",
    day: "10",
    year: "2026",
    title: "Webinar: Innovative Approaches in Marine Conservation",
    location: "Online",
    type: "Online",
  },
  {
    month: "SEP",
    day: "25",
    year: "2026",
    title: "Regional Workshop on Sustainable Fisheries Management",
    location: "Jakarta, Indonesia",
    type: "In-person",
  },
];

export type Resource = {
  type: "PUBLICATION" | "POLICY BRIEF" | "VIDEO";
  title: string;
  meta: string;
};

export const resources: Resource[] = [
  {
    type: "PUBLICATION",
    title: "Indonesia Marine and Fisheries Statistics 2024",
    meta: "PDF · 3.2 MB",
  },
  {
    type: "POLICY BRIEF",
    title: "Sustainable Fisheries Management: Policy Brief",
    meta: "PDF · 1.8 MB",
  },
  {
    type: "VIDEO",
    title: "Best Practices in Community-Based Fisheries Management",
    meta: "Video · 12:45",
  },
];

export type Expert = {
  name: string;
  position: string;
  image: string;
};

export const experts: Expert[] = [
  {
    name: "Dr. Aruna Pratama",
    position: "Head of The Agency for Marine and Fisheries and Human Resources Development",
    image: expert1,
  },
  {
    name: "Dr. Sinta Mahardika",
    position: "Director of Directorate for Marine and Fisheries Training",
    image: expert2,
  },
  {
    name: "Dr. Larasati Pangan",
    position: "Secretary of The Agency for Marine and Fisheries and Human Resources Development",
    image: expert3,
  },
];

export type Fellowship = {
  abbr: string;
  title: string;
  deadline: string;
};

export const fellowships: Fellowship[] = [
  {
    abbr: "CTI",
    title: "CTI-CFF Fellowship Program",
    deadline: "Application open until 20 Aug 2026",
  },
  {
    abbr: "SEA",
    title: "SEAFDEC Exchange Program",
    deadline: "Application open until 31 Aug 2026",
  },
  {
    abbr: "IOC",
    title: "IOC-UNESCO Training Course",
    deadline: "Application open until 15 Sep 2026",
  },
];

export const partners = ["WORLD BANK", "GEF", "USGS", "EUROPEAN UNION", "IUCN"];

export const footerStats = [
  { value: "1,250+", label: "Learners", icon: Users },
  { value: "240+", label: "Programs", icon: GraduationCap },
  { value: "45+", label: "Countries", icon: Globe },
  { value: "120+", label: "Partners", icon: Handshake },
  { value: "300+", label: "Learning Resources", icon: BookOpen },
];
