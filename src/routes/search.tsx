import { createFileRoute } from "@tanstack/react-router";
import { Search as SearchIcon, ArrowRight } from "lucide-react";
import { useState, useMemo } from "react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { DEMO_EXPERTS, DEMO_MODULES, DEMO_SHORT_COURSES, DEMO_EVENTS, DEMO_PARTNERS, DEMO_FELLOWSHIPS, DEMO_COMMUNITIES, DEMO_CATEGORIES } from "@/data/demo";

function buildHref(pattern: string, params?: Record<string, string>) {
  if (!params) return pattern;
  let out = pattern;
  for (const [k, v] of Object.entries(params)) out = out.replace("$" + k, v);
  return out;
}

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [
    { title: "Search — BARUNA" },
    { name: "description", content: "Search across BARUNA training programs, courses, experts, events, fellowships, partners, and communities." },
  ] }),
  component: SearchPage,
});

type Hit = { kind: string; label: string; to: string; params?: Record<string, string>; hint?: string };

function SearchPage() {
  const [q, setQ] = useState("");
  const hits: Hit[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all: Hit[] = [
      ...DEMO_EXPERTS.map((e) => ({ kind: "Expert", label: e.fullName, to: "/experts/$slug", params: { slug: e.slug }, hint: e.organization })),
      ...DEMO_MODULES.map((m) => ({ kind: "Module", label: m.title, to: "/knowledge-hub", hint: m.code })),
      ...DEMO_SHORT_COURSES.map((c) => ({ kind: "Self-Paced Course", label: c.title, to: "/academy/self-paced/$code", params: { code: c.code }, hint: `${c.instructionalHours} IH` })),
      ...DEMO_EVENTS.map((e) => ({ kind: "Event", label: e.title, to: "/events/$slug", params: { slug: e.slug }, hint: e.date })),
      ...DEMO_PARTNERS.map((p) => ({ kind: "Partner", label: p.name, to: "/partnership", hint: p.country })),
      ...DEMO_FELLOWSHIPS.map((f) => ({ kind: "Fellowship", label: f.title, to: "/fellowship", hint: f.duration })),
      ...DEMO_COMMUNITIES.map((c) => ({ kind: "Community", label: c.name, to: "/community", hint: `${c.members} members` })),
      ...DEMO_CATEGORIES.map((c) => ({ kind: "Category", label: c.name, to: "/academy/category/$slug", params: { slug: c.slug }, hint: c.tagline })),
    ];
    if (!term) return all.slice(0, 20);
    return all.filter((h) => h.label.toLowerCase().includes(term) || (h.hint ?? "").toLowerCase().includes(term));
  }, [q]);

  return (
    <PageShell
      sidebar={{ icon: SearchIcon, title: "Global Search", subtitle: "Search the BARUNA demo network.", sections: [{ label: "Filters", items: [
        { label: "All results", active: true },
        { label: "Experts", to: "/experts/directory" },
        { label: "Self-Paced Courses", to: "/academy/self-paced" },
        { label: "Events", to: "/events" },
        { label: "Communities", to: "/community" },
        { label: "Partners", to: "/partnership" },
      ] }] }}
      cta={{ icon: SearchIcon, title: "Looking for something specific?", description: "Every result opens a real page in the demo.", button: "Browse Academy", href: "/academy" }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Search</h1>
          <p className="mt-1 text-sm text-muted-foreground">Type a keyword or browse by type.</p>
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search experts, courses, events, partners…" className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-marine" />
        </div>
        <div className="rounded-2xl border border-border bg-card shadow-soft">
          <ul className="divide-y divide-border">
            {hits.length === 0 && <li className="p-6 text-sm text-muted-foreground">No results.</li>}
            {hits.map((h, i) => (
              <li key={i}>
                <a href={buildHref(h.to, h.params)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/60">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{h.label}</p>
                    {h.hint && <p className="truncate text-xs text-muted-foreground">{h.hint}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-marine/10 px-2 py-0.5 font-bold text-marine">{h.kind}</span>
                    <ArrowRight className="h-4 w-4 text-marine" />
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
