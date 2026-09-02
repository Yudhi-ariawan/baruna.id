import { useEffect, useState } from "react";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  CalendarDays,
  MapPin,
  Globe,
  Users,
  Clock,
  Award,
  Star,
  CheckCircle2,
  GraduationCap,
  Plane,
  BookOpen,
  Layers,
  ArrowRight,
  Bookmark,
  HelpCircle,
  Plus,
  Minus,
  Flag,
  Download,
  CalendarPlus,
  ExternalLink,
  Building2,
  FileText,
  ClipboardList,
  Laptop,
  Fish,
  Sparkles,
  Eye,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { trainingBySlug, type TrainingProgram } from "@/data/training";
import { instructorsForProgram } from "@/data/instructors";
import { GroupedInstructorDirectory } from "@/components/baruna/InstructorDirectory";
import { ProgramSeriesNav } from "@/components/baruna/academy/ProgramSeriesNav";
import { Toaster } from "@/components/baruna/Toaster";
import { downloadPdf, downloadScheduleICS, barunaToast } from "@/lib/downloads";

export const Route = createFileRoute("/academy/training/$slug")({
  loader: ({ params }) => {
    const program = trainingBySlug[params.slug];
    if (!program) throw notFound();
    return { program };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.program;
    if (!p) return {};
    const url = `/academy/training/${p.slug}`;
    return {
      meta: [
        { title: `${p.title} — Training — BARUNA` },
        { name: "description", content: p.overview.slice(0, 155) },
        { property: "og:title", content: `${p.title} — Training — BARUNA` },
        { property: "og:description", content: p.overview.slice(0, 155) },
        { property: "og:image", content: p.hero },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <AcademyShell active="training">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Training not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The training program you're looking for doesn't exist.
        </p>
        <Link
          to="/academy/training"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-marine px-4 py-2 text-sm font-semibold text-marine-foreground"
        >
          Browse training <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </AcademyShell>
  ),
  errorComponent: ({ error }) => (
    <AcademyShell active="training">
      <div role="alert" className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <h1 className="font-display text-2xl font-bold text-navy">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </AcademyShell>
  ),
  component: TrainingDetail,
});

const TABS = ["Overview", "Curriculum", "Schedule", "Instructors", "Venue", "Reviews", "FAQs"] as const;
type Tab = (typeof TABS)[number];

const africanCountries = [
  "Nigeria", "Kenya", "Ghana", "Egypt", "Tanzania", "Uganda",
  "Senegal", "Ethiopia", "Morocco", "South Africa", "Zambia", "Mozambique",
];

const journeyIcons = [ClipboardList, Laptop, Plane, BookOpen, FileText, Award];
const journeyTone: Record<string, { box: string; icon: string }> = {
  marine: { box: "bg-marine/10", icon: "text-marine" },
  green: { box: "bg-ocean/10", icon: "text-ocean" },
  amber: { box: "bg-star/25", icon: "text-accent" },
  rose: { box: "bg-accent/10", icon: "text-accent" },
};

// ── Saved-program state (localStorage) ──────────────────────────────────────
const SAVED_KEY = "baruna:saved-training";
function useSaved(slug: string) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      setSaved(list.includes(slug));
    } catch {
      /* ignore */
    }
  }, [slug]);
  const toggle = () => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      const next = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setSaved(next.includes(slug));
      barunaToast(next.includes(slug) ? "Program saved to your list" : "Program removed from your list");
    } catch {
      /* ignore */
    }
  };
  return { saved, toggle };
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

function FaqItem({ q, a, category }: { q: string; a: string; category: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="hidden shrink-0 rounded-md bg-marine/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-marine sm:inline">
            {category}
          </span>
          <span className="text-sm font-bold text-navy">{q}</span>
        </span>
        {open ? (
          <Minus className="h-4 w-4 shrink-0 text-marine" />
        ) : (
          <Plus className="h-4 w-4 shrink-0 text-marine" />
        )}
      </button>
      {open && <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>}
    </div>
  );
}

// ── Sidebar cards ───────────────────────────────────────────────────────────
function BlendedJourneyCard({ p }: { p: TrainingProgram }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-marine" />
        <h3 className="font-display text-base font-bold text-navy">Blended Learning Journey (2026)</h3>
      </div>
      <ol className="mt-4 space-y-0">
        {p.timeline.map((step, i) => {
          const Icon = journeyIcons[i] ?? BookOpen;
          const tone = journeyTone[step.tone] ?? journeyTone.marine;
          return (
            <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
              {i < p.timeline.length - 1 && (
                <span className="absolute left-[17px] top-10 h-[calc(100%-1.5rem)] w-px bg-border" aria-hidden />
              )}
              <span className={`z-10 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone.box} ${tone.icon}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className={`min-w-0 flex-1 rounded-xl ${tone.box} px-3 py-2`}>
                <p className="text-xs font-bold text-navy">{step.title}</p>
                <p className="text-[0.7rem] font-medium text-marine">{step.period}</p>
                {step.items && (
                  <p className="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground">
                    {step.items.join(" · ")}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DownloadCard({
  title,
  description,
  button,
  onClick,
}: {
  title: string;
  description: string;
  button: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-marine/20 bg-marine/5 p-5">
      <h3 className="font-display text-base font-bold text-navy">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      <button
        onClick={onClick}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-marine bg-card py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
      >
        <Download className="h-4 w-4" /> {button}
      </button>
    </div>
  );
}

function TrainingDetail() {
  const { program: p } = Route.useLoaderData() as { program: TrainingProgram };
  const [tab, setTab] = useState<Tab>("Overview");
  const { saved, toggle } = useSaved(p.slug);

  // "Enroll Now" opens the dedicated multi-step application flow (see Enroll button below).

  const downloadCurriculum = () =>
    downloadPdf(
      "baruna-curriculum.pdf",
      "Curriculum — International Training on Fisheries",
      [
        "BARUNA Academy · Blended Training",
        "",
        ...p.curriculum.map((m) => `${m.no}. ${m.module} (${m.hours}h) — ${m.topics}`),
        "",
        `Total learning hours: ${p.curriculum.reduce((s, m) => s + m.hours, 0)}h`,
      ],
    );

  const downloadSchedule = () =>
    downloadPdf(
      "baruna-schedule.pdf",
      "In-Person Schedule — Bali, 21-26 Sep 2026",
      [
        ...p.scheduleDays.map((d) => `Day ${d.day} (${d.date}, ${d.weekday}) · ${d.hours}h — ${d.theme}`),
      ],
    );

  const exportCalendar = () => {
    downloadScheduleICS(
      "baruna-training-schedule.ics",
      p.scheduleDays.map((d) => ({
        dateISO: d.dateISO,
        summary: `Day ${d.day}: ${d.theme}`,
        description: d.activities.join(", "),
      })),
    );
    barunaToast("Calendar file (.ics) downloaded");
  };

  const downloadBrochure = () =>
    downloadPdf("baruna-program-brochure.pdf", p.title, [
      "BARUNA Academy · Blended Training",
      "",
      p.overview,
      "",
      `E-Learning: ${p.elearningPeriod}`,
      `In-Person Training: ${p.inPersonTraining} · ${p.location}`,
      `Application Deadline: ${p.applicationDeadline}`,
      `Certificate: ${p.certificateIssued}`,
    ]);

  const downloadHandbook = () =>
    downloadPdf("baruna-instructor-handbook.pdf", "Instructor Handbook", [
      "Meet the instructors for this program:",
      "",
      ...instructorsForProgram(p.slug).map((i) => `${i.name} — ${i.position}, ${i.organization}`),
    ]);

  const downloadVenue = () =>
    downloadPdf("baruna-venue-information.pdf", p.venue.name, [
      p.venue.agency,
      ...p.venue.addressLines,
      "",
      p.venue.description,
      "",
      "Facilities:",
      ...p.venue.facilities.map((f) => `• ${f}`),
    ]);

  // Right sidebar is tab-aware to match the approved mockups.
  const aside = (
    <>
      {/* Training Information — consistent across every tab */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h3 className="font-display text-base font-bold text-navy">Training Information</h3>
        <div className="mt-3">
          <InfoRow icon={CalendarDays} label="E-Learning Period" value="1–12 Sep 2026" />
          <InfoRow icon={CalendarDays} label="In-Person Training" value="21–26 Sep 2026" />
          <InfoRow icon={Clock} label="Application Deadline" value="31 Jul 2026" />
          <InfoRow icon={Layers} label="Learning Model" value="Cohort-Based" />
          <InfoRow icon={MapPin} label="Location" value="Bali, Indonesia" />
          <InfoRow icon={Globe} label="Language" value="English" />
          <InfoRow icon={Award} label="Certificate" value="Yes" />
          <InfoRow icon={Users} label="Capacity" value="20 Participants" />
        </div>
        <Link
          to="/academy/apply/$slug"
          params={{ slug: p.slug }}
          className="mt-4 block w-full rounded-xl bg-marine py-2.5 text-center text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90"
        >
          Enroll Now
        </Link>
        <button
          onClick={toggle}
          className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
            saved
              ? "border-marine bg-marine text-marine-foreground"
              : "border-marine bg-card text-marine hover:bg-marine hover:text-marine-foreground"
          }`}
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} /> {saved ? "Saved" : "Save Program"}
        </button>
        {p.slug === "international-training-fisheries-african-countries" && (
          <Link
            to="/academy/preview/international-training-fisheries-african-countries"
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-accent bg-accent/10 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Eye className="h-4 w-4" /> Preview Training Experience
          </Link>
        )}
      </div>

      {/* Overview-only: Travel & Visa Support */}
      {tab === "Overview" && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <Plane className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold text-navy">Travel &amp; Visa Support</h3>
              <p className="text-xs text-muted-foreground">{p.travelSupport.period}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {p.travelSupport.includes.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground/80">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blended Learning Journey: Overview / Curriculum / Schedule / Reviews / FAQs */}
      {tab !== "Instructors" && tab !== "Venue" && <BlendedJourneyCard p={p} />}

      {/* Curriculum / Schedule / Reviews / FAQs: Download brochure */}
      {(tab === "Curriculum" || tab === "Schedule" || tab === "Reviews" || tab === "FAQs") && (
        <DownloadCard
          title="Download Brochure"
          description="Get the complete program brochure and share it with your organization."
          button="Download PDF"
          onClick={downloadBrochure}
        />
      )}

      {/* Instructors sidebar */}
      {tab === "Instructors" && (
        <>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="font-display text-base font-bold text-navy">Expertise Coverage</h3>
            <ul className="mt-3 space-y-2.5">
              {p.expertiseCoverage.map((x) => (
                <li key={x} className="flex items-center gap-2.5 text-sm font-medium text-navy">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
                    <Fish className="h-3.5 w-3.5" />
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <h3 className="bg-navy px-5 py-3 font-display text-base font-bold text-navy-foreground">
              Who Will Teach You
            </h3>
            <ul className="divide-y divide-border">
              {p.whoWillTeach.map((w) => (
                <li key={w.area} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">{w.area}</span>
                  <span className="text-right text-xs font-semibold text-navy">{w.instructor}</span>
                </li>
              ))}
            </ul>
          </div>
          <DownloadCard
            title="Download Instructor Handbook"
            description="Get to know more about our instructors and their expertise."
            button="Download PDF"
            onClick={downloadHandbook}
          />
        </>
      )}

      {/* Venue sidebar */}
      {tab === "Venue" && (
        <>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="font-display text-base font-bold text-navy">About the Venue</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.venue.description}</p>
            <ul className="mt-4 space-y-2.5">
              {p.venue.facilities.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-marine" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="font-display text-base font-bold text-navy">Location Map</h3>
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <iframe
                title="Venue location map"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(p.venue.mapQuery)}&z=12&output=embed`}
                className="h-44 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <a
              href={p.venue.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-marine bg-card py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
            >
              Open in Google Maps <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <DownloadCard
            title="Download Venue Information"
            description="Get more details about the venue and facilities."
            button="Download PDF"
            onClick={downloadVenue}
          />
        </>
      )}
    </>
  );

  const breadcrumbTab =
    tab === "Overview" ? p.type : tab === "Schedule" ? "Schedule" : tab === "Reviews" ? "Reviews" : tab === "FAQs" ? "FAQs" : tab;

  return (
    <AcademyShell active="training" aside={aside}>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/training" className="font-medium text-foreground/70 hover:text-marine">Training</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          {tab === "Overview" ? (
            <span className="font-semibold text-navy">{p.type}</span>
          ) : (
            <>
              <button onClick={() => setTab("Overview")} className="font-medium text-foreground/70 hover:text-marine">
                {p.title.length > 40 ? "International Training" : p.title}
              </button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-navy">{breadcrumbTab}</span>
            </>
          )}
        </nav>

        {/* Hero banner */}
        <section className="relative overflow-hidden rounded-3xl border border-border shadow-card">
          <img
            src={p.hero}
            alt="International fisheries training in Bali, Indonesia"
            width={1600}
            height={900}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/70 to-navy/30" />
          <div className="relative flex flex-col gap-5 p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-badge-webinar px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy-foreground">
                {p.badge}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy-foreground backdrop-blur">
                <MapPin className="h-3.5 w-3.5" /> {p.bannerLabel}
              </span>
            </div>
            <div className="max-w-2xl">
              <h1 className="font-display text-2xl font-extrabold leading-tight text-navy-foreground sm:text-4xl">
                {p.title}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-navy-foreground/85 sm:text-base">
                {p.subtitle}
              </p>
            </div>

            {/* Quick info */}
            <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { icon: CalendarDays, label: "E-Learning", value: "1–12 Sep 2026" },
                { icon: MapPin, label: "In-Person (Bali)", value: "21–26 Sep · 6 Days" },
                { icon: Clock, label: "Deadline", value: "31 Jul 2026" },
                { icon: Users, label: "Participants", value: "20 from Africa" },
                { icon: Star, label: "Rating", value: `${p.rating} / 5.0` },
                { icon: BookOpen, label: "Reviews", value: `${p.reviews} Reviews` },
              ].map((q) => (
                <div key={q.label} className="flex items-center gap-2 rounded-xl bg-card/15 p-3 backdrop-blur">
                  <q.icon className="h-4 w-4 shrink-0 text-navy-foreground" />
                  <div className="min-w-0 leading-tight">
                    <p className="text-[0.65rem] text-navy-foreground/75">{q.label}</p>
                    <p className="truncate text-xs font-bold text-navy-foreground">{q.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/academy/apply/$slug"
                params={{ slug: p.slug }}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover"
              >
                Enroll Now <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={toggle}
                className="inline-flex items-center gap-2 rounded-xl border border-navy-foreground/40 bg-card/10 px-6 py-3 text-sm font-semibold text-navy-foreground backdrop-blur transition-colors hover:bg-card/20"
              >
                <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} /> {saved ? "Saved" : "Save Program"}
              </button>
            </div>
          </div>
        </section>

        {/* Program Series — connects the 2026 edition with the completed 2024 edition */}
        {p.slug === "international-training-fisheries-african-countries" && (
          <ProgramSeriesNav active="2026" />
        )}



        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t
                  ? "border-marine bg-marine text-marine-foreground"
                  : "border-border bg-card text-navy hover:border-marine/40"
              }`}
            >
              {t === "Reviews" ? `Reviews (${p.reviews})` : t}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {tab === "Overview" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-xl font-bold text-navy">About This Training</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                This blended training program is designed for fisheries professionals from African countries to
                strengthen their capacity in sustainable aquaculture. Participants will gain practical knowledge
                and hands-on skills from Indonesia's best practices in aquaculture management, biofloc technology,
                hatchery management, feed development, fish health, and value-added processing.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex rounded-full border border-marine/20 bg-marine/5 px-3 py-1.5 text-xs font-semibold text-marine"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-xl font-bold text-navy">For Fisheries Professionals from African Countries</h2>
              <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
                <div className="relative grid place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-marine/10 via-marine/5 to-accent/10 p-8">
                  <Globe className="h-40 w-40 text-marine/30" strokeWidth={1} />
                  <span className="absolute inline-flex items-center gap-1.5 rounded-full bg-marine px-3 py-1.5 text-xs font-bold text-marine-foreground shadow-hover">
                    <Flag className="h-3.5 w-3.5" /> Africa
                  </span>
                </div>
                <div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Participants are selected from fisheries institutions across the African continent, building a
                    network of practitioners committed to sustainable aquaculture. Highlighted partner countries:
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {africanCountries.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-navy"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-marine" /> {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Training Modules preview */}
            <ModulesPreview p={p} onViewCurriculum={() => setTab("Curriculum")} />

            {/* Learning Outcomes */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-xl font-bold text-navy">What You Will Learn</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {p.outcomes.map((o) => (
                  <div key={o} className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/30 p-3.5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-marine" />
                    <p className="text-sm text-foreground/85">{o}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Total duration banner */}
            <section className="rounded-2xl border border-marine/20 bg-marine/5 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marine/15 text-marine">
                  <Clock className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-navy">
                    Total Program Duration: <span className="text-marine">{p.totalDuration}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    12 days e-learning + 8 days preparation + 6 days in-person + 14 days post-course
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Time zone for online sessions: {p.timeZones.join(" / ")}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Tab: Curriculum */}
        {tab === "Curriculum" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-navy">Curriculum Overview</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    This program consists of 13 comprehensive modules covering sustainable aquaculture, hatchery
                    management, biofloc technology, fish health, feed development, and value-added processing. The
                    curriculum is delivered through a combination of e-learning and in-person practical training.
                  </p>
                </div>
                <button
                  onClick={downloadCurriculum}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-marine bg-card px-4 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                >
                  <Download className="h-4 w-4" /> Download PDF
                </button>
              </div>

              <h3 className="mt-6 flex items-center gap-2 font-display text-base font-bold text-navy">
                <BookOpen className="h-4 w-4 text-marine" /> A. Pre-Course E-Learning
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="bg-navy text-navy-foreground">
                      <th className="rounded-l-lg px-4 py-3 text-xs font-bold uppercase tracking-wide">No.</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Module</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Topics</th>
                      <th className="rounded-r-lg px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.curriculum.map((m) => (
                      <tr key={m.no} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-sm font-bold text-marine">{m.no}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-navy">{m.module}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{m.topics}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-navy">
                          <span className="inline-flex items-center gap-1 rounded-md bg-marine/10 px-2 py-0.5 text-xs text-marine">
                            <Clock className="h-3 w-3" /> {m.hours}h
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/40 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <Laptop className="h-4 w-4 text-marine" /> E-Learning Assessment — Pre-test &amp; Country Assignment
                </p>
                <p className="text-sm font-bold text-marine">
                  Total: {p.curriculum.reduce((s, m) => s + m.hours, 0)} learning hours
                </p>
              </div>
            </section>

            {/* Learning Outcomes */}
            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-xl font-bold text-navy">Learning Outcomes</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {p.outcomes.map((o) => (
                  <div key={o} className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/30 p-3.5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-marine" />
                    <p className="text-sm text-foreground/85">{o}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Tab: Schedule */}
        {tab === "Schedule" && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-navy">Schedule</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  In-person training will be conducted in Bali, Indonesia from 21 – 26 September 2026.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportCalendar}
                  className="inline-flex items-center gap-2 rounded-xl border border-marine bg-card px-4 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                >
                  <CalendarPlus className="h-4 w-4" /> Add to Calendar
                </button>
                <button
                  onClick={downloadSchedule}
                  className="inline-flex items-center gap-2 rounded-xl border border-marine bg-card px-4 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                >
                  <Download className="h-4 w-4" /> Download Schedule
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="bg-navy text-navy-foreground">
                    <th className="rounded-l-lg px-4 py-3 text-xs font-bold uppercase tracking-wide">Day</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Theme</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">Key Activities</th>
                    <th className="rounded-r-lg px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {p.scheduleDays.map((d) => (
                    <tr key={d.day} className="border-b border-border align-top last:border-0">
                      <td className="px-4 py-4 text-sm font-bold text-marine">{d.day}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-navy">
                        {d.date}
                        <span className="block text-xs font-normal text-muted-foreground">({d.weekday})</span>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-navy">{d.theme}</td>
                      <td className="px-4 py-4">
                        <ul className="space-y-1">
                          {d.activities.map((a) => (
                            <li key={a} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-marine" /> {a}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right">
                        <span className="inline-flex items-center gap-1 rounded-md bg-marine/10 px-2 py-0.5 text-xs font-semibold text-marine">
                          <Clock className="h-3 w-3" /> {d.hours}h
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-right text-sm font-bold text-marine">
              Total in-person learning hours: {p.scheduleDays.reduce((s, d) => s + d.hours, 0)}h
            </p>
          </section>
        )}

        {/* Tab: Instructors */}
        {tab === "Instructors" && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-2xl font-extrabold text-navy">Meet Your Instructors</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Learn directly from experienced trainers, lecturers, researchers, and practitioners from Indonesia's
              marine and fisheries sector, with extensive experience in training, research, extension services, and
              international capacity-building programs.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Users, value: `${p.instructorStats.instructors}`, label: "Instructors" },
                { icon: Star, value: `${p.instructorStats.experience} Years`, label: "Combined Experience" },
                { icon: Building2, value: `${p.instructorStats.institutions}`, label: "Institutions" },
                { icon: Sparkles, value: `${p.instructorStats.areas}`, label: "Areas of Expertise" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/30 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-marine/10 text-marine">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 leading-tight">
                    <p className="font-display text-base font-extrabold text-navy">{s.value}</p>
                    <p className="text-[0.7rem] text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <GroupedInstructorDirectory list={instructorsForProgram(p.slug)} />
            </div>
            <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5" /> Instructors and topics are subject to change based on final program arrangement.
            </p>
          </section>
        )}

        {/* Tab: Venue */}
        {tab === "Venue" && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-xl font-bold text-navy">Venue</h2>
              <p className="mt-1 text-sm text-muted-foreground">In-person training will be conducted in Bali, Indonesia.</p>

              <img
                src={p.venue.exterior}
                alt={`${p.venue.name} building exterior in Denpasar, Bali`}
                loading="lazy"
                width={1280}
                height={768}
                className="mt-4 h-64 w-full rounded-2xl object-cover sm:h-80"
              />

              <div className="mt-5 grid gap-5 rounded-2xl border border-border bg-secondary/30 p-5 lg:grid-cols-2">
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-marine" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-marine">Venue Address</p>
                    <p className="mt-1 text-sm font-bold text-navy">{p.venue.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.venue.agency}</p>
                    {p.venue.addressLines.map((line) => (
                      <p key={line} className="text-sm font-semibold text-navy">{line}</p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.venue.description}</p>
                  <a
                    href={p.venue.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-marine bg-card px-4 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground"
                  >
                    View on Google Maps <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {p.venue.photos.map((ph) => (
                  <figure key={ph.caption} className="overflow-hidden rounded-2xl border border-border">
                    <img
                      src={ph.src}
                      alt={`${p.venue.name} — ${ph.caption}`}
                      loading="lazy"
                      width={1024}
                      height={768}
                      className="h-40 w-full object-cover"
                    />
                    <figcaption className="bg-card px-3 py-2 text-xs font-semibold text-navy">{ph.caption}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Tab: Reviews */}
        {tab === "Reviews" && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="font-display text-xl font-bold text-navy">Participant Reviews</h2>
              <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="text-center sm:border-r sm:border-border sm:pr-8">
                  <p className="font-display text-5xl font-extrabold text-navy">{p.rating}</p>
                  <div className="mt-1 flex items-center justify-center gap-0.5 text-star">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < Math.round(p.rating) ? "fill-star" : ""}`} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Based on {p.reviews} reviews</p>
                </div>
                <div className="space-y-1.5">
                  {p.ratingBreakdown.map((b) => (
                    <div key={b.stars} className="flex items-center gap-2 text-xs">
                      <span className="w-10 font-semibold text-navy">{b.stars} star</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <span
                          className="block h-full rounded-full bg-star"
                          style={{ width: `${(b.count / p.reviews) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 text-right text-muted-foreground">{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {p.reviewsList.map((r) => (
                <article key={r.name} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-marine/10 font-display text-sm font-bold text-marine">
                        {r.name.charAt(0)}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-navy">{r.name}</p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Flag className="h-3 w-3" /> {r.country} · {r.role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 text-star">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-star" : ""}`} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Tab: FAQs */}
        {tab === "FAQs" && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-marine" />
              <h2 className="font-display text-xl font-bold text-navy">Frequently Asked Questions</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Covering eligibility, application, visa support, accommodation, language, certification, and travel.
            </p>
            <div className="mt-3">
              {p.faqs.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} category={f.category} />
              ))}
            </div>
          </section>
        )}
      </div>
      <Toaster />
    </AcademyShell>
  );
}

function ModulesPreview({
  p,
  onViewCurriculum,
}: {
  p: TrainingProgram;
  onViewCurriculum: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-xl font-bold text-navy">
        Training Modules <span className="text-muted-foreground">({p.modules.length})</span>
      </h2>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {p.modules.map((m, i) => (
          <div key={m} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-marine/10 text-sm font-bold text-marine">
              {i + 1}
            </span>
            <p className="text-sm font-medium text-navy">{m}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onViewCurriculum}
        className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-marine bg-card py-3 text-sm font-semibold text-marine transition-all hover:bg-marine hover:text-marine-foreground"
      >
        View Full Curriculum <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );
}
