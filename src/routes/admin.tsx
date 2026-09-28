import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, ClipboardCheck, ShieldCheck, UserCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAccess } from "@/lib/admin/users.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administration — BARUNA" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminShell,
});

function AdminShell() {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const accessFn = useServerFn(getAdminAccess);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const authenticated = Boolean(data.user);
      setSignedIn(authenticated);
      setAuthReady(true);
      if (!authenticated) navigate({ to: "/auth", search: { redirect: "/admin/users" } });
    });
  }, [navigate]);

  const accessQuery = useQuery({
    queryKey: ["admin", "access"],
    queryFn: () => accessFn(),
    enabled: signedIn,
    retry: false,
  });

  if (!authReady || (signedIn && accessQuery.isLoading)) {
    return (
      <div className="p-10 text-sm text-muted-foreground">Checking administrative access…</div>
    );
  }
  if (!signedIn) return null;
  if (accessQuery.isError || !accessQuery.data?.canReadUsers) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold text-navy">Administrative access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have permission to manage BARUNA users.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block text-sm font-semibold text-marine hover:underline"
        >
          Return to homepage
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70">
      <header className="border-b border-border bg-white sticky top-0 z-30 shadow-2xs">
        <div className="mx-auto flex max-w-7xl flex-col md:flex-row md:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="rounded-xl bg-navy p-2 text-white shadow-xs shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-display text-base sm:text-lg md:text-xl font-bold text-navy leading-tight">
                  BARUNA Administration
                </h1>
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  Portal Tata Kelola &amp; Verifikasi
                </p>
              </div>
            </div>
            <Link
              to="/"
              className="md:hidden inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Public site
            </Link>
          </div>

          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs sm:text-sm -mx-4 px-4 sm:mx-0 sm:px-0 whitespace-nowrap scrollbar-none">
            <Link
              to="/admin/users"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-semibold text-slate-700 hover:bg-muted transition"
              activeProps={{ className: "bg-navy text-white hover:bg-navy border-navy" }}
            >
              <Users className="h-3.5 w-3.5" /> Users
            </Link>
            <Link
              to="/admin/experts"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-semibold text-slate-700 hover:bg-muted transition"
              activeProps={{ className: "bg-navy text-white hover:bg-navy border-navy" }}
            >
              <UserCheck className="h-3.5 w-3.5" /> Verifikasi Expert
            </Link>
            <Link
              to="/admin/modules"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-semibold text-slate-700 hover:bg-muted transition"
              activeProps={{ className: "bg-navy text-white hover:bg-navy border-navy" }}
            >
              <BookOpen className="h-3.5 w-3.5" /> Verifikasi Modul
            </Link>
            <Link
              to="/governance/subjects"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-semibold text-slate-700 hover:bg-muted transition"
              activeProps={{ className: "bg-navy text-white hover:bg-navy border-navy" }}
            >
              <ClipboardCheck className="h-3.5 w-3.5" /> Approvals
            </Link>
            <Link
              to="/"
              className="hidden md:inline-flex shrink-0 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Public site
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
