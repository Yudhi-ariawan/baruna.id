import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export function RequireAuth({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const redirectHome = () => {
      if (mounted) {
        setAuthenticated(false);
        void navigate({ to: "/", replace: true });
      }
    };

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data.user) {
        redirectHome();
        return;
      }
      setAuthenticated(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        redirectHome();
      } else if (mounted) {
        setAuthenticated(true);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!authenticated) {
    return <div className="p-10 text-sm text-muted-foreground">Checking your session…</div>;
  }

  return children;
}
