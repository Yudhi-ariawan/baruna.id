import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, BadgeCheck } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { publicExpertsNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";

export const Route = createFileRoute("/experts/contributions")({
  head: () => ({
    meta: [
      { title: "Expert Contributions — BARUNA Experts" },
      { name: "description", content: "Verified contributions by BARUNA experts: modules developed, courses delivered, reviews completed, mentoring, and more." },
      { property: "og:title", content: "Expert Contributions — BARUNA Experts" },
      { property: "og:description", content: "Verified professional contributions to BARUNA." },
    ],
    links: [{ rel: "canonical", href: "/experts/contributions" }],
  }),
  component: ContributionsPage,
});

const KINDS = [
  "Modules developed","Self-Paced Courses delivered","Full Training Programs supported","Reviews completed","Mentoring provided","Technical assistance delivered","Webinars delivered","Workshops facilitated","Publications contributed","Curriculum development","Knowledge resources submitted","International collaboration",
];

const RECENT = [
  { expert: "Dr. Sri Astutik", kind: "Self-Paced Course delivered", detail: "Tilapia Cultivation Using Biofloc System — 142 unique successful participants", date: "2025-04-18" },
  { expert: "Dr. Sinta Mahardika", kind: "Academic Review completed", detail: "Reviewed 3 Self-Paced Course modules for the 2026 Africa cohort", date: "2025-03-30" },
  { expert: "Prof. Dimas Cakrawala", kind: "Full Training Program supported", detail: "Curriculum lead — International Training on Fisheries for African Countries 2026", date: "2025-03-05" },
  { expert: "Dr. A. Rita Tisiana", kind: "Quality Assurance Review", detail: "5 modules reviewed against BARUNA standards", date: "2025-02-14" },
];

function ContributionsPage() {
  return (
    <PageShell
      sidebar={{ ...EXPERTS_SIDEBAR_META, sections: publicExpertsNav("/experts/contributions") }}
      cta={{ icon: ScrollText, title: "See something missing?", description: "All contributions on this page are verified by BARUNA administrators.", button: "Contact BARUNA", href: "/about" }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Expert Contributions</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Only verified contributions appear here. Unverified achievements are never displayed as official records.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-base font-bold text-navy">Contribution Types</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <span key={k} className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-navy">{k}</span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-base font-bold text-navy">Recent Verified Contributions</h2>
          <ul className="mt-4 divide-y divide-border">
            {RECENT.map((r, i) => (
              <li key={i} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy">{r.expert}</p>
                  <p className="text-xs text-foreground/70">{r.detail}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-eco-community/15 px-2.5 py-0.5 font-semibold text-eco-community">
                    <BadgeCheck className="h-3 w-3" /> {r.kind}
                  </span>
                  <span className="text-muted-foreground">{r.date}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
