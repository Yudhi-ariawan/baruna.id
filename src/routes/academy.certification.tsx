import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Layers,
  Clock,
  Monitor,
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  Medal,
  Share2,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  Globe2,
  ShieldCheck,
  Award,
  FileSearch,
  type LucideIcon,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import {
  AcademyHeader,
  TabBar,
  StatusBadge,
  MetaItem,
  PrimaryButton,
  OutlineButton,
  FilterPanel,
  FilterGroup,
  CheckRow,
  FilterSelect,
  ApplyButton,
  ShowMore,
  type Tab,
} from "@/components/baruna/academy/ui";
import { academyImages } from "@/data/academy";

export const Route = createFileRoute("/academy/certification")({
  head: () => ({
    meta: [
      { title: "Certification — Academy — BARUNA" },
      {
        name: "description",
        content:
          "Earn industry-recognized certificates to validate your expertise and enhance your professional credibility in marine and fisheries.",
      },
      { property: "og:title", content: "Certification — Academy — BARUNA" },
      { property: "og:description", content: "Industry-recognized marine and fisheries certifications." },
      { property: "og:image", content: academyImages.seaTurtle },
      { property: "og:url", content: "/academy/certification" },
    ],
    links: [{ rel: "canonical", href: "/academy/certification" }],
  }),
  component: CertificationPage,
});

const tabs: Tab[] = [
  { label: "All Certifications", count: "38 Certifications", active: true },
  { label: "Fisheries Management", count: "7 Certifications" },
  { label: "Aquaculture", count: "6 Certifications" },
  { label: "Marine Conservation", count: "6 Certifications" },
  { label: "Blue Economy", count: "5 Certifications" },
  { label: "Ocean Governance", count: "5 Certifications" },
];

const steps: { n: string; label: string; icon: LucideIcon }[] = [
  { n: "1", label: "Complete the Required Program", icon: BookOpen },
  { n: "2", label: "Pass the Assessment", icon: ClipboardCheck },
  { n: "3", label: "Earn Your Certificate", icon: Medal },
  { n: "4", label: "Share & Showcase Your Achievement", icon: Share2 },
];

type CertItem = {
  image: string;
  title: string;
  desc: string;
  level: string;
  modules: string;
  hours: string;
  mode: string;
  category: string;
  validUntil: string;
};

const items: CertItem[] = [
  {
    image: academyImages.seaTurtle, title: "Sustainable Fisheries Management",
    desc: "Demonstrate your knowledge of sustainable fisheries principles, ecosystem approach, and responsible resource management.",
    level: "Intermediate", modules: "8 Modules", hours: "20 Hours", mode: "Online",
    category: "Fisheries Management", validUntil: "20 Jun 2028",
  },
  {
    image: academyImages.aquaculture, title: "Aquaculture Production and Management",
    desc: "Validate your skills in aquaculture systems, production techniques, and farm management.",
    level: "Intermediate", modules: "7 Modules", hours: "18 Hours", mode: "Online",
    category: "Aquaculture", validUntil: "15 May 2028",
  },
  {
    image: academyImages.coralDiver, title: "Coral Reef Monitoring and Assessment",
    desc: "Learn to monitor, assess, and report coral reef health and biodiversity effectively.",
    level: "Advanced", modules: "6 Modules", hours: "16 Hours", mode: "In-person",
    category: "Marine Conservation", validUntil: "10 Apr 2028",
  },
  {
    image: academyImages.marineSpatial, title: "Marine Spatial Planning Fundamentals",
    desc: "Gain essential knowledge and skills in marine spatial planning process and implementation.",
    level: "Intermediate", modules: "5 Modules", hours: "15 Hours", mode: "Online",
    category: "Ocean Governance", validUntil: "05 Mar 2028",
  },
];

const whyCertified: { title: string; desc: string; icon: LucideIcon }[] = [
  { title: "Boost Your Career", desc: "Enhance your professional profile and job opportunities.", icon: TrendingUp },
  { title: "Industry Recognition", desc: "Stand out with globally recognized certifications.", icon: Globe2 },
  { title: "Build Confidence", desc: "Validate your skills and expertise with credible credentials.", icon: ShieldCheck },
];

function CertCard({ c }: { c: CertItem }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover">
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-xl lg:h-32 lg:w-48">
          <img src={c.image} alt={c.title} loading="lazy" width={768} height={512} className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2">
            <StatusBadge label="VERIFIED" />
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="font-display text-lg font-bold text-navy">{c.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <MetaItem icon={BarChart3}>{c.level}</MetaItem>
            <MetaItem icon={Layers}>{c.modules}</MetaItem>
            <MetaItem icon={Clock}>{c.hours}</MetaItem>
            <MetaItem icon={Monitor}>{c.mode}</MetaItem>
          </div>
          <span className="mt-3 inline-flex w-fit rounded-full bg-marine/10 px-3 py-1 text-[0.7rem] font-semibold text-marine">
            {c.category}
          </span>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:w-[160px]">
          <div className="rounded-xl border border-badge-training/30 bg-badge-training/8 p-3 text-center">
            <span className="flex items-center justify-center gap-1 text-sm font-bold text-badge-training">
              <BadgeCheck className="h-4 w-4" /> Certified
            </span>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">Valid until {c.validUntil}</p>
          </div>
          <PrimaryButton className="w-full">View Details</PrimaryButton>
          <OutlineButton className="w-full">Save</OutlineButton>
        </div>
      </div>
    </article>
  );
}

function CertificationPage() {
  return (
    <AcademyShell
      active="certification"
      aside={
        <>
          <FilterPanel title="Filter Certifications">
            <FilterGroup label="Level">
              <FilterSelect placeholder="All Levels" />
            </FilterGroup>
            <FilterGroup label="Category">
              <CheckRow label="Fisheries Management" count={7} />
              <CheckRow label="Aquaculture" count={6} />
              <CheckRow label="Marine Conservation" count={6} />
              <CheckRow label="Blue Economy" count={5} />
              <CheckRow label="Ocean Governance" count={5} />
              <ShowMore />
            </FilterGroup>
            <FilterGroup label="Delivery Mode">
              <CheckRow label="Online" count={22} />
              <CheckRow label="In-person" count={10} />
              <CheckRow label="Blended" count={6} />
            </FilterGroup>
            <FilterGroup label="Language">
              <FilterSelect placeholder="All Languages" />
            </FilterGroup>
            <ApplyButton />
          </FilterPanel>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="mb-4 font-display text-base font-bold text-navy">Why Get Certified?</h3>
            <ul className="space-y-4">
              {whyCertified.map(({ title, desc, icon: Icon }) => (
                <li key={title} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marine/10 text-marine">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-marine/20 bg-marine/5 p-5">
            <h3 className="font-display text-base font-bold text-navy">Verify a Certificate?</h3>
            <div className="mt-3 flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marine/10 text-marine">
                <FileSearch className="h-4 w-4" />
              </span>
              <p className="text-xs text-muted-foreground">
                Enter certificate ID to verify a credential issued by BARUNA.
              </p>
            </div>
            <button className="mt-3 flex items-center gap-1 text-sm font-semibold text-marine hover:text-navy">
              Verify Now <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-6">
        <AcademyHeader
          crumb="Certification"
          title="Certification"
          description="Earn industry-recognized certificates to validate your expertise and enhance your professional credibility in marine and fisheries."
          searchPlaceholder="Search certifications, skills, or keywords..."
        />

        {/* Certification journey banner */}
        <section className="overflow-hidden rounded-2xl border border-marine/15 bg-gradient-to-r from-marine/10 to-secondary p-5 sm:p-6">
          <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-center">
            <div className="flex items-start gap-4 2xl:w-80 2xl:shrink-0">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-marine/15 text-marine">
                <Award className="h-8 w-8" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-navy">Build Credibility. Showcase Expertise.</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Our certifications are designed by industry experts and recognized by institutions and partners worldwide.
                </p>
                <button className="mt-2 flex items-center gap-1 text-sm font-semibold text-marine hover:text-navy">
                  How Certification Works <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-1 flex-wrap items-start justify-center gap-x-1 gap-y-4 sm:justify-between">
              {steps.map((s, i) => (
                <div key={s.n} className="flex items-start gap-1">
                  <div className="flex w-24 flex-col items-center text-center sm:w-28">
                    <span className="relative grid h-12 w-12 place-items-center rounded-full bg-card text-marine shadow-soft">
                      <s.icon className="h-5 w-5" />
                      <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-marine text-[0.65rem] font-bold text-marine-foreground">
                        {s.n}
                      </span>
                    </span>
                    <p className="mt-2 text-[0.65rem] font-semibold leading-tight text-navy">{s.label}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <ChevronRight className="mt-3.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <TabBar tabs={tabs} />
          </div>
          <button className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-navy shadow-soft">
            More <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">Showing 1–10 of 38 certifications</p>
        <div className="space-y-4">
          {items.map((c) => (
            <CertCard key={c.title} c={c} />
          ))}
        </div>

        <div className="flex justify-center pt-2">
          <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-semibold text-navy shadow-soft transition-colors hover:border-marine/40">
            Load More <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </AcademyShell>
  );
}
