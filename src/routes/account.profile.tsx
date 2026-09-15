import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { UserRound } from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { AvatarManager } from "@/components/baruna/account/AvatarManager";
import { ProfileIdentityForm } from "@/components/baruna/account/ProfileIdentityForm";
import { getAccountProfile } from "@/lib/account/account.functions";

export const Route = createFileRoute("/account/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — BARUNA" },
      { name: "description", content: "Manage your BARUNA account identity and avatar." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AccountProfilePage,
});

function AccountProfilePage() {
  const profileFn = useServerFn(getAccountProfile);
  const profileQuery = useQuery({
    queryKey: ["account", "profile"],
    queryFn: () => profileFn(),
    retry: false,
  });
  const [avatarOverride, setAvatarOverride] = useState<string | null | undefined>(undefined);

  return (
    <div className="min-h-screen bg-slate-50/70">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-marine/10 p-2 text-marine">
            <UserRound className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">My Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your account identity and profile avatar.
            </p>
          </div>
        </div>

        {profileQuery.isLoading ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Loading your profile…
          </div>
        ) : profileQuery.isError || !profileQuery.data ? (
          <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Unable to load your profile. Please sign in again or refresh this page.
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <AvatarManager
              userId={profileQuery.data.id}
              displayName={profileQuery.data.displayName}
              avatarUrl={
                avatarOverride === undefined ? profileQuery.data.avatarUrl : avatarOverride
              }
              onAvatarChange={setAvatarOverride}
            />
            <ProfileIdentityForm profile={profileQuery.data} />
          </div>
        )}
      </main>
    </div>
  );
}
