import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { BarunaEvent } from "@/data/events";
import {
  Calendar,
  MapPin,
  Building2,
  Users,
  Tag,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  ArrowRight,
  Globe,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import {
  EventActions,
  EventBadge,
  Breadcrumb,
  UpcomingItem,
} from "@/components/baruna/events/eventsUi";
import { Panel } from "@/components/baruna/page/primitives";
import { getEvent, events, getUpcomingEvents } from "@/data/events";

export const Route = createFileRoute("/events/$slug")({
  loader: ({ params }) => {
    const event = getEvent(params.slug);
    if (!event) throw notFound();
    const related = events
      .filter((e) => e.slug !== event.slug && e.category === event.category)
      .slice(0, 3);
    const relatedFallback = related.length ? related : getUpcomingEvents().filter((e) => e.slug !== event.slug).slice(0, 3);
    return { event, related: relatedFallback };
  },
  head: ({ loaderData }) => {
    const e = loaderData?.event;
    if (!e) return { meta: [{ title: "Event — BARUNA" }] };
    return {
      meta: [
        { title: `${e.shortTitle} — BARUNA Events` },
        { name: "description", content: e.description },
        { property: "og:title", content: `${e.title} — BARUNA Events` },
        { property: "og:description", content: e.description },
        { property: "og:image", content: e.image },
      ],
      links: [{ rel: "canonical", href: `/events/${e.slug}` }],
    };
  },
  component: EventDetail,
  errorComponent: ({ error }: { error: any }) => (
    <EventsShell>
      <div role="alert" className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-navy">{error?.message || String(error)}</p>
      </div>
    </EventsShell>
  ),
  notFoundComponent: () => (
    <EventsShell>
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <h1 className="font-display text-2xl font-bold text-navy">Event not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This event may have been moved or removed.
        </p>
        <Link
          to="/events/all" search={{ q: "", category: "", country: "", format: "" }}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
        >
          Browse all events <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </EventsShell>
  ),
});

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-display text-xl font-bold text-navy">{children}</h2>;
}

function EventDetail() {
  const { event: e, related } = Route.useLoaderData() as {
    event: BarunaEvent;
    related: BarunaEvent[];
  };
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(e.location)}&output=embed`;

  return (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Events", to: "/events" },
            { label: "All Events", to: "/events/all" },
            { label: e.shortTitle },
          ]}
        />

        {/* Hero banner */}
        <section className="relative overflow-hidden rounded-3xl shadow-card">
          <img
            src={e.image}
            alt={e.title}
            width={1920}
            height={720}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="hero-overlay absolute inset-0" />
          <div className="relative p-7 text-navy-foreground sm:p-9 lg:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <EventBadge category={e.category} />
              <span className="rounded-md bg-navy-foreground/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide">
                {e.format}
              </span>
            </div>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-extrabold leading-[1.1] sm:text-4xl">
              {e.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-foreground/90">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> {e.dateLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {e.location}
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" /> {e.organizer}
              </span>
            </div>
            <div className="mt-6">
              <EventActions e={e} />
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="space-y-6">
            <Panel>
              <SectionTitle>About this event</SectionTitle>
              <p className="text-sm leading-relaxed text-foreground/80">{e.longDescription}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {e.themes.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full bg-marine/10 px-3 py-1 text-xs font-semibold text-marine"
                  >
                    <Tag className="h-3 w-3" /> {t}
                  </span>
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionTitle>Agenda</SectionTitle>
              <ol className="space-y-4">
                {e.agenda.map((day) => (
                  <li key={day.day} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-navy px-2.5 py-1 text-xs font-bold text-navy-foreground">
                        {day.day}
                      </span>
                      <span className="font-display text-sm font-bold text-navy">{day.title}</span>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {day.items.map((it) => (
                        <li key={it} className="flex items-center gap-2 text-sm text-foreground/75">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-marine" /> {it}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel>
              <SectionTitle>Speakers</SectionTitle>
              <p className="rounded-xl border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground">
                The full speaker line-up is announced by the organizer. Visit the{" "}
                {e.website ? (
                  <a
                    href={e.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-marine hover:underline"
                  >
                    official event website
                  </a>
                ) : (
                  "official event website"
                )}{" "}
                for the latest programme and confirmed speakers.
              </p>
            </Panel>

            <Panel>
              <SectionTitle>Downloads</SectionTitle>
              <ul className="space-y-2">
                {["Event programme (PDF)", "Registration guide (PDF)", "Sponsorship prospectus (PDF)"].map(
                  (d) => (
                    <li key={d}>
                      <a
                        href={e.website ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-medium text-navy transition-colors hover:border-marine hover:text-marine"
                      >
                        <span className="flex items-center gap-2">
                          <Download className="h-4 w-4" /> {d}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </Panel>

            <Panel>
              <SectionTitle>Gallery</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="relative aspect-video overflow-hidden rounded-xl">
                    <img
                      src={e.image}
                      alt={`${e.title} gallery ${i + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-card/80 text-marine">
                      <ImageIcon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionTitle>Location & Map</SectionTitle>
              <div className="overflow-hidden rounded-xl border border-border">
                <iframe
                  title={`Map of ${e.location}`}
                  src={mapSrc}
                  loading="lazy"
                  className="h-72 w-full"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-marine" /> {e.location}
              </p>
            </Panel>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <Panel>
              <h3 className="font-display text-base font-bold text-navy">Event details</h3>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  { icon: Calendar, label: "Dates", value: e.dateLabel },
                  { icon: MapPin, label: "Location", value: e.location },
                  { icon: Globe, label: "Format", value: e.format },
                  { icon: Building2, label: "Organizer", value: e.organizer },
                  { icon: Users, label: "Partners", value: e.partners.join(", ") },
                ].map((row) => (
                  <div key={row.label} className="flex gap-3">
                    <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd className="text-foreground/85">{row.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              <div className="mt-5">
                <EventActions e={e} variant="stack" />
              </div>
            </Panel>

            <Panel>
              <h3 className="font-display text-base font-bold text-navy">Connect</h3>
              <div className="mt-3 space-y-2">
                {[
                  { to: "/experts", icon: Users, label: "Related Experts" },
                  { to: "/knowledge-hub", icon: BookOpen, label: "Related Resources" },
                  { to: "/academy", icon: GraduationCap, label: "Related Programs" },
                ].map((row) => (
                  <Link
                    key={row.label}
                    to={row.to}
                    className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-medium text-navy transition-colors hover:border-marine hover:text-marine"
                  >
                    <span className="flex items-center gap-2">
                      <row.icon className="h-4 w-4" /> {row.label}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </Panel>

            {related.length > 0 && (
              <Panel>
                <h3 className="mb-4 font-display text-base font-bold text-navy">Related Events</h3>
                <ul className="space-y-4">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <UpcomingItem e={r} />
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </EventsShell>
  );
}
