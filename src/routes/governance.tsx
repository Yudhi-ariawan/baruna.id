import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  BookOpen,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  Award,
  LineChart,
  Settings,
  ShieldAlert,
  Timer,
  UserCheck,
  Megaphone,
  CalendarCheck,
} from "lucide-react";
import {
  ConsoleAccessDenied,
  ConsoleLoading,
  ConsoleShell,
  type ConsoleNavGroup,
} from "@/components/baruna/console/ConsoleShell";
import { useConsoleSession } from "@/components/baruna/console/useConsoleSession";
import { useConsoleAccess } from "@/components/baruna/console/useConsoleAccess";
import { badgeTotal, useAdminBadges, useCurationBadges } from "@/components/baruna/console/useConsoleBadges";
import type { ConsoleBadges } from "@/lib/governance/console-badges.functions";
import { hasConsoleAccess, type ConsoleAccess } from "@/lib/governance/console-access.functions";

export const Route = createFileRoute("/governance")({
  head: () => ({
    meta: [
      { title: "Konsol Kurasi — BARUNA" },
      { name: "description", content: "Review, verifikasi, dan persetujuan sesuai peran (Slide 16)." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: GovernanceLayout,
  errorComponent: ({ error, reset }) => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md text-center rounded-2xl border border-red-200 bg-white p-8 shadow-lg space-y-4">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-100 text-red-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="font-display text-xl font-bold text-navy">Kendala Memuat Konsol Kurasi</h2>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : "Terjadi kesalahan sistem saat memuat konsol."}
        </p>
        <button
          onClick={() => reset()}
          className="rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy/90 transition"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  ),
});

/** Sidebar of the curation console: only the menus this account may open. */
function consoleNav(access: ConsoleAccess, badges: ConsoleBadges = {}, adminBadge = 0): ConsoleNavGroup[] {
  const { menus } = access;
  const items = (list: Array<ConsoleNavGroup["items"][number] | false>) =>
    list.filter(Boolean) as ConsoleNavGroup["items"];

  // Grouped by business domain (Slide 35-41 Experts, 11-25 Academy, 26-34 Knowledge Hub).
  const experts = items([
    menus.experts.read && { label: "Verifikasi Expert", to: "/governance/experts", icon: UserCheck, badge: badges.experts },
    menus.modules.read && { label: "Verifikasi Modul", to: "/governance/modules", icon: BookOpen, badge: badges.modules },
  ]);
  const academy = items([
    // Slide 20-21: Master Course and Course Offering are prepared and approved here.
    menus.programs.read && { label: "Program Academy", to: "/governance/programs", icon: Library, badge: badges.programs },
    menus.trainingNeeds.read && { label: "Permintaan Pelatihan", to: "/governance/training-needs", icon: ClipboardList, badge: badges.trainingNeeds },
  ]);
  const participants = items([
    menus.enrollments.read && { label: "Persetujuan Peserta", to: "/governance/enrollments", icon: GraduationCap, badge: badges.enrollments },
    // Slide 23: Operator records attendance of cohort offerings (2bb).
    menus.programs.read && { label: "Kehadiran", to: "/governance/attendance", icon: CalendarCheck },
    menus.enrollments.read && { label: "Pemantauan Progres", to: "/governance/learning-progress", icon: LineChart },
    // Slide 24 (PB-ACA-05): Review and Approval Completion before the certificate.
    menus.completions.read && { label: "Persetujuan Kelulusan", to: "/governance/completions", icon: Award, badge: badges.completions },
  ]);
  const knowledgeHub = items([
    menus.publications.read && { label: "Verifikasi Publikasi", to: "/governance/publications", icon: FileText, badge: badges.publications },
  ]);
  const live = items([
    // Slide 16: Publisher takes live content down temporarily and puts it back (2ba).
    menus.publishing.read && { label: "Penayangan", to: "/governance/publishing", icon: Megaphone },
  ]);

  const groups: ConsoleNavGroup[] = [
    { group: "Ringkasan", items: [{ label: "Beranda Konsol", to: "/governance", icon: LayoutDashboard, exact: true }] },
    { group: "Expert", items: experts },
    { group: "Academy", items: academy },
    { group: "Peserta", items: participants },
    { group: "Knowledge Hub", items: knowledgeHub },
    { group: "Konten Tayang", items: live },
  ].filter((g) => g.items.length > 0);
  const settings = items([
    menus.trainingNeeds.read && { label: "SLA Alur Kerja", to: "/governance/sla", icon: Timer },
    // Slide 16: Approver/Admin manage the Experts and Academy reference data; Operators propose (2az).
    menus.masterData.read && { label: "Data Master", to: "/governance/master-data", icon: Database, badge: badges.masterData },
    access.isAdmin && { label: "Portal Admin", to: "/admin", icon: Settings, badge: adminBadge },
  ]);
  if (settings.length) groups.push({ group: "Pengaturan", items: settings });
  return groups;
}

function GovernanceLayout() {
  const { authReady, signedIn, currentUser, signOut } = useConsoleSession("/governance");
  const accessQuery = useConsoleAccess(signedIn);
  const ready = signedIn && hasConsoleAccess(accessQuery.data);
  const badges = useCurationBadges(ready);
  const adminBadges = useAdminBadges(ready && Boolean(accessQuery.data?.isAdmin));

  if (!authReady || (signedIn && accessQuery.isLoading)) {
    return <ConsoleLoading message="Memeriksa peran kurasi Anda…" />;
  }
  if (!signedIn) return null;

  if (accessQuery.isError || !hasConsoleAccess(accessQuery.data)) {
    return (
      <ConsoleAccessDenied
        title="Konsol Kurasi"
        message="Akun Anda belum memiliki peran kurasi (reviewer, verifier, approver, publisher, operator, atau admin). Perubahan peran dilakukan administrator."
        onSignOut={signOut}
        action={
          accessQuery.data?.isAdmin ? (
            <Link
              to="/admin"
              className="rounded-xl bg-marine px-5 py-2.5 text-xs font-semibold text-white hover:bg-navy transition shadow-xs"
            >
              Buka Portal Admin
            </Link>
          ) : null
        }
      />
    );
  }

  return (
    <ConsoleShell
      brandTitle="BARUNA Kurasi"
      brandSubtitle="Konsol Review & Persetujuan"
      sectionLabel="Konsol Kurasi"
      navGroups={consoleNav(accessQuery.data!, badges, badgeTotal([adminBadges?.accessRequests, adminBadges?.trainerApplications]))}
      user={currentUser}
      onSignOut={signOut}
    >
      <Outlet />
    </ConsoleShell>
  );
}
