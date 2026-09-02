import { createFileRoute } from "@tanstack/react-router";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { PageHeader, Breadcrumb } from "@/components/baruna/events/eventsUi";
import { StoredEvents } from "@/components/baruna/events/StoredEvents";

export const Route = createFileRoute("/events/registrations")({
  head: () => ({
    meta: [
      { title: "My Registrations — BARUNA Events" },
      { name: "description", content: "Events you've registered for on BARUNA." },
    ],
  }),
  component: () => (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Events", to: "/events" }, { label: "My Registrations" }]} />
        <PageHeader
          title="My Registrations"
          subtitle="Events you've registered for across the BARUNA network."
        />
        <StoredEvents
          kind="registered"
          emptyTitle="No registrations yet"
          emptyMessage="When you register for an event, it will appear here for quick access."
        />
      </div>
    </EventsShell>
  ),
});
