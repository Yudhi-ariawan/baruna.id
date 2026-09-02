import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Clock,
  BarChart3,
  MapPin,
  Globe,
  Users2,
  ArrowRight,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import {
  AcademyHeader,
  TabBar,
  StatusBadge,
  MetaItem,
  DateChip,
  PrimaryButton,
  OutlineButton,
  FilterPanel,
  FilterSearch,
  FilterGroup,
  CheckRow,
  ApplyButton,
  ShowMore,
  AsidePanel,
  type Tab,
} from "@/components/baruna/academy/ui";
import { academyImages } from "@/data/academy";

export const Route = createFileRoute("/academy/workshop")({
  head: () => ({
    meta: [
      { title: "Workshop — Academy — BARUNA" },
      {
        name: "description",
        content:
          "Hands-on and practical workshops to build technical skills, encourage collaboration, and solve real-world marine and fisheries challenges.",
      },
      { property: "og:title", content: "Workshop — Academy — BARUNA" },
      { property: "og:description", content: "Practical marine and fisheries workshops." },
      { property: "og:image", content: academyImages.coralDiver },
      { property: "og:url", content: "/academy/workshop" },
    ],
    links: [{ rel: "canonical", href: "/academy/workshop" }],
  }),
  component: WorkshopPage,
});

const tabs: Tab[] = [
  { label: "All Workshops", count: "64 Workshops", active: true },
  { label: "Upcoming", count: "18 Workshops" },
  { label: "Open for Registration", count: "23 Workshops" },
  { label: "On Demand", count: "16 Workshops" },
  { label: "Completed", count: "7 Workshops" },
];

type WorkshopItem = {
  badge: string;
  image: string;
  title: string;
  desc: string;
  dateRange: string;
  duration: string;
  level: string;
  location: string;
  language: string;
  category: string;
  date?: { top: string; big: string; year: string; tone: "marine" | "green" | "amber" };
  onDemand?: boolean;
  cta: "register" | "access";
  count: string;
};

const items: WorkshopItem[] = [
  {
    badge: "UPCOMING", image: academyImages.coralDiver,
    title: "Coral Reef Monitoring Techniques",
    desc: "Learn practical methods for monitoring coral reef health and biodiversity.",
    dateRange: "24 – 26 Jun 2026", duration: "3 Days", level: "Intermediate", location: "Bali, Indonesia", language: "English",
    category: "Marine Conservation", date: { top: "JUN", big: "24 – 26", year: "2026", tone: "marine" },
    cta: "register", count: "25 Seats Left",
  },
  {
    badge: "OPEN FOR REGISTRATION", image: academyImages.fisheriesWorkers,
    title: "Sustainable Fisheries Management Practices",
    desc: "Interactive workshop on responsible fishing and ecosystem-based management.",
    dateRange: "14 – 15 Jul 2026", duration: "2 Days", level: "Beginner", location: "Jakarta, Indonesia", language: "Bahasa Indonesia",
    category: "Fisheries Management", date: { top: "JUL", big: "14 – 15", year: "2026", tone: "green" },
    cta: "register", count: "30 Seats Left",
  },
  {
    badge: "ON DEMAND", image: academyImages.fishProcessing,
    title: "Fish Processing and Value Addition",
    desc: "Improve product quality, safety, and market value through modern processing techniques.",
    dateRange: "Self-paced", duration: "6 Hours", level: "Intermediate", location: "Online", language: "English",
    category: "Fish Processing", onDemand: true, cta: "access", count: "186 Enrolled",
  },
  {
    badge: "UPCOMING", image: academyImages.mangrove,
    title: "Mangrove Rehabilitation and Restoration",
    desc: "Hands-on workshop on restoring mangrove ecosystems and community-based conservation.",
    dateRange: "29 – 31 Jul 2026", duration: "3 Days", level: "Advanced", location: "Lombok, Indonesia", language: "English",
    category: "Coastal & Habitat Management", date: { top: "JUL", big: "29 – 31", year: "2026", tone: "marine" },
    cta: "register", count: "28 Seats Left",
  },
  {
    badge: "UPCOMING", image: academyImages.marineSpatial,
    title: "Introduction to Marine Spatial Planning",
    desc: "Understand the tools and approaches for marine spatial planning and ocean governance.",
    dateRange: "11 – 12 Aug 2026", duration: "2 Days", level: "Intermediate", location: "Online (Live)", language: "English",
    category: "Ocean Governance", date: { top: "AUG", big: "11 – 12", year: "2026", tone: "green" },
    cta: "register", count: "40 Seats Left",
  },
];

const upcomingSidebar = [
  { month: "JUN", day: "24", title: "Coral Reef Monitoring Techniques", meta: "24 – 26 Jun 2026 | Bali, Indonesia", duration: "3 Days" },
  { month: "JUL", day: "14", title: "Sustainable Fisheries Management Practices", meta: "14 – 15 Jul 2026 | Jakarta, Indonesia", duration: "2 Days" },
  { month: "JUL", day: "29", title: "Mangrove Rehabilitation and Restoration", meta: "29 – 31 Jul 2026 | Lombok, Indonesia", duration: "3 Days" },
];

function WorkshopCard({ w }: { w: WorkshopItem }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-xl lg:h-32 lg:w-52">
          <img src={w.image} alt={w.title} loading="lazy" width={768} height={512} className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2">
            <StatusBadge label={w.badge} />
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="font-display text-lg font-bold text-navy">{w.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{w.desc}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <MetaItem icon={CalendarDays}>{w.dateRange}</MetaItem>
            <MetaItem icon={Clock}>{w.duration}</MetaItem>
            <MetaItem icon={BarChart3}>{w.level}</MetaItem>
            <MetaItem icon={MapPin}>{w.location}</MetaItem>
            <MetaItem icon={Globe}>{w.language}</MetaItem>
          </div>
          <span className="mt-3 inline-flex w-fit rounded-full bg-marine/10 px-3 py-1 text-[0.7rem] font-semibold text-marine">
            {w.category}
          </span>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-3 lg:w-[150px] lg:flex-col lg:items-stretch">
          {w.onDemand ? (
            <div className="grid w-[68px] shrink-0 place-items-center rounded-xl bg-navy/8 px-2 py-3 text-center leading-tight text-navy">
              <span className="text-[0.6rem] font-bold uppercase">On</span>
              <span className="text-[0.7rem] font-extrabold uppercase">Demand</span>
            </div>
          ) : (
            w.date && <DateChip top={w.date.top} big={w.date.big} year={w.date.year} tone={w.date.tone} />
          )}
          <div className="flex flex-1 flex-col gap-2 lg:flex-none">
            {w.cta === "register" ? (
              <PrimaryButton className="w-full">Register</PrimaryButton>
            ) : (
              <PrimaryButton className="w-full">Access Now</PrimaryButton>
            )}
            <OutlineButton className="w-full">View Details</OutlineButton>
            <span className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground lg:justify-start">
              <Users2 className="h-3.5 w-3.5" /> {w.count}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function WorkshopPage() {
  return (
    <AcademyShell
      active="workshop"
      aside={
        <>
          <FilterPanel title="Filter Workshops">
            <FilterSearch placeholder="Search workshops..." />
            <FilterGroup label="Category">
              <CheckRow label="Fisheries Management" count={16} />
              <CheckRow label="Aquaculture" count={11} />
              <CheckRow label="Marine Conservation" count={15} />
              <CheckRow label="Blue Economy" count={9} />
              <CheckRow label="Ocean Governance" count={8} />
              <ShowMore />
            </FilterGroup>
            <FilterGroup label="Level">
              <CheckRow label="Beginner" count={20} />
              <CheckRow label="Intermediate" count={28} />
              <CheckRow label="Advanced" count={16} />
            </FilterGroup>
            <FilterGroup label="Format">
              <CheckRow label="In-person" count={36} />
              <CheckRow label="Online" count={18} />
              <CheckRow label="Blended" count={10} />
            </FilterGroup>
            <ApplyButton />
          </FilterPanel>

          <AsidePanel title="Upcoming Workshops" action="View all">
            <ul className="space-y-4">
              {upcomingSidebar.map((u) => (
                <li key={u.title} className="flex gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-secondary text-center leading-none">
                    <span className="text-[0.55rem] font-bold uppercase text-marine">{u.month}</span>
                    <span className="text-sm font-extrabold text-navy">{u.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="line-clamp-2 text-xs font-semibold leading-snug text-navy">{u.title}</h4>
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{u.meta}</p>
                    <p className="text-[0.7rem] text-muted-foreground">{u.duration}</p>
                  </div>
                  <button className="h-fit shrink-0 rounded-md bg-marine/10 px-2 py-1 text-[0.65rem] font-semibold text-marine">Register</button>
                </li>
              ))}
            </ul>
            <button className="mt-4 flex w-full items-center gap-1.5 text-sm font-semibold text-marine hover:text-navy">
              <CalendarDays className="h-4 w-4" /> Go to Event Calendar <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </AsidePanel>
        </>
      }
    >
      <div className="space-y-6">
        <AcademyHeader
          crumb="Workshop"
          title="Workshop"
          description="Hands-on and practical workshops to build technical skills, encourage collaboration, and solve real-world challenges."
          searchPlaceholder="Search workshop topics, skills, or keywords..."
        />
        <TabBar tabs={tabs} />
        <p className="text-sm text-muted-foreground">Showing 1–10 of 64 workshops</p>
        <div className="space-y-4">
          {items.map((w) => (
            <WorkshopCard key={w.title} w={w} />
          ))}
        </div>
      </div>
    </AcademyShell>
  );
}
