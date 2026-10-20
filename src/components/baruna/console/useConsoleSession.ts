import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ConsoleUser = { email?: string; name?: string };

/** Signed-in user for the admin and curation consoles; sends visitors to /auth. */
export function useConsoleSession(redirectTo: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<ConsoleUser | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      setSignedIn(Boolean(user));
      if (user) {
        setCurrentUser({
          email: user.email,
          name:
            (user.user_metadata?.display_name as string) ||
            (user.user_metadata?.full_name as string) ||
            (user.email ? user.email.split("@")[0] : "Pengguna"),
        });
      }
      setAuthReady(true);
      if (!user) navigate({ to: "/auth", search: { redirect: redirectTo } });
    });
  }, [navigate, redirectTo]);

  async function signOut() {
    try {
      await supabase.auth.signOut();
      queryClient.clear();
      toast.success("Berhasil keluar dari sesi.");
      navigate({ to: "/auth" });
    } catch {
      toast.error("Gagal keluar.");
    }
  }

  return { authReady, signedIn, currentUser, signOut };
}
