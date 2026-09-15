import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/account")({
  component: AccountShell,
});

function AccountShell() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/auth", search: { redirect: "/account/profile" } });
        return;
      }
      setReady(true);
    });
  }, [navigate]);

  if (!ready) {
    return <div className="p-10 text-sm text-muted-foreground">Loading account…</div>;
  }
  return <Outlet />;
}
