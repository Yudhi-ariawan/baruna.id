import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  GraduationCap,
  Award,
  Bookmark,
  CalendarDays,
  MessagesSquare,
  Globe,
  UserRound,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { RequireAuth } from "@/components/baruna/auth/RequireAuth";
import { DEMO_PARTICIPANTS, DEMO_SHORT_COURSES } from "@/data/demo";

function buildHref(pattern: string, params?: Record<string, string>) {
  if (!params) return pattern;
  let out = pattern;
  for (const [k, v] of Object.entries(params)) out = out.replace("$" + k, v);
  return out;
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Training Journey — BARUNA" },
      {
        name: "description",
        content:
          "Your personal BARUNA dashboard: applications, learning, certificates, alumni, community, and events.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  // Use a demo participant as the "me"
  const me = DEMO_PARTICIPANTS.find((p) => p.status === "In Progress") ?? DEMO_PARTICIPANTS[0];
  const enrolledCourse = DEMO_SHORT_COURSES.find((c) => c.code === me.courseCode)!;

  const cards: {
    icon: React.ElementType;
    title: string;
    body: string;
    cta: string;
    to: string;
    params?: Record<string, string>;
  }[] = [
    {
      icon: GraduationCap,
      title: "Applications",
      body: "Track applications to full training programs.",
      cta: "Open",
      to: "/academy/applications",
    },
    {
      icon: GraduationCap,
      title: "Upcoming Training",
      body: "Sessions scheduled in the next 30 days.",
      cta: "View calendar",
      to: "/events/calendar",
    },
    {
      icon: GraduationCap,
      title: "Active Learning",
      body: `${enrolledCourse.title} — ${me.progressPct}% complete`,
      cta: "Continue",
      to: "/academy/self-paced/$code",
      params: { code: enrolledCourse.code },
    },
    {
      icon: Award,
      title: "Certificates",
      body: "SAMPLE — NOT VALID demo certificates.",
      cta: "View",
      to: "/academy/certification",
    },
    {
      icon: Bookmark,
      title: "Saved Items",
      body: "Courses, events, and fellowships you saved.",
      cta: "Open",
      to: "/saved",
    },
    {
      icon: Globe,
      title: "Fellowship Applications",
      body: "Draft, submitted, or accepted.",
      cta: "Open",
      to: "/fellowship",
    },
    {
      icon: MessagesSquare,
      title: "Community Participation",
      body: "Posts, replies, and expert answers.",
      cta: "Open",
      to: "/community",
    },
    {
      icon: CalendarDays,
      title: "Upcoming Events",
      body: "Webinars, workshops, and conferences.",
      cta: "Open",
      to: "/events",
    },
    {
      icon: Award,
      title: "Alumni Activities",
      body: "Stay connected with your cohort.",
      cta: "Open",
      to: "/academy/alumni-network",
    },
    {
      icon: GraduationCap,
      title: "Recommended Learning",
      body: "Based on your interests and completions.",
      cta: "Browse",
      to: "/academy/self-paced",
    },
    {
      icon: Bookmark,
      title: "Learning Records",
      body: "Full transcript of your BARUNA activity.",
      cta: "Open",
      to: "/academy/learn",
    },
    {
      icon: GraduationCap,
      title: "Completed Courses",
      body: "Everything you've finished.",
      cta: "Open",
      to: "/academy/learn",
    },
  ];

  return (
    <RequireAuth>
      <PageShell
        sidebar={{
          icon: LayoutDashboard,
          title: "My Training Journey",
          subtitle: "Demo participant workspace.",
          sections: [
            {
              label: "Sections",
              items: [
                { label: "Overview", active: true },
                { label: "Applications", to: "/academy/applications" },
                { label: "My Learning", to: "/academy/learn" },
                { label: "Certificates", to: "/academy/certification" },
                { label: "Saved", to: "/saved" },
              ],
            },
          ],
        }}
        cta={{
          icon: LayoutDashboard,
          title: "Explore more of BARUNA",
          description: "Browse experts, events, and communities.",
          button: "Browse Academy",
          href: "/academy",
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-amber-700">
              Demo Profile · {me.fullName}
            </span>
            <h1 className="mt-3 font-display text-3xl font-extrabold text-navy">
              My Training Journey
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A single place for everything you're doing on BARUNA.
            </p>
          </div>
          <a
            href="/account/profile"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-navy shadow-soft transition hover:border-marine hover:text-marine"
          >
            <UserRound className="h-4 w-4" /> Edit Profile
          </a>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-marine">
                <c.icon className="h-4 w-4" /> {c.title}
              </div>
              <p className="mt-2 text-sm text-foreground/80">{c.body}</p>
              <a
                href={buildHref(c.to, c.params)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-marine hover:text-navy"
              >
                {c.cta} →
              </a>
            </div>
          ))}
        </div>
      </PageShell>
    </RequireAuth>
  );
}
