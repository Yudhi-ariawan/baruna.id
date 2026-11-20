import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { GraduationCap, ShieldAlert } from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { RoutePendingSkeleton } from "@/components/baruna/loading/RoutePendingSkeleton";
import { useTrainerPortal } from "@/lib/experts/useTrainerPortal";
import { CandidatePortalHub } from "@/components/baruna/experts/CandidatePortalHub";

export const Route = createFileRoute("/experts/portal")({ component: TrainerPortalGuard });

function TrainerPortalGuard() {
  const navigate = useNavigate();
  const query = useTrainerPortal();
  useEffect(() => {
    if (!query.isLoading && !query.data && !query.isError) void navigate({ to: "/auth", search: { mode: "signin", redirect: "/experts/portal" }, replace: true });
  }, [navigate, query.data, query.isError, query.isLoading]);
  if (query.isLoading || (!query.data && !query.isError)) return <RoutePendingSkeleton label="Checking trainer access…" withStats />;
  if (query.isError) return <StateScreen icon={ShieldAlert} title="Unable to verify trainer access" description="Please sign in again or try refreshing this page." />;
  const data = query.data;
  if (!data) return null;
  if (data.access === "registered_user") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <CandidatePortalHub userDisplayName={data.expertName} />
      </div>
    );
  }
  if (data.access === "expert_non_trainer") return <StateScreen icon={GraduationCap} title="Trainer qualification required" description={`Your expert profile${data.expertName ? ` (${data.expertName})` : ""} is recognized, but its trainer qualification is not active. Submit a trainer qualification application to unlock this workspace.`} action="Apply for Trainer Qualification" href="/experts/trainer-application" />;
  return <Outlet />;
}

function StateScreen({ icon: Icon, title, description, action, href }: { icon: React.ElementType; title: string; description?: string; action?: string; href?: string }) {
  return <div className="min-h-screen bg-background"><Navbar /><main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-marine/10 text-marine"><Icon className="h-8 w-8" /></span><h1 className="mt-6 font-display text-3xl font-extrabold text-navy">{title}</h1>{description && <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>}{action && href && <Link to={href} className="mt-7 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-white hover:bg-navy">{action}</Link>}<Link to="/experts" className="mt-4 text-sm font-semibold text-marine hover:text-navy">Back to Experts</Link></main></div>
}
