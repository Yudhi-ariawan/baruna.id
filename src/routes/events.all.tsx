import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { EventGrid, PageHeader, Breadcrumb } from "@/components/baruna/events/eventsUi";
import { events, eventCategories } from "@/data/events";
import type { BarunaEvent } from "@/data/events";

type AllSearch = {
  q: string;
  category: string;
  country: string;
  format: string;
};

export const Route = createFileRoute("/events/all")({
  validateSearch: (search: Record<string, unknown>): AllSearch => ({
    q: typeof search.q === "string" ? search.q : "",
    category: typeof search.category === "string" ? search.category : "",
    country: typeof search.country === "string" ? search.country : "",
    format: typeof search.format === "string" ? search.format : "",
  }),
  head: () => ({
    meta: [
      { title: "All Events — BARUNA Events" },
      {
        name: "description",
        content:
          "Search and filter all marine and fisheries events by category, country, and format on BARUNA.",
      },
    ],
    links: [{ rel: "canonical", href: "/events/all" }],
  }),
  component: AllEvents,
});

function AllEvents() {
  const { q, category, country, format } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const update = (patch: Partial<AllSearch>) =>
    navigate({ search: (prev: AllSearch) => ({ ...prev, ...patch }) });

  const countries = Array.from(new Set(events.map((e) => e.country))).sort();
  const formats = ["Offline", "Online", "Blended"];

  const filtered: BarunaEvent[] = events.filter((e) => {
    const text = `${e.title} ${e.location} ${e.organizer} ${e.themes.join(" ")}`.toLowerCase();
    if (q && !text.includes(q.toLowerCase())) return false;
    if (category && e.category !== category) return false;
    if (country && e.country !== country) return false;
    if (format && e.format !== format) return false;
    return true;
  });

  const hasFilters = q || category || country || format;

  return (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Events", to: "/events" }, { label: "All Events" }]} />
        <PageHeader
          title="All Events"
          subtitle="Search and filter the full BARUNA marine and fisheries events database."
        />

        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(ev) => update({ q: ev.target.value })}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search events, topics, organizers..."
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <select
              value={category}
              onChange={(ev) => update({ category: ev.target.value })}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-navy outline-none"
            >
              <option value="">All categories</option>
              {eventCategories.map((c) => (
                <option key={c.slug} value={c.category}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={country}
              onChange={(ev) => update({ country: ev.target.value })}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-navy outline-none"
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={format}
              onChange={(ev) => update({ format: ev.target.value })}
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-navy outline-none"
            >
              <option value="">All formats</option>
              {formats.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button
              onClick={() => navigate({ search: { q: "", category: "", country: "", format: "" } })}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-marine hover:text-navy"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-navy">{filtered.length}</span> of{" "}
          {events.length} events
        </p>

        <EventGrid items={filtered} />
      </div>
    </EventsShell>
  );
}
