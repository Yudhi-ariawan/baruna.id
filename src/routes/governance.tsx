import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Settings,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import {
  ConsoleAccessDenied,
  ConsoleLoading,
  ConsoleShell,
  type ConsoleNavGroup,
} from "@/components/baruna/console/ConsoleShell";
import { useConsoleSession } from "@/components/baruna/console/useConsoleSession";
import { useConsoleAccess } from "@/components/baruna/console/useConsoleAccess";
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
function consoleNav(access: ConsoleAccess): ConsoleNavGroup[] {
  const { menus } = access;
  const curation = [
    menus.experts.read && { label: "Verifikasi Expert", to: "/governance/experts", icon: UserCheck },
    menus.modules.read && { label: "Verifikasi Modul", to: "/governance/modules", icon: BookOpen },
    menus.publications.read && { label: "Verifikasi Publikasi", to: "/governance/publications", icon: FileText },
    menus.enrollments.read && { label: "Persetujuan Peserta", to: "/governance/enrollments", icon: GraduationCap },
    menus.enrollments.read && { label: "Pemantauan Progres", to: "/governance/learning-progress", icon: LineChart },
    menus.trainingNeeds.read && { label: "Permintaan Pelatihan", to: "/governance/training-needs", icon: ClipboardList },
  ].filter(Boolean) as ConsoleNavGroup["items"];

  const groups: ConsoleNavGroup[] = [
    { group: "Ringkasan", items: [{ label: "Beranda Konsol", to: "/governance", icon: LayoutDashboard, exact: true }] },
    { group: "Verifikasi & Kurasi", items: curation },
  ];
  const settings = [
    menus.trainingNeeds.decide && { label: "Template Review", to: "/governance/templates", icon: ListChecks },
    access.isAdmin && { label: "Portal Admin", to: "/admin", icon: Settings },
  ].filter(Boolean) as ConsoleNavGroup["items"];
  if (settings.length) groups.push({ group: "Pengaturan", items: settings });
  return groups;
}

function GovernanceLayout() {
  const { authReady, signedIn, currentUser, signOut } = useConsoleSession("/governance");
  const accessQuery = useConsoleAccess(signedIn);

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
      navGroups={consoleNav(accessQuery.data!)}
      user={currentUser}
      onSignOut={signOut}
    >
      <Outlet />
    </ConsoleShell>
  );
}
