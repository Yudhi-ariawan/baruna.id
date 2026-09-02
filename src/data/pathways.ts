import {
  Sprout,
  Compass,
  Radar,
  ShieldCheck,
  BookOpen,
  Clock,
  BarChart3,
  Award,
  Users,
  Video,
  GraduationCap,
  Wrench,
  FileText,
  FolderKanban,
  UserCheck,
  ClipboardCheck,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { academyImages } from "./academy";
import { expertImages } from "./pages";

import pathwayBeginner from "@/assets/academy/pathway-beginner.jpg";
import pathwayIntermediate from "@/assets/academy/pathway-intermediate.jpg";
import pathwayAdvanced from "@/assets/academy/pathway-advanced.jpg";
import pathwayCertification from "@/assets/academy/pathway-certification.jpg";

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

export type PathwayTone = "beginner" | "intermediate" | "advanced" | "certification";

export type PathwayModule = {
  title: string;
  format: string;
  level: string;
  duration: string;
  desc: string;
  image: string;
};

export type PathwayStat = { icon: LucideIcon; value: string; label: string };

export type PathwayComponent = { label: string; icon: LucideIcon };

export type CertificationStep = { step: number; title: string; desc: string; icon: LucideIcon };

export type Pathway = {
  slug: string;
  title: string;
  shortLabel: string;
  icon: LucideIcon;
  illustration: string;
  illustrationAlt: string;
  tone: PathwayTone;
  badge: string;
  hero: string;
  description: string;
  overview: string[];
  visualTone: string;
  stats: PathwayStat[];
  modules: PathwayModule[];
  components: PathwayComponent[];
  about: { whoFor: string; whatLearn: string; whatNext: string };
  progress: { percent: number; completed: number; total: number; cta: string };
  nextStep: { label: string; title: string; desc: string; slug?: string; cta: string };
  certificationTracks?: { label: string; icon: LucideIcon }[];
  certificationJourney?: CertificationStep[];
};

export const pathwayOrder: PathwayTone[] = [
  "beginner",
  "intermediate",
  "advanced",
  "certification",
];

export const pathways: Pathway[] = [
  {
    slug: "beginner",
    title: "Beginner Pathway",
    shortLabel: "Beginner",
    icon: Sprout,
    illustration: pathwayBeginner,
    illustrationAlt: "Friendly ocean illustration with a sailboat, coral reef and sea turtle",
    tone: "beginner",
    badge: "Beginner Explorer",
    hero: "Start Your Ocean Learning Journey",
    description:
      "Build foundational knowledge in ocean literacy, marine biodiversity, blue economy, and fisheries fundamentals.",
    overview: [
      "This pathway is designed for learners who are new to marine and fisheries topics. You will gain foundational knowledge and build confidence to explore more advanced subjects.",
      "Start with the basics of ocean literacy, marine biodiversity, and the blue economy before progressing to the Intermediate Pathway.",
    ],
    visualTone: "Friendly, introductory, fresh, welcoming",
    stats: [
      { icon: BookOpen, value: "12", label: "Courses" },
      { icon: Clock, value: "20–25", label: "Hours of learning" },
      { icon: BarChart3, value: "Foundational", label: "Level" },
      { icon: Award, value: "Certificate", label: "of Completion" },
      { icon: Users, value: "3,241", label: "Learners enrolled" },
    ],
    modules: [
      { title: "Ocean Literacy Fundamentals", format: "Self-paced Course", level: "Beginner", duration: "1.5 Hours", desc: "Explore the basic features of the ocean and its importance to life.", image: seaTurtle },
      { title: "Introduction to Marine Biodiversity", format: "Self-paced Course", level: "Beginner", duration: "2 Hours", desc: "Learn about major marine ecosystems and their components.", image: coralDiver },
      { title: "Blue Economy Basics", format: "Self-paced Course", level: "Beginner", duration: "1.5 Hours", desc: "Understand the principles of a sustainable ocean economy.", image: offshoreWind },
      { title: "Introduction to Fisheries Management", format: "Self-paced Course", level: "Beginner", duration: "2 Hours", desc: "Discover what fisheries are and why they matter.", image: fishingSunset },
      { title: "Climate Change and Oceans", format: "Self-paced Course", level: "Beginner", duration: "1.5 Hours", desc: "Understand how climate change affects marine systems.", image: mangrove },
    ],
    components: [
      { label: "Self-Paced Course", icon: BookOpen },
      { label: "Webinar", icon: Video },
      { label: "Introductory Training", icon: GraduationCap },
    ],
    about: {
      whoFor: "New learners with little to no prior knowledge of marine and fisheries topics.",
      whatLearn: "Fundamental concepts, key terms, and basic principles.",
      whatNext: "Continue to the Intermediate Pathway to deepen your knowledge.",
    },
    progress: { percent: 0, completed: 0, total: 12, cta: "Start Learning" },
    nextStep: {
      label: "Recommended Next Step",
      title: "Intermediate Pathway",
      desc: "Build on your foundation and dive deeper into key topics.",
      slug: "intermediate",
      cta: "Explore Intermediate Pathway",
    },
  },
  {
    slug: "intermediate",
    title: "Intermediate Pathway",
    shortLabel: "Intermediate",
    icon: Compass,
    illustration: pathwayIntermediate,
    illustrationAlt: "Coastal illustration with a fishing vessel and aquaculture net cages",
    tone: "intermediate",
    badge: "Marine Practitioner",
    hero: "Strengthen Your Marine and Fisheries Competencies",
    description:
      "Deepen practical knowledge and apply marine and fisheries concepts in real program settings.",
    overview: [
      "Strengthen your understanding through core topics, case studies, and practical tools. This pathway prepares you to contribute to projects and support decision-making in your field.",
      "Build on your foundational knowledge and develop practical skills to address real-world challenges in marine and fisheries.",
    ],
    visualTone: "Practical, collaborative, field-based",
    stats: [
      { icon: BookOpen, value: "16", label: "Courses" },
      { icon: Clock, value: "40–45", label: "Hours of learning" },
      { icon: BarChart3, value: "Intermediate", label: "Level" },
      { icon: Award, value: "Certificate", label: "of Completion" },
      { icon: Users, value: "2,187", label: "Learners enrolled" },
    ],
    modules: [
      { title: "Sustainable Fisheries Management", format: "Training", level: "Intermediate", duration: "3 Hours", desc: "Explore principles and approaches to manage fisheries sustainably.", image: fisheriesWorkers },
      { title: "Aquaculture Systems", format: "Training", level: "Intermediate", duration: "3 Hours", desc: "Learn about major aquaculture systems and management practices.", image: aquaculture },
      { title: "Marine Conservation Planning", format: "Workshop", level: "Intermediate", duration: "2.5 Hours", desc: "Examine biodiversity, habitats, and conservation strategies.", image: coralDiver },
      { title: "Ocean Governance", format: "Webinar", level: "Intermediate", duration: "2.5 Hours", desc: "Analyze policies, institutions, and governance for sustainable oceans.", image: marineSpatial },
      { title: "Fisheries Data Collection", format: "Case Study", level: "Intermediate", duration: "3 Hours", desc: "Learn methods for collecting and managing marine and fisheries data.", image: fishingSunset },
    ],
    components: [
      { label: "Training", icon: GraduationCap },
      { label: "Webinar", icon: Video },
      { label: "Workshop", icon: Wrench },
      { label: "Case Study", icon: FileText },
    ],
    about: {
      whoFor: "Learners with basic understanding who want to build practical skills and knowledge.",
      whatLearn: "Core concepts, practical tools, and applied knowledge in key marine and fisheries areas.",
      whatNext: "Advance to the Advanced Pathway or specialize in a specific area.",
    },
    progress: { percent: 15, completed: 2, total: 16, cta: "Continue Learning" },
    nextStep: {
      label: "Recommended Next Step",
      title: "Advanced Pathway",
      desc: "Deepen your expertise and take on complex challenges.",
      slug: "advanced",
      cta: "Explore Advanced Pathway",
    },
  },
  {
    slug: "advanced",
    title: "Advanced Pathway",
    shortLabel: "Advanced",
    icon: Radar,
    illustration: pathwayAdvanced,
    illustrationAlt: "Illustration of offshore wind turbines, a research vessel and monitoring buoys",
    tone: "advanced",
    badge: "Marine Specialist",
    hero: "Master Technical and Strategic Skills",
    description:
      "Develop technical and strategic competencies for planning, surveillance, adaptation, and advanced marine-fisheries management.",
    overview: [
      "This pathway is for learners ready to deepen their expertise, apply advanced methodologies, and lead initiatives that influence policy, drive innovation, and promote sustainable ocean and fisheries futures.",
      "Master advanced concepts, analytical tools, and leadership strategies to design solutions and drive impact in complex marine and fisheries challenges.",
    ],
    visualTone: "Technical, strategic, professional",
    stats: [
      { icon: BookOpen, value: "18", label: "Courses" },
      { icon: Clock, value: "60–70", label: "Hours of learning" },
      { icon: BarChart3, value: "Advanced", label: "Level" },
      { icon: Award, value: "Certificate", label: "of Completion" },
      { icon: Users, value: "1,245", label: "Learners enrolled" },
    ],
    modules: [
      { title: "Marine Spatial Planning", format: "Advanced Training", level: "Advanced", duration: "4.5 Hours", desc: "Advanced tools and approaches for planning in dynamic marine environments.", image: marineSpatial },
      { title: "Fisheries Surveillance", format: "Technical Workshop", level: "Advanced", duration: "4 Hours", desc: "Advanced technologies and strategies for effective MCS systems.", image: fisheriesWorkers },
      { title: "Climate Adaptation Strategies", format: "Expert Session", level: "Advanced", duration: "4 Hours", desc: "Assess risks and design adaptation strategies for marine systems.", image: plasticPollution },
      { title: "Fish Processing and Value Addition", format: "Applied Project", level: "Advanced", duration: "3.5 Hours", desc: "Advanced methods for processing and adding value to fisheries products.", image: fishProcessing },
      { title: "Ecosystem-Based Fisheries Management", format: "Advanced Training", level: "Advanced", duration: "4 Hours", desc: "Apply EBFM principles to balance conservation and fisheries objectives.", image: seaTurtle },
    ],
    components: [
      { label: "Advanced Training", icon: GraduationCap },
      { label: "Technical Workshop", icon: Wrench },
      { label: "Expert Session", icon: UserCheck },
      { label: "Applied Project", icon: FolderKanban },
    ],
    about: {
      whoFor: "Professionals and practitioners seeking to strengthen expertise and lead initiatives in the marine and fisheries domain.",
      whatLearn: "Advanced frameworks, analytical tools, leadership strategies, and innovative solutions for real-world challenges.",
      whatNext: "Graduate to the Professional Certification Pathway or apply your skills in practice.",
    },
    progress: { percent: 10, completed: 2, total: 18, cta: "Continue Learning" },
    nextStep: {
      label: "Recommended Next Step",
      title: "Professional Certification Pathway",
      desc: "Earn advanced recognition and validate your expertise.",
      slug: "professional-certification",
      cta: "Explore Certification Pathway",
    },
  },
  {
    slug: "professional-certification",
    title: "Professional Certification Pathway",
    shortLabel: "Professional Certification",
    icon: ShieldCheck,
    illustration: pathwayCertification,
    illustrationAlt: "Marine and fisheries professionals reviewing a tablet at a coastal port",
    tone: "certification",
    badge: "Certified Professional",
    hero: "Become a Certified Marine and Fisheries Professional",
    description:
      "Complete required learning, pass assessment, and earn professional certification in selected marine and fisheries competency areas.",
    overview: [
      "This pathway prepares professionals to meet industry standards and best practices through rigorous training, assessments, and practical application.",
      "Earn a professional certificate upon successful completion and enhance your career opportunities.",
    ],
    visualTone: "Formal, credible, high-value, achievement-oriented",
    stats: [
      { icon: BookOpen, value: "10", label: "Certification Programs" },
      { icon: Clock, value: "80–120", label: "Hours of learning" },
      { icon: BarChart3, value: "Advanced", label: "Level" },
      { icon: Award, value: "Industry", label: "Recognized" },
      { icon: Users, value: "876", label: "Professionals Certified" },
    ],
    modules: [
      { title: "Certified Fisheries Manager (CFM)", format: "Certification", level: "Advanced", duration: "120 Hours", desc: "Comprehensive certification for fisheries management professionals.", image: fishingSunset },
      { title: "Certified Aquaculture Practitioner (CAP)", format: "Certification", level: "Advanced", duration: "90 Hours", desc: "Certification for advanced aquaculture management and operations.", image: aquaculture },
      { title: "Certified Marine Conservation Professional (CMCP)", format: "Certification", level: "Advanced", duration: "90 Hours", desc: "Certification in marine biodiversity conservation and management.", image: coralDiver },
      { title: "Certified Blue Economy Specialist (CBES)", format: "Certification", level: "Advanced", duration: "100 Hours", desc: "Certification in sustainable blue economy strategy and investment.", image: offshoreWind },
      { title: "Certified Ocean Governance Professional (COGP)", format: "Certification", level: "Advanced", duration: "100 Hours", desc: "Certification in ocean policy, institutions, and governance frameworks.", image: marineSpatial },
    ],
    components: [
      { label: "Certification Track", icon: ShieldCheck },
      { label: "Mandatory Training", icon: GraduationCap },
      { label: "Assessment", icon: ClipboardCheck },
      { label: "Expert Validation", icon: UserCheck },
    ],
    about: {
      whoFor: "Professionals and practitioners seeking to validate their expertise and advance their careers.",
      whatLearn: "Advanced knowledge, practical skills, and industry standards in your chosen specialization area.",
      whatNext: "Use your certification to open new career opportunities and make greater impact.",
    },
    progress: { percent: 0, completed: 0, total: 10, cta: "Start Your Certification Journey" },
    nextStep: {
      label: "Certification Benefits",
      title: "Industry Recognition",
      desc: "Earn a recognized certificate that enhances your professional credibility.",
      cta: "Contact Advisor",
    },
    certificationTracks: [
      { label: "Fisheries Management", icon: Compass },
      { label: "Aquaculture", icon: Sprout },
      { label: "Marine Conservation", icon: ShieldCheck },
      { label: "Blue Economy", icon: BarChart3 },
      { label: "Ocean Governance", icon: BookOpen },
    ],
    certificationJourney: [
      { step: 1, title: "Complete Required Courses", desc: "Finish the required learning modules in your chosen track.", icon: BookOpen },
      { step: 2, title: "Attend Mandatory Training", desc: "Join instructor-led sessions and hands-on practice.", icon: GraduationCap },
      { step: 3, title: "Pass Assessment", desc: "Demonstrate your competencies through a formal assessment.", icon: ClipboardCheck },
      { step: 4, title: "Earn Certification", desc: "Receive your industry-recognized professional certificate.", icon: Award },
      { step: 5, title: "Share Achievement", desc: "Showcase your certification and grow your professional network.", icon: Share2 },
    ],
  },
];

export const pathwayBySlug: Record<string, Pathway> = Object.fromEntries(
  pathways.map((p) => [p.slug, p]),
);
