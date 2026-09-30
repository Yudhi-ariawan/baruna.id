import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/governance/governance.functions";

export const Route = createFileRoute("/governance")({
  head: () => ({
    meta: [
      { title: "Governance Review — BARUNA" },
      { name: "description", content: "Institutional quality-assurance review workspace." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: GovernanceShell,
});

function GovernanceShell() {
  const navigate = useNavigate();
  const [userReady, setUserReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setUserReady(true);
      if (!data.user) navigate({ to: "/auth", search: { redirect: "/governance" } });
    });
  }, [navigate]);

  const fetchRoles = useServerFn(getMyRoles);
  const rolesQ = useQuery({
    queryKey: ["governance", "my-roles"],
    queryFn: () => fetchRoles(),
    enabled: signedIn,
  });

  if (!userReady) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!signedIn) return null;

  const roles = rolesQ.data ?? [];
  const isAdmin = roles.includes("admin");
  const isMgmt = roles.includes("management");
  const isReviewer = roles.includes("qa_reviewer");
  const hasAny = isAdmin || isMgmt || isReviewer;

  if (rolesQ.isLoading) return <div className="p-8 text-sm text-muted-foreground">Checking access…</div>;

  if (!hasAny) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Governance workspace</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You don't have a governance role. This area is reserved for admins, management, and QA reviewers.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">
          Return home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Governance Review</h1>
          <p className="text-xs text-muted-foreground">
            Roles: {roles.join(", ") || "—"} · Recommendations only; final decisions rest with admin/management.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {isAdmin ? (
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Users className="h-3.5 w-3.5" /> Users Management
            </Link>
          ) : null}
          <Link
            to="/governance/subjects"
            className="rounded border border-border px-3 py-1.5 hover:bg-muted"
            activeProps={{ className: "bg-primary text-primary-foreground" }}
          >
            All Subjects
          </Link>
          {isReviewer || isAdmin ? (
            <Link to="/governance/queue" className="rounded border border-border px-3 py-1.5 hover:bg-muted" activeProps={{ className: "bg-primary text-primary-foreground" }}>
              My Queue
            </Link>
          ) : null}
          {isAdmin || isMgmt ? (
            <Link to="/governance/decisions" className="rounded border border-border px-3 py-1.5 hover:bg-muted" activeProps={{ className: "bg-primary text-primary-foreground" }}>
              Pending Decisions
            </Link>
          ) : null}
          {isAdmin || isMgmt ? (
            <Link to="/governance/templates" className="rounded border border-border px-3 py-1.5 hover:bg-muted" activeProps={{ className: "bg-primary text-primary-foreground" }}>
              Templates
            </Link>
          ) : null}
          {isAdmin ? (
            <Link to="/governance/roles" className="rounded border border-border px-3 py-1.5 hover:bg-muted" activeProps={{ className: "bg-primary text-primary-foreground" }}>
              Role Admin
            </Link>
          ) : null}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
