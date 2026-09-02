import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  BarChart3,
  Globe,
  MapPin,
  Star,
  Users,
  Layers,
  Sparkles,
  GraduationCap,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { programsByType, type Program } from "@/data/programs";
import { MINUTES_PER_JP, masterByCode } from "@/data/masterModules";
import { useShortCourses } from "@/lib/shortCourses";

export const Route = createFileRoute("/academy/self-paced")({
  head: () => ({
    meta: [
      { title: "Self-Paced Courses — Standalone Learning Modules — BARUNA Academy" },
      {
        name: "description",
        content:
          "Every BARUNA module can be taken as a Self-Paced Course. Completions are recognised as credit inside Full Training Programs.",
      },
      { property: "og:title", content: "Self-Paced Courses — BARUNA Academy" },
      {
        property: "og:description",
        content: "Standalone modules with credit recognition toward Full Training Programs.",
      },
    ],
    links: [{ rel: "canonical", href: "/academy/self-paced" }],
  }),
  component: SelfPacedIndex,
});

/** Resolve the Master Module code (if any) for a Self-Paced program. */
function masterCodeFor(p: Program): string | undefined {
  // Module-based programs use `sp-mNN` ids and embed the code as href suffix.
  if (p.href.startsWith("/academy/self-paced/BARUNA-")) {
    return p.href.split("/").pop();
  }
  return undefined;
}

function SelfPacedIndex() {
  const catalog = programsByType("self-paced");
  const { isCompleted, get } = useShortCourses();

  const enrichedCount = catalog.reduce(
    (acc, p) => {
      const code = masterCodeFor(p);
      const enrolled = code ? !!get(code) : false;
      const done = code ? isCompleted(code) : false;
      if (enrolled) acc.enrolled += 1;
      if (done) acc.completed += 1;
      return acc;
    },
    { enrolled: 0, completed: 0 },
  );

  return (
    <AcademyShell active="self-paced">
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-marine/10 text-marine">
              <BookOpen className="h-5 w-5" />
            </span>
            <span className="rounded-md bg-marine/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-marine">
              Self-Paced Learning
            </span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-navy">Self-Paced Courses</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every BARUNA module can be accessed independently as a Self-Paced Course. Complete a Self-Paced
            Course and the result will be recognised as{" "}
            <strong className="text-navy">credit</strong> when you enrol in a Full Training Program that
            includes the same module, so you do not need to retake it.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Courses Available" value={String(catalog.length)} icon={Layers} />
            <Stat label="Enrolled" value={String(enrichedCount.enrolled)} icon={BookOpen} />
            <Stat label="Completed" value={String(enrichedCount.completed)} icon={CheckCircle2} />
          </div>
        </div>

        {/* Callout */}
        <div className="rounded-2xl border border-marine/30 bg-marine/5 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-marine/15 text-marine">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-navy">Credit Recognition</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Self-Paced Courses that share a Master Module with a{" "}
                <Link
                  to="/academy/training/$slug"
                  params={{ slug: "international-training-fisheries-african-countries" }}
                  className="font-semibold text-marine hover:underline"
                >
                  Full Training Program
                </Link>{" "}
                will appear as recognised learning credit in your learning dashboard once completed.
              </p>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.map((p) => (
            <CourseCard key={p.id} program={p} completed={isCompletedFor(p, isCompleted)} />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          1 JP (Jam Pelajaran) = {MINUTES_PER_JP} minutes · consistent across Self-Paced Courses and Full
          Training Programs.
        </p>
      </div>
    </AcademyShell>
  );
}

function isCompletedFor(p: Program, isCompleted: (code: string) => boolean): boolean {
  const code = masterCodeFor(p);
  return code ? isCompleted(code) : false;
}

function CourseCard({ program, completed }: { program: Program; completed: boolean }) {
  const code = masterCodeFor(program);
  const master = code ? masterByCode[code] : undefined;
  const badge = master?.subCategory ?? program.category;
  // Every self-paced program routes through the shared detail route
  // /academy/self-paced/$code — for module-derived courses `$code` is the
  // Master Module code (BARUNA-…), for the 7 illustrated standalone courses
  // it is the program id (sp-01…sp-07). The detail loader resolves both.
  const routeParam = code ?? program.id;

  return (
    <Link
      to="/academy/self-paced/$code"
      params={{ code: routeParam }}
      aria-label={`Open Self-Paced Course: ${program.title}`}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-marine/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marine focus-visible:ring-offset-2"
    >

      {/* Hero */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        <img
          src={program.image}
          alt={program.title}
          loading="lazy"
          width={1280}
          height={720}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-marine shadow-sm ring-1 ring-marine/20">
          Online
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-marine px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-white shadow-sm">
          Self-Paced
        </span>
        {completed && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-white shadow-sm">
            <CheckCircle2 className="h-3 w-3" /> Completed
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-base font-bold text-navy transition-colors group-hover:text-marine">
          {program.title}
        </h3>
        <p className="mt-1 text-xs font-medium text-marine">{program.category}</p>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{program.description}</p>

        {/* Row 1: meta */}
        <div className="mt-4 grid grid-cols-2 gap-y-2 border-t border-border pt-3 text-xs text-foreground/80">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-marine" />
            {program.duration}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-marine" />
            {program.level}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-marine" />
            {program.language}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-marine" />
            {program.country}
          </span>
        </div>

        {/* Row 2: category badge + trainer */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-marine/10 px-2 py-0.5 font-semibold text-marine">{badge}</span>
          <span className="text-muted-foreground">
            by <span className="font-semibold text-navy">{program.instructor}</span>
          </span>
        </div>

        {/* Row 3: rating + learners */}
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-navy">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            {program.rating.toFixed(1)}
            <span className="font-normal text-muted-foreground">({program.reviews})</span>
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {program.participants.toLocaleString()} participants
          </span>
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof GraduationCap }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-marine/10 text-marine">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="font-display text-lg font-extrabold text-navy leading-none">{value}</p>
        <p className="text-[0.7rem] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
