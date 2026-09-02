import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Check, Plus, MapPin } from "lucide-react";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { PageHeader, Breadcrumb, EventBadge } from "@/components/baruna/events/eventsUi";
import { events } from "@/data/events";
import { useFollowing } from "@/lib/eventActions";

export const Route = createFileRoute("/events/following")({
  head: () => ({
    meta: [
      { title: "Following — BARUNA Events" },
      { name: "description", content: "Organizers you follow on BARUNA Events." },
    ],
  }),
  component: FollowingPage,
});

function FollowingPage() {
  const { has, toggle } = useFollowing();
  const organizers = Array.from(new Set(events.map((e) => e.organizer))).sort();
  const followed = organizers.filter(has);
  const followedEvents = events.filter((e) => has(e.organizer));

  return (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Events", to: "/events" }, { label: "Following" }]} />
        <PageHeader
          title="Following"
          subtitle="Follow organizers to keep up with their latest marine and fisheries events."
        />

        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-navy">Organizers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {organizers.map((org) => {
              const following = has(org);
              return (
                <div
                  key={org}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <span className="truncate text-sm font-semibold text-navy">{org}</span>
                  </div>
                  <button
                    onClick={() => toggle(org)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      following
                        ? "border-marine bg-marine text-marine-foreground"
                        : "border-border text-navy hover:border-marine hover:text-marine"
                    }`}
                  >
                    {following ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {following ? "Following" : "Follow"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {followed.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-navy">
              Events from organizers you follow
            </h2>
            <div className="space-y-3">
              {followedEvents.map((e) => (
                <Link
                  key={e.slug}
                  to="/events/$slug"
                  params={{ slug: e.slug }}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover"
                >
                  <img
                    src={e.image}
                    alt={e.title}
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <EventBadge category={e.category} />
                    <h3 className="mt-1 truncate font-display text-sm font-bold text-navy group-hover:text-marine">
                      {e.title}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{e.dateLabel}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {e.location}
                      </span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </EventsShell>
  );
}
