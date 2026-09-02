import bannerUnderwater from "@/assets/banner-underwater.jpg";
import coralDiver from "@/assets/academy/coral-diver.jpg";
import seaTurtle from "@/assets/academy/sea-turtle.jpg";
import fishingSunset from "@/assets/academy/fishing-sunset.jpg";
import fishProcessing from "@/assets/academy/fish-processing.jpg";
import fisheriesWorkers from "@/assets/academy/fisheries-workers.jpg";
import mangrove from "@/assets/academy/mangrove.jpg";
import aquaculture from "@/assets/academy/aquaculture.jpg";
import {
  Building,
  Monitor,
  Presentation,
  GraduationCap,
  UsersRound,
  MapPin,
  Compass,
  type LucideIcon,
} from "lucide-react";

export type EventFormat = "Offline" | "Online" | "Blended";
export type EventCategory =
  | "Conference"
  | "Webinar"
  | "Workshop"
  | "Training"
  | "Community"
  | "Field Visit";

export type AgendaDay = { day: string; title: string; items: string[] };

export type BarunaEvent = {
  slug: string;
  title: string;
  shortTitle: string;
  category: EventCategory;
  startISO: string;
  endISO: string;
  dateLabel: string;
  city: string;
  country: string;
  region: string;
  location: string;
  format: EventFormat;
  organizer: string;
  partners: string[];
  website?: string;
  registrationUrl?: string;
  description: string;
  longDescription: string;
  image: string;
  themes: string[];
  agenda: AgendaDay[];
  featured: boolean;
  hero: boolean;
};

// ── Real events sourced from the BARUNA Events List 2026–2027 ────────────────
export const events: BarunaEvent[] = [
  {
    slug: "our-ocean-conference-2026",
    title: "Our Ocean Conference 2026",
    shortTitle: "Our Ocean Conference 2026",
    category: "Conference",
    startISO: "2026-06-16",
    endISO: "2026-06-18",
    dateLabel: "16–18 June 2026",
    city: "Mombasa",
    country: "Kenya",
    region: "Africa",
    location: "Mombasa, Kenya",
    format: "Offline",
    organizer: "Government of Kenya",
    partners: ["Our Ocean Conference Secretariat"],
    website: "https://www.ouroceanconference.org/",
    registrationUrl: "https://www.ouroceanconference.org/conferences/mombasa-2026/",
    description:
      "The premier global gathering driving voluntary commitments to protect the ocean, advance the blue economy, and strengthen maritime security.",
    longDescription:
      "Our Ocean Conference 2026 brings governments, civil society, and industry together in Mombasa to make concrete, measurable commitments for ocean health. The agenda spans marine protected areas, sustainable fisheries, the blue economy, climate change, ocean pollution, and maritime security — a defining moment for ocean action in Africa and beyond.",
    image: fishingSunset,
    themes: ["Blue Economy", "Marine Protected Areas", "Maritime Security", "Sustainable Fisheries"],
    agenda: [
      { day: "Day 1", title: "Opening & High-Level Plenary", items: ["Heads of state addresses", "Announcing voluntary commitments", "Blue economy showcase"] },
      { day: "Day 2", title: "Thematic Action Panels", items: ["Sustainable fisheries", "Marine protected areas", "Ocean–climate nexus"] },
      { day: "Day 3", title: "Commitments & Closing", items: ["Maritime security dialogue", "Youth & innovation forum", "Commitments roundup"] },
    ],
    featured: true,
    hero: true,
  },
  {
    slug: "ocean-impact-summit-2026",
    title: "Ocean Impact Summit 2026",
    shortTitle: "Ocean Impact Summit",
    category: "Conference",
    startISO: "2026-10-08",
    endISO: "2026-10-09",
    dateLabel: "8–9 October 2026",
    city: "Bali",
    country: "Indonesia",
    region: "Asia Pacific",
    location: "Bali, Indonesia",
    format: "Blended",
    organizer: "Ocean Impact Summit Organising Committee",
    partners: ["Marine & fisheries innovation partners"],
    website: "https://oceanimpactsummit.com/",
    registrationUrl: "https://oceanimpactsummit.com/register/",
    description:
      "A two-day summit connecting ocean entrepreneurs, investors, scientists, and policymakers to scale solutions for a sustainable blue economy.",
    longDescription:
      "Held in Bali, the Ocean Impact Summit gathers founders, investors, and ocean leaders to accelerate the blue economy. Expect pitch sessions, investment matchmaking, and deep-dive workshops on aquaculture technology, marine conservation finance, and coastal community livelihoods.",
    image: seaTurtle,
    themes: ["Blue Economy", "Ocean Innovation", "Impact Investment", "Aquaculture"],
    agenda: [
      { day: "Day 1", title: "Innovation & Investment", items: ["Keynotes from ocean leaders", "Startup pitch arena", "Investor matchmaking"] },
      { day: "Day 2", title: "Solutions & Scaling", items: ["Aquaculture technology track", "Coastal community panel", "Closing commitments"] },
    ],
    featured: true,
    hero: false,
  },
  {
    slug: "apconf-much-2026",
    title: "Asia Pacific Conference on Maritime & Underwater Cultural Heritage (APCONF-MUCH)",
    shortTitle: "APCONF-MUCH 2026",
    category: "Conference",
    startISO: "2026-10-26",
    endISO: "2026-10-31",
    dateLabel: "26–31 October 2026",
    city: "Bali",
    country: "Indonesia",
    region: "Asia Pacific",
    location: "Bali, Indonesia",
    format: "Offline",
    organizer: "APCONF Secretariat",
    partners: ["UNESCO", "Regional maritime heritage institutions"],
    website: "https://apconf-much.org/",
    description:
      "The leading Asia-Pacific forum on maritime archaeology and the protection of underwater cultural heritage.",
    longDescription:
      "APCONF-MUCH convenes archaeologists, heritage managers, and marine scientists across six days in Bali to advance the documentation, protection, and sustainable management of maritime and underwater cultural heritage throughout the Asia-Pacific region.",
    image: coralDiver,
    themes: ["Underwater Cultural Heritage", "Maritime Archaeology", "Ocean Governance", "Conservation"],
    agenda: [
      { day: "Days 1–2", title: "Scientific Sessions", items: ["Maritime archaeology research", "Underwater survey methods", "Heritage at risk"] },
      { day: "Days 3–4", title: "Policy & Management", items: ["Legal frameworks", "Community stewardship", "Site protection"] },
      { day: "Days 5–6", title: "Field Programme", items: ["Dive site visits", "Workshops", "Closing declaration"] },
    ],
    featured: true,
    hero: false,
  },
  {
    slug: "responsible-seafood-summit-2026",
    title: "Responsible Seafood Summit 2026",
    shortTitle: "Responsible Seafood Summit",
    category: "Conference",
    startISO: "2026-09-21",
    endISO: "2026-09-24",
    dateLabel: "21–24 September 2026",
    city: "Bangkok",
    country: "Thailand",
    region: "Asia Pacific",
    location: "Bangkok, Thailand",
    format: "Offline",
    organizer: "Global Seafood Alliance",
    partners: ["Global seafood industry & certification bodies"],
    website: "https://events.globalseafood.org/responsible-seafood-summit",
    description:
      "The world's leading event on responsible seafood, uniting industry, NGOs, and government on sustainability and social responsibility.",
    longDescription:
      "The Responsible Seafood Summit brings the global seafood value chain to Bangkok to address aquaculture and fisheries sustainability, social responsibility, traceability, and market access. Sessions cover certification, climate resilience, and the future of responsible seafood production.",
    image: fishProcessing,
    themes: ["Responsible Seafood", "Aquaculture", "Traceability", "Social Responsibility"],
    agenda: [
      { day: "Day 1", title: "Pre-Summit Workshops", items: ["Certification deep-dives", "Traceability technology", "Site tours"] },
      { day: "Days 2–3", title: "Summit Plenary", items: ["Sustainability leadership", "Social responsibility", "Market access"] },
      { day: "Day 4", title: "Future Outlook", items: ["Climate resilience", "Innovation showcase", "Closing"] },
    ],
    featured: true,
    hero: false,
  },
  {
    slug: "iifet-2026-conference",
    title: "IIFET 2026 Conference — Global Dialogue for Sustainable Fisheries and Aquaculture",
    shortTitle: "IIFET 2026 Conference",
    category: "Conference",
    startISO: "2026-08-17",
    endISO: "2026-08-21",
    dateLabel: "17–21 August 2026",
    city: "Tórshavn",
    country: "Faroe Islands",
    region: "Europe",
    location: "Tórshavn, Faroe Islands",
    format: "Offline",
    organizer: "International Institute of Fisheries Economics and Trade (IIFET)",
    partners: ["Oregon State University", "Faroese fisheries institutions"],
    website: "https://iifet.oregonstate.edu/iifet-2026-faroe-islands/iifet-2026-registration",
    registrationUrl: "https://iifet.oregonstate.edu/iifet-2026-faroe-islands/iifet-2026-registration",
    description:
      "A global dialogue on the economics and trade of sustainable fisheries and aquaculture, hosted in the Faroe Islands.",
    longDescription:
      "IIFET 2026 gathers fisheries economists, researchers, and policymakers from around the world for a week of dialogue on sustainable fisheries and aquaculture. Sessions explore trade, market dynamics, resource management, and the socio-economic dimensions of ocean food systems.",
    image: fisheriesWorkers,
    themes: ["Fisheries Economics", "Trade", "Aquaculture", "Resource Management"],
    agenda: [
      { day: "Day 1", title: "Opening & Plenary", items: ["Welcome", "Keynote on global fisheries trade", "Networking reception"] },
      { day: "Days 2–4", title: "Parallel Sessions", items: ["Economics of aquaculture", "Trade & markets", "Management & policy"] },
      { day: "Day 5", title: "Field & Closing", items: ["Faroese fisheries field visit", "Award sessions", "Closing plenary"] },
    ],
    featured: false,
    hero: false,
  },
  {
    slug: "ocean-decade-conference-2027",
    title: "2027 Ocean Decade Conference",
    shortTitle: "2027 Ocean Decade Conference",
    category: "Conference",
    startISO: "2027-04-07",
    endISO: "2027-04-09",
    dateLabel: "7–9 April 2027",
    city: "Rio de Janeiro",
    country: "Brazil",
    region: "Americas",
    location: "Rio de Janeiro, Brazil",
    format: "Blended",
    organizer: "UNESCO-IOC Ocean Decade",
    partners: ["UNESCO", "Government of Brazil"],
    website: "https://oceandecade.org/events/2027-ocean-decade-conference/",
    description:
      "A milestone gathering of the UN Decade of Ocean Science for Sustainable Development, reviewing global progress for the ocean we need.",
    longDescription:
      "The 2027 Ocean Decade Conference convenes the global ocean science community in Rio de Janeiro to assess progress at the midpoint of the UN Ocean Decade. The programme highlights science-based solutions, partnerships, and the actions needed to deliver the ocean we want.",
    image: mangrove,
    themes: ["Ocean Science", "Sustainable Development", "Climate Change", "Partnerships"],
    agenda: [
      { day: "Day 1", title: "State of the Decade", items: ["Opening plenary", "Global progress review", "Science showcase"] },
      { day: "Day 2", title: "Solutions in Action", items: ["Decade actions", "Regional dialogues", "Partnership forum"] },
      { day: "Day 3", title: "The Ocean We Want", items: ["Future priorities", "Youth voices", "Closing declaration"] },
    ],
    featured: false,
    hero: false,
  },
  {
    slug: "aquaculture-technology-conference-2027",
    title: "2nd International Conference on Aquaculture Technology & Sustainable Production",
    shortTitle: "Aquaculture Technology 2027",
    category: "Conference",
    startISO: "2027-10-18",
    endISO: "2027-10-20",
    dateLabel: "18–20 October 2027",
    city: "Amsterdam",
    country: "Netherlands",
    region: "Europe",
    location: "Amsterdam, Netherlands",
    format: "Offline",
    organizer: "Cognition Conferences",
    partners: ["Global aquaculture research network"],
    website: "https://cognitionconferences.com/aquaculture/",
    description:
      "An international conference advancing aquaculture technology, innovation, and sustainable production systems.",
    longDescription:
      "The 2nd International Conference on Aquaculture Technology & Sustainable Production brings researchers and industry to Amsterdam to share advances in aquaculture systems, feed and nutrition, disease management, and sustainable production at scale.",
    image: aquaculture,
    themes: ["Aquaculture Technology", "Sustainable Production", "Innovation", "Food Security"],
    agenda: [
      { day: "Day 1", title: "Technology & Systems", items: ["Recirculating aquaculture", "Smart farming", "Feed innovation"] },
      { day: "Day 2", title: "Sustainability", items: ["Disease management", "Environmental impact", "Certification"] },
      { day: "Day 3", title: "Future of Aquaculture", items: ["Investment panel", "Research showcase", "Closing"] },
    ],
    featured: false,
    hero: false,
  },
];

// ── Category configuration ──────────────────────────────────────────────────
export type CategoryConfig = {
  slug: string;
  label: string;
  category: EventCategory;
  icon: LucideIcon;
  blurb: string;
};

export const eventCategories: CategoryConfig[] = [
  { slug: "conferences", label: "Conferences", category: "Conference", icon: Building, blurb: "Global conferences and summits convening marine and fisheries leaders." },
  { slug: "webinars", label: "Webinars", category: "Webinar", icon: Monitor, blurb: "Live online sessions on marine science, policy, and practice." },
  { slug: "workshops", label: "Workshops", category: "Workshop", icon: Presentation, blurb: "Hands-on workshops building practical marine and fisheries skills." },
  { slug: "training", label: "Training Events", category: "Training", icon: GraduationCap, blurb: "Structured training programmes for ocean professionals." },
  { slug: "community", label: "Community Events", category: "Community", icon: UsersRound, blurb: "Networking and community gatherings across the BARUNA network." },
  { slug: "field-visits", label: "Field Visits", category: "Field Visit", icon: MapPin, blurb: "On-site study and field visits to marine and fisheries hubs." },
];

// ── Open calls & opportunities (derived from real events) ───────────────────
export type Opportunity = {
  id: string;
  type: "Participants" | "Speakers" | "Experts" | "Abstracts" | "Volunteer";
  title: string;
  organization: string;
  deadline: string;
  deadlineISO: string;
  country: string;
  eventSlug?: string;
  applyUrl?: string;
  description: string;
};

export const opportunities: Opportunity[] = [
  {
    id: "iifet-abstracts",
    type: "Abstracts",
    title: "Call for Abstracts — IIFET 2026 Conference",
    organization: "International Institute of Fisheries Economics and Trade",
    deadline: "1 March 2026",
    deadlineISO: "2026-03-01",
    country: "Faroe Islands",
    eventSlug: "iifet-2026-conference",
    applyUrl: "https://iifet.oregonstate.edu/iifet-2026-faroe-islands/iifet-2026-registration",
    description: "Submit abstracts on fisheries economics, trade, and aquaculture for IIFET 2026 in the Faroe Islands.",
  },
  {
    id: "ocean-decade-participants",
    type: "Participants",
    title: "Call for Participants — 2027 Ocean Decade Conference",
    organization: "UNESCO-IOC Ocean Decade",
    deadline: "31 October 2026",
    deadlineISO: "2026-10-31",
    country: "Brazil",
    eventSlug: "ocean-decade-conference-2027",
    applyUrl: "https://oceandecade.org/events/2027-ocean-decade-conference/",
    description: "Register interest to participate in the global Ocean Decade Conference in Rio de Janeiro.",
  },
  {
    id: "ocean-impact-speakers",
    type: "Speakers",
    title: "Call for Speakers — Ocean Impact Summit 2026",
    organization: "Ocean Impact Summit Organising Committee",
    deadline: "30 June 2026",
    deadlineISO: "2026-06-30",
    country: "Indonesia",
    eventSlug: "ocean-impact-summit-2026",
    applyUrl: "https://oceanimpactsummit.com/register/",
    description: "Propose talks on the blue economy, ocean innovation, and impact investment for the Bali summit.",
  },
  {
    id: "apconf-experts",
    type: "Experts",
    title: "Call for Experts — APCONF-MUCH 2026",
    organization: "APCONF Secretariat",
    deadline: "15 July 2026",
    deadlineISO: "2026-07-15",
    country: "Indonesia",
    eventSlug: "apconf-much-2026",
    applyUrl: "https://apconf-much.org/",
    description: "Join the expert review panel for maritime and underwater cultural heritage sessions.",
  },
  {
    id: "responsible-seafood-volunteer",
    type: "Volunteer",
    title: "Volunteer Programme — Responsible Seafood Summit 2026",
    organization: "Global Seafood Alliance",
    deadline: "1 August 2026",
    deadlineISO: "2026-08-01",
    country: "Thailand",
    eventSlug: "responsible-seafood-summit-2026",
    applyUrl: "https://events.globalseafood.org/responsible-seafood-summit",
    description: "Support the summit operations in Bangkok and connect with the global seafood community.",
  },
  {
    id: "our-ocean-participants",
    type: "Participants",
    title: "Call for Participants — Our Ocean Conference 2026",
    organization: "Government of Kenya",
    deadline: "1 June 2026",
    deadlineISO: "2026-06-01",
    country: "Kenya",
    eventSlug: "our-ocean-conference-2026",
    applyUrl: "https://www.ouroceanconference.org/conferences/mombasa-2026/",
    description: "Apply to participate in the premier global ocean conference in Mombasa.",
  },
];

export const opportunityTypes = [
  { slug: "participants", type: "Participants", label: "Call for Participants" },
  { slug: "speakers", type: "Speakers", label: "Call for Speakers" },
  { slug: "experts", type: "Experts", label: "Call for Experts" },
  { slug: "abstracts", type: "Abstracts", label: "Call for Abstracts" },
  { slug: "volunteer", type: "Volunteer", label: "Volunteer Opportunities" },
] as const;

// ── Reference "now" so the demo stays consistent ────────────────────────────
const NOW = new Date();

export function isUpcoming(e: BarunaEvent): boolean {
  return new Date(e.endISO) >= NOW;
}

export function getEvent(slug: string): BarunaEvent | undefined {
  return events.find((e) => e.slug === slug);
}

export function getUpcomingEvents(): BarunaEvent[] {
  return [...events]
    .filter(isUpcoming)
    .sort((a, b) => +new Date(a.startISO) - +new Date(b.startISO));
}

export function getPastEvents(): BarunaEvent[] {
  return [...events]
    .filter((e) => !isUpcoming(e))
    .sort((a, b) => +new Date(b.startISO) - +new Date(a.startISO));
}

export function getFeaturedEvents(): BarunaEvent[] {
  const f = events.filter((e) => e.featured);
  return f.length ? f : events;
}

export function getHeroEvent(): BarunaEvent {
  return events.find((e) => e.hero) ?? getUpcomingEvents()[0] ?? events[0];
}

export function getEventsByCategory(category: EventCategory): BarunaEvent[] {
  return events.filter((e) => e.category === category);
}

export function categoryCount(category: EventCategory): number {
  return getEventsByCategory(category).length;
}

export function daysUntil(iso: string): number {
  const ms = +new Date(iso) - +NOW;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function countdownLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return "Completed";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 31) return `In ${d} days`;
  const months = Math.round(d / 30);
  return `In ${months} month${months > 1 ? "s" : ""}`;
}

export const eventStats = {
  total: events.length,
  upcoming: getUpcomingEvents().length,
  completed: getPastEvents().length,
  countries: new Set(events.map((e) => e.country)).size,
  organizations: new Set(events.map((e) => e.organizer)).size,
  partners: new Set(events.flatMap((e) => e.partners)).size,
  activeCalls: opportunities.length,
  // Network-level reach across the BARUNA events ecosystem
  participants: "9,120+",
  globalCountries: "48+",
  globalOrganizations: "385+",
};
