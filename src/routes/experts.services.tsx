import { createFileRoute, Link } from "@tanstack/react-router";
import { Handshake, Megaphone, GraduationCap, ClipboardCheck, UserCheck, LifeBuoy, BookOpen, ArrowRight, Users } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { publicExpertsNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";

export const Route = createFileRoute("/experts/services")({
  head: () => ({
    meta: [
      { title: "Expert Services — BARUNA Experts" },
      { name: "description", content: "Request BARUNA experts as speakers, trainers, reviewers, mentors, technical instructors, or subject matter experts." },
      { property: "og:title", content: "Expert Services — BARUNA Experts" },
      { property: "og:description", content: "Unified Expert Services request portal." },
    ],
    links: [{ rel: "canonical", href: "/experts/services" }],
  }),
  component: ServicesPage,
});

const SERVICES = [
  { icon: Megaphone, label: "Speaker", type: "speaker" as const, desc: "Keynote, panel, seminar, or webinar." },
  { icon: GraduationCap, label: "Trainer", type: "trainer" as const, desc: "Capacity building and professional training." },
  { icon: ClipboardCheck, label: "Reviewer", type: "reviewer" as const, desc: "Academic or quality assurance review." },
  { icon: UserCheck, label: "Mentor", type: "mentor" as const, desc: "Institutional or individual mentoring." },
  { icon: LifeBuoy, label: "Technical Assistance", type: "technical" as const, desc: "Technical support and problem-solving." },
  { icon: BookOpen, label: "Subject Matter Expert", type: "reviewer" as const, desc: "Content expertise for curriculum or programs." },
];

const REQUEST_STATUSES = [
  "Draft","Submitted","Under Review","Expert Contacted","Expert Available","Expert Unavailable","Additional Information Required","Approved","Scheduled","Completed","Declined","Cancelled",
];

function ServicesPage() {
  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, sections: publicExpertsNav("/experts/services") }}
      cta={{ icon: Handshake, title: "Track your requests", description: "See status, assigned experts, and next steps.", button: "My Requests", href: "/experts/my-requests" }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Expert Services</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Request a BARUNA expert for your programme, event, or project. Every request follows a transparent status workflow.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SERVICES.map((s) => (
            <Link key={s.label} to="/experts/request" search={{ type: s.type }} className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-marine/10 text-marine group-hover:bg-marine group-hover:text-marine-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-display text-base font-bold text-navy">Request a {s.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-marine">Start request <ArrowRight className="h-3.5 w-3.5" /></span>
            </Link>
          ))}
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Request Statuses</h2>
          <p className="mt-1 text-xs text-muted-foreground">All requests transition through these statuses. Every change is recorded in the audit trail.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {REQUEST_STATUSES.map((s) => (
              <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground/80">{s}</span>
            ))}
          </div>
        </section>

        <div className="rounded-2xl border border-marine/20 bg-marine/5 p-5 text-sm text-foreground/80">
          <p className="flex items-center gap-2 font-bold text-marine"><Users className="h-4 w-4" /> Not sure which service you need?</p>
          <p className="mt-1">Browse the <Link to="/experts/directory" className="font-semibold underline">Expert Directory</Link> to identify a suitable expert, then submit a request.</p>
        </div>
      </div>
    </PageShell>
  );
}
