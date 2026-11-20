// Shown by the router while a page's loader is still running (slow network, server
// call). Every page with a loader is a top-level page that draws its own Navbar, so
// the Navbar is kept here and the menu does not disappear during the wait.
//
// The router can also render this for the root route itself (during server render),
// where the app providers (language, viewer) are not mounted yet. The Navbar needs
// them, so it is only drawn when they exist; otherwise a plain skeleton is shown.
import { useContext } from "react";
import { Navbar } from "@/components/baruna/Navbar";
import { HomeExperienceContext } from "@/components/baruna/home-experience";
import { PageSkeleton } from "./Skeletons";

export function RoutePendingSkeleton({ label = "Memuat halaman…", withStats = false }: { label?: string; withStats?: boolean }) {
  const hasProviders = useContext(HomeExperienceContext) !== null;
  return (
    <div className="min-h-screen bg-background">
      {hasProviders ? <Navbar /> : null}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PageSkeleton label={label} withStats={withStats} />
      </main>
    </div>
  );
}
