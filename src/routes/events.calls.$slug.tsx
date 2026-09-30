import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CalendarClock, MapPin, Building2, ArrowRight } from "lucide-react";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { PageHeader, Breadcrumb } from "@/components/baruna/events/eventsUi";
import { opportunities, opportunityTypes } from "@/data/events";
import type { Opportunity } from "@/data/events";

export const Route = createFileRoute("/events/calls/$slug")({
  loader: ({ params }) => {
    const type = opportunityTypes.find((t) => t.slug === params.slug);
    if (!type) throw notFound();
    const items = opportunities.filter((o) => o.type === type.type);
    return { type, items };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.type.label ?? "Opportunities"} — BARUNA Events` },
      {
        name: "description",
        content:
          "Open calls and opportunities across the BARUNA marine and fisheries events network — participants, speakers, experts, abstracts, and volunteers.",
      },
    ],
  }),
  component: CallsPage,
  errorComponent: ({ error }: { error: any }) => (
    <EventsShell>
      <div role="alert" className="rounded-2xl border border-border bg-card p-8 text-center text-navy">
        {error?.message || String(error)}
      </div>
    </EventsShell>
  ),
  notFoundComponent: () => (
    <EventsShell>
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <h1 className="font-display text-2xl font-bold text-navy">Opportunity type not found</h1>
        <Link to="/events/calls/$slug" params={{ slug: "participants" }} className="mt-4 inline-block font-semibold text-marine">
          View open calls
        </Link>
      </div>
    </EventsShell>
  ),
});

function CallsPage() {
  const { type, items } = Route.useLoaderData() as {
    type: { slug: string; type: string; label: string };
    items: Opportunity[];
  };

  return (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Events", to: "/events" },
            { label: "Opportunities" },
            { label: type.label },
          ]}
        />
        <PageHeader
          title="Open Calls & Opportunities"
          subtitle="Apply to participate, speak, contribute expertise, submit abstracts, or volunteer across the BARUNA events network."
        />

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {opportunityTypes.map((t) => (
            <Link
              key={t.slug}
              to="/events/calls/$slug"
              params={{ slug: t.slug }}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                t.slug === type.slug
                  ? "border-marine bg-marine text-marine-foreground"
                  : "border-border bg-card text-navy hover:border-marine hover:text-marine"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No open {type.label.toLowerCase()} right now. Check other opportunity types or come back soon.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((o) => (
              <article
                key={o.id}
                className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover"
              >
                <span className="inline-flex w-fit rounded-md bg-marine/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-marine">
                  {type.label}
                </span>
                <h2 className="mt-3 font-display text-base font-bold text-navy">{o.title}</h2>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{o.description}</p>
                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-foreground/80">
                    <Building2 className="h-4 w-4 text-marine" /> {o.organization}
                  </div>
                  <div className="flex items-center gap-2 text-foreground/80">
                    <MapPin className="h-4 w-4 text-marine" /> {o.country}
                  </div>
                  <div className="flex items-center gap-2 font-semibold text-destructive">
                    <CalendarClock className="h-4 w-4" /> Deadline: {o.deadline}
                  </div>
                </dl>
                <div className="mt-4 flex items-center gap-2">
                  <a
                    href={o.applyUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
                  >
                    Apply <ArrowRight className="h-4 w-4" />
                  </a>
                  {o.eventSlug && (
                    <Link
                      to="/events/$slug"
                      params={{ slug: o.eventSlug }}
                      className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-marine hover:text-marine"
                    >
                      Event
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </EventsShell>
  );
}
