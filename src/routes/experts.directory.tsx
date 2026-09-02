import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Search,
  Users,
  Globe,
  BadgeCheck,
  GraduationCap,
  Award,
  ArrowRight,
  Filter,
  RotateCcw,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { publicExpertsNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { EXPERT_CATEGORIES, TRAINING_ROLES, LEVEL_LABEL, type TrainerLevel } from "@/lib/trainerModules";
import { instructors } from "@/data/instructors";

export const Route = createFileRoute("/experts/directory")({
  head: () => ({
    meta: [
      { title: "Expert Directory — BARUNA Experts" },
      { name: "description", content: "Searchable directory of verified BARUNA marine and fisheries experts and approved trainers." },
      { property: "og:title", content: "Expert Directory — BARUNA Experts" },
      { property: "og:description", content: "Verified experts, approved trainers, and tiered recognition levels." },
    ],
    links: [{ rel: "canonical", href: "/experts/directory" }],
  }),
  component: DirectoryPage,
});

type DirectoryExpert = {
  id: string;
  name: string;
  title: string;
  organization: string;
  country: string;
  category: string;
  role: string;
  language: string;
  verified: boolean;
  trainer: boolean;
  level: TrainerLevel;
  publishedCourses: number;
  approvedModules: number;
  available: boolean;
  scope: "National" | "International";
  photo: string;
  summary: string;
};

const DIRECTORY: DirectoryExpert[] = instructors.slice(0, 10).map((i, idx) => ({
  id: i.slug,
  name: i.name,
  title: i.position,
  organization: i.organization,
  country: idx % 3 === 0 ? "Indonesia" : idx % 3 === 1 ? "Kenya" : "Senegal",
  category: EXPERT_CATEGORIES[idx % EXPERT_CATEGORIES.length],
  role: TRAINING_ROLES[idx % TRAINING_ROLES.length],
  language: idx % 2 === 0 ? "English" : "English, French",
  verified: true,
  trainer: idx < 6,
  level: (["certified", "advanced", "senior", "master", "none", "certified"][idx] || "none") as TrainerLevel,
  publishedCourses: idx < 6 ? (idx % 3) + 1 : 0,
  approvedModules: idx < 6 ? (idx % 3) + 1 : 0,
  available: idx % 4 !== 0,
  scope: idx % 2 === 0 ? "International" : "National",
  photo: i.photo,
  summary: i.summary.slice(0, 160),
}));

const LEVEL_BADGE: Record<TrainerLevel, string> = {
  none: "bg-muted text-foreground/70",
  certified: "bg-badge-course/15 text-badge-course",
  advanced: "bg-marine/15 text-marine",
  senior: "bg-accent/25 text-accent-foreground",
  master: "bg-success/15 text-success",
};

function DirectoryPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("");
  const [trainerOnly, setTrainerOnly] = useState(false);
  const [levelFilter, setLevelFilter] = useState<"" | TrainerLevel>("");
  const [available, setAvailable] = useState(false);
  const [scope, setScope] = useState<"" | "National" | "International">("");

  const results = useMemo(() => {
    return DIRECTORY.filter((e) => {
      if (q && !`${e.name} ${e.organization} ${e.category}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (category && e.category !== category) return false;
      if (country && e.country !== country) return false;
      if (role && e.role !== role) return false;
      if (trainerOnly && !e.trainer) return false;
      if (levelFilter && e.level !== levelFilter) return false;
      if (available && !e.available) return false;
      if (scope && e.scope !== scope) return false;
      return true;
    });
  }, [q, category, country, role, trainerOnly, levelFilter, available, scope]);

  const countries = Array.from(new Set(DIRECTORY.map((d) => d.country))).sort();

  const reset = () => {
    setQ(""); setCategory(""); setCountry(""); setRole(""); setTrainerOnly(false); setLevelFilter(""); setAvailable(false); setScope("");
  };

  return (
    <PageShell
      sidebar={{
        ...EXPERTS_SIDEBAR_META,
        sections: publicExpertsNav("/experts/directory"),
        extra: (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="mb-3 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
              <Filter className="h-3 w-3" /> Filters
            </p>
            <div className="space-y-3 text-sm">
              <FilterSelect label="Category" value={category} onChange={setCategory} options={EXPERT_CATEGORIES} />
              <FilterSelect label="Country" value={country} onChange={setCountry} options={countries} />
              <FilterSelect label="Training Role" value={role} onChange={setRole} options={TRAINING_ROLES} />
              <FilterSelect label="Recognition Level" value={levelFilter} onChange={(v) => setLevelFilter(v as TrainerLevel | "")} options={["certified", "advanced", "senior", "master"]} format={(v) => LEVEL_LABEL[v as TrainerLevel] ?? v} />
              <FilterSelect label="Scope" value={scope} onChange={(v) => setScope(v as "" | "National" | "International")} options={["National", "International"]} />
              <label className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                <input type="checkbox" checked={trainerOnly} onChange={(e) => setTrainerOnly(e.target.checked)} className="accent-marine" />
                Approved BARUNA Trainers only
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="accent-marine" />
                Currently available
              </label>
              <button onClick={reset} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-marine py-2 text-xs font-semibold text-marine hover:bg-marine hover:text-marine-foreground">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
          </div>
        ),
      }}
      cta={{
        icon: Users,
        title: "Not finding the right expert?",
        description: "Submit an Expert Service Request and BARUNA will match you with a verified expert.",
        button: "Request an Expert",
        href: "/experts/services",
      }}
    >
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Expert Directory</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Browse verified BARUNA experts and approved trainers. Only professionals who have passed BARUNA verification appear in this directory.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-soft">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Search by name, organization, or expertise…" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {results.length} expert{results.length === 1 ? "" : "s"} found
        </p>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((e) => (
            <article key={e.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover">
              <div className="relative">
                <img src={e.photo} alt={e.name} loading="lazy" className="h-44 w-full rounded-xl object-cover object-top" />
                <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
                  {e.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-eco-community/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-white shadow-soft">
                      <BadgeCheck className="h-3 w-3" /> Verified Expert
                    </span>
                  )}
                  {e.trainer && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-marine px-2 py-0.5 text-[0.6rem] font-bold uppercase text-marine-foreground shadow-soft">
                      <GraduationCap className="h-3 w-3" /> BARUNA Trainer
                    </span>
                  )}
                </div>
              </div>
              <h3 className="mt-3 font-display text-sm font-bold leading-tight text-navy">{e.name}</h3>
              <p className="mt-0.5 text-xs font-medium text-marine">{e.title}</p>
              <p className="text-[0.7rem] text-muted-foreground">{e.organization}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[0.6rem]">
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-medium text-navy">
                  <Globe className="h-2.5 w-2.5" /> {e.country}
                </span>
                <span className="rounded-md bg-secondary px-1.5 py-0.5 font-medium text-navy">{e.category}</span>
                <span className="rounded-md bg-secondary px-1.5 py-0.5 font-medium text-navy">{e.role}</span>
              </div>
              {e.trainer && (
                <div className={`mt-2 inline-flex items-center gap-1 self-start rounded-md px-2 py-0.5 text-[0.65rem] font-bold ${LEVEL_BADGE[e.level]}`}>
                  <Award className="h-3 w-3" /> {LEVEL_LABEL[e.level]}
                </div>
              )}
              <p className="mt-2 text-xs text-foreground/70 line-clamp-3">{e.summary}</p>
              <div className="mt-3 flex items-center justify-between text-[0.65rem] text-muted-foreground">
                <span>{e.publishedCourses} Published Course{e.publishedCourses === 1 ? "" : "s"}</span>
                <span>{e.approvedModules} Approved Module{e.approvedModules === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Link to="/experts/$slug" params={{ slug: e.id }} className="flex-1 rounded-lg bg-marine px-3 py-1.5 text-center text-xs font-semibold text-marine-foreground hover:bg-navy">
                  View Profile
                </Link>
                <Link to="/experts/services" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy hover:bg-muted">
                  Request
                </Link>
              </div>
            </article>
          ))}
          {results.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No experts match those filters.
              <button onClick={reset} className="ml-2 font-semibold text-marine hover:underline">Reset filters <ArrowRight className="inline h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function FilterSelect({
  label, value, onChange, options, format,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  format?: (v: string) => string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{format ? format(o) : o}</option>)}
      </select>
    </div>
  );
}
