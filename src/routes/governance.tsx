import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
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
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const isMgmt = roles.includes("management");
  const isReviewer = roles.includes("qa_reviewer") || roles.includes("reviewer") || roles.includes("verifier");
  const isApprover = roles.includes("approver");
  const hasAny = isAdmin || isMgmt || isReviewer || isApprover;

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
        <nav className="flex flex-wrap gap-2 text-sm">
          {isAdmin || isMgmt ? (
            <Link to="/governance/subjects" className="rounded border border-border px-3 py-1.5 hover:bg-muted" activeProps={{ className: "bg-primary text-primary-foreground" }}>
              Review Subjects
            </Link>
          ) : null}
          {isReviewer || isAdmin ? (
            <Link to="/governance/queue" className="rounded border border-border px-3 py-1.5 hover:bg-muted" activeProps={{ className: "bg-primary text-primary-foreground" }}>
              My Queue
            </Link>
          ) : null}
          {isAdmin || isMgmt || isApprover ? (
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
