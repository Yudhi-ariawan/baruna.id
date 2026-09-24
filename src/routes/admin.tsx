import { Link, Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, ShieldCheck, Users } from "lucide-react";
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
      if (!authenticated) navigate({ to: "/auth", search: { redirect: "/admin" } });
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
  const canGovern = Boolean(accessQuery.data?.canReviewModules || accessQuery.data?.canVerifyModules || accessQuery.data?.canApproveModules);
  if (accessQuery.isError || (!accessQuery.data?.canReadUsers && !canGovern)) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold text-navy">Administrative access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have permission to use BARUNA administration or governance tools.
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
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-navy p-2 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold text-navy">BARUNA Administration</h1>
              <p className="text-xs text-muted-foreground">Secure user and access management</p>
            </div>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            {accessQuery.data?.canReadUsers ? <Link
              to="/admin/users"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-semibold hover:bg-muted"
              activeProps={{ className: "bg-navy text-white hover:bg-navy" }}
            >
              <Users className="h-4 w-4" /> Users
            </Link> : null}
            {canGovern ? <Link to="/admin/reviews" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-semibold hover:bg-muted" activeProps={{ className: "bg-navy text-white hover:bg-navy" }}>
              <ClipboardCheck className="h-4 w-4" /> Module Reviews
            </Link> : null}
            <Link to="/" className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted">
              Public site
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
