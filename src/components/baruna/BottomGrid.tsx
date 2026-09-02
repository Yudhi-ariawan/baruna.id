import {
  ArrowRight,
  MapPin,
  Calendar,
  Download,
  FileText,
  Play,
  Bookmark,
  Users,
  Building2,
  Globe,
} from "lucide-react";
import {
  events,
  resources,
  experts,
  fellowships,
  partners,
} from "@/data/baruna";

function ColHeader({ title, action }: { title: string; action: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="font-display text-base font-bold text-navy">{title}</h2>
      <a
        href="#"
        className="inline-flex shrink-0 items-center gap-1 text-[0.7rem] font-semibold text-marine transition-colors hover:text-navy"
      >
        {action}
        <ArrowRight className="h-3 w-3" />
      </a>
    </div>
  );
}

const eventBadge: Record<string, string> = {
  Blended: "bg-badge-webinar/10 text-badge-webinar",
  Online: "bg-badge-training/10 text-badge-training",
  "In-person": "bg-eco-fellowship/10 text-eco-fellowship",
};

const resourceColor: Record<string, string> = {
  PUBLICATION: "text-badge-course",
  "POLICY BRIEF": "text-badge-training",
  VIDEO: "text-eco-events",
};

const resourceIcon: Record<string, typeof FileText> = {
  PUBLICATION: FileText,
  "POLICY BRIEF": FileText,
  VIDEO: Play,
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">{children}</div>
  );
}

function UpcomingEvents() {
  return (
    <Card>
      <ColHeader title="Upcoming Events" action="View all events" />
      <ul className="space-y-4">
        {events.map((e) => (
          <li key={e.title} className="flex gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary text-center leading-none">
              <span className="text-[0.6rem] font-bold uppercase text-marine">{e.month}</span>
              <span className="text-base font-extrabold text-navy">{e.day}</span>
              <span className="text-[0.55rem] text-muted-foreground">{e.year}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold leading-snug text-navy">{e.title}</h3>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {e.location}
              </p>
            </div>
            <span
              className={`h-fit shrink-0 rounded-md px-2 py-0.5 text-[0.6rem] font-bold ${eventBadge[e.type]}`}
            >
              {e.type}
            </span>
          </li>
        ))}
      </ul>
      <a
        href="#"
        className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-marine"
      >
        <Calendar className="h-3.5 w-3.5" />
        Go to Event Calendar
      </a>
    </Card>
  );
}

function KnowledgeHub() {
  return (
    <Card>
      <ColHeader title="Latest from Knowledge Hub" action="View all resources" />
      <ul className="space-y-4">
        {resources.map((r) => {
          const Icon = resourceIcon[r.type];
          return (
            <li key={r.title} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className={`text-[0.6rem] font-bold uppercase tracking-wide ${resourceColor[r.type]}`}>
                  {r.type}
                </p>
                <h3 className="mt-0.5 text-sm font-semibold leading-snug text-navy">{r.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.meta}</p>
              </div>
              <button
                aria-label={r.type === "VIDEO" ? "Play video" : "Download"}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
              >
                <Icon className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <a
        href="#"
        className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-marine"
      >
        <Download className="h-3.5 w-3.5" />
        Go to Knowledge Hub
      </a>
    </Card>
  );
}

function FeaturedExperts() {
  return (
    <Card>
      <ColHeader title="Featured Experts" action="View all experts" />
      <ul className="space-y-4">
        {experts.map((ex) => (
          <li key={ex.name} className="flex items-start gap-3">
            <img
              src={ex.image}
              alt={ex.name}
              loading="lazy"
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold leading-tight text-navy">{ex.name}</h3>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{ex.position}</p>
            </div>
            <button
              aria-label="Save expert"
              className="shrink-0 text-muted-foreground transition-colors hover:text-marine"
            >
              <Bookmark className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <a
        href="#"
        className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-marine"
      >
        <Users className="h-3.5 w-3.5" />
        Browse Experts
      </a>
    </Card>
  );
}

function Fellowship() {
  return (
    <Card>
      <ColHeader title="Fellowship & Exchange Opportunities" action="View all opportunities" />
      <ul className="space-y-4">
        {fellowships.map((f) => (
          <li key={f.title} className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-[0.6rem] font-bold text-navy">
              {f.abbr}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold leading-snug text-navy">{f.title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{f.deadline}</p>
            </div>
          </li>
        ))}
      </ul>
      <a
        href="#"
        className="mt-5 flex items-center justify-center gap-1.5 text-xs font-semibold text-marine"
      >
        <Globe className="h-3.5 w-3.5" />
        Explore Opportunities
      </a>
    </Card>
  );
}

function Partnership() {
  return (
    <Card>
      <ColHeader title="Partnership Highlights" action="View all partners" />
      <div className="grid grid-cols-3 gap-3">
        {partners.map((p) => (
          <div
            key={p}
            className="flex h-16 items-center justify-center rounded-lg border border-border bg-secondary/50 px-2 text-center text-[0.65rem] font-bold uppercase tracking-tight text-navy/70"
          >
            {p}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Working together for sustainable oceans and fisheries.
      </p>
      <button className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">
        <Building2 className="h-4 w-4" />
        Become a Partner
      </button>
    </Card>
  );
}

export function BottomGrid() {
  return (
    <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <UpcomingEvents />
        <KnowledgeHub />
        <FeaturedExperts />
        <Fellowship />
        <Partnership />
      </div>
    </section>
  );
}
