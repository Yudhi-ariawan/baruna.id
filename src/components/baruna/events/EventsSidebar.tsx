import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Home,
  CalendarRange,
  Ticket,
  Calendar,
  History,
  LayoutGrid,
  Monitor,
  Building,
  Presentation,
  GraduationCap,
  UsersRound,
  MapPin,
  Megaphone,
  Mic,
  UserCheck,
  FileText,
  HandHeart,
  CalendarClock,
  Bookmark,
  Heart,
  Plus,
  CalendarPlus,
  type LucideIcon,
} from "lucide-react";

type Item = { label: string; to: string; icon: LucideIcon; exact?: boolean };
type Section = { label: string; items: Item[] };

const sections: Section[] = [
  {
    label: "Main Menu",
    items: [
      { label: "Events Home", to: "/events", icon: Home, exact: true },
      { label: "All Events", to: "/events/all", icon: CalendarRange },
      { label: "My Registrations", to: "/events/registrations", icon: Ticket },
      { label: "Calendar", to: "/events/calendar", icon: Calendar },
      { label: "Past Events", to: "/events/past", icon: History },
    ],
  },
  {
    label: "Explore",
    items: [
      { label: "Event Categories", to: "/events/categories", icon: LayoutGrid },
      { label: "Webinars", to: "/events/category/webinars", icon: Monitor },
      { label: "Conferences", to: "/events/category/conferences", icon: Building },
      { label: "Workshops", to: "/events/category/workshops", icon: Presentation },
      { label: "Training Events", to: "/events/category/training", icon: GraduationCap },
      { label: "Community Events", to: "/events/category/community", icon: UsersRound },
      { label: "Field Visits", to: "/events/category/field-visits", icon: MapPin },
    ],
  },
  {
    label: "Opportunities",
    items: [
      { label: "Call for Participants", to: "/events/calls/participants", icon: Megaphone },
      { label: "Call for Speakers", to: "/events/calls/speakers", icon: Mic },
      { label: "Call for Experts", to: "/events/calls/experts", icon: UserCheck },
      { label: "Call for Abstracts", to: "/events/calls/abstracts", icon: FileText },
      { label: "Volunteer Opportunities", to: "/events/calls/volunteer", icon: HandHeart },
    ],
  },
  {
    label: "My Activity",
    items: [
      { label: "My Schedule", to: "/events/schedule", icon: CalendarClock },
      { label: "Saved Events", to: "/events/saved", icon: Bookmark },
      { label: "Following", to: "/events/following", icon: Heart },
    ],
  },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      {sections.map((section, si) => (
        <div key={section.label} className={si > 0 ? "mt-4" : ""}>
          <p className="px-3 pb-2 pt-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.exact
                ? pathname === item.to
                : pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                      active
                        ? "bg-marine/10 text-marine"
                        : "text-foreground/75 hover:bg-muted hover:text-marine"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

export function EventsSidebarHeader() {
  return (
    <div className="rounded-2xl bg-navy p-5 text-navy-foreground shadow-card">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-foreground/10">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold leading-tight">Events</h2>
          <p className="mt-1 text-xs leading-relaxed text-navy-foreground/80">
            Discover and join events, webinars, workshops, and conferences related to marine and
            fisheries.
          </p>
        </div>
      </div>
    </div>
  );
}

export function EventsSidebar() {
  return (
    <aside className="hidden w-full shrink-0 lg:block lg:w-[260px]">
      <div className="sticky top-24 space-y-5">
        <EventsSidebarHeader />
        <nav className="rounded-2xl border border-border bg-card p-3 shadow-soft">
          <NavList />
          <Link
            to="/events/submit"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground shadow-soft transition-colors hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            Submit Event
          </Link>
          <Link
            to="/events/host"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
          >
            <CalendarPlus className="h-4 w-4" />
            Host an Event
          </Link>
        </nav>
      </div>
    </aside>
  );
}

export function EventsMobileNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="p-1">
      <NavList onNavigate={onNavigate} />
      <Link
        to="/events/submit"
        onClick={onNavigate}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground"
      >
        <Plus className="h-4 w-4" />
        Submit Event
      </Link>
      <Link
        to="/events/host"
        onClick={onNavigate}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine"
      >
        <CalendarPlus className="h-4 w-4" />
        Host an Event
      </Link>
    </nav>
  );
}
