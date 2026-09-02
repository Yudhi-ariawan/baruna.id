import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Users, GraduationCap, Award, Globe, BookOpen, CalendarDays, MessagesSquare, Handshake } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { getPublicAnalytics, DEMO_CATEGORIES, plhgByCategory, DEMO_SHORT_COURSES, LEVEL_LABEL } from "@/data/demo";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Impact Analytics — BARUNA" },
      { name: "description", content: "BARUNA public impact dashboard: participants, trainers, modules, courses, events, and countries reached." },
      { property: "og:title", content: "Impact Analytics — BARUNA" },
      { property: "og:description", content: "Demo analytics for the BARUNA network." },
    ],
    links: [{ rel: "canonical", href: "/analytics" }],
  }),
  component: AnalyticsPage,
});

function fmt(n: number) { return n.toLocaleString(); }

function AnalyticsPage() {
  const a = getPublicAnalytics();

  const tiles: { label: string; value: string; to?: string; icon: React.ElementType }[] = [
    { label: "Registered Participants", value: fmt(a.registeredParticipants), icon: Users, to: "/academy" },
    { label: "Active Learners", value: fmt(a.activeLearners), icon: GraduationCap, to: "/academy/self-paced" },
    { label: "Unique Successful Participants", value: fmt(a.uniqueSuccessfulParticipants), icon: Award, to: "/academy/self-paced" },
    { label: "Countries Reached", value: fmt(a.countriesReached), icon: Globe, to: "/academy/alumni" },
    { label: "Verified Experts", value: fmt(a.verifiedExperts), icon: Users, to: "/experts/directory" },
    { label: "Approved BARUNA Trainers", value: fmt(a.approvedTrainers), icon: Award, to: "/experts/recognition" },
    { label: "Approved Modules", value: fmt(a.approvedModules), icon: BookOpen, to: "/knowledge-hub" },
    { label: "Published Self-Paced Courses", value: fmt(a.publishedShortCourses), icon: BookOpen, to: "/academy/self-paced" },
    { label: "Full Training Programs", value: fmt(a.fullTrainingPrograms), icon: GraduationCap, to: "/academy/programs" },
    { label: "Certificates Issued", value: fmt(a.certificatesIssued), icon: Award, to: "/academy/certification" },
    { label: "Participant Learning Hours Generated", value: fmt(a.participantLearningHoursGenerated), icon: BarChart3 },
    { label: "Events Conducted", value: fmt(a.eventsConducted), icon: CalendarDays, to: "/events" },
    { label: "Community Members", value: fmt(a.communityMembers), icon: MessagesSquare, to: "/community" },
    { label: "Knowledge Resources", value: fmt(a.knowledgeResources), icon: BookOpen, to: "/knowledge-hub" },
    { label: "Active Partners", value: fmt(a.activePartners), icon: Handshake, to: "/partnership" },
    { label: "Fellowship Participants", value: fmt(a.fellowshipParticipants), icon: Globe, to: "/fellowship" },
    { label: "Alumni", value: fmt(a.alumni), icon: Users, to: "/academy/alumni" },
    { label: "Training Archive Records", value: fmt(a.trainingArchiveRecords), icon: BookOpen, to: "/academy/archive" },
  ];

  return (
    <PageShell
      sidebar={{ title: "Impact Analytics", subtitle: "Demo Analytics — every number is derived from the shared demo dataset.", icon: BarChart3, sections: [{ label: "Sections", items: [
        { label: "Impact Dashboard", to: "/analytics", active: true },
        { label: "Self-Paced Courses", to: "/academy/self-paced" },
        { label: "Experts Directory", to: "/experts/directory" },
        { label: "Alumni", to: "/academy/alumni" },
        { label: "Training Archive", to: "/academy/archive" },
      ] }] }}
      cta={{ icon: BarChart3, title: "Drill into any number", description: "Every tile links to the underlying records.", button: "Browse Self-Paced Courses", href: "/academy/self-paced" }}
    >
      <div className="space-y-8">
        <header>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-amber-700">Demo Analytics</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-navy">BARUNA Public Impact Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">All figures are computed from the shared demonstration dataset and update automatically when underlying records change.</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((t) => {
            const inner = (
              <>
                <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                  <t.icon className="h-3.5 w-3.5 text-marine" /> {t.label}
                </div>
                <p className="mt-2 font-display text-3xl font-extrabold text-navy">{t.value}</p>
              </>
            );
            return t.to ? (
              <a key={t.label} href={t.to} className="rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-marine/50 hover:shadow-md">{inner}</a>
            ) : (
              <div key={t.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">{inner}</div>
            );
          })}
        </div>

        <section id="by-category" className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Participant Learning Hours Generated — by Category</h2>
          <div className="mt-4 space-y-2">
            {DEMO_CATEGORIES.map((c) => {
              const plhg = plhgByCategory(c.slug);
              const sc = DEMO_SHORT_COURSES.find((x) => x.category === c.slug)!;
              return (
                <Link key={c.slug} to="/academy/category/$slug" params={{ slug: c.slug }} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-marine/50">
                  <span className="font-semibold text-navy">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{sc.instructionalHours} IH × {fmt(sc.usp)} USP = <strong className="text-marine">{fmt(plhg)}</strong> PLHG</span>
                </Link>
              );
            })}
            <div className="flex items-center justify-between rounded-lg bg-marine/10 p-3 text-sm">
              <span className="font-bold text-navy">Total</span>
              <span className="font-bold text-marine">{fmt(a.participantLearningHoursGenerated)} PLHG</span>
            </div>
          </div>
        </section>

        <section id="by-level" className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Trainer Recognition Distribution</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {(["certified", "advanced", "senior", "master"] as const).map((lvl) => (
              <Link key={lvl} to="/experts/recognition" className="rounded-xl border border-border p-4 text-center hover:border-marine/50">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{LEVEL_LABEL[lvl]}</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-navy">{a.levelDistribution[lvl]}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
