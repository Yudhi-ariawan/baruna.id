import { Link, Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAccess } from "@/lib/admin/users.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration Portal — BARUNA" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminShell,
});

function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email?: string; name?: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const accessFn = useServerFn(getAdminAccess);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      const authenticated = Boolean(user);
      setSignedIn(authenticated);
      if (user) {
        setCurrentUser({
          email: user.email,
          name: (user.user_metadata?.display_name as string) || (user.user_metadata?.full_name as string) || user.email?.split("@")[0],
        });
      }
      setAuthReady(true);
      if (!authenticated) navigate({ to: "/auth", search: { redirect: "/admin/users" } });
    });
  }, [navigate]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const accessQuery = useQuery({
    queryKey: ["admin", "access"],
    queryFn: () => accessFn(),
    enabled: signedIn,
    retry: false,
  });

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      toast.success("Berhasil keluar dari sesi admin.");
      navigate({ to: "/auth" });
    } catch {
      toast.error("Gagal keluar.");
    }
  }

  if (!authReady || (signedIn && accessQuery.isLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <span className="rounded-2xl bg-navy p-3 text-white shadow-md animate-pulse">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <p className="font-semibold text-navy">Memeriksa hak akses administratif BARUNA…</p>
        </div>
      </div>
    );
  }

  if (!signedIn) return null;

  if (accessQuery.isError || !accessQuery.data?.canReadUsers) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <span className="inline-flex rounded-2xl bg-amber-100 p-4 text-amber-700 shadow-xs mb-4">
          <ShieldAlert className="h-10 w-10" />
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy">
          Akses Administratif Diperlukan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Akun Anda tidak memiliki izin role administrator atau pengelola sistem untuk mengakses portal tata kelola BARUNA.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="rounded-xl bg-navy px-5 py-2.5 text-xs font-semibold text-white hover:bg-marine transition shadow-xs"
          >
            Kembali ke Beranda Publik
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition"
          >
            Ganti Akun
          </button>
        </div>
      </main>
    );
  }

  const navItems = [
    {
      group: "Overview",
      items: [
        {
          label: "Dashboard Overview",
          to: "/admin" as const,
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      group: "Manajemen & Pengguna",
      items: [
        {
          label: "Users & Access",
          to: "/admin/users" as const,
          icon: Users,
          description: "Data pengguna & RBAC",
        },
      ],
    },
    {
      group: "Verifikasi & Kurasi",
      items: [
        {
          label: "Verifikasi Expert",
          to: "/admin/experts" as const,
          icon: UserCheck,
          description: "Pengajuan pakar baru",
        },
        {
          label: "Verifikasi Modul",
          to: "/admin/modules" as const,
          icon: BookOpen,
          description: "Kurasi materi pelatihan",
        },
        {
          label: "Persetujuan / Approvals",
          to: "/governance/subjects" as const,
          icon: ClipboardCheck,
          description: "Tata kelola & audit",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Modern Left Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-navy to-marine text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <span className="font-display text-sm font-extrabold text-navy tracking-tight block">
                BARUNA Admin
              </span>
              <span className="text-[10px] font-semibold text-marine uppercase tracking-wider block">
                Portal Tata Kelola
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navItems.map((group) => (
            <div key={group.group} className="space-y-1">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.group}
              </span>
              <div className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.exact
                      ? location.pathname === item.to
                      : location.pathname.startsWith(item.to);

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-navy text-white shadow-xs font-bold"
                          : "text-slate-600 hover:bg-slate-100 hover:text-navy"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive ? "text-white" : "text-slate-400 group-hover:text-navy"
                        }`}
                      />
                      <div className="min-w-0 flex-1 truncate">{item.label}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Sidebar Profile & Links */}
        <div className="border-t border-slate-100 p-3 space-y-2 bg-slate-50/50">
          <Link
            to="/"
            className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white hover:text-navy hover:shadow-2xs transition"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              Kembali ke Web Publik
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300" />
          </Link>

          {/* User Account & Logout */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-marine/10 text-xs font-bold text-marine uppercase">
                {currentUser?.name?.[0] || "A"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-navy leading-tight">
                  {currentUser?.name || "Admin"}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{currentUser?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Keluar Sesi Admin"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-navy">Portal Tata Kelola</span>
              <span>/</span>
              <span className="capitalize font-medium text-slate-700">
                {location.pathname.split("/")[2]?.replace(/-/g, " ") || "Dashboard"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Aktif
            </span>
            <Link
              to="/account/profile"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Profil Saya</span>
            </Link>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
