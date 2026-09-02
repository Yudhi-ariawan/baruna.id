import { createFileRoute } from "@tanstack/react-router";
import {
  Globe,
  LayoutGrid,
  FileText,
  Repeat,
  Award,
  Plane,
  FlaskConical,
  HeartHandshake,
  BookOpen,
  Building2,
  Trophy,
  HelpCircle,
  Search,
  SlidersHorizontal,
  Bookmark,
  Calendar,
  MapPin,
  ArrowRight,
  Compass,
  Send,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { Banner } from "@/components/baruna/page/Banner";
import { Panel, SectionHeader } from "@/components/baruna/page/primitives";
import { pageImages, courseImages } from "@/data/pages";

export const Route = createFileRoute("/fellowship")({
  head: () => ({
    meta: [
      { title: "Fellowship & Exchange — BARUNA" },
      {
        name: "description",
        content:
          "Empowering marine and fisheries professionals through global collaboration, exchange, and capacity building opportunities.",
      },
      { property: "og:title", content: "Fellowship & Exchange — BARUNA" },
      { property: "og:description", content: "Fellowships, exchange programs, and collaborative opportunities worldwide." },
      { property: "og:image", content: pageImages.bannerFellowship },
    ],
    links: [{ rel: "canonical", href: "/fellowship" }],
  }),
  component: FellowshipPage,
});

const overview = [
  { label: "Overview", icon: LayoutGrid, active: true },
  { label: "Opportunities", icon: Compass },
  { label: "My Applications", icon: FileText },
  { label: "My Exchange", icon: Repeat },
];

const explore = [
  { label: "Fellowships", icon: Award },
  { label: "Short-term Exchange", icon: Repeat },
  { label: "Training & Attachment", icon: Plane },
  { label: "Research Collaboration", icon: FlaskConical },
  { label: "Mentorship Programs", icon: HeartHandshake },
];

const resources = [
  { label: "Guidelines", icon: BookOpen },
  { label: "Partner Institutions", icon: Building2 },
  { label: "Success Stories", icon: Trophy },
  { label: "FAQ", icon: HelpCircle },
];

type Opp = {
  badge: string;
  title: string;
  org: string;
  deadline: string;
  location: string;
  image: string;
};

const opportunities: Opp[] = [
  { badge: "Fellowship", title: "2026 MPA Leadership Fellowship Program", org: "The Nature Conservancy", deadline: "30 June 2026", location: "Global", image: courseImages[3] },
  { badge: "Short-term Exchange", title: "Marine Science Short-Term Exchange Program 2026", org: "Hokkaido University", deadline: "15 July 2026", location: "Japan", image: courseImages[5] },
  { badge: "Training & Attachment", title: "Aquaculture Innovation Training Program 2026", org: "SEAFDEC", deadline: "10 August 2026", location: "Thailand", image: courseImages[1] },
  { badge: "Research Collaboration", title: "Coral Triangle Research Collaboration Grant 2026", org: "CTI-CFF", deadline: "20 May 2026", location: "Indonesia", image: courseImages[2] },
];

const partners = [
  { name: "Hokkaido University", country: "Japan" },
  { name: "Ocean University of China", country: "China" },
  { name: "SEAFDEC", country: "Southeast Asia" },
  { name: "University of Wollongong", country: "Australia" },
  { name: "CTI-CFF", country: "Coral Triangle Initiative" },
];

const applications = [
  { label: "Submitted", value: 2 },
  { label: "In Review", value: 1 },
  { label: "Shortlisted", value: 0 },
  { label: "Awarded", value: 0 },
];

const steps: { label: string; desc: string; icon: LucideIcon }[] = [
  { label: "Explore", desc: "Find opportunities that match your goals and expertise.", icon: Search },
  { label: "Apply", desc: "Submit your application and required documents.", icon: Send },
  { label: "Review & Selection", desc: "Applications are reviewed by our partners and selection committee.", icon: Users },
  { label: "Participate", desc: "Join the program and gain international experience.", icon: Plane },
  { label: "Grow & Contribute", desc: "Share your knowledge and contribute to our ocean community.", icon: Sparkles },
];

function FellowshipPage() {
  return (
    <PageShell
      sidebar={{
        icon: Globe,
        title: "Fellowship & Exchange",
        subtitle: "Discover opportunities, connect globally, and grow through fellowships and exchange programs.",
        sections: [
          { label: "Overview", items: overview },
          { label: "Explore Programs", items: explore },
          { label: "Resources", items: resources },
        ],
        footer: { icon: FileText, label: "How to Apply" },
      }}
      cta={{
        icon: Globe,
        title: "Be Part of a Global Network. Make an Impact.",
        description: "Join fellow marine and fisheries professionals in building a sustainable future for our ocean.",
        button: "Explore Opportunities",
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">Fellowship & Exchange</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Empowering marine and fisheries professionals through global collaboration, exchange, and capacity building opportunities.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-soft">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Search opportunities, programs, or institutions..." />
            </div>
            <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-navy shadow-soft">
              <SlidersHorizontal className="h-4 w-4" /> Filter
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <Banner
              image={pageImages.bannerFellowship}
              alt="Group of marine science students collaborating"
              title={<>Connecting Talents.<br />Expanding Horizons.</>}
              description="Access fellowships, exchange programs, and collaborative opportunities with leading institutions worldwide."
              cta={{ label: "Explore Opportunities" }}
            />

            <section>
              <SectionHeader title="Featured Opportunities" action="View all opportunities" />
              <div className="grid gap-4 sm:grid-cols-2">
                {opportunities.map((o) => (
                  <article key={o.title} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover">
                    <div className="relative h-36 overflow-hidden">
                      <img src={o.image} alt={o.title} loading="lazy" width={768} height={512} className="h-full w-full object-cover" />
                      <span className="absolute left-3 top-3 rounded-full bg-navy/85 px-3 py-1 text-[0.65rem] font-bold text-navy-foreground backdrop-blur">{o.badge}</span>
                      <button aria-label="Save" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-card/90 text-marine"><Bookmark className="h-4 w-4" /></button>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-display text-sm font-bold leading-snug text-navy">{o.title}</h3>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{o.org}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" />Deadline: {o.deadline}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{o.location}</p>
                      <a href="#" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-marine">View Details <ArrowRight className="h-4 w-4" /></a>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <Panel>
              <SectionHeader title="How It Works" action={null} />
              <ol className="grid gap-5 sm:grid-cols-3 lg:grid-cols-5">
                {steps.map((s, i) => (
                  <li key={s.label} className="text-center">
                    <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-full bg-marine/10 text-marine">
                      <s.icon className="h-6 w-6" />
                      <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-marine text-xs font-bold text-marine-foreground">{i + 1}</span>
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-navy">{s.label}</h3>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{s.desc}</p>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel>
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-marine" />
                <h2 className="font-display text-base font-bold text-navy">Find Your Opportunity</h2>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Answer a few questions and we'll recommend programs that match your goals and expertise.</p>
              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">
                Get Recommendations <ArrowRight className="h-4 w-4" />
              </button>
            </Panel>

            <Panel>
              <SectionHeader title="My Applications" action={null} />
              <ul className="divide-y divide-border">
                {applications.map((a) => (
                  <li key={a.label} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-foreground/80">{a.label}</span>
                    <span className="font-display font-bold text-navy">{a.value}</span>
                  </li>
                ))}
              </ul>
              <a href="#" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-marine">View all applications <ArrowRight className="h-4 w-4" /></a>
            </Panel>

            <Panel>
              <SectionHeader title="Featured Partner Institutions" action={null} />
              <ul className="space-y-3">
                {partners.map((p) => (
                  <li key={p.name} className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marine/10 text-marine"><Building2 className="h-4 w-4" /></span>
                    <div>
                      <p className="text-sm font-semibold leading-tight text-navy">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.country}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <a href="#" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-marine">View all partners <ArrowRight className="h-4 w-4" /></a>
            </Panel>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
