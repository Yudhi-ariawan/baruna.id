import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { EventGrid, Breadcrumb } from "@/components/baruna/events/eventsUi";
import {
  eventCategories,
  getEventsByCategory,
  getUpcomingEvents,
} from "@/data/events";
import type { BarunaEvent, CategoryConfig } from "@/data/events";

export const Route = createFileRoute("/events/category/$slug")({
  loader: ({ params }) => {
    const config = eventCategories.find((c) => c.slug === params.slug);
    if (!config) throw notFound();
    const items = getEventsByCategory(config.category);
    const suggested = getUpcomingEvents()
      .filter((e) => e.category !== config.category)
      .slice(0, 3);
    return { config, items, suggested };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.config;
    return {
      meta: [
        { title: `${c?.label ?? "Category"} — BARUNA Events` },
        { name: "description", content: c?.blurb ?? "Marine and fisheries events." },
      ],
    };
  },
  component: CategoryPage,
  errorComponent: ({ error }) => (
    <EventsShell>
      <div role="alert" className="rounded-2xl border border-border bg-card p-8 text-center text-navy">
        {error.message}
      </div>
    </EventsShell>
  ),
  notFoundComponent: () => (
    <EventsShell>
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <h1 className="font-display text-2xl font-bold text-navy">Category not found</h1>
        <Link to="/events/categories" className="mt-4 inline-block font-semibold text-marine">
          View all categories
        </Link>
      </div>
    </EventsShell>
  ),
});

function CategoryPage() {
  const { config, items, suggested } = Route.useLoaderData() as {
    config: CategoryConfig;
    items: BarunaEvent[];
    suggested: BarunaEvent[];
  };
  const Icon = config.icon;

  return (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Events", to: "/events" },
            { label: "Categories", to: "/events/categories" },
            { label: config.label },
          ]}
        />

        <section className="flex items-center gap-4 rounded-3xl bg-navy p-7 text-navy-foreground shadow-card">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-navy-foreground/10">
            <Icon className="h-7 w-7" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{config.label}</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-navy-foreground/85">{config.blurb}</p>
            <p className="mt-2 text-xs font-semibold text-navy-foreground/70">
              {items.length} event{items.length !== 1 ? "s" : ""} in this category
            </p>
          </div>
        </section>

        <EventGrid
          items={items}
          emptyMessage={`No ${config.label.toLowerCase()} are scheduled yet — check back soon or explore other categories.`}
        />

        {suggested.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-navy">You may also like</h2>
              <Link
                to="/events/all" search={{ q: "", category: "", country: "", format: "" }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-marine"
              >
                All events <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <EventGrid items={suggested} />
          </section>
        )}
      </div>
    </EventsShell>
  );
}
