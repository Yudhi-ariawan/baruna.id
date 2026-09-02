import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { events } from "@/data/events";
import { useSavedEvents, useRegisteredEvents } from "@/lib/eventActions";
import { EventGrid } from "./eventsUi";

export function StoredEvents({
  kind,
  emptyTitle,
  emptyMessage,
}: {
  kind: "saved" | "registered";
  emptyTitle: string;
  emptyMessage: string;
}) {
  const saved = useSavedEvents();
  const registered = useRegisteredEvents();
  const slugs = kind === "saved" ? saved.items : registered.items;
  const items = events.filter((e) => slugs.includes(e.slug));

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <h2 className="font-display text-lg font-bold text-navy">{emptyTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
        <Link
          to="/events/all" search={{ q: "", category: "", country: "", format: "" }}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
        >
          Browse events <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return <EventGrid items={items} />;
}
