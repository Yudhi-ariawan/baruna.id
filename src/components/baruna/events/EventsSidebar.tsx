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
import { useLanguage } from "@/lib/i18n";

type Item = { labelKey: string; en: string; id: string; to: string; icon: LucideIcon; exact?: boolean };
type Section = { labelEn: string; labelId: string; items: Item[] };

const sections: Section[] = [
  {
    labelEn: "Main Menu",
    labelId: "Menu Utama",
    items: [
      { labelKey: "home", en: "Events Home", id: "Beranda Acara", to: "/events", icon: Home, exact: true },
      { labelKey: "all", en: "All Events", id: "Semua Acara", to: "/events/all", icon: CalendarRange },
      { labelKey: "registrations", en: "My Registrations", id: "Pendaftaran Saya", to: "/events/registrations", icon: Ticket },
      { labelKey: "calendar", en: "Calendar", id: "Kalender", to: "/events/calendar", icon: Calendar },
      { labelKey: "past", en: "Past Events", id: "Acara Lalu", to: "/events/past", icon: History },
    ],
  },
  {
    labelEn: "Explore",
    labelId: "Jelajahi",
    items: [
      { labelKey: "categories", en: "Event Categories", id: "Kategori Acara", to: "/events/categories", icon: LayoutGrid },
      { labelKey: "webinars", en: "Webinars", id: "Webinar", to: "/events/category/webinars", icon: Monitor },
      { labelKey: "conferences", en: "Conferences", id: "Konferensi", to: "/events/category/conferences", icon: Building },
      { labelKey: "workshops", en: "Workshops", id: "Lokakarya", to: "/events/category/workshops", icon: Presentation },
      { labelKey: "training", en: "Training Events", id: "Pelatihan", to: "/events/category/training", icon: GraduationCap },
      { labelKey: "community", en: "Community Events", id: "Acara Komunitas", to: "/events/category/community", icon: UsersRound },
      { labelKey: "fieldVisits", en: "Field Visits", id: "Kunjungan Lapangan", to: "/events/category/field-visits", icon: MapPin },
    ],
  },
  {
    labelEn: "Opportunities",
    labelId: "Peluang & Partisipasi",
    items: [
      { labelKey: "participants", en: "Call for Participants", id: "Panggilan Peserta", to: "/events/calls/participants", icon: Megaphone },
      { labelKey: "speakers", en: "Call for Speakers", id: "Panggilan Pembicara", to: "/events/calls/speakers", icon: Mic },
      { labelKey: "experts", en: "Call for Experts", id: "Panggilan Pakar", to: "/events/calls/experts", icon: UserCheck },
      { labelKey: "abstracts", en: "Call for Abstracts", id: "Panggilan Abstrak", to: "/events/calls/abstracts", icon: FileText },
      { labelKey: "volunteer", en: "Volunteer Opportunities", id: "Peluang Relawan", to: "/events/calls/volunteer", icon: HandHeart },
    ],
  },
  {
    labelEn: "My Activity",
    labelId: "Aktivitas Saya",
    items: [
      { labelKey: "schedule", en: "My Schedule", id: "Jadwal Saya", to: "/events/schedule", icon: CalendarClock },
      { labelKey: "saved", en: "Saved Events", id: "Acara Tersimpan", to: "/events/saved", icon: Bookmark },
      { labelKey: "following", en: "Following", id: "Mengikuti", to: "/events/following", icon: Heart },
    ],
  },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { language } = useLanguage();
  const isId = language === "id";

  return (
    <>
      {sections.map((section, si) => (
        <div key={section.labelEn} className={si > 0 ? "mt-4" : ""}>
          <p className="px-3 pb-2 pt-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
            {isId ? section.labelId : section.labelEn}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.exact
                ? pathname === item.to
                : pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <li key={item.labelKey}>
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
                    <span className="flex-1 truncate">{isId ? item.id : item.en}</span>
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
  const { language } = useLanguage();
  const isId = language === "id";

  return (
    <div className="rounded-2xl bg-navy p-5 text-navy-foreground shadow-card">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-foreground/10">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold leading-tight">
            {isId ? "Acara" : "Events"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-navy-foreground/80">
            {isId
              ? "Temukan dan ikuti acara, webinar, lokakarya, dan konferensi maritim & perikanan."
              : "Discover and join events, webinars, workshops, and conferences related to marine and fisheries."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function EventsSidebar() {
  const { language } = useLanguage();
  const isId = language === "id";

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
            {isId ? "Ajukan Acara" : "Submit Event"}
          </Link>
          <Link
            to="/events/host"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
          >
            <CalendarPlus className="h-4 w-4" />
            {isId ? "Adakan Acara" : "Host an Event"}
          </Link>
        </nav>
      </div>
    </aside>
  );
}

export function EventsMobileNav({ onNavigate }: { onNavigate?: () => void }) {
  const { language } = useLanguage();
  const isId = language === "id";

  return (
    <nav className="p-1">
      <NavList onNavigate={onNavigate} />
      <Link
        to="/events/submit"
        onClick={onNavigate}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground"
      >
        <Plus className="h-4 w-4" />
        {isId ? "Ajukan Acara" : "Submit Event"}
      </Link>
      <Link
        to="/events/host"
        onClick={onNavigate}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine"
      >
        <CalendarPlus className="h-4 w-4" />
        {isId ? "Adakan Acara" : "Host an Event"}
      </Link>
    </nav>
  );
}
