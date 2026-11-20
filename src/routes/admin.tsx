import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, GraduationCap, History, Inbox, KeyRound, LayoutDashboard, LogIn, ShieldAlert, Users } from "lucide-react";
import { getAdminAccess } from "@/lib/admin/users.functions";
import { getGovernanceConsoleAccess, hasConsoleAccess } from "@/lib/governance/console-access.functions";
import {
  ConsoleAccessDenied,
  ConsoleLoading,
  ConsoleShell,
  type ConsoleNavGroup,
} from "@/components/baruna/console/ConsoleShell";
import { useConsoleSession } from "@/components/baruna/console/useConsoleSession";
import { badgeTotal, useAdminBadges, useCurationBadges } from "@/components/baruna/console/useConsoleBadges";
import type { AdminBadges } from "@/lib/governance/console-badges.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration Portal — BARUNA" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLayout,
  errorComponent: ({ error, reset }) => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md text-center rounded-2xl border border-red-200 bg-white p-8 shadow-lg space-y-4">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-100 text-red-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="font-display text-xl font-bold text-navy">Kendala Memuat Panel Admin</h2>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : "Terjadi kesalahan sistem saat memuat modul admin."}
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy/90 transition"
          >
            Coba Lagi
          </button>
          <a
            href="/"
            className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-slate-50 transition"
          >
            Ke Beranda
          </a>
        </div>
      </div>
    </div>
  ),
});

// System administration only. Review, verification, approval and enrollment
// queues live in the curation console (/governance), opened per role.
function adminNav(canReadAudit: boolean, badges: AdminBadges = {}, curationBadge = 0): ConsoleNavGroup[] {
  return [
    {
      group: "Overview",
      items: [{ label: "Dashboard Overview", to: "/admin", icon: LayoutDashboard, exact: true }],
    },
    {
      group: "Manajemen & Pengguna",
      items: [
        { label: "Users & Access", to: "/admin/users", icon: Users },
        // Slide 42 (LS-01): role requests from My Profile, decided by a super admin.
        { label: "Permintaan Akses", to: "/admin/access-requests", icon: KeyRound, badge: badges.accessRequests },
        // Slide 42-45, 49 (RACI baris 8): audit trail run from the Admin Console.
        ...(canReadAudit ? [{ label: "Jejak Audit", to: "/admin/audit", icon: History }] : []),
        // Slide 42 (LS-01) output "Authentication Log": sign-ins and sign-outs.
        ...(canReadAudit ? [{ label: "Log Autentikasi", to: "/admin/auth-log", icon: LogIn }] : []),
      ],
    },
    {
      group: "Verifikasi & Kurasi",
      items: [
        // Total of the curation queues, so admins see waiting work from here too.
        { label: "Konsol Kurasi", to: "/governance", icon: ClipboardCheck, badge: curationBadge },
        { label: "Kualifikasi Trainer", to: "/admin/trainer-applications", icon: GraduationCap, badge: badges.trainerApplications },
        // Slide 38 (PB-EXP-03): review, match and assign expert service requests.
        { label: "Penugasan Expert", to: "/admin/service-requests", icon: Inbox, badge: badges.serviceRequests },
      ],
    },
  ];
}

function AdminLayout() {
  const { authReady, signedIn, currentUser, signOut } = useConsoleSession("/admin/users");
  const accessFn = useServerFn(getAdminAccess);
  const consoleFn = useServerFn(getGovernanceConsoleAccess);

  const accessQuery = useQuery({
    queryKey: ["admin", "access"],
    queryFn: () => accessFn(),
    enabled: signedIn,
    retry: false,
  });
  const denied = accessQuery.isError || (accessQuery.isSuccess && !accessQuery.data?.canReadUsers);
  const allowed = signedIn && accessQuery.isSuccess && !denied;
  const adminBadges = useAdminBadges(allowed);
  const curationBadges = useCurationBadges(allowed);
  // Only asked when the admin portal refuses: point curation roles to their console.
  const consoleQuery = useQuery({
    queryKey: ["governance", "console-access"],
    queryFn: () => consoleFn(),
    enabled: signedIn && denied,
    retry: false,
    staleTime: 60 * 1000,
  });

  if (!authReady || (signedIn && accessQuery.isLoading)) {
    return <ConsoleLoading message="Memeriksa hak akses administratif BARUNA…" />;
  }
  if (!signedIn) return null;

  if (denied) {
    return (
      <ConsoleAccessDenied
        title="Akses Administratif Diperlukan"
        message="Portal ini untuk administrator sistem (pengelolaan pengguna dan peran). Antrean review, verifikasi, dan persetujuan ada di Konsol Kurasi."
        onSignOut={signOut}
        action={
          hasConsoleAccess(consoleQuery.data) ? (
            <Link
              to="/governance"
              className="rounded-xl bg-marine px-5 py-2.5 text-xs font-semibold text-white hover:bg-navy transition shadow-xs"
            >
              Buka Konsol Kurasi
            </Link>
          ) : null
        }
      />
    );
  }

  return (
    <ConsoleShell
      brandTitle="BARUNA Admin"
      brandSubtitle="Portal Tata Kelola"
      sectionLabel="Portal Tata Kelola"
      navGroups={adminNav(Boolean(accessQuery.data?.canReadAudit), adminBadges, badgeTotal(Object.values(curationBadges ?? {})))}
      user={currentUser}
      onSignOut={signOut}
    >
      <Outlet />
    </ConsoleShell>
  );
}
