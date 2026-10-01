import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Handshake,
  Home,
  Users,
  Target,
  Activity,
  FileSignature,
  Grid3x3,
  Map as MapIcon,
  Trophy,
  FolderOpen,
  Briefcase,
  Bookmark,
  Heart,
  Search,
  SlidersHorizontal,
  Calendar,
  ArrowRight,
  Plus,
  Globe,
  Rocket,
  GraduationCap,
  Landmark,
  FileText,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { Banner } from "@/components/baruna/page/Banner";
import { Panel, SectionHeader } from "@/components/baruna/page/primitives";
import { pageImages, courseImages } from "@/data/pages";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/partnership")({
  head: () => ({
    meta: [
      { title: "Partnership — BARUNA" },
      {
        name: "description",
        content:
          "Build strategic partnerships to strengthen capacity, drive innovation, and create lasting impact for a sustainable ocean.",
      },
      { property: "og:title", content: "Partnership — BARUNA" },
      { property: "og:description", content: "Collaborate with global partners to share knowledge, mobilize resources, and implement solutions." },
      { property: "og:image", content: pageImages.bannerUnderwater },
    ],
    links: [{ rel: "canonical", href: "/partnership" }],
  }),
  component: PartnershipPage,
});

type Opp = { badge: string; title: string; focus: string; partner: string; deadline: string; image: string };

const opportunities: Opp[] = [
  { badge: "Research Collaboration", title: "Blue Economy Innovation Research Partnership 2026", focus: "Sustainable blue economy solutions and marine technology innovation.", partner: "Research Institution, Private Sector", deadline: "31 August 2026", image: courseImages[0] },
  { badge: "Program Partnership", title: "Mangrove Restoration Program Partnership 2026", focus: "Coastal ecosystem restoration and community empowerment.", partner: "NGO, Government, Academic", deadline: "15 September 2026", image: courseImages[6] },
  { badge: "Capacity Building", title: "Sustainable Aquaculture Training Partnership 2026", focus: "Capacity building for sustainable aquaculture practices.", partner: "Training Provider, Industry Association", deadline: "30 September 2026", image: courseImages[1] },
  { badge: "Knowledge Exchange", title: "Ocean Data & Knowledge Sharing Initiative 2026", focus: "Marine data sharing and digital knowledge platforms.", partner: "International Organization, Tech Partner", deadline: "31 October 2026", image: courseImages[2] },
];

const highlights = [
  { badge: "New Collaboration", title: "KKP & University of Queensland Australia", desc: "Joint research on sustainable fisheries and climate resilience.", date: "15 July 2026", image: pageImages.bannerFellowship },
  { badge: "MoU Signed", title: "KKP & SEAFDEC", desc: "Strengthening capacity building programs for fisheries management.", date: "8 July 2026", image: courseImages[4] },
  { badge: "New Initiative", title: "Coral Triangle Partnership", desc: "Expanding collaboration for coral reef conservation and restoration.", date: "1 July 2026", image: courseImages[3] },
];

const keyPartners = ["SEAFDEC", "FAO", "UNEP", "WorldFish", "Australian Government", "University of Queensland"];

function PartnershipPage() {
  const { t } = useLanguage();

  const mainMenu = [
    { label: t("sidebar.partnershipHome"), icon: Home, active: true },
    { label: t("sidebar.ourPartners"), icon: Users },
    { label: t("sidebar.partnershipOpportunities"), icon: Target },
    { label: t("sidebar.activeCollaborations"), icon: Activity },
    { label: t("sidebar.mousAgreements"), icon: FileSignature },
  ];

  const explore = [
    { label: t("sidebar.sectors"), icon: Grid3x3 },
    { label: t("sidebar.regions"), icon: MapIcon },
    { label: t("sidebar.impactStories"), icon: Trophy },
    { label: t("sidebar.resourcesForPartners"), icon: FolderOpen },
  ];

  const myActivity = [
    { label: t("sidebar.myCollaborations"), icon: Briefcase },
    { label: t("sidebar.savedItems"), icon: Bookmark },
    { label: t("sidebar.following"), icon: Heart },
  ];

  const sectors: { label: string; count: number; icon: LucideIcon }[] = [
    { label: "Government", count: 36, icon: Landmark },
    { label: "Academic & Research", count: 32, icon: GraduationCap },
    { label: "International Organization", count: 24, icon: Globe },
    { label: "NGO & Non-profit", count: 18, icon: Heart },
    { label: "Private Sector", count: 14, icon: Briefcase },
    { label: "Community Organization", count: 4, icon: Users2 },
  ];

  const impact = [
    { value: "24", label: t("partnership.jointProjects"), icon: Rocket },
    { value: "56,230", label: t("partnership.beneficiaries"), icon: Users },
    { value: "18", label: t("partnership.countriesReached"), icon: FileText },
    { value: "12", label: t("partnership.activePartners"), icon: FileSignature },
  ];

  return (
    <PageShell
      sidebar={{
        icon: Handshake,
        title: "Partnership",
        subtitle: "Collaborate with institutions and organizations to advance marine and fisheries goals together.",
        sections: [
          { label: "Main Menu", items: mainMenu },
          { label: "Explore", items: explore },
          { label: "My Activity", items: myActivity },
        ],
        footer: { icon: Plus, label: t("partnership.ctaButton") },
      }}
      cta={{
        icon: Handshake,
        title: "Become a Strategic Partner",
        description: "Join hands with BARUNA to co-design learning programs, share data, and mobilize resources for ocean sustainability.",
        button: "Become a Partner",
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">{t("partnership.title")}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {t("partnership.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-soft">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder={t("search.placeholder")} />
            </div>
            <button type="button" className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-navy shadow-soft">
              <SlidersHorizontal className="h-4 w-4" /> {t("common.filter")}
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Banner
              image={pageImages.bannerUnderwater}
              alt="Sea turtle swimming over coral reef"
              title={t("partnership.bannerTitle")}
              description={t("partnership.bannerDesc")}
              stats={[
                { value: "128", label: t("partnership.activePartners"), icon: Landmark },
                { value: "45", label: t("partnership.jointProjects"), icon: Handshake },
                { value: "32", label: t("partnership.countriesReached"), icon: Globe },
                { value: "86", label: t("partnership.beneficiaries"), icon: Target },
              ]}
            />

            <section>
              <SectionHeader title={t("partnership.opportunitiesTitle")} action={t("bottomGrid.viewAllPartners")} />
              <div className="grid gap-4 sm:grid-cols-2">
                {opportunities.map((o) => (
                  <article key={o.title} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover">
                    <div className="relative h-32 overflow-hidden">
                      <img src={o.image} alt={o.title} loading="lazy" width={768} height={512} className="h-full w-full object-cover" />
                      <span className="absolute left-3 top-3 rounded-full bg-navy/85 px-3 py-1 text-[0.65rem] font-bold text-navy-foreground backdrop-blur">{o.badge}</span>
                      <button type="button" aria-label="Save" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-card/90 text-marine cursor-pointer"><Bookmark className="h-4 w-4" /></button>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-display text-sm font-bold leading-snug text-navy">{o.title}</h3>
                      <p className="mt-2 text-xs leading-snug text-muted-foreground"><span className="font-semibold text-navy">Focus:</span> {o.focus}</p>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground"><span className="font-semibold text-navy">Partner Type:</span> {o.partner}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{t("common.deadline")}: {o.deadline}</p>
                      <Link to="/partnership" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-marine">
                        {t("common.details")} <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <Panel>
              <SectionHeader title={t("sidebar.ourPartners")} action={t("bottomGrid.viewAllPartners")} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {keyPartners.map((p) => (
                  <div key={p} className="flex h-16 items-center justify-center rounded-lg border border-border bg-secondary/50 px-2 text-center text-[0.65rem] font-bold uppercase tracking-tight text-navy/70">
                    {p}
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel>
              <SectionHeader title={t("partnership.recentHighlights")} action={t("common.viewAll")} />
              <ul className="space-y-4">
                {highlights.map((h) => (
                  <li key={h.title} className="flex gap-3">
                    <img src={h.image} alt={h.title} loading="lazy" width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <span className="inline-flex rounded bg-marine/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-marine">{h.badge}</span>
                      <h3 className="mt-1 text-sm font-semibold leading-snug text-navy">{h.title}</h3>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{h.desc}</p>
                      <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-muted-foreground"><Calendar className="h-3 w-3" />{h.date}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <SectionHeader title={t("partnership.sectorsTitle")} action={t("common.viewAll")} />
              <ul className="space-y-1">
                {sectors.map(({ label, count, icon: Icon }) => (
                  <li key={label}>
                    <button type="button" className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-marine">
                      <Icon className="h-4 w-4 text-marine" />
                      <span className="flex-1 text-left">{label}</span>
                      <span className="font-semibold text-muted-foreground">{count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <SectionHeader title={t("partnership.title")} action={null} />
              <div className="grid grid-cols-2 gap-3">
                {impact.map(({ value, label, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-border p-3 text-center">
                    <Icon className="mx-auto h-5 w-5 text-marine" />
                    <p className="mt-2 font-display text-lg font-extrabold text-navy">{value}</p>
                    <p className="text-[0.7rem] leading-tight text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
