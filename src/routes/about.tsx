import { createFileRoute } from "@tanstack/react-router";
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
  Building2,
  Monitor,
  ArrowRight,
  Flag,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { Panel, SectionHeader } from "@/components/baruna/page/primitives";
import { pageImages, courseImages } from "@/data/pages";

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

const aboutMenu = [
  { label: "Overview", icon: Home, active: true },
  { label: "The Inspiration Behind BARUNA", icon: Lightbulb },
  { label: "Mission & Vision", icon: Compass },
  { label: "Values", icon: Heart },
  { label: "What We Do", icon: Briefcase },
  { label: "Impact & Outcomes", icon: BarChart3 },
  { label: "Roadmap 2026–2030", icon: MapIcon },
  { label: "Governance & Partners", icon: Network },
];

const platform = [
  { label: "Academy", icon: GraduationCap },
  { label: "Knowledge Hub", icon: BookOpen },
  { label: "Experts", icon: Users },
  { label: "Fellowship & Exchange", icon: Globe },
  { label: "Community", icon: MessagesSquare },
  { label: "Events", icon: CalendarDays },
  { label: "Partnership", icon: Handshake },
];

const resources = [
  { label: "Executive Summary", icon: FileText },
  { label: "Annual Report", icon: FileBarChart },
  { label: "FAQ", icon: HelpCircle },
];

const values = [
  { letter: "B", title: "Build Capacity", desc: "Strengthening competencies, leadership, and professional talent to support the sustainable development of marine and fisheries sectors." },
  { letter: "A", title: "Advance Knowledge", desc: "Promoting knowledge creation, learning, innovation, and the sharing of good practices across institutions and communities." },
  { letter: "R", title: "Reach Globally", desc: "Expanding networks and fostering collaboration across countries, organizations, and experts to address shared ocean challenges." },
  { letter: "U", title: "Unite Communities", desc: "Bringing together learners, experts, practitioners, institutions, and communities to learn, collaborate, and grow together." },
  { letter: "N", title: "Nurture Sustainability", desc: "Supporting the responsible stewardship of marine ecosystems and fisheries resources for present and future generations." },
  { letter: "A", title: "Accelerate Impact", desc: "Transforming knowledge, partnerships, and capacity building into meaningful outcomes that benefit people, fisheries, and the ocean." },
];

const whatWeDo: { label: string; desc: string; icon: LucideIcon }[] = [
  { label: "Academy", desc: "High-quality learning and training to build knowledge and skills.", icon: GraduationCap },
  { label: "Knowledge Hub", desc: "Curated resources, research, and best practices.", icon: BookOpen },
  { label: "Experts", desc: "Connect with and access specialized knowledge.", icon: Users },
  { label: "Fellowship & Exchange", desc: "Opportunities for learning, exchange, and professional development.", icon: Globe },
];

const roadmap = [
  { year: "2026", title: "Foundation", desc: "Building the foundation: platform development, content, and initial partnerships.", icon: Layers },
  { year: "2027", title: "Learning", desc: "Expanding learning programs, digital resources, and knowledge sharing.", icon: GraduationCap },
  { year: "2028", title: "Network", desc: "Strengthening communities, expert engagement, and institutional collaboration across sectors.", icon: Network },
  { year: "2029", title: "International", desc: "Expanding fellowship, exchange, and international capacity building initiatives.", icon: Globe },
  { year: "2030", title: "Global Hub", desc: "Positioning BARUNA as a recognized global hub for marine and fisheries capacity building.", icon: Flag },
];

const outcomes: { value: string; title: string; desc: string; icon: LucideIcon }[] = [
  { value: "7", title: "Platform Components", desc: "Integrated features for learning, sharing, and collaboration.", icon: Grid3x3 },
  { value: "1", title: "Integrated Knowledge Network", desc: "Connecting people, knowledge, and opportunities.", icon: Network },
  { value: "4", title: "Pilot Expert Profiles", desc: "Marine and fisheries experts onboarded.", icon: Users },
  { value: "1", title: "Prototype Platform", desc: "BARUNA prototype launched for pilot users.", icon: Monitor },
];

const galleryImages = [courseImages[3], courseImages[6], courseImages[1], courseImages[5]];

function AboutPage() {
  return (
    <PageShell
      sidebar={{
        icon: Info,
        title: "About BARUNA",
        subtitle: "Discover the inspiration, purpose, and values behind BARUNA and how we create impact together.",
        sections: [
          { label: "About BARUNA", items: aboutMenu },
          { label: "Platform Components", items: platform },
          { label: "Resources", items: resources },
        ],
        footer: { icon: Mail, label: "Contact Us" },
      }}
      cta={{
        icon: Globe,
        title: "Together, From Ocean Wisdom to Global Impact.",
        description: "Join BARUNA and be part of a global network working for a healthy, productive, and resilient ocean and fisheries.",
        button: "Join Our Network",
      }}
    >
      <div className="space-y-6">
        <Panel className="overflow-hidden p-0">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="p-6 sm:p-8">
              <h1 className="font-display text-3xl font-extrabold text-navy">About BARUNA</h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                BARUNA (Indonesia's Marine and Fisheries Knowledge & Capacity Building Network) is an initiative developed by the Agency for Marine and Fisheries Extension and Human Resources Development (BPPSDMKP), Ministry of Marine Affairs and Fisheries of the Republic of Indonesia.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                BARUNA connects people, knowledge, expertise, and opportunities to strengthen human resource development in marine and fisheries sectors and to build a sustainable ocean future for Indonesia and the world.
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
                <h2 className="font-display text-lg font-bold text-navy">The Inspiration Behind BARUNA</h2>
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
              <SectionHeader title="Our Values" action={null} />
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
              <SectionHeader title="What We Do" action={null} />
              <p className="-mt-2 mb-4 text-sm text-muted-foreground">BARUNA provides an integrated platform and programs that empower marine and fisheries professionals worldwide.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {whatWeDo.map(({ label, desc, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-border p-4">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-marine/10 text-marine"><Icon className="h-5 w-5" /></span>
                    <h3 className="mt-3 text-sm font-bold text-navy">{label}</h3>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionHeader title="Roadmap 2026–2030" action={null} />
              <ol className="grid gap-5 sm:grid-cols-3 lg:grid-cols-5">
                {roadmap.map((r) => (
                  <li key={r.year} className="text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-marine/10 text-marine"><r.icon className="h-5 w-5" /></div>
                    <p className="mt-2 font-display text-base font-extrabold text-navy">{r.year}</p>
                    <p className="text-sm font-semibold text-marine">{r.title}</p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{r.desc}</p>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel>
              <SectionHeader title="Impact & Outcomes (2026)" action={null} />
              <ul className="space-y-4">
                {outcomes.map((o) => (
                  <li key={o.title} className="flex gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine"><o.icon className="h-5 w-5" /></span>
                    <div>
                      <p className="font-display text-lg font-extrabold leading-none text-navy">{o.value} <span className="text-sm font-bold">{o.title}</span></p>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground">{o.desc}</p>
                    </div>
                  </li>
                ))}
                <li className="flex gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine"><Handshake className="h-5 w-5" /></span>
                  <div>
                    <p className="text-sm font-bold text-navy">Growing Partnership Network</p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">Building initial partnerships with institutions and organizations.</p>
                  </div>
                </li>
              </ul>
            </Panel>

            <Panel>
              <SectionHeader title="Our Commitment" action={null} />
              <p className="text-sm leading-relaxed text-muted-foreground">
                We are committed to diversity, equity, inclusion, and sustainability in everything we do. Together, we can create a better future for our ocean, our fisheries, and the communities that depend on them.
              </p>
            </Panel>

            <Panel>
              <h2 className="font-display text-base font-bold text-navy">Developed by</h2>
              <p className="mt-2 text-xs leading-snug text-muted-foreground">
                Agency for Marine and Fisheries Extension and Human Resources Development, Ministry of Marine Affairs and Fisheries of the Republic of Indonesia.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-marine/10 text-marine"><Building2 className="h-4 w-4" /></span>
                <span className="text-sm font-bold text-navy">BPPSDM KKP</span>
              </div>
              <h3 className="mt-5 font-display text-base font-bold text-navy">Our Partners</h3>
              <p className="mt-1 text-xs text-muted-foreground">Working together for ocean knowledge and capacity building.</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {["UNESCO", "UNDP", "WorldFish"].map((p) => (
                  <div key={p} className="flex h-12 items-center justify-center rounded-lg border border-border bg-secondary/50 text-[0.65rem] font-bold uppercase text-navy/70">{p}</div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
