import { createFileRoute } from "@tanstack/react-router";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { PageHeader, Breadcrumb } from "@/components/baruna/events/eventsUi";
import { StoredEvents } from "@/components/baruna/events/StoredEvents";

export const Route = createFileRoute("/events/saved")({
  head: () => ({
    meta: [
      { title: "Saved Events — BARUNA Events" },
      { name: "description", content: "Your saved marine and fisheries events on BARUNA." },
    ],
  }),
  component: () => (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Events", to: "/events" }, { label: "Saved Events" }]} />
        <PageHeader title="Saved Events" subtitle="Events you've bookmarked to revisit later." />
        <StoredEvents
          kind="saved"
          emptyTitle="No saved events yet"
          emptyMessage="Tap the bookmark icon on any event to save it here."
        />
      </div>
    </EventsShell>
  ),
});
