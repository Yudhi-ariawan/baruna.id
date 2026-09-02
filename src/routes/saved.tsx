import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { DEMO_SHORT_COURSES, DEMO_EVENTS, DEMO_FELLOWSHIPS } from "@/data/demo";

export const Route = createFileRoute("/saved")({
  head: () => ({ meta: [{ title: "Saved Items — BARUNA" }, { name: "description", content: "Your saved courses, events, and fellowships." }] }),
  component: SavedPage,
});

function SavedPage() {
  const courses = DEMO_SHORT_COURSES.slice(0, 3);
  const events = DEMO_EVENTS.slice(0, 2);
  const fellowships = DEMO_FELLOWSHIPS.slice(0, 1);

  return (
    <PageShell
      sidebar={{ icon: Bookmark, title: "Saved Items", subtitle: "Everything you've bookmarked.", sections: [{ label: "Categories", items: [
        { label: "Self-Paced Courses", active: true }, { label: "Events", to: "/events/saved" }, { label: "Fellowships", to: "/fellowship" },
      ] }] }}
      cta={{ icon: Bookmark, title: "Discover more", description: "Browse the Academy and Knowledge Hub.", button: "Browse Academy", href: "/academy" }}
    >
      <h1 className="font-display text-3xl font-extrabold text-navy">Saved Items</h1>
      <p className="mt-1 text-sm text-muted-foreground">Demo bookmarks — click through to the record.</p>
      <Section title="Self-Paced Courses">
        {courses.map((c) => (
          <Link key={c.code} to="/academy/self-paced/$code" params={{ code: c.code }} className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-marine/50">
            <div><p className="text-sm font-bold text-navy">{c.title}</p><p className="text-xs text-muted-foreground">{c.code} · {c.instructionalHours} IH</p></div>
            <ArrowRight className="h-4 w-4 text-marine" />
          </Link>
        ))}
      </Section>
      <Section title="Events">
        {events.map((e) => (
          <Link key={e.slug} to="/events/$slug" params={{ slug: e.slug }} className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-marine/50">
            <div><p className="text-sm font-bold text-navy">{e.title}</p><p className="text-xs text-muted-foreground">{e.date} · {e.format}</p></div>
            <ArrowRight className="h-4 w-4 text-marine" />
          </Link>
        ))}
      </Section>
      <Section title="Fellowships">
        {fellowships.map((f) => (
          <Link key={f.slug} to="/fellowship" className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-marine/50">
            <div><p className="text-sm font-bold text-navy">{f.title}</p><p className="text-xs text-muted-foreground">{f.window} · {f.duration}</p></div>
            <ArrowRight className="h-4 w-4 text-marine" />
          </Link>
        ))}
      </Section>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6"><h2 className="mb-2 font-display text-lg font-bold text-navy">{title}</h2><div className="space-y-2">{children}</div></section>;
}
