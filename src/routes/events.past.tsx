import { createFileRoute } from "@tanstack/react-router";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { PageHeader, Breadcrumb, EventGrid } from "@/components/baruna/events/eventsUi";
import { getPastEvents } from "@/data/events";

export const Route = createFileRoute("/events/past")({
  head: () => ({
    meta: [
      { title: "Past Events — BARUNA Events" },
      { name: "description", content: "Browse the archive of past marine and fisheries events." },
    ],
    links: [{ rel: "canonical", href: "/events/past" }],
  }),
  component: PastPage,
});

function PastPage() {
  const items = getPastEvents();
  return (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Events", to: "/events" }, { label: "Past Events" }]} />
        <PageHeader
          title="Past Events"
          subtitle="Explore the archive of completed marine and fisheries events, proceedings, and recordings."
        />
        <EventGrid
          items={items}
          emptyMessage="No past events in the archive yet — all listed events are still upcoming."
        />
      </div>
    </EventsShell>
  );
}
