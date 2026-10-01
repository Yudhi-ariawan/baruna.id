import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Info,
  Home,
  Lightbulb,
  Compass,
  Heart,
  Briefcase,
  BarChart3,
  Map as MapIcon,
  Network,
  GraduationCap,
  BookOpen,
  Users,
  Globe,
  MessagesSquare,
  CalendarDays,
  Handshake,
  FileText,
  FileBarChart,
  HelpCircle,
  Mail,
  Grid3x3,
  Layers,
  Monitor,
  ArrowRight,
  Flag,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { Panel, SectionHeader } from "@/components/baruna/page/primitives";
import { pageImages, courseImages } from "@/data/pages";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About BARUNA — Marine & Fisheries Knowledge Network" },
      {
        name: "description",
        content:
          "Discover the inspiration, purpose, and values behind BARUNA — Indonesia's Marine and Fisheries Knowledge & Capacity Building Network.",
      },
      { property: "og:title", content: "About BARUNA" },
      { property: "og:description", content: "The inspiration, mission, and values behind BARUNA." },
      { property: "og:image", content: pageImages.bannerAbout },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

const values = [
  { letter: "B", title: "Build Capacity", desc: "Strengthening competencies, leadership, and professional talent to support the sustainable development of marine and fisheries sectors." },
  { letter: "A", title: "Advance Knowledge", desc: "Promoting knowledge creation, learning, innovation, and the sharing of good practices across institutions and communities." },
  { letter: "R", title: "Reach Globally", desc: "Expanding networks and fostering collaboration across countries, organizations, and experts to address shared ocean challenges." },
  { letter: "U", title: "Unite Communities", desc: "Bringing together learners, experts, practitioners, institutions, and communities to learn, collaborate, and grow together." },
  { letter: "N", title: "Nurture Sustainability", desc: "Supporting the responsible stewardship of marine ecosystems and fisheries resources for present and future generations." },
  { letter: "A", title: "Accelerate Impact", desc: "Transforming knowledge, partnerships, and capacity building into meaningful outcomes that benefit people, fisheries, and the ocean." },
];

const roadmap = [
  { year: "2026", title: "Foundation", desc: "Building the foundation: platform development, content, and initial partnerships.", icon: Layers },
  { year: "2027", title: "Learning", desc: "Expanding learning programs, digital resources, and knowledge sharing.", icon: GraduationCap },
  { year: "2028", title: "Network", desc: "Strengthening communities, expert engagement, and institutional collaboration across sectors.", icon: Network },
  { year: "2029", title: "International", desc: "Expanding fellowship, exchange, and international capacity building initiatives.", icon: Globe },
  { year: "2030", title: "Global Hub", desc: "Positioning BARUNA as a recognized global hub for marine and fisheries capacity building.", icon: Flag },
];

const galleryImages = [courseImages[3], courseImages[6], courseImages[1], courseImages[5]];

function AboutPage() {
  const { t } = useLanguage();

  const aboutMenu = [
    { label: t("sidebar.overview"), icon: Home, active: true },
    { label: t("sidebar.theInspiration"), icon: Lightbulb },
    { label: t("sidebar.missionVision"), icon: Compass },
    { label: t("sidebar.values"), icon: Heart },
    { label: t("sidebar.whatWeDo"), icon: Briefcase },
    { label: t("sidebar.impactOutcomes"), icon: BarChart3 },
    { label: t("sidebar.roadmap"), icon: MapIcon },
    { label: t("sidebar.governancePartners"), icon: Network },
  ];

  const platform = [
    { label: t("nav.academy"), icon: GraduationCap, to: "/academy" },
    { label: t("nav.knowledgeHub"), icon: BookOpen, to: "/knowledge-hub" },
    { label: t("nav.experts"), icon: Users, to: "/experts" },
    { label: t("nav.fellowship"), icon: Globe, to: "/fellowship" },
    { label: t("nav.community"), icon: MessagesSquare, to: "/community" },
    { label: t("nav.events"), icon: CalendarDays, to: "/events" },
    { label: t("nav.partnership"), icon: Handshake, to: "/partnership" },
  ];

  const resources = [
    { label: t("sidebar.executiveSummary"), icon: FileText },
    { label: t("sidebar.annualReport"), icon: FileBarChart },
    { label: t("sidebar.faqs"), icon: HelpCircle, to: "/help" },
  ];

  const whatWeDo: { label: string; desc: string; icon: LucideIcon }[] = [
    { label: t("nav.academy"), desc: "High-quality learning and training to build knowledge and skills.", icon: GraduationCap },
    { label: t("nav.knowledgeHub"), desc: "Curated resources, research, and best practices.", icon: BookOpen },
    { label: t("nav.experts"), desc: "Connect with and access specialized knowledge.", icon: Users },
    { label: t("nav.fellowship"), desc: "Opportunities for learning, exchange, and professional development.", icon: Globe },
  ];

  return (
    <PageShell
      sidebar={{
        icon: Info,
        title: "About BARUNA",
        subtitle: "Discover the inspiration, purpose, and values behind BARUNA and how we create impact together.",
        sections: [
          { label: "About BARUNA", items: aboutMenu },
          { label: "Platform", items: platform },
          { label: "Resources", items: resources },
        ],
        footer: { icon: Mail, label: t("footer.contactUs") },
      }}
      cta={{
        icon: Globe,
        title: "Ready to be part of the future?",
        description: "Join our learning community and collaborate with maritime professionals around the world.",
        button: "Get Started",
        href: "/auth",
      }}
    >
      <div className="space-y-6">
        <Panel className="overflow-hidden p-0">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="p-6 sm:p-8">
              <h1 className="font-display text-3xl font-extrabold text-navy">{t("about.title")}</h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                BARUNA (Indonesia's Marine and Fisheries Knowledge & Capacity Building Network) is an initiative developed by the Agency for Marine and Fisheries Extension and Human Resources Development (BPPSDMKP), Ministry of Marine Affairs and Fisheries of the Republic of Indonesia.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("hero.subtitle")}
              </p>
            </div>
            <div className="relative min-h-[220px]">
              <img src={pageImages.bannerAbout} alt="Traditional Indonesian boat among tropical islands" loading="lazy" width={960} height={640} className="absolute inset-0 h-full w-full object-cover" />
            </div>
          </div>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Panel>
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-marine" />
                <h2 className="font-display text-lg font-bold text-navy">{t("sidebar.theInspiration")}</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The name BARUNA is inspired by the maritime heritage of the Nusantara, where Baruna has long been recognized as the guardian of the ocean. Across generations, Baruna symbolizes wisdom, responsibility, connectivity, and the enduring relationship between people and the sea.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                As the world's largest archipelagic nation, Indonesia's identity is inseparable from its marine and fisheries resources. Inspired by this maritime legacy, BARUNA connects people, knowledge, expertise, and opportunities to strengthen human resource development and foster collaboration in marine and fisheries sectors.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {galleryImages.map((img, i) => (
                  <img key={i} src={img} alt="BARUNA activities" loading="lazy" width={300} height={200} className="h-24 w-full rounded-lg object-cover" />
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionHeader title={t("about.valuesTitle")} action={null} />
              <div className="grid gap-4 sm:grid-cols-2">
                {values.map((v) => (
                  <div key={v.title} className="flex gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marine/10 font-display text-lg font-extrabold text-marine">{v.letter}</span>
                    <div>
                      <h3 className="text-sm font-bold text-navy">{v.title}</h3>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionHeader title={t("about.whatWeDoTitle")} action={null} />
              <div className="grid gap-4 sm:grid-cols-2">
                {whatWeDo.map((w) => {
                  const Icon = w.icon;
                  return (
                    <div key={w.label} className="flex gap-3 rounded-xl border border-border p-3.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-navy">{w.label}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{w.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel>
              <SectionHeader title={t("about.roadmapTitle")} action={null} />
              <ol className="space-y-3">
                {roadmap.map((r) => {
                  const Icon = r.icon;
                  return (
                    <li key={r.year} className="flex gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marine/10 text-marine">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-xs font-bold text-marine">{r.year} — {r.title}</p>
                        <p className="text-[0.7rem] text-muted-foreground">{r.desc}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Panel>

            <Panel>
              <SectionHeader title={t("sidebar.governancePartners")} action={null} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                BARUNA operates under the guidance of BPPSDMKP, Ministry of Marine Affairs and Fisheries, collaborating closely with regional and international marine bodies.
              </p>
              <Link to="/partnership" className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-semibold text-marine">
                {t("sidebar.ourPartners")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Panel>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
