import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCircle2, GraduationCap, Award, MessagesSquare, CalendarDays, Users, FileEdit } from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";

function buildHref(pattern: string, params?: Record<string, string>) {
  if (!params) return pattern;
  let out = pattern;
  for (const [k, v] of Object.entries(params)) out = out.replace("$" + k, v);
  return out;
}

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — BARUNA" }, { name: "description", content: "Recent activity across your BARUNA workspace." }] }),
  component: NotificationsPage,
});

const NOTIFS: { icon: React.ElementType; title: string; body: string; to: string; params?: Record<string, string>; when: string }[] = [
  { icon: CheckCircle2, title: "Application accepted", body: "You've been accepted to the International Training on Fisheries for African Countries (2026).", to: "/academy/training/$slug", params: { slug: "international-training-fisheries-african-countries" }, when: "2h ago" },
  { icon: GraduationCap, title: "New Self-Paced Course published", body: "Sustainable Biofloc Aquaculture for Beginners is now open.", to: "/academy/self-paced/$code", params: { code: "BARUNA-AQ-001" }, when: "1d ago" },
  { icon: Award, title: "Certificate ready", body: "Your certificate for Fisheries Management is available.", to: "/academy/certification", when: "3d ago" },
  { icon: CalendarDays, title: "Event reminder", body: "Webinar: Data for Sustainable Fisheries Management starts in 24 hours.", to: "/events/$slug", params: { slug: "webinar-data-fisheries" }, when: "4d ago" },
  { icon: MessagesSquare, title: "Expert answered your question", body: "Dr. Nara Samudra replied to your post in Marine Conservation CoP.", to: "/community", when: "5d ago" },
  { icon: FileEdit, title: "Module review update", body: "Your submitted module BARUNA-FM-001 v1.2 was approved.", to: "/experts/portal/review-status", when: "1w ago" },
  { icon: Users, title: "New follower", body: "Naomi Wanjiku joined your Marine Spatial Planning cohort.", to: "/community", when: "1w ago" },
];

function NotificationsPage() {
  return (
    <PageShell
      sidebar={{ icon: Bell, title: "Notifications", subtitle: "Everything happening in your workspace.", sections: [{ label: "Filter", items: [
        { label: "All", active: true }, { label: "Learning", to: "/academy/learn" }, { label: "Events", to: "/events" }, { label: "Community", to: "/community" }, { label: "Experts", to: "/experts" },
      ] }] }}
      cta={{ icon: Bell, title: "Notification settings", description: "Choose what you receive by email.", button: "Go to Settings", href: "/help" }}
    >
      <h1 className="font-display text-3xl font-extrabold text-navy">Notifications</h1>
      <p className="mt-1 text-sm text-muted-foreground">Demo notifications — click any item to open the underlying record.</p>
      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
        {NOTIFS.map((n, i) => (
          <li key={i}>
            <a href={buildHref(n.to, n.params)} className="flex items-start gap-3 px-4 py-4 hover:bg-muted/60">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marine/10 text-marine">
                <n.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-navy">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.body}</p>
              </div>
              <span className="whitespace-nowrap text-[0.7rem] text-muted-foreground">{n.when}</span>
            </a>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
