import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, GraduationCap, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/baruna/Navbar";
import { TrainerApplicationForm } from "@/components/baruna/experts/TrainerApplicationForm";
import { supabase } from "@/integrations/supabase/client";
import { getActiveUserId } from "@/lib/authSession";
import { formatDate } from "@/lib/experts";
import { getMyTrainerApplication, withdrawTrainerApplication } from "@/lib/experts/trainer-application.functions";

export const Route = createFileRoute("/experts/trainer-application")({
  head: () => ({
    meta: [
      { title: "Trainer Application — BARUNA Experts" },
      { name: "description", content: "Apply for BARUNA Trainer qualification as a verified expert." },
    ],
  }),
  component: TrainerApplicationPage,
});

const STATUS_TEXT: Record<string, string> = {
  not_applied: "Not applied",
  candidate: "Candidate",
  inactive: "Inactive",
  suspended: "Suspended",
  retired: "Retired",
  active: "Active",
};

function TrainerApplicationPage() {
  const load = useServerFn(getMyTrainerApplication);
  const withdraw = useServerFn(withdrawTrainerApplication);
  const client = useQueryClient();
  const userId = getActiveUserId();
  const query = useQuery({
    queryKey: ["experts", "trainer-application", userId ?? "guest"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      return load();
    },
    retry: false,
    staleTime: 15_000,
  });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["experts", "trainer-application"] });
    await client.invalidateQueries({ queryKey: ["experts", "trainer-portal-dashboard"] });
  };

  const body = (() => {
    if (query.isLoading) return <Notice icon={Loader2} spin title="Checking your eligibility…" />;
    if (query.isError) return <Notice icon={ShieldAlert} title="Unable to load your trainer status" text={query.error instanceof Error ? query.error.message : undefined} />;
    const state = query.data;
    if (state === null || state === undefined) {
      return <Notice icon={ShieldAlert} title="Please sign in" text="Sign in with your verified expert account to apply." action={{ label: "Sign in", to: "/auth" }} />;
    }
    if (state.eligibility === "not_expert") {
      return <Notice icon={GraduationCap} title="Verified expert status required" text="Trainer qualification is open to Verified BARUNA Experts. Register as an expert first; once approved you can apply here." action={{ label: "Register as an Expert", to: "/experts/join" }} />;
    }
    if (state.eligibility === "active_trainer") {
      return <Notice icon={CheckCircle2} title="You are an active BARUNA Trainer" text={`Level: ${state.trainerLevel ?? "certified"}.`} action={{ label: "Open Trainer Portal", to: "/experts/portal" }} />;
    }
    const app = state.latestApplication;
    if (app?.status === "submitted") {
      return (
        <Notice icon={Clock} title="Application under review" text={`Submitted ${formatDate(app.createdAt)}. BARUNA administrators will review your qualification; you will see the decision here.`}>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("Withdraw this application?")) return;
              try {
                await withdraw({ data: { applicationId: app.id } });
                toast.success("Pengajuan ditarik.");
              } catch (cause) {
                toast.error(cause instanceof Error ? cause.message : "Gagal menarik pengajuan.");
              }
              await refresh();
            }}
            className="mt-5 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground/70 hover:bg-muted"
          >
            Withdraw Application
          </button>
        </Notice>
      );
    }
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 text-sm shadow-soft">
          <p>Current trainer status: <strong className="text-navy">{STATUS_TEXT[state.trainerStatus] ?? state.trainerStatus}</strong></p>
          {app?.status === "rejected" && (
            <p className="mt-2 flex gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Your previous application ({formatDate(app.createdAt)}) was not approved{app.decisionNote ? `: ${app.decisionNote}` : "."} You may submit a new application.</span>
            </p>
          )}
        </div>
        <TrainerApplicationForm onSubmitted={refresh} />
      </div>
    );
  })();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link to="/experts/become-trainer" className="text-sm font-semibold text-marine">← Become a BARUNA Trainer</Link>
        <h1 className="mt-4 font-display text-3xl font-extrabold text-navy">Trainer Application</h1>
        <p className="mt-2 text-sm text-muted-foreground">Trainer status is a separate qualification reviewed by BARUNA administrators.</p>
        <div className="mt-6">{body}</div>
      </main>
    </div>
  );
}

function Notice({ icon: Icon, title, text, action, spin, children }: { icon: React.ElementType; title: string; text?: string; action?: { label: string; to: string }; spin?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-soft">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-marine/10 text-marine"><Icon className={`h-7 w-7 ${spin ? "animate-spin" : ""}`} /></span>
      <h2 className="mt-4 font-display text-xl font-bold text-navy">{title}</h2>
      {text && <p className="mt-2 max-w-lg text-sm text-muted-foreground">{text}</p>}
      {action && <Link to={action.to} className="mt-5 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy">{action.label}</Link>}
      {children}
    </div>
  );
}
