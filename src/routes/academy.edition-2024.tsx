import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  CheckCircle2,
  MapPin,
  CalendarDays,
  Users,
  Globe,
  Award,
  BookOpen,
  GraduationCap,
  Image as ImageIcon,
  Play,
  FileText,
  Download,
  Quote,
  Flag,
  Sparkles,
  HelpCircle,
  Search,
  ArrowRight,
  Network,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { ProgramSeriesNav } from "@/components/baruna/academy/ProgramSeriesNav";
import {
  EDITION_2024,
  EDITION_2024_HIGHLIGHTS,
  EDITION_2024_OVERVIEW,
  EDITION_2024_SCHEDULE,
  EDITION_2024_IMPACT,
  EDITION_2024_FAQS,
  GALLERY_CATEGORIES,
  EDITION_2024_VIDEOS,
  EDITION_2024_DOCUMENTS,
  EDITION_2024_TESTIMONIALS,
  ALUMNI_NETWORK_PILLARS,
  alumniByCountry,
  COUNTRY_STATS,
  initials,
} from "@/data/edition2024";
import { trainingBySlug } from "@/data/training";
import { instructorsForProgram, groupInstructors } from "@/data/instructors";
import { downloadPdf } from "@/lib/downloads";
import trainingBali from "@/assets/academy/training-bali.jpg";
import { academyImages } from "@/data/academy";

const TRAINING_SLUG = "international-training-fisheries-african-countries";

export const Route = createFileRoute("/academy/edition-2024")({
  head: () => ({
    meta: [
      { title: "2024 Edition (Completed) — Fisheries Training for African Countries — BARUNA" },
      {
        name: "description",
        content:
          "The first International Training on Fisheries for African Countries, successfully implemented in Indonesia, 7–15 September 2024. 20 alumni from 10 African countries.",
      },
      { property: "og:title", content: "2024 Edition (Completed) — Fisheries Training — BARUNA" },
      {
        property: "og:description",
        content: "First edition completed in Indonesia. 20 alumni · 10 countries · 13 modules · 100% completion.",
      },
      { property: "og:image", content: trainingBali },
      { property: "og:url", content: "/academy/edition-2024" },
    ],
    links: [{ rel: "canonical", href: "/academy/edition-2024" }],
  }),
  component: Edition2024Page,
});

const TABS = [
  "Overview",
  "Curriculum",
  "Schedule",
  "Instructors",
  "Participants",
  "Alumni",
  "Gallery",
  "Videos",
  "Documentation",
  "Impact",
  "Testimonials",
  "FAQs",
] as const;
type Tab = (typeof TABS)[number];

const GALLERY_THUMBS = [
  academyImages.fisheriesWorkers,
  academyImages.aquaculture,
  academyImages.fishProcessing,
  academyImages.coralDiver,
  academyImages.mangrove,
  academyImages.seaTurtle,
  academyImages.marineSpatial,
  academyImages.offshoreWind,
  academyImages.fishingSunset,
];

function CompletedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-success">
      <CheckCircle2 className="h-3.5 w-3.5" /> Completed
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-marine to-ocean text-sm font-bold text-marine-foreground"
    >
      {initials(name)}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-border py-2.5 last:border-0">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-navy">{value}</p>
      </div>
    </div>
  );
}

function Edition2024Page() {
  const [tab, setTab] = useState<Tab>("Overview");
  const program = trainingBySlug[TRAINING_SLUG];
  const curriculum = program?.curriculum ?? [];
  const instructors = instructorsForProgram(TRAINING_SLUG);
  const grouped = groupInstructors(instructors);

  const downloadDoc = (title: string) =>
    downloadPdf(`baruna-2024-${title.toLowerCase().replace(/\s+/g, "-")}.pdf`, `${title} — 2024 Edition`, [
      "International Training on Fisheries for African Countries",
      "First Edition · 7–15 September 2024 · Indonesia",
      "",
      `Document: ${title}`,
      "Status: Completed",
      "",
      "This is a sample export generated from BARUNA Academy.",
    ]);

  const aside = (
    <>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-navy">2024 Edition</h3>
          <CompletedBadge />
        </div>
        <div>
          <InfoRow icon={CheckCircle2} label="Status" value="Completed" />
          <InfoRow icon={MapPin} label="Location" value={EDITION_2024.location} />
          <InfoRow icon={CalendarDays} label="Training Period" value={EDITION_2024.trainingPeriod} />
          <InfoRow icon={Users} label="Participants" value="20 from 10 countries" />
          <InfoRow icon={BookOpen} label="Learning Modules" value="13 (all completed)" />
          <InfoRow icon={Globe} label="Language" value="English" />
          <InfoRow icon={Award} label="Certificate" value="Issued" />
        </div>
        <Link
          to="/academy/alumni"
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-marine py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
        >
          <GraduationCap className="h-4 w-4" /> View Alumni Directory
        </Link>
        <Link
          to="/academy/alumni-network"
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-marine bg-card py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
        >
          <Users className="h-4 w-4" /> Alumni Network
        </Link>
      </div>

      <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
        <h3 className="font-display text-sm font-bold text-navy">Country Distribution</h3>
        <ul className="mt-3 space-y-1.5">
          {COUNTRY_STATS.map((c) => (
            <li key={c.name}>
              <Link
                to="/academy/alumni"
                search={{ country: c.name }}
                className="flex items-center justify-between rounded-lg px-2 py-1 text-sm transition-colors hover:bg-success/10"
              >
                <span className="flex items-center gap-2 text-foreground/80">
                  <Flag className="h-3.5 w-3.5 text-success" /> {c.name}
                </span>
                <span className="font-semibold text-navy">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );

  return (
    <AcademyShell active="training" aside={aside}>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/training" className="font-medium text-foreground/70 hover:text-marine">Training</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">2024 Edition</span>
        </nav>

        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="relative h-48 sm:h-60">
            <img src={trainingBali} alt="2024 edition training" className="h-full w-full object-cover" width={1200} height={480} />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-md bg-marine/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-marine-foreground">
                  {EDITION_2024.series} · 2024
                </span>
                <CompletedBadge />
              </div>
              <h1 className="font-display text-xl font-extrabold text-navy-foreground sm:text-2xl">
                {EDITION_2024.title}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-foreground/85">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {EDITION_2024.location}</span>
                <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {EDITION_2024.trainingPeriod}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Program Series switcher */}
        <ProgramSeriesNav active="2024" />

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t ? "bg-marine text-marine-foreground" : "border border-border bg-card text-navy hover:border-marine/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ---------- Overview ---------- */}
        {tab === "Overview" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Program Overview</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{EDITION_2024_OVERVIEW}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {EDITION_2024_HIGHLIGHTS.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1.5 rounded-full bg-marine/10 px-3 py-1.5 text-xs font-semibold text-marine">
                    <Sparkles className="h-3 w-3" /> {h}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {EDITION_2024_IMPACT.slice(0, 4).map((s) => (
                <div key={s.label} className="rounded-2xl border border-border bg-card p-5 text-center shadow-soft">
                  <p className="font-display text-3xl font-extrabold text-marine">{s.value}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Curriculum ---------- */}
        {tab === "Curriculum" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-navy">Curriculum</h2>
              <CompletedBadge />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              The same 13-module curriculum delivered in the program series — all modules completed by the 2024 cohort.
            </p>
            <ul className="mt-5 space-y-2.5">
              {curriculum.map((m) => (
                <li key={m.no} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-navy">{m.no}. {m.module}</p>
                    <p className="text-xs text-muted-foreground">{m.topics}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">{m.hours}h</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ---------- Schedule ---------- */}
        {tab === "Schedule" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-navy">Training Schedule</h2>
              <CompletedBadge />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Official agenda · {EDITION_2024.trainingPeriod}</p>
            <ol className="mt-5 space-y-0">
              {EDITION_2024_SCHEDULE.map((d, i) => (
                <li key={d.day} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < EDITION_2024_SCHEDULE.length - 1 && (
                    <span className="absolute left-[19px] top-11 h-[calc(100%-2rem)] w-px bg-border" aria-hidden />
                  )}
                  <span className="z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-navy">Day {d.day} — {d.phase}</p>
                      <span className="text-xs font-medium text-muted-foreground">{d.weekday}, {d.date}</span>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {d.activities.map((a) => (
                        <li key={a} className="rounded-md bg-marine/8 px-2 py-1 text-[0.7rem] font-medium text-marine">
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ---------- Instructors ---------- */}
        {tab === "Instructors" && (
          <div className="space-y-5">
            {grouped.map((g) => (
              <div key={g.group} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="font-display text-base font-bold text-navy">{g.group}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {g.items.map((ins) => (
                    <div key={ins.slug} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5">
                      <img src={ins.photo} alt={ins.name} loading="lazy" width={56} height={56} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy">{ins.name}</p>
                        <p className="text-xs font-medium text-marine">{ins.position}</p>
                        <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{ins.organization}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- Participants ---------- */}
        {tab === "Participants" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Participant Directory</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                20 officials from 10 African countries — grouped by country. All completed the program.
              </p>
            </div>
            {alumniByCountry().map((group) => (
              <div key={group.country} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="mb-3 flex items-center gap-2">
                  <Flag className="h-4 w-4 text-marine" />
                  <h3 className="font-display text-base font-bold text-navy">{group.country}</h3>
                  <span className="rounded-full bg-marine/10 px-2 py-0.5 text-xs font-semibold text-marine">
                    {group.items.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.items.map((p) => (
                    <Link
                      key={p.id}
                      to="/academy/alumni/$id"
                      params={{ id: p.id }}
                      className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5 transition-colors hover:border-marine/40"
                    >
                      <Avatar name={p.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-navy">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.organization}</p>
                        <p className="truncate text-[0.7rem] text-muted-foreground">{p.department}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[0.6rem] font-semibold text-foreground/70">2024</span>
                          <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase text-success">
                            <CheckCircle2 className="h-3 w-3" /> Completed
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- Alumni ---------- */}
        {tab === "Alumni" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-lg font-bold text-navy">Alumni Network</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The graduating cohort of the first edition — now part of the BARUNA African Fisheries Alumni Network.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {[
                  { value: "20", label: "Alumni" },
                  { value: "10", label: "African Countries" },
                  { value: "2024", label: "Training Year" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-border bg-background p-5 text-center">
                    <p className="font-display text-3xl font-extrabold text-marine">{s.value}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/academy/alumni"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
                >
                  <Search className="h-4 w-4" /> Search Alumni Directory
                </Link>
                <Link
                  to="/academy/alumni-network"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-marine bg-card px-5 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                >
                  <Network className="h-4 w-4" /> Alumni Network
                </Link>
              </div>
            </div>

            {/* Countries */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h3 className="font-display text-base font-bold text-navy">Countries</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a country to filter the Alumni Directory.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {COUNTRY_STATS.map((c) => (
                  <Link
                    key={c.name}
                    to="/academy/alumni"
                    search={{ country: c.name }}
                    className="group flex items-center justify-between rounded-xl border border-border bg-background p-4 transition-colors hover:border-marine/40"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-marine/10 text-marine">
                        <Flag className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-bold text-navy">{c.name}</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      {c.count} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Network pillars */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h3 className="font-display text-base font-bold text-navy">African Fisheries Alumni Network</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {ALUMNI_NETWORK_PILLARS.map((p) => (
                  <div key={p.title} className="rounded-xl border border-border bg-background p-4">
                    <p className="text-sm font-bold text-navy">{p.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


        {/* ---------- Impact ---------- */}
        {tab === "Impact" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-navy">Program Impact</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {EDITION_2024_IMPACT.map((s) => (
                <div key={s.label} className="rounded-2xl border border-border bg-background p-5 text-center">
                  <p className="font-display text-3xl font-extrabold text-marine">{s.value}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Gallery ---------- */}
        {tab === "Gallery" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-navy">Photo Gallery</h2>
            <p className="mt-1 text-sm text-muted-foreground">Browse documentation by category.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GALLERY_CATEGORIES.map((c, i) => (
                <div key={c.name} className="group overflow-hidden rounded-xl border border-border bg-background">
                  <div className="relative h-32 overflow-hidden">
                    <img src={GALLERY_THUMBS[i % GALLERY_THUMBS.length]} alt={c.name} loading="lazy" width={400} height={256} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-navy/80 px-2 py-0.5 text-[0.6rem] font-bold text-navy-foreground">
                      <ImageIcon className="h-3 w-3" /> {c.count}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-bold text-navy">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.count} photos</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Videos ---------- */}
        {tab === "Videos" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-navy">Videos</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {EDITION_2024_VIDEOS.map((v, i) => (
                <div key={v.title} className="overflow-hidden rounded-xl border border-border bg-background">
                  <div className="relative grid h-36 place-items-center bg-navy/90">
                    <img src={GALLERY_THUMBS[i % GALLERY_THUMBS.length]} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-30" />
                    <span className="z-10 grid h-12 w-12 place-items-center rounded-full bg-marine text-marine-foreground shadow-hover">
                      <Play className="h-5 w-5 fill-current" />
                    </span>
                    <span className="absolute bottom-2 right-2 z-10 rounded bg-navy/80 px-1.5 py-0.5 text-[0.65rem] font-semibold text-navy-foreground">{v.duration}</span>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-bold text-navy">{v.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Documentation ---------- */}
        {tab === "Documentation" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-navy">Documentation Library</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {EDITION_2024_DOCUMENTS.map((d) => (
                <div key={d.title} className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-navy">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.desc}</p>
                    <button
                      onClick={() => downloadDoc(d.title)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-marine hover:text-navy"
                    >
                      <Download className="h-3.5 w-3.5" /> Download {d.meta}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Testimonials ---------- */}
        {tab === "Testimonials" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {EDITION_2024_TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <Quote className="h-6 w-6 text-marine/40" />
                <p className="mt-2 text-sm italic leading-relaxed text-foreground/85">"{t.quote}"</p>
                <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                  <Avatar name={t.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.country} · {t.organization}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- FAQs ---------- */}
        {tab === "FAQs" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-navy">Frequently Asked Questions</h2>
            <div className="mt-5 space-y-3">
              {EDITION_2024_FAQS.map((f) => (
                <details key={f.q} className="group rounded-xl border border-border bg-background p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-navy">
                    <span className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 shrink-0 text-marine" /> {f.q}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 pl-6 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>

    </AcademyShell>
  );
}
