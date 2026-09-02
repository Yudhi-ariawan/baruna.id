import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MapPin, Calendar as CalIcon } from "lucide-react";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { PageHeader, Breadcrumb, EventBadge } from "@/components/baruna/events/eventsUi";
import { events, eventCategories } from "@/data/events";
import type { BarunaEvent } from "@/data/events";

export const Route = createFileRoute("/events/calendar")({
  head: () => ({
    meta: [
      { title: "Event Calendar — BARUNA Events" },
      {
        name: "description",
        content: "Browse marine and fisheries events by month, year, or agenda on the BARUNA calendar.",
      },
    ],
    links: [{ rel: "canonical", href: "/events/calendar" }],
  }),
  component: CalendarPage,
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type View = "month" | "year" | "agenda";

function eventsOnDay(list: BarunaEvent[], y: number, m: number, d: number) {
  const target = new Date(y, m, d).setHours(0, 0, 0, 0);
  return list.filter((e) => {
    const start = new Date(e.startISO).setHours(0, 0, 0, 0);
    const end = new Date(e.endISO).setHours(0, 0, 0, 0);
    return target >= start && target <= end;
  });
}

function CalendarPage() {
  const firstEvent = [...events].sort((a, b) => +new Date(a.startISO) - +new Date(b.startISO))[0];
  const [cursor, setCursor] = useState(new Date(firstEvent.startISO));
  const [view, setView] = useState<View>("month");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [format, setFormat] = useState("");

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (!category || e.category === category) &&
          (!country || e.country === country) &&
          (!format || e.format === format),
      ),
    [category, country, format],
  );

  const countries = Array.from(new Set(events.map((e) => e.country))).sort();
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [year, month]);

  const shiftMonth = (n: number) => setCursor(new Date(year, month + n, 1));
  const shiftYear = (n: number) => setCursor(new Date(year + n, month, 1));

  const agendaList = [...filtered].sort((a, b) => +new Date(a.startISO) - +new Date(b.startISO));

  return (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Events", to: "/events" }, { label: "Calendar" }]} />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader title="Event Calendar" subtitle="Plan ahead with month, year, and agenda views." />
          <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-soft">
            {(["month", "year", "agenda"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                  view === v ? "bg-marine text-marine-foreground" : "text-navy hover:text-marine"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:grid-cols-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-navy outline-none">
            <option value="">All categories</option>
            {eventCategories.map((c) => (
              <option key={c.slug} value={c.category}>{c.label}</option>
            ))}
          </select>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-navy outline-none">
            <option value="">All countries</option>
            {countries.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-navy outline-none">
            <option value="">All formats</option>
            {["Offline", "Online", "Blended"].map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>
        </div>

        {/* Month view */}
        {view === "month" && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-navy">
                {MONTHS[month]} {year}
              </h2>
              <div className="flex gap-2">
                <button onClick={() => shiftMonth(-1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-navy hover:border-marine hover:text-marine">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => shiftMonth(1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-navy hover:border-marine hover:text-marine">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((d, i) => {
                const dayEvents = d ? eventsOnDay(filtered, year, month, d) : [];
                return (
                  <div
                    key={i}
                    className={`min-h-[84px] rounded-lg border p-1.5 text-left ${
                      d ? "border-border" : "border-transparent"
                    }`}
                  >
                    {d && <span className="text-xs font-semibold text-muted-foreground">{d}</span>}
                    <div className="mt-1 space-y-1">
                      {dayEvents.map((e) => (
                        <Link
                          key={e.slug}
                          to="/events/$slug"
                          params={{ slug: e.slug }}
                          className="block truncate rounded bg-marine/10 px-1.5 py-0.5 text-[0.62rem] font-semibold text-marine hover:bg-marine hover:text-marine-foreground"
                          title={e.title}
                        >
                          {e.shortTitle}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Year view */}
        {view === "year" && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-navy">{year}</h2>
              <div className="flex gap-2">
                <button onClick={() => shiftYear(-1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-navy hover:border-marine hover:text-marine">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => shiftYear(1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-navy hover:border-marine hover:text-marine">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {MONTHS.map((mName, mi) => {
                const monthEvents = filtered.filter((e) => {
                  const s = new Date(e.startISO);
                  return s.getFullYear() === year && s.getMonth() === mi;
                });
                return (
                  <button
                    key={mName}
                    onClick={() => {
                      setCursor(new Date(year, mi, 1));
                      setView("month");
                    }}
                    className="rounded-xl border border-border p-3 text-left transition-colors hover:border-marine"
                  >
                    <p className="text-sm font-bold text-navy">{mName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {monthEvents.length} event{monthEvents.length !== 1 ? "s" : ""}
                    </p>
                    <div className="mt-2 space-y-1">
                      {monthEvents.slice(0, 2).map((e) => (
                        <span key={e.slug} className="block truncate text-[0.62rem] font-semibold text-marine">
                          {e.shortTitle}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Agenda view */}
        {view === "agenda" && (
          <div className="space-y-3">
            {agendaList.map((e) => (
              <Link
                key={e.slug}
                to="/events/$slug"
                params={{ slug: e.slug }}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover"
              >
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                  <CalIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
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
            {agendaList.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                No events match these filters.
              </div>
            )}
          </div>
        )}
      </div>
    </EventsShell>
  );
}
