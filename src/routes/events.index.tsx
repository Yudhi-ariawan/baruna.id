import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Search,
  SlidersHorizontal,
  Calendar,
  MapPin,
  Building2,
  Users,
  Globe,
  ArrowRight,
  FileText,
  Megaphone,
} from "lucide-react";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import {
  EventCard,
  EventActions,
  UpcomingItem,
  EventBadge,
} from "@/components/baruna/events/eventsUi";
import { Panel, SectionHeader } from "@/components/baruna/page/primitives";
import {
  getHeroEvent,
  getFeaturedEvents,
  getUpcomingEvents,
  eventCategories,
  categoryCount,
  eventStats,
} from "@/data/events";
import bannerUnderwater from "@/assets/banner-underwater.jpg";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Events — BARUNA Marine & Fisheries Events Portal" },
      {
        name: "description",
        content:
          "Discover, join, and organize marine and fisheries events worldwide — conferences, webinars, workshops, training, and community gatherings on BARUNA.",
      },
      { property: "og:title", content: "BARUNA Events — Marine & Fisheries Events Portal" },
      {
        property: "og:description",
        content:
          "Explore global marine and fisheries events, webinars, workshops, and conferences. Learn, connect, and act for a sustainable ocean.",
      },
      { property: "og:image", content: bannerUnderwater },
    ],
    links: [{ rel: "canonical", href: "/events" }],
  }),
  component: EventsHome,
});

function EventsHome() {
  const hero = getHeroEvent();
  const featured = getFeaturedEvents();
  const upcoming = getUpcomingEvents().slice(0, 4);

  return (
    <EventsShell>
      <div className="space-y-6">
        {/* Title + search */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">Events</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Explore events, webinars, workshops, conferences, and networking opportunities related
              to marine and fisheries.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <form
              action="/events/all"
              method="get"
              className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-soft"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                name="q"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search events, topics, or speakers..."
              />
            </form>
            <Link
              to="/events/all" search={{ q: "", category: "", country: "", format: "" }}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-navy shadow-soft transition-colors hover:border-marine hover:text-marine"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filter
            </Link>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {/* Dynamic featured hero */}
            <section className="relative overflow-hidden rounded-3xl shadow-card">
              <img
                src={bannerUnderwater}
                alt={hero.title}
                width={1920}
                height={640}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="hero-overlay absolute inset-0" />
              <div className="relative p-7 text-navy-foreground sm:p-9 lg:p-10">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <EventBadge category={hero.category} />
                    <span className="rounded-md bg-navy-foreground/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide">
                      Featured
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-3xl font-extrabold leading-[1.1] sm:text-4xl">
                    {hero.title}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-navy-foreground/90">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" /> {hero.dateLabel}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" /> {hero.location}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" /> {hero.organizer}
                    </span>
                  </div>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-navy-foreground/85">
                    {hero.description}
                  </p>
                  <div className="mt-5">
                    <EventActions e={hero} />
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap gap-x-7 gap-y-4 border-t border-navy-foreground/20 pt-6">
                  {[
                    { value: String(eventStats.upcoming), label: "Upcoming Events", icon: Calendar },
                    { value: eventStats.participants, label: "Participants", icon: Users },
                    { value: eventStats.globalOrganizations, label: "Organizations", icon: Building2 },
                    { value: eventStats.globalCountries, label: "Countries", icon: Globe },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2.5">
                      <s.icon className="h-5 w-5 text-navy-foreground/80" strokeWidth={1.8} />
                      <div className="leading-tight">
                        <p className="font-display text-xl font-extrabold">{s.value}</p>
                        <p className="text-[0.7rem] text-navy-foreground/75">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Featured events */}
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-navy sm:text-xl">
                  Featured Events
                </h2>
                <Link
                  to="/events/all" search={{ q: "", category: "", country: "", format: "" }}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marine transition-colors hover:text-navy"
                >
                  View all events <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                {featured.map((e) => (
                  <EventCard key={e.slug} e={e} />
                ))}
              </div>
            </section>

            {/* Browse by category */}
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-navy sm:text-xl">
                  Browse by Category
                </h2>
                <Link
                  to="/events/categories"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marine transition-colors hover:text-navy"
                >
                  View all categories <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {eventCategories.map(({ slug, label, icon: Icon, category }) => (
                  <Link
                    key={slug}
                    to="/events/category/$slug"
                    params={{ slug }}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition-all hover:-translate-y-0.5 hover:border-marine/40 hover:shadow-hover"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-marine/10 text-marine">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-navy">{label}</span>
                    <span className="text-[0.7rem] text-muted-foreground">
                      {categoryCount(category)} Events
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            <Panel>
              <SectionHeader title="Upcoming Events" action={null} />
              <ul className="space-y-4">
                {upcoming.map((e) => (
                  <li key={e.slug}>
                    <UpcomingItem e={e} />
                  </li>
                ))}
              </ul>
              <Link
                to="/events/calendar"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-marine"
              >
                Open calendar <ArrowRight className="h-4 w-4" />
              </Link>
            </Panel>

            <Panel>
              <SectionHeader title="Event Categories" action={null} />
              <ul className="space-y-1">
                {eventCategories.map(({ slug, label, category }) => (
                  <li key={slug}>
                    <Link
                      to="/events/category/$slug"
                      params={{ slug }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-marine"
                    >
                      <span>{label}</span>
                      <span className="font-semibold text-muted-foreground">
                        {categoryCount(category)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>

            <div className="rounded-2xl border border-marine/30 bg-marine/5 p-5 shadow-soft">
              <Megaphone className="h-6 w-6 text-marine" />
              <h3 className="mt-3 font-display text-base font-bold text-navy">
                Open Calls & Opportunities
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {eventStats.activeCalls} active calls for participants, speakers, experts, and more.
              </p>
              <Link
                to="/events/calls/$slug" params={{ slug: "participants" }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
              >
                Explore Opportunities <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <FileText className="h-6 w-6 text-marine" />
              <h3 className="mt-3 font-display text-base font-bold text-navy">
                Have an event to share?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Submit your event and reach a global marine and fisheries audience.
              </p>
              <Link
                to="/events/submit"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground shadow-soft transition-colors hover:bg-accent/90"
              >
                Submit Event <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </EventsShell>
  );
}
