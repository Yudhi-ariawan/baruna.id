import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarPlus,
  Users,
  Handshake,
  BookOpen,
  CheckCircle2,
  Send,
  ArrowRight,
} from "lucide-react";
import { EventsShell } from "@/components/baruna/events/EventsShell";
import { PageHeader, Breadcrumb } from "@/components/baruna/events/eventsUi";

export const Route = createFileRoute("/events/host")({
  head: () => ({
    meta: [
      { title: "Host an Event — BARUNA Events" },
      {
        name: "description",
        content:
          "Host, co-host, or partner on a marine and fisheries event with BARUNA. Review guidelines and request collaboration.",
      },
    ],
    links: [{ rel: "canonical", href: "/events/host" }],
  }),
  component: HostPage,
});

const options = [
  {
    icon: CalendarPlus,
    title: "Host an Event",
    desc: "Lead and run your own marine or fisheries event under the BARUNA network.",
  },
  {
    icon: Users,
    title: "Co-host an Event",
    desc: "Partner with BARUNA or another member to deliver a joint programme.",
  },
  {
    icon: Handshake,
    title: "Partner Event",
    desc: "List your organization's event and amplify it to our global audience.",
  },
];

const guidelines = [
  "Events must relate to marine science, fisheries, or the blue economy.",
  "Provide accurate dates, location, organizer, and registration details.",
  "Open, inclusive, and non-discriminatory participation policies.",
  "Share post-event materials such as proceedings or recordings where possible.",
];

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-navy outline-none transition-colors focus:border-marine";

function HostPage() {
  const [sent, setSent] = useState(false);

  return (
    <EventsShell>
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Events", to: "/events" }, { label: "Host an Event" }]} />
        <PageHeader
          title="Host an Event"
          subtitle="Bring your marine and fisheries event to a global community. Host, co-host, or partner with BARUNA."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          {options.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-marine/10 text-marine">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 font-display text-lg font-bold text-navy">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Collaboration form */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-xl font-bold text-navy">Collaboration Request</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell us about your event idea and how you'd like to work together.
            </p>
            {sent ? (
              <div className="mt-6 rounded-xl border border-eco-community/30 bg-eco-community/5 p-6 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-eco-community" />
                <p className="mt-3 font-semibold text-navy">Request received</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Our partnerships team will be in touch soon.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
                className="mt-5 grid gap-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <input required className={inputClass} placeholder="Your name" />
                  <input required type="email" className={inputClass} placeholder="Email" />
                  <input required className={inputClass} placeholder="Organization" />
                  <select required defaultValue="" className={inputClass}>
                    <option value="" disabled>
                      Collaboration type
                    </option>
                    <option>Host</option>
                    <option>Co-host</option>
                    <option>Partner</option>
                  </select>
                </div>
                <input className={inputClass} placeholder="Proposed event title" />
                <textarea rows={4} className={inputClass} placeholder="Describe your event idea..." />
                <button
                  type="submit"
                  className="inline-flex w-fit items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:bg-accent/90"
                >
                  <Send className="h-4 w-4" /> Send Request
                </button>
              </form>
            )}
          </div>

          {/* Guidelines */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-marine" />
                <h3 className="font-display text-base font-bold text-navy">Event Guidelines</h3>
              </div>
              <ul className="mt-4 space-y-3">
                {guidelines.map((g) => (
                  <li key={g} className="flex gap-2 text-sm text-foreground/80">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-marine" /> {g}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-marine/30 bg-marine/5 p-6 shadow-soft">
              <h3 className="font-display text-base font-bold text-navy">Already have an event?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Submit it directly to the BARUNA events database.
              </p>
              <Link
                to="/events/submit"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-marine px-5 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
              >
                Submit Event <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </EventsShell>
  );
}
