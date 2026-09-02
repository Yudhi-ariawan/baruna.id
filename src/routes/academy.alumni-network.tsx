import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  Users,
  Flag,
  Share2,
  Trophy,
  Handshake,
  ArrowRight,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";
import { AcademyShell } from "@/components/baruna/academy/AcademyShell";
import { ProgramSeriesNav } from "@/components/baruna/academy/ProgramSeriesNav";
import {
  ALUMNI_NETWORK_PILLARS,
  COUNTRY_STATS,
  EDITION_2024,
  EDITION_2024_TESTIMONIALS,
  initials,
} from "@/data/edition2024";

export const Route = createFileRoute("/academy/alumni-network")({
  head: () => ({
    meta: [
      { title: "Alumni Network — Fisheries Training for African Countries — BARUNA" },
      {
        name: "description",
        content:
          "The BARUNA African Fisheries Alumni Network — connecting 20 alumni across 10 African countries from the 2024 training edition for knowledge sharing and future collaboration.",
      },
      { property: "og:title", content: "Alumni Network — BARUNA Academy" },
      { property: "og:description", content: "20 alumni · 10 countries · 1 network." },
      { property: "og:url", content: "/academy/alumni-network" },
    ],
    links: [{ rel: "canonical", href: "/academy/alumni-network" }],
  }),
  component: AlumniNetworkPage,
});

const PILLAR_ICONS = [Users, Flag, Share2, Trophy, Handshake];

function AlumniNetworkPage() {
  return (
    <AcademyShell active="training">
      <div className="space-y-6">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/academy" className="font-medium text-foreground/70 hover:text-marine">Academy</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/academy/edition-2024" className="font-medium text-foreground/70 hover:text-marine">2024 Edition</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-navy">Alumni Network</span>
        </nav>

        {/* Hero */}
        <div className="rounded-2xl border border-marine/20 bg-gradient-to-br from-marine/10 to-ocean/5 p-6 shadow-soft">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-marine/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-marine">
            <Users className="h-3.5 w-3.5" /> {EDITION_2024.network}
          </span>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-navy">Alumni Network</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A living network of fisheries professionals from the first International Training on Fisheries for African
            Countries (2024). Connect, share knowledge, and collaborate across borders.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { v: "20", l: "Alumni" },
              { v: "10", l: "Countries" },
              { v: "1", l: "Network" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="font-display text-2xl font-extrabold text-marine">{s.v}</p>
                <p className="text-xs font-medium text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        <ProgramSeriesNav active="2024" />

        {/* Pillars */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ALUMNI_NETWORK_PILLARS.map((p, i) => {
            const Icon = PILLAR_ICONS[i % PILLAR_ICONS.length];
            return (
              <div key={p.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-marine/10 text-marine">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-display text-base font-bold text-navy">{p.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                {p.title === "Alumni Directory" && (
                  <Link to="/academy/alumni" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-marine hover:text-navy">
                    Open directory <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Country distribution */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy">Country Distribution</h2>
            <span className="text-xs text-muted-foreground">Click a country to filter the directory</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {COUNTRY_STATS.map((c) => (
              <Link
                key={c.name}
                to="/academy/alumni"
                search={{ country: c.name }}
                className="rounded-xl border border-border bg-background p-4 text-center transition-colors hover:border-marine/40"
              >
                <Flag className="mx-auto h-5 w-5 text-marine" />
                <p className="mt-1.5 text-sm font-bold text-navy">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.count} alumni</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Success stories */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-navy">Success Stories</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {EDITION_2024_TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-marine to-ocean text-sm font-bold text-marine-foreground">
                    {initials(t.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.country} · {t.organization}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm italic leading-relaxed text-foreground/80">"{t.quote}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* Future collaboration CTA */}
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-marine/20 bg-marine/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-navy">Future Collaboration</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore the alumni directory and connect with peers for joint projects and the next program edition.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link to="/academy/alumni" className="inline-flex items-center gap-1.5 rounded-xl bg-marine px-4 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-marine/90">
              <GraduationCap className="h-4 w-4" /> Alumni Directory
            </Link>
            <Link to="/academy/edition-2024" className="inline-flex items-center gap-1.5 rounded-xl border border-marine bg-card px-4 py-2.5 text-sm font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">
              <CheckCircle2 className="h-4 w-4" /> 2024 Edition
            </Link>
          </div>
        </div>
      </div>
    </AcademyShell>
  );
}
