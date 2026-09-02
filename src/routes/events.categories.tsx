import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { PageHeader, Breadcrumb } from "@/components/baruna/events/eventsUi";
import { eventCategories, categoryCount } from "@/data/events";

export const Route = createFileRoute("/events/categories")({
  head: () => ({
    meta: [
      { title: "Event Categories — BARUNA Events" },
      {
        name: "description",
        content:
          "Browse marine and fisheries events by category — conferences, webinars, workshops, training, community events, and field visits.",
      },
    ],
    links: [{ rel: "canonical", href: "/events/categories" }],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  return (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Events", to: "/events" }, { label: "Event Categories" }]} />
        <PageHeader
          title="Event Categories"
          subtitle="Explore the full range of BARUNA marine and fisheries events by category."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventCategories.map(({ slug, label, icon: Icon, category, blurb }) => (
            <Link
              key={slug}
              to="/events/category/$slug"
              params={{ slug }}
              className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:border-marine/40 hover:shadow-hover"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-marine/10 text-marine">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 font-display text-lg font-bold text-navy group-hover:text-marine">
                {label}
              </h2>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{blurb}</p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-semibold text-navy">
                  {categoryCount(category)} events
                </span>
                <ArrowRight className="h-4 w-4 text-marine transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </EventsShell>
  );
}
