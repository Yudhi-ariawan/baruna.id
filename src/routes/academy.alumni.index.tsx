import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Search, CheckCircle2, ArrowRight, Users, Flag, Building2, GraduationCap } from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { ProgramSeriesNav } from "@/components/baruna/academy/ProgramSeriesNav";
import { ALUMNI, COUNTRY_STATS, INSTITUTIONS, initials } from "@/data/edition2024";

export const Route = createFileRoute("/academy/alumni/")({
  validateSearch: (search: Record<string, unknown>): { country?: string } => ({
    country: typeof search.country === "string" ? search.country : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Alumni — Fisheries Training for African Countries (2024) — BARUNA" },
      {
        name: "description",
        content:
          "Alumni directory of the 2024 International Training on Fisheries for African Countries — 20 alumni from 10 African countries.",
      },
      { property: "og:title", content: "Alumni Directory (2024) — BARUNA Academy" },
      { property: "og:description", content: "20 alumni · 10 countries · Training Year 2024." },
      { property: "og:url", content: "/academy/alumni" },
    ],
    links: [{ rel: "canonical", href: "/academy/alumni" }],
  }),
  component: AlumniPage,
});

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-marine to-ocean text-base font-bold text-marine-foreground"
    >
      {initials(name)}
    </span>
  );
}

function AlumniPage() {
  const { country: countryParam } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState(countryParam ?? "All");
  const [institution, setInstitution] = useState("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALUMNI.filter((a) => {
      if (country !== "All" && a.country !== country) return false;
      if (institution !== "All" && a.organization !== institution) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q) ||
        a.organization.toLowerCase().includes(q) ||
        a.department.toLowerCase().includes(q)
      );
    });
  }, [query, country, institution]);

  const stats = [
    { value: "20", label: "Alumni", icon: GraduationCap },
    { value: "10", label: "Countries", icon: Flag },
    { value: "2024", label: "Training Year", icon: Users },
  ];

  return (
    <AcademyShell active="training">
      <div className="space-y-6">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/edition-2024" className="font-medium text-foreground/70 hover:text-marine">2024 Edition</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">Alumni</span>
        </nav>

        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Alumni Directory</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The first cohort of the International Training on Fisheries for African Countries — 20 alumni from 10 countries, Training Year 2024.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-5 text-center shadow-soft">
              <s.icon className="mx-auto h-5 w-5 text-marine" />
              <p className="mt-2 font-display text-2xl font-extrabold text-navy">{s.value}</p>
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <ProgramSeriesNav active="2024" />

        {/* Filters */}
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:grid-cols-3">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 sm:col-span-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, country, organization, or department..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-navy outline-none"
          >
            <option value="All">All Countries</option>
            {COUNTRY_STATS.map((c) => (
              <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
            ))}
          </select>
          <select
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-navy outline-none sm:col-span-2"
          >
            <option value="All">All Institutions</option>
            {INSTITUTIONS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        <p className="text-sm text-muted-foreground">Showing {filtered.length} of {ALUMNI.length} alumni</p>

        {/* Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((a) => (
            <Link
              key={a.id}
              to="/academy/alumni/$id"
              params={{ id: a.id }}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-marine/40 hover:shadow-hover"
            >
              <Avatar name={a.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy">{a.name}</p>
                <p className="flex items-center gap-1 truncate text-xs font-medium text-marine">
                  <Flag className="h-3 w-3" /> {a.country}
                </p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3 shrink-0" /> {a.organization}
                </p>
                <p className="truncate text-[0.7rem] text-muted-foreground">{a.department}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[0.6rem] font-semibold text-foreground/70">2024</span>
                  <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase text-success">
                    <CheckCircle2 className="h-3 w-3" /> Completed
                  </span>
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-soft">
            No alumni match your filters.
          </div>
        )}
      </div>
    </AcademyShell>
  );
}
