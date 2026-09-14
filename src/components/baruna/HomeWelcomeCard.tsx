import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Hand,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { useHomeExperience } from "./home-experience";
import { ProfileAvatar } from "./ProfileAvatar";
import type { HomeMetricIcon } from "@/lib/home/home.types";

const metricIcons = {
  book: BookOpen,
  certificate: GraduationCap,
  progress: BarChart3,
  completed: CheckCircle2,
  users: Users,
  requests: ClipboardCheck,
  reviews: ShieldCheck,
  audit: FileText,
  profile: UserCheck,
} satisfies Record<HomeMetricIcon, typeof BookOpen>;

export function HomeWelcomeCard() {
  const { authState, viewer, publicStats, publicStatsLoading } = useHomeExperience();

  if (authState === "authenticated" && viewer) {
    return (
      <div className="rounded-2xl border border-navy-foreground/15 bg-navy/85 p-6 text-navy-foreground shadow-card backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-navy-foreground/80">
              Welcome back <Hand className="h-4 w-4 text-star" />
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold">{viewer.displayName}</p>
            <span className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[0.7rem] font-semibold text-white/90">
              {viewer.primaryRoleLabel}
            </span>
          </div>
          <ProfileAvatar name={viewer.displayName} url={viewer.avatarUrl} size="large" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
          {viewer.metrics.map(({ label, value, icon }) => {
            const Icon = metricIcons[icon];
            return (
              <div key={label} className="text-center">
                <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-navy-foreground/10">
                  <Icon className="h-4 w-4 text-navy-foreground" />
                </div>
                <p className="mt-2 font-display text-lg font-bold leading-none">{value}</p>
                <p className="mt-1 text-[0.65rem] leading-tight text-navy-foreground/75">{label}</p>
              </div>
            );
          })}
        </div>

        <Link
          to={viewer.dashboardUrl}
          className="mt-6 flex w-full items-center justify-between rounded-xl bg-navy-foreground/10 px-4 py-3 text-sm font-semibold transition-colors hover:bg-navy-foreground/20"
        >
          {viewer.variant === "admin" ? "Open Admin Console" : "Go to Dashboard"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const publicMetrics = [
    { label: "Active Training", value: publicStats?.activeTraining, icon: Award },
    { label: "Verified Experts", value: publicStats?.verifiedExperts, icon: UserCheck },
    { label: "Open Publications", value: publicStats?.openPublications, icon: BookOpen },
    { label: "Upcoming Events", value: publicStats?.upcomingEvents, icon: CalendarDays },
  ];

  return (
    <div className="rounded-2xl border border-navy-foreground/15 bg-navy/85 p-6 text-navy-foreground shadow-card backdrop-blur-md">
      <div>
        <p className="text-sm text-navy-foreground/80">Indonesia’s marine knowledge network</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold">Welcome to BARUNA</h2>
        <p className="mt-1 text-sm text-navy-foreground/80">
          Learn, connect, and contribute to a stronger marine and fisheries community.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
        {publicMetrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="text-center">
            <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-navy-foreground/10">
              <Icon className="h-4 w-4 text-navy-foreground" />
            </div>
            <p className="mt-2 font-display text-lg font-bold leading-none">
              {publicStatsLoading || authState === "loading" ? "—" : (value ?? 0)}
            </p>
            <p className="mt-1 text-[0.65rem] leading-tight text-navy-foreground/75">{label}</p>
          </div>
        ))}
      </div>

      <Link
        to="/auth"
        search={{ mode: "signup" }}
        className="mt-6 flex w-full items-center justify-between rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
      >
        Register Now
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
