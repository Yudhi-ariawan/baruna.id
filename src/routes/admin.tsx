import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, GraduationCap, LayoutDashboard, ShieldAlert, Users } from "lucide-react";
import { getAdminAccess } from "@/lib/admin/users.functions";
import { getGovernanceConsoleAccess, hasConsoleAccess } from "@/lib/governance/console-access.functions";
import {
  ConsoleAccessDenied,
  ConsoleLoading,
  ConsoleShell,
  type ConsoleNavGroup,
} from "@/components/baruna/console/ConsoleShell";
import { useConsoleSession } from "@/components/baruna/console/useConsoleSession";

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
const ADMIN_NAV: ConsoleNavGroup[] = [
  {
    group: "Overview",
    items: [{ label: "Dashboard Overview", to: "/admin", icon: LayoutDashboard, exact: true }],
  },
  {
    group: "Manajemen & Pengguna",
    items: [{ label: "Users & Access", to: "/admin/users", icon: Users }],
  },
  {
    group: "Verifikasi & Kurasi",
    items: [
      { label: "Konsol Kurasi", to: "/governance", icon: ClipboardCheck },
      { label: "Kualifikasi Trainer", to: "/admin/trainer-applications", icon: GraduationCap },
    ],
  },
];

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
      navGroups={ADMIN_NAV}
      user={currentUser}
      onSignOut={signOut}
    >
      <Outlet />
    </ConsoleShell>
  );
}
