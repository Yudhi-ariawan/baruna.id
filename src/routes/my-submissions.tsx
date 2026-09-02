import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/my-submissions")({
  head: () => ({
    meta: [
      { title: "My Submissions — BARUNA" },
      { name: "description", content: "Draft, submit, and track your BARUNA review submissions." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MySubmissionsShell,
});

function MySubmissionsShell() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setReady(true);
      if (!data.user) navigate({ to: "/auth", search: { redirect: "/my-submissions" } });
    });
  }, [navigate]);

  if (!ready) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!signedIn) return null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Submissions</h1>
          <p className="text-xs text-muted-foreground">
            Draft submissions, request review, and track institutional QA outcomes.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            to="/my-submissions"
            activeOptions={{ exact: true }}
            className="rounded border border-border px-3 py-1.5 hover:bg-muted"
            activeProps={{ className: "bg-primary text-primary-foreground" }}
          >
            All drafts
          </Link>
          <Link
            to="/my-submissions/new"
            className="rounded border border-border px-3 py-1.5 hover:bg-muted"
            activeProps={{ className: "bg-primary text-primary-foreground" }}
          >
            New submission
          </Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
