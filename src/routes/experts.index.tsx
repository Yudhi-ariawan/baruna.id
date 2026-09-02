import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Mic,
  GraduationCap,
  UserPlus,
  Search,
  ChevronDown,
  Bookmark,
  ArrowRight,
  Globe,
  BookMarked,
  Building2,
  RotateCcw,
  Megaphone,
  ClipboardCheck,
  UserCheck,
  UserSquare2,
  LifeBuoy,
} from "lucide-react";

import { PageShell } from "@/components/baruna/page/PageShell";
import { Banner } from "@/components/baruna/page/Banner";
import { Panel, SectionHeader, Tag } from "@/components/baruna/page/primitives";
import { pageImages, expertImages } from "@/data/pages";
import { instructors } from "@/data/instructors";
import { ExpertInstructorCard } from "@/components/baruna/InstructorDirectory";
import { DEMO_EXPERTS, DEMO_CATEGORIES, LEVEL_LABEL } from "@/data/demo";

import { publicExpertsNav } from "@/data/expertsNav";

export const Route = createFileRoute("/experts/")({
  head: () => ({
    meta: [
      { title: "Experts Directory — BARUNA" },
      {
        name: "description",
        content:
          "Explore our network of marine and fisheries experts, researchers, educators, and practitioners worldwide.",
      },
      { property: "og:title", content: "Experts Directory — BARUNA" },
      { property: "og:description", content: "Connect with leading experts in marine and fisheries." },
      { property: "og:image", content: pageImages.bannerUnderwater },
    ],
    links: [{ rel: "canonical", href: "/experts" }],
  }),
  component: ExpertsPage,
});

const expertsMenu = [
  { label: "Browse Experts", icon: Users, to: "/experts", active: true },
  { label: "Request an Expert", icon: UserPlus, to: "/experts/request" },
  { label: "Join as an Expert", icon: UserCheck, to: "/experts/join" },
  { label: "My Requests", icon: ClipboardCheck, to: "/experts/my-requests" },
  { label: "My Expert Profile", icon: UserSquare2, to: "/experts/profile" },
];

type Expert = {
  name: string;
  role: string;
  institution: string;
  expertise: string[];
  image: string;
};

const experts: Expert[] = DEMO_EXPERTS.map((e, i) => ({
  name: e.fullName,
  role: `${e.title} — ${LEVEL_LABEL[e.level]} (DEMO)`,
  institution: e.organization,
  expertise: [
    DEMO_CATEGORIES.find((c) => c.slug === e.category)?.name ?? "Marine & Fisheries",
    "Verified BARUNA Expert",
    "Approved BARUNA Trainer",
  ],
  image: expertImages[i % expertImages.length],
}));


const requests = [
  { label: "Request a Speaker", icon: Megaphone, type: "speaker" as const },
  { label: "Request a Trainer", icon: GraduationCap, type: "trainer" as const },
  { label: "Request a Reviewer", icon: ClipboardCheck, type: "reviewer" as const },
  { label: "Request a Mentor", icon: UserCheck, type: "mentor" as const },
  { label: "Request Technical Assistance", icon: LifeBuoy, type: "technical" as const },
];

const expertiseAreas = [
  "Fisheries Management", "Aquaculture", "Marine Conservation", "Blue Economy",
  "Ocean Governance", "Climate Change", "Marine Spatial Planning", "Fisheries Surveillance",
];

const institutions = [
  "Ministry of Marine Affairs and Fisheries", "Hokkaido University", "IPB University",
  "Institut Teknologi Bandung", "Ocean University of China", "CTI-CFF (Coral Triangle Initiative)", "SEAFDEC",
];

const filters = ["All Expertise", "All Countries", "All Institutions", "All Languages"];

function ExpertCard({ e }: { e: Expert }) {
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover">
      <div className="relative">
        <img src={e.image} alt={e.name} loading="lazy" width={400} height={320} className="h-44 w-full rounded-xl object-cover object-top" />
        <button aria-label="Save expert" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-card/90 text-marine shadow-soft">
          <Bookmark className="h-4 w-4" />
        </button>
      </div>
      <h3 className="mt-3 font-display text-sm font-bold leading-tight text-navy">{e.name}</h3>
      <p className="mt-1 text-xs font-medium leading-snug text-marine">{e.role}</p>
      <p className="mt-1 text-[0.7rem] leading-snug text-muted-foreground">{e.institution}</p>
      <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Expertise</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {e.expertise.map((x) => (
          <span key={x} className="rounded-md bg-secondary px-2 py-0.5 text-[0.65rem] font-medium text-navy">{x}</span>
        ))}
      </div>
      <a href="#" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-marine transition-colors hover:text-navy">
        View Profile <ArrowRight className="h-4 w-4" />
      </a>
    </article>
  );
}

function ExpertsPage() {
  return (
    <PageShell
      sidebar={{
        icon: Users,
        title: "Experts",
        subtitle: "Connect with marine and fisheries experts, researchers, educators, and practitioners worldwide.",
        sections: publicExpertsNav("/experts"),
        extra: (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Filter Experts</p>
            <div className="space-y-3">
              {filters.map((f) => (
                <div key={f}>
                  <label className="mb-1 block text-xs font-semibold text-navy">{f.replace("All ", "")}</label>
                  <button className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm text-foreground/80">
                    {f} <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-marine py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">
              <RotateCcw className="h-4 w-4" /> Reset Filters
            </button>
          </div>
        ),
      }}
      cta={{
        icon: Users,
        title: "Share Knowledge. Build Capacity. Create Impact.",
        description: "Join our community of experts and help shape a sustainable future for our ocean.",
        button: "Join as an Expert",
        href: "/experts/join",
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">Experts Directory</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Explore our network of experts and find the right people for learning, collaboration, and advisory.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-soft">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Search experts by name, expertise, or institution..." />
            </div>
            <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-navy shadow-soft">
              Sort by: Relevance <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Banner
          image={pageImages.bannerUnderwater}
          alt="Sea turtle swimming over coral reef"
          title={<>Learn from Experts.<br />Collaborate for Impact.</>}
          description="Connect with leading experts in marine and fisheries for knowledge sharing, capacity building, and sustainable ocean solutions."
          stats={[
            { value: "850+", label: "Experts", icon: Users },
            { value: "60+", label: "Countries", icon: Globe },
            { value: "25+", label: "Expertise Areas", icon: BookMarked },
            { value: "320+", label: "Institutions", icon: Building2 },
          ]}
          side={
            <div className="w-full rounded-2xl border border-navy-foreground/15 bg-navy/85 p-5 text-navy-foreground shadow-card backdrop-blur-md sm:w-72">
              <p className="font-display text-base font-bold">Need an Expert?</p>
              <p className="mt-1 text-xs text-navy-foreground/80">Find the right expert to support your program, event, or project.</p>
              <ul className="mt-4 space-y-1.5">
                {requests.map(({ label, icon: Icon, type }) => (
                  <li key={label}>
                    <Link
                      to="/experts/request"
                      search={{ type }}
                      className="flex w-full items-center gap-2.5 rounded-lg bg-navy-foreground/10 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-navy-foreground/20"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{label}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          }
        />

        {/* Training & Capacity Development Instructors (shared profiles) */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-navy sm:text-xl">
              Training &amp; Capacity Development Instructors
            </h2>
            <Link
              to="/academy/training/$slug"
              params={{ slug: "international-training-fisheries-african-countries" }}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marine transition-colors hover:text-navy"
            >
              View program <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {instructors.map((i) => (
              <ExpertInstructorCard key={i.slug} instructor={i} />
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
          <section>
            <SectionHeader title="All Experts" action="View all experts" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {experts.map((e) => (
                <ExpertCard key={e.name} e={e} />
              ))}
            </div>
          </section>

          <div className="space-y-5">
            <Panel>
              <SectionHeader title="Explore by Expertise" action={null} />
              <div className="flex flex-wrap gap-2">
                {expertiseAreas.map((x) => (
                  <Tag key={x}>{x}</Tag>
                ))}
              </div>
              <a href="#" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-marine">
                View all expertise areas <ArrowRight className="h-4 w-4" />
              </a>
            </Panel>

            <Panel>
              <SectionHeader title="Featured Institutions" action={null} />
              <ul className="space-y-3">
                {institutions.map((i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marine/10 text-marine">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-navy">{i}</span>
                  </li>
                ))}
              </ul>
              <a href="#" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-marine">
                View all institutions <ArrowRight className="h-4 w-4" />
              </a>
            </Panel>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
