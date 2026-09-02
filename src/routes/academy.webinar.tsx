import { createFileRoute } from "@tanstack/react-router";
import {
  User,
  MapPin,
  Globe,
  CalendarPlus,
  Share2,
  Radio,
  Play,
  Users2,
  Eye,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import {
  AcademyHeader,
  TabBar,
  StatusBadge,
  MetaItem,
  PrimaryButton,
  OutlineButton,
  DangerButton,
  FilterPanel,
  FilterSearch,
  FilterGroup,
  CheckRow,
  FilterSelect,
  ApplyButton,
  ShowMore,
  AsidePanel,
  type Tab,
} from "@/components/baruna/academy/ui";
import { academyImages } from "@/data/academy";

export const Route = createFileRoute("/academy/webinar")({
  head: () => ({
    meta: [
      { title: "Webinar — Academy — BARUNA" },
      {
        name: "description",
        content:
          "Live, interactive webinar sessions with experts. Learn, ask questions, and exchange ideas with a global marine and fisheries community.",
      },
      { property: "og:title", content: "Webinar — Academy — BARUNA" },
      { property: "og:description", content: "Live and on-demand marine and fisheries webinars." },
      { property: "og:image", content: academyImages.seaTurtle },
      { property: "og:url", content: "/academy/webinar" },
    ],
    links: [{ rel: "canonical", href: "/academy/webinar" }],
  }),
  component: WebinarPage,
});

const tabs: Tab[] = [
  { label: "All Webinars", count: "98 Webinars", active: true },
  { label: "Upcoming", count: "28 Webinars" },
  { label: "Live Now", count: "3 Webinars", live: true },
  { label: "On Demand", count: "67 Webinars" },
  { label: "Series", count: "12 Series" },
];

type WebinarItem = {
  badge: string;
  image: string;
  date?: { month: string; day: string; year: string; time: string };
  onDemand?: boolean;
  title: string;
  desc: string;
  speaker: string;
  institution: string;
  language: string;
  category: string;
  type: "register" | "live" | "ondemand";
  count: string;
  countIcon: typeof Users2;
};

const items: WebinarItem[] = [
  {
    badge: "UPCOMING", image: academyImages.seaTurtle,
    date: { month: "JUN", day: "05", year: "2026", time: "10:00 AM WIB" },
    title: "Blue Economy and Sustainable Ocean Development",
    desc: "Explore opportunities and strategies for a sustainable blue economy in Indonesia and beyond.",
    speaker: "Dr. Rashid Sumaila", institution: "Dalhousie University, Canada", language: "English",
    category: "Blue Economy", type: "register", count: "256 Registered", countIcon: Users2,
  },
  {
    badge: "LIVE NOW", image: academyImages.aquaculture,
    date: { month: "MAY", day: "29", year: "2026", time: "02:00 PM WIB" },
    title: "Innovative Approaches in Aquaculture",
    desc: "Discover innovations improving productivity and sustainability in aquaculture.",
    speaker: "Dr. Mohammad Yusoff", institution: "WorldFish", language: "English",
    category: "Aquaculture", type: "live", count: "412 Attending", countIcon: Users2,
  },
  {
    badge: "UPCOMING", image: academyImages.mangrove,
    date: { month: "JUN", day: "12", year: "2026", time: "11:00 AM WIB" },
    title: "Mangrove Ecosystem Restoration and Community Engagement",
    desc: "Learn how communities and science work together to restore and protect mangroves.",
    speaker: "Dr. Alongi Daniel", institution: "University of Queensland, Australia", language: "English",
    category: "Marine Conservation", type: "register", count: "183 Registered", countIcon: Users2,
  },
  {
    badge: "ON DEMAND", image: academyImages.fishingSunset, onDemand: true,
    title: "Fisheries Management in a Changing Climate",
    desc: "Understand climate impacts and adaptive management strategies for sustainable fisheries.",
    speaker: "Dr. Ratana Chuenpagdee", institution: "Memorial University, Canada", language: "English",
    category: "Fisheries Management", type: "ondemand", count: "1.2K Views", countIcon: Eye,
  },
  {
    badge: "UPCOMING", image: academyImages.plasticPollution,
    date: { month: "JUN", day: "19", year: "2026", time: "09:00 AM WIB" },
    title: "Marine Plastic Pollution: Mitigation and Solutions",
    desc: "Share knowledge and solutions to reduce marine plastic pollution.",
    speaker: "Dr. Jenna R. Jambeck", institution: "University of Georgia, USA", language: "English",
    category: "Ocean Health", type: "register", count: "141 Registered", countIcon: Users2,
  },
];

const upcomingSidebar = [
  { month: "JUN", day: "05", title: "Blue Economy and Sustainable Ocean Development", time: "10:00 AM WIB", speaker: "Dr. Rashid Sumaila" },
  { month: "JUN", day: "12", title: "Mangrove Ecosystem Restoration and Community Engagement", time: "11:00 AM WIB", speaker: "Dr. Alongi Daniel" },
  { month: "JUN", day: "19", title: "Marine Plastic Pollution: Mitigation and Solutions", time: "09:00 AM WIB", speaker: "Dr. Jenna R. Jambeck" },
];

function WebinarCard({ w }: { w: WebinarItem }) {
  const CountIcon = w.countIcon;
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-xl lg:h-32 lg:w-56">
          <img src={w.image} alt={w.title} loading="lazy" width={768} height={512} className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2">
            <StatusBadge label={w.badge} />
          </span>
          {w.onDemand ? (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-card/90 text-marine shadow-card">
                <Play className="h-5 w-5 translate-x-0.5 fill-marine" />
              </span>
            </span>
          ) : (
            w.date && (
              <div className="absolute bottom-0 right-0 top-0 grid w-20 place-items-center bg-navy/85 text-center text-navy-foreground backdrop-blur-sm">
                <div className="leading-tight">
                  <p className="text-[0.6rem] font-bold uppercase">{w.date.month}</p>
                  <p className="font-display text-xl font-extrabold">{w.date.day}</p>
                  <p className="text-[0.55rem] text-navy-foreground/80">{w.date.year}</p>
                  <p className="mt-1 text-[0.5rem] font-semibold text-navy-foreground/90">{w.date.time}</p>
                </div>
              </div>
            )
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="font-display text-lg font-bold text-navy">{w.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{w.desc}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <MetaItem icon={User}>{w.speaker}</MetaItem>
            <MetaItem icon={MapPin}>{w.institution}</MetaItem>
            <MetaItem icon={Globe}>{w.language}</MetaItem>
          </div>
          <span className="mt-3 inline-flex w-fit rounded-full bg-marine/10 px-3 py-1 text-[0.7rem] font-semibold text-marine">
            {w.category}
          </span>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:w-[150px]">
          {w.type === "register" && (
            <>
              <OutlineButton className="w-full"><CalendarPlus className="h-4 w-4" /> Register</OutlineButton>
              <OutlineButton className="w-full"><Share2 className="h-4 w-4" /> Share</OutlineButton>
            </>
          )}
          {w.type === "live" && (
            <>
              <DangerButton className="w-full"><Radio className="h-4 w-4" /> Join Live</DangerButton>
              <OutlineButton className="w-full">Details</OutlineButton>
            </>
          )}
          {w.type === "ondemand" && (
            <>
              <PrimaryButton className="w-full"><Play className="h-4 w-4" /> Watch Now</PrimaryButton>
              <OutlineButton className="w-full">Details</OutlineButton>
            </>
          )}
          <span className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground lg:justify-start">
            <CountIcon className="h-3.5 w-3.5" /> {w.count}
          </span>
        </div>
      </div>
    </article>
  );
}

function WebinarPage() {
  return (
    <AcademyShell
      active="webinar"
      aside={
        <>
          <FilterPanel title="Filter Webinars">
            <FilterSearch placeholder="Search webinars..." />
            <FilterGroup label="Category">
              <CheckRow label="Fisheries Management" count={20} />
              <CheckRow label="Aquaculture" count={14} />
              <CheckRow label="Marine Conservation" count={16} />
              <CheckRow label="Blue Economy" count={13} />
              <CheckRow label="Ocean Governance" count={10} />
              <ShowMore />
            </FilterGroup>
            <FilterGroup label="Date">
              <FilterSelect placeholder="Select date" />
            </FilterGroup>
            <FilterGroup label="Language">
              <FilterSelect placeholder="All Languages" />
            </FilterGroup>
            <FilterGroup label="Format">
              <CheckRow label="Live" count={31} />
              <CheckRow label="On Demand" count={67} />
            </FilterGroup>
            <ApplyButton />
          </FilterPanel>

          <AsidePanel title="Upcoming Webinars" action="View all">
            <ul className="space-y-4">
              {upcomingSidebar.map((u) => (
                <li key={u.title} className="flex gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-secondary text-center leading-none">
                    <span className="text-[0.55rem] font-bold uppercase text-marine">{u.month}</span>
                    <span className="text-sm font-extrabold text-navy">{u.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="line-clamp-2 text-xs font-semibold leading-snug text-navy">{u.title}</h4>
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{u.time}</p>
                    <p className="text-[0.7rem] text-muted-foreground">{u.speaker}</p>
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
          crumb="Webinar"
          title="Webinar"
          description="Live, interactive sessions with experts. Learn, ask questions, and exchange ideas with a global community."
          searchPlaceholder="Search webinar topics, speakers, or keywords..."
        />
        <TabBar tabs={tabs} />
        <p className="text-sm text-muted-foreground">Showing 1–10 of 98 webinars</p>
        <div className="space-y-4">
          {items.map((w) => (
            <WebinarCard key={w.title} w={w} />
          ))}
        </div>
      </div>
    </AcademyShell>
  );
}
