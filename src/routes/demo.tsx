import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  GraduationCap,
  Info,
  Layers,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import {
  DEMO_CATEGORIES,
  DEMO_EXPERTS,
  DEMO_MODULES,
  DEMO_SHORT_COURSES,
  DEMO_PARTICIPANTS,
  LEVEL_LABEL,
  LEVEL_THRESHOLD,
  levelDistribution,
  totalPLHG,
  totalUsp,
  participantsByCourse,
  getModuleByCode,
  type DemoCategorySlug,
  type TrainerLevel,
} from "@/data/demo";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "BARUNA Demonstration Environment — Synthetic Data" },
      {
        name: "description",
        content:
          "Connected demonstration of BARUNA's Expert → Trainer → Module → Self-Paced Course → Participant → Certificate → Recognition workflow. All records are synthetic.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "BARUNA Demonstration Environment" },
      { property: "og:description", content: "Synthetic demonstration data — not real BARUNA records." },
    ],
    links: [{ rel: "canonical", href: "/demo" }],
  }),
  component: DemoHub,
});

const LEVEL_STYLE: Record<TrainerLevel, string> = {
  certified: "bg-badge-course/15 text-badge-course border-badge-course/30",
  advanced: "bg-marine/15 text-marine border-marine/30",
  senior: "bg-accent/25 text-accent-foreground border-accent/40",
  master: "bg-success/15 text-success border-success/30",
};

function DemoHub() {
  const [catFilter, setCatFilter] = useState<"" | DemoCategorySlug>("");
  const [levelFilter, setLevelFilter] = useState<"" | TrainerLevel>("");

  const dist = levelDistribution();
  const usp = totalUsp();
  const plhg = totalPLHG();

  const filteredExperts = useMemo(() => {
    return DEMO_EXPERTS.filter(
      (e) => (!catFilter || e.category === catFilter) && (!levelFilter || e.level === levelFilter),
    );
  }, [catFilter, levelFilter]);

  const reset = () => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Reset the demonstration environment?\n\nThis clears local demo progress (short-course enrollments, application state, presentation-mode flag). No production data is affected.",
    );
    if (!ok) return;
    for (const key of [
      "baruna:short-courses",
      "baruna:demo-mode",
      "baruna:applications",
      "baruna:training-requests",
      "baruna:expert-requests",
      "baruna:expert-registrations",
      "baruna:resources",
    ]) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
    window.alert("Demonstration data reset. Reload any open tab to see the clean state.");
  };

  return (
    <PageShell
      sidebar={{
        title: "Demonstration Hub",
        subtitle: "Synthetic data for presentations.",
        icon: Sparkles,
        sections: [
          {
            label: "Related",
            items: [
              { label: "Expert Directory", to: "/experts/directory", icon: Users },
              { label: "Self-Paced Courses", to: "/academy/self-paced", icon: BookOpen },
              { label: "Trainer Recognition", to: "/experts/recognition", icon: Award },
              { label: "Analytics", to: "/analytics", icon: Layers },
              { label: "Alumni Network", to: "/academy/alumni-network", icon: GraduationCap },
              { label: "Academy Home", to: "/academy", icon: GraduationCap },
            ],
          },
        ],
      }}
      cta={{
        icon: ShieldAlert,
        title: "Not real BARUNA records",
        description:
          "Every profile, participant, statistic, badge and certificate on this page is synthetic demonstration data.",
        button: "Open Expert Directory",
        href: "/experts/directory",
      }}
    >
      <div className="space-y-8">
        {/* Global demo banner */}
        <div className="rounded-2xl border-2 border-dashed border-amber-500/60 bg-amber-500/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-700">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-widest text-amber-700">
                  Synthetic Demonstration Data
                </p>
                <h1 className="font-display text-2xl font-extrabold text-navy">
                  BARUNA Demonstration Environment
                </h1>
              </div>
            </div>
            <span className="rounded-full bg-amber-500 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-white">
              DEMO DATA
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-foreground/80">
            This page walks through the full{" "}
            <strong>
              Training Category → Verified Expert → Approved Trainer → Approved Module → Published
              Self-Paced Course → Synthetic Participants → Certificate of Training Delivery → Recognition
              Level
            </strong>{" "}
            chain. Names, organisations, ratings, participant counts and certificates on this page
            are <em>fictional</em>. Do not present them as real BARUNA achievements.
          </p>
        </div>

        {/* Overview stats */}
        <section id="overview" className="space-y-3">
          <SectionTitle icon={Layers} title="Demonstration Dashboard" subtitle="Verified from the master synthetic records." />
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Demo Experts" value={String(DEMO_EXPERTS.length)} />
            <Stat label="Verified Experts" value={String(DEMO_EXPERTS.length)} />
            <Stat label="Approved Trainers" value={String(DEMO_EXPERTS.length)} />
            <Stat label="Approved Modules" value={String(DEMO_MODULES.length)} />
            <Stat label="Published Self-Paced Courses" value={String(DEMO_SHORT_COURSES.length)} />
            <Stat label="Visible Sample Participants" value={String(DEMO_PARTICIPANTS.length)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <BigStat label="Synthetic Successful Participants" value={usp.toLocaleString()} />
            <BigStat label="Participant Learning Hours Generated" value={`${plhg.toLocaleString()} h`} />
            <BigStat
              label="Recognition Distribution"
              value={`${dist.certified} · ${dist.advanced} · ${dist.senior} · ${dist.master}`}
              hint="Certified · Advanced · Senior · Master"
            />
          </div>
          <p className="text-[0.7rem] italic text-muted-foreground">
            Participant Learning Hours Generated = Instructional Hours × Unique Successful Participants.
            It is <strong>not</strong> the trainer's teaching hours.
          </p>
        </section>

        {/* Pathway */}
        <section id="pathway" className="space-y-3">
          <SectionTitle icon={Trophy} title="Trainer Recognition Pathway" subtitle="Recognition is never awarded automatically — quality gates must also be verified." />
          <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {[
              { step: "1", label: "Verified BARUNA Expert", detail: "Identity & credentials confirmed." },
              { step: "2", label: "Approved BARUNA Trainer", detail: "Passed trainer qualification." },
              { step: "3", label: "Module Submitted → Approved", detail: "Passes Admin, Academic, QA & Digital review." },
              { step: "4", label: "Self-Paced Course Published", detail: "Available in the Academy catalogue." },
              { step: "5", label: `≥ ${LEVEL_THRESHOLD.certified} USP → Certified`, detail: "First delivered cohort." },
              { step: "6", label: `≥ ${LEVEL_THRESHOLD.advanced} USP → Advanced`, detail: "Multi-cohort consistency." },
              { step: "7", label: `≥ ${LEVEL_THRESHOLD.senior} USP → Senior`, detail: "Sustained large-scale reach." },
              { step: "8", label: "> 10,000 USP → Master", detail: "Reviewed by the demo panel." },
            ].map((s) => (
              <li key={s.step} className="rounded-xl border border-border bg-card p-3 shadow-soft">
                <p className="text-[0.6rem] font-bold uppercase tracking-widest text-marine">Stage {s.step}</p>
                <p className="mt-1 font-display text-sm font-bold text-navy">{s.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Recognition summary */}
        <section id="recognition" className="space-y-3">
          <SectionTitle icon={Award} title="Recognition Summary — All 9 Demo Trainers" subtitle="Level derived from synthetic Unique Successful Participants." />
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Trainer</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">USP</th>
                  <th className="px-3 py-2 text-right">IH</th>
                  <th className="px-3 py-2 text-right">PLHG</th>
                  <th className="px-3 py-2 text-right">Rating</th>
                  <th className="px-3 py-2 text-right">Completion</th>
                  <th className="px-3 py-2">Recognition</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_EXPERTS.map((e) => {
                  const cat = DEMO_CATEGORIES.find((c) => c.slug === e.category)!;
                  return (
                    <tr key={e.id} className="border-t border-border/60">
                      <td className="px-3 py-2 font-medium text-navy">{e.fullName}</td>
                      <td className="px-3 py-2 text-xs text-foreground/70">{cat.name}</td>
                      <td className="px-3 py-2 text-right font-mono">{e.usp.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono">{e.instructionalHours}h</td>
                      <td className="px-3 py-2 text-right font-mono">{(e.usp * e.instructionalHours).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono">{e.averageRating.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{e.completionRatePct}%</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.65rem] font-bold ${LEVEL_STYLE[e.level]}`}>
                          <Award className="h-3 w-3" /> {LEVEL_LABEL[e.level]}
                          <span className="ml-1 rounded bg-white/60 px-1 text-[0.55rem] font-bold text-foreground/70">DEMO</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Filters + Expert grid */}
        <section id="experts" className="space-y-3">
          <SectionTitle icon={Users} title="Demo Expert Directory" subtitle="Every card is a Demo Expert Profile." />
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-soft">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value as DemoCategorySlug | "")} className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
              <option value="">All categories</option>
              {DEMO_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as TrainerLevel | "")} className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
              <option value="">All recognition levels</option>
              {(["certified", "advanced", "senior", "master"] as TrainerLevel[]).map((l) => (
                <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
              ))}
            </select>
            <span className="ml-auto text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {filteredExperts.length} of {DEMO_EXPERTS.length} experts
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredExperts.map((e) => {
              const cat = DEMO_CATEGORIES.find((c) => c.slug === e.category)!;
              const course = DEMO_SHORT_COURSES.find((c) => c.trainerId === e.id)!;
              return (
                <article key={e.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-amber-700">
                      Demo Profile
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 text-[0.6rem] font-bold ${LEVEL_STYLE[e.level]}`}>
                      {LEVEL_LABEL[e.level]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-marine/10 font-display text-lg font-bold text-marine">
                      {e.fullName.split(" ").slice(-1)[0][0]}
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold leading-tight text-navy">{e.fullName}</h3>
                      <p className="text-xs font-medium text-marine">{e.title}</p>
                      <p className="text-[0.7rem] text-muted-foreground">{e.organization} · {e.country}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`rounded-md px-2 py-0.5 text-[0.6rem] font-semibold ${cat.colorClass}`}>{cat.name}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-eco-community/10 px-2 py-0.5 text-[0.6rem] font-bold text-eco-community">
                      <BadgeCheck className="h-3 w-3" /> Verified Expert
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-marine/10 px-2 py-0.5 text-[0.6rem] font-bold text-marine">
                      <GraduationCap className="h-3 w-3" /> Approved Trainer
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-foreground/70">{e.bio}</p>

                  <div className="mt-3 rounded-xl border border-border bg-background p-3">
                    <p className="text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">Demo Self-Paced Course</p>
                    <p className="mt-0.5 text-sm font-bold text-navy">{course.title}</p>
                    <p className="font-mono text-[0.65rem] text-muted-foreground">{course.code}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-1 text-[0.7rem]">
                      <MiniStat label="IH" value={`${course.instructionalHours}h`} />
                      <MiniStat label="USP" value={course.usp.toLocaleString()} />
                      <MiniStat label="Rating" value={course.averageRating.toFixed(1)} />
                      <MiniStat label="Completion" value={`${course.completionRatePct}%`} />
                    </dl>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Short course catalogue */}
        <section id="courses" className="space-y-3">
          <SectionTitle icon={BookOpen} title="Demo Self-Paced Course Catalogue" subtitle="Nine published demonstration courses." />
          <div className="grid gap-3 sm:grid-cols-2">
            {DEMO_SHORT_COURSES.map((c) => {
              const mod = getModuleByCode(c.moduleCode)!;
              const trainer = DEMO_EXPERTS.find((e) => e.id === c.trainerId)!;
              return (
                <article key={c.code} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[0.65rem] font-bold text-foreground/70">{c.code}</span>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-amber-700">Demo Course</span>
                  </div>
                  <h3 className="mt-2 font-display text-base font-bold text-navy">{c.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{mod.summary}</p>
                  <p className="mt-2 text-[0.7rem] font-medium text-marine">Trainer: {trainer.fullName}</p>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-[0.7rem]">
                    <MiniStat label="IH" value={`${c.instructionalHours}h`} />
                    <MiniStat label="USP" value={c.usp.toLocaleString()} />
                    <MiniStat label="Rating" value={c.averageRating.toFixed(1)} />
                    <MiniStat label="Cohorts" value={String(c.cohorts)} />
                  </div>
                  <p className="mt-2 text-[0.65rem] italic text-muted-foreground">
                    Module {mod.version} · Last reviewed {mod.lastReviewed}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Participants */}
        <section id="participants" className="space-y-3">
          <SectionTitle icon={Users} title="Sample Synthetic Participants" subtitle="First four per course. Every record is fictional." />
          <div className="space-y-4">
            {DEMO_SHORT_COURSES.map((course) => {
              const rows = participantsByCourse(course.code).slice(0, 4);
              return (
                <div key={course.code} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-display text-sm font-bold text-navy">{course.title}</p>
                      <p className="font-mono text-[0.65rem] text-muted-foreground">{course.code}</p>
                    </div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                      Synthetic Demo Total: {course.usp.toLocaleString()} USP
                    </p>
                  </div>
                  <div className="mt-2 overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1.5">Participant</th>
                          <th className="px-2 py-1.5">Country</th>
                          <th className="px-2 py-1.5">Organization</th>
                          <th className="px-2 py-1.5">Cohort</th>
                          <th className="px-2 py-1.5 text-right">Score</th>
                          <th className="px-2 py-1.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((p) => (
                          <tr key={p.id} className="border-t border-border/60">
                            <td className="px-2 py-1.5 font-medium text-navy">{p.fullName}</td>
                            <td className="px-2 py-1.5">{p.country}</td>
                            <td className="px-2 py-1.5 text-foreground/70">{p.organization}</td>
                            <td className="px-2 py-1.5 font-mono text-[0.65rem]">{p.cohort}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{p.finalPct ?? p.quizPct ?? "—"}</td>
                            <td className="px-2 py-1.5 text-[0.65rem] font-semibold text-marine">{p.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Certificates */}
        <section id="certificates" className="space-y-3">
          <SectionTitle icon={FileText} title="Sample Certificates of Training Delivery" subtitle="One preview per trainer — SAMPLE — NOT VALID." />
          <div className="grid gap-4 lg:grid-cols-2">
            {DEMO_EXPERTS.map((e) => {
              const course = DEMO_SHORT_COURSES.find((c) => c.trainerId === e.id)!;
              const mod = getModuleByCode(e.moduleCode)!;
              const certNo = `DEMO-BARUNA-2026-${e.moduleCode.split("-")[1]}-${e.id.replace("e", "").padStart(4, "0")}`;
              return (
                <article key={e.id} className="relative overflow-hidden rounded-2xl border-2 border-navy/10 bg-gradient-to-br from-marine/5 to-transparent p-5 shadow-soft">
                  <Award className="absolute -right-6 -top-6 h-32 w-32 text-marine/5" />
                  <p className="text-[0.55rem] font-bold uppercase tracking-widest text-rose-600">
                    Sample — Not Valid · Demonstration Only
                  </p>
                  <p className="mt-2 text-[0.65rem] font-bold uppercase tracking-widest text-marine">
                    Certificate of Training Delivery
                  </p>
                  <p className="mt-3 text-xs text-foreground/70">Awarded to</p>
                  <p className="font-display text-lg font-extrabold text-navy">{e.fullName}</p>
                  <p className="mt-2 text-xs text-foreground/70">for developing and delivering</p>
                  <p className="text-sm font-bold text-navy">"{course.title}"</p>
                  <p className="mt-2 text-xs text-foreground/70">
                    comprising <strong>{course.instructionalHours} Instructional Hours</strong> and
                    successfully completed by{" "}
                    <strong>{course.usp.toLocaleString()} Unique Successful Participants</strong>.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[0.65rem]">
                    <div>
                      <p className="font-bold uppercase text-muted-foreground">Module</p>
                      <p className="font-mono text-navy">{mod.code} · {mod.version}</p>
                    </div>
                    <div>
                      <p className="font-bold uppercase text-muted-foreground">Recognition</p>
                      <p className="text-navy">{LEVEL_LABEL[e.level]}</p>
                    </div>
                    <div>
                      <p className="font-bold uppercase text-muted-foreground">Certificate No.</p>
                      <p className="font-mono text-navy">{certNo}</p>
                    </div>
                    <div>
                      <p className="font-bold uppercase text-muted-foreground">Issued</p>
                      <p className="text-navy">2026-01-15</p>
                    </div>
                  </div>
                  <button className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-marine/40 px-3 py-1.5 text-[0.7rem] font-semibold text-marine hover:bg-marine hover:text-marine-foreground">
                    <Download className="h-3 w-3" /> Download Sample PDF
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* Reset */}
        <section id="reset" className="rounded-2xl border-2 border-dashed border-rose-400/50 bg-rose-500/5 p-5">
          <SectionTitle icon={RotateCcw} title="Administrator: Reset Demonstration Data" subtitle="Available only during the controlled demonstration environment." />
          <p className="mt-1 max-w-2xl text-sm text-foreground/80">
            Clears local demo state (short-course enrollments, application progress, presentation-mode flag,
            training/expert requests, community submissions). The seeded catalogue above is regenerated at load
            and is <strong>not</strong> affected. No production data is touched.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset Demonstration Environment
            </button>
            <Link to="/experts/recognition" className="inline-flex items-center gap-1.5 text-xs font-semibold text-marine hover:underline">
              <Info className="h-3.5 w-3.5" /> View public Trainer Recognition page
            </Link>
          </div>
        </section>

        <p className="pb-6 text-center text-[0.65rem] italic text-muted-foreground">
          All records above are fictional. Do not combine demonstration data with future verified production
          records. Recognition levels shown are demo-only and do not represent a real BARUNA award.
        </p>
      </div>
    </PageShell>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: typeof Award; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-marine/10 text-marine">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="font-display text-lg font-extrabold text-navy">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
      <p className="font-display text-xl font-extrabold text-navy leading-none">{value}</p>
      <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function BigStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-marine/20 bg-marine/5 p-4">
      <p className="font-display text-3xl font-extrabold text-navy leading-none">{value}</p>
      <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-widest text-marine">{label}</p>
      {hint && <p className="mt-1 text-[0.65rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-1">
      <p className="text-[0.55rem] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xs font-bold text-navy">{value}</p>
    </div>
  );
}

// Silence unused imports (kept for future wiring but not needed at runtime here).
void Clock;
void CheckCircle2;
