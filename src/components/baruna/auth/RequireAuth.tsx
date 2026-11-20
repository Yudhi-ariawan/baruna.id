import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RoutePendingSkeleton } from "@/components/baruna/loading/RoutePendingSkeleton";

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
    // The guarded page draws its own Navbar, so the skeleton keeps one too.
    return <RoutePendingSkeleton label="Memeriksa sesi Anda…" withStats />;
  }

  return children;
}
