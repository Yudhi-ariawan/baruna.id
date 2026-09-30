import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Filter,
  Globe,
  GraduationCap,
  RotateCcw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { publicExpertsNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import defaultExpertAvatar from "@/assets/avatar-presets/marine-researcher.webp";
import { listPublicExperts } from "@/lib/experts/directory.functions";
import { TRAINER_LEVEL_LABEL, type PublicExpert } from "@/lib/experts/directory.types";

export const Route = createFileRoute("/experts/directory")({
  loader: async () => ({ experts: await listPublicExperts() }),
  head: () => ({
    meta: [
      { title: "Expert Directory — BARUNA Experts" },
      {
        name: "description",
        content: "Search verified BARUNA marine and fisheries experts and approved trainers.",
      },
    ],
    links: [{ rel: "canonical", href: "/experts/directory" }],
  }),
  component: DirectoryPage,
});

const LEVEL_BADGE: Record<PublicExpert["trainerLevel"], string> = {
  not_assigned: "bg-muted text-foreground/70",
  certified: "bg-badge-course/15 text-badge-course",
  advanced: "bg-marine/15 text-marine",
  senior: "bg-accent/25 text-accent-foreground",
  master: "bg-success/15 text-success",
};

function DirectoryPage() {
  const { experts } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [expertise, setExpertise] = useState("");
  const [country, setCountry] = useState("");
  const [trainerOnly, setTrainerOnly] = useState(false);
  const [trainerLevel, setTrainerLevel] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  const expertiseOptions = useMemo(
    () => Array.from(new Set(experts.flatMap((expert) => expert.expertiseAreas))).sort(),
    [experts],
  );
  const countries = useMemo(
    () =>
      Array.from(
        new Set(
          experts.map((expert) => expert.country).filter((value): value is string => !!value),
        ),
      ).sort(),
    [experts],
  );
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return experts.filter((expert) => {
      const haystack = [
        expert.displayName,
        expert.headline,
        expert.institution,
        expert.country,
        ...expert.expertiseAreas,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (normalizedQuery && !haystack.includes(normalizedQuery)) return false;
      if (expertise && !expert.expertiseAreas.includes(expertise)) return false;
      if (country && expert.country !== country) return false;
      if (trainerOnly && expert.trainerStatus !== "active") return false;
      if (trainerLevel && expert.trainerLevel !== trainerLevel) return false;
      if (availableOnly && expert.availabilityStatus !== "available") return false;
      return true;
    });
  }, [availableOnly, country, expertise, experts, query, trainerLevel, trainerOnly]);

  const reset = () => {
    setQuery("");
    setExpertise("");
    setCountry("");
    setTrainerOnly(false);
    setTrainerLevel("");
    setAvailableOnly(false);
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
              <FilterSelect
                label="Expertise"
                value={expertise}
                onChange={setExpertise}
                options={expertiseOptions}
              />
              <FilterSelect
                label="Country"
                value={country}
                onChange={setCountry}
                options={countries}
              />
              <FilterSelect
                label="Recognition Level"
                value={trainerLevel}
                onChange={setTrainerLevel}
                options={["certified", "advanced", "senior", "master"]}
                format={(value) => TRAINER_LEVEL_LABEL[value as PublicExpert["trainerLevel"]]}
              />
              <FilterCheckbox
                label="Approved BARUNA Trainers only"
                checked={trainerOnly}
                onChange={setTrainerOnly}
              />
              <FilterCheckbox
                label="Currently available"
                checked={availableOnly}
                onChange={setAvailableOnly}
              />
              <button
                type="button"
                onClick={reset}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-marine py-2 text-xs font-semibold text-marine hover:bg-marine hover:text-marine-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
          </div>
        ),
      }}
      cta={{
        icon: Users,
        title: "Not finding the right expert?",
        description: "Submit a service request and BARUNA will match you with a verified expert.",
        button: "Request an Expert",
        href: "/experts/services",
      }}
    >
      <div className="space-y-5">
        <header>
          <h1 className="font-display text-3xl font-extrabold text-navy">Expert Directory</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Browse published profiles from BARUNA&apos;s curated registry of verified marine and
            fisheries professionals.
          </p>
        </header>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-soft">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search by name, institution, country, or expertise…"
          />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {results.length} expert{results.length === 1 ? "" : "s"} found
        </p>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {results.map((expert) => (
            <ExpertCard key={expert.id} expert={expert} />
          ))}
          {results.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No experts match those filters.
              <button
                type="button"
                onClick={reset}
                className="ml-2 font-semibold text-marine hover:underline"
              >
                Reset filters <ArrowRight className="inline h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function ExpertCard({ expert }: { expert: PublicExpert }) {
  const isTrainer = expert.trainerStatus === "active";
  const isImageAvatar = Boolean(
    expert.avatarUrl && !expert.avatarUrl.toLowerCase().endsWith(".pdf"),
  );
  const photoSrc = isImageAvatar ? expert.avatarUrl! : defaultExpertAvatar;

  return (
    <article className="group flex h-full gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-1 hover:border-marine/40 hover:shadow-hover">
      <div className="relative aspect-[3/4] w-[76px] sm:w-[88px] shrink-0 self-start overflow-hidden rounded-xl bg-secondary/40">
        <img
          src={photoSrc}
          alt={`Portrait of ${expert.displayName}`}
          loading="lazy"
          width={240}
          height={320}
          className="h-full w-full object-cover object-center"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Badges */}
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-eco-community/90 px-1.5 py-0.5 text-[0.58rem] font-bold uppercase text-white shadow-soft">
            <BadgeCheck className="h-2.5 w-2.5" /> Verified
          </span>
          {isTrainer && (
            <span className="inline-flex items-center gap-1 rounded-full bg-marine px-1.5 py-0.5 text-[0.58rem] font-bold uppercase text-white shadow-soft">
              <GraduationCap className="h-2.5 w-2.5" /> Trainer
            </span>
          )}
        </div>

        <h2 className="font-display text-sm font-bold leading-tight text-navy">
          {expert.displayName}
        </h2>
        <p className="mt-0.5 text-xs font-semibold text-marine line-clamp-1">{expert.headline}</p>
        {expert.institution && (
          <p className="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground line-clamp-1">
            {expert.institution}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-1 text-[0.65rem]">
          {expert.country && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-secondary px-1.5 py-0.5 font-medium text-navy">
              <Globe className="h-2.5 w-2.5" /> {expert.country}
            </span>
          )}
          {expert.expertiseAreas.slice(0, 3).map((item) => (
            <span key={item} className="rounded-md bg-secondary px-1.5 py-0.5 font-medium text-navy">
              {item}
            </span>
          ))}
        </div>

        {expert.bio && (
          <p className="mt-2 line-clamp-2 text-[0.72rem] leading-relaxed text-foreground/70">
            {expert.bio}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-border/40">
          <Link
            to="/experts/$slug"
            params={{ slug: expert.slug }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-marine transition-colors hover:text-navy"
          >
            View Profile <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/experts/request"
            search={{ type: isTrainer ? "trainer" : "technical", expert: expert.slug }}
            className="rounded-lg border border-border px-2.5 py-1 text-[0.7rem] font-semibold text-navy hover:bg-muted transition-colors"
          >
            Request
          </Link>
        </div>
      </div>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  format,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  format?: (value: string) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {format ? format(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-foreground/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-marine"
      />
      {label}
    </label>
  );
}
