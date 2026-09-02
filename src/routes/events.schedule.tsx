import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Building2 } from "lucide-react";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { PageHeader, Breadcrumb, EventBadge } from "@/components/baruna/events/eventsUi";
import { getUpcomingEvents, countdownLabel } from "@/data/events";

export const Route = createFileRoute("/events/schedule")({
  head: () => ({
    meta: [
      { title: "My Schedule — BARUNA Events" },
      { name: "description", content: "Your upcoming marine and fisheries events timeline." },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const items = getUpcomingEvents();
  return (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Events", to: "/events" }, { label: "My Schedule" }]} />
        <PageHeader
          title="My Schedule"
          subtitle="Your upcoming marine and fisheries events, in chronological order."
        />
        <ol className="relative space-y-4 border-l-2 border-border pl-6">
          {items.map((e) => (
            <li key={e.slug} className="relative">
              <span className="absolute -left-[1.95rem] top-2 h-3.5 w-3.5 rounded-full border-2 border-marine bg-card" />
              <Link
                to="/events/$slug"
                params={{ slug: e.slug }}
                className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <EventBadge category={e.category} />
                    <span className="text-xs font-semibold text-marine">
                      {countdownLabel(e.startISO)}
                    </span>
                  </div>
                  <h3 className="mt-1 font-display text-sm font-bold text-navy group-hover:text-marine">
                    {e.title}
                  </h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{e.dateLabel}</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {e.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> {e.organizer}
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </EventsShell>
  );
}
