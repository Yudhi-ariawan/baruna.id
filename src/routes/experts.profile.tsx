import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FilePenLine, UserPlus } from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { listMyExpertApplications } from "@/lib/experts/application.functions";
import type { ExpertApplicationStatus } from "@/lib/experts/application.types";

export const Route = createFileRoute("/experts/profile")({
  head: () => ({
    meta: [
      { title: "My Expert Profile — BARUNA Experts" },
      { name: "description", content: "Track your BARUNA expert application and review status." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MyExpertProfilePage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending: "Submitted",
  under_review: "Under Review",
  decision_pending: "Decision Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function statusFor(application: ExpertApplicationStatus) {
  return STATUS_LABEL[application.reviewStatus ?? application.draftStatus] ?? "In Progress";
}

function MyExpertProfilePage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listMyExpertApplications);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const authenticated = Boolean(data.user);
      setSignedIn(authenticated);
      setAuthReady(true);
      if (!authenticated) {
        navigate({
          to: "/auth",
          search: { mode: "signin", redirect: "/experts/profile" },
          replace: true,
        });
      }
    });
  }, [navigate]);

  const applications = useQuery({
    queryKey: ["experts", "my-applications"],
    queryFn: () => listFn(),
    enabled: signedIn,
    retry: false,
  });

  if (!authReady || (signedIn && applications.isLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-16 text-sm text-muted-foreground sm:px-6">
          Loading your expert application…
        </main>
      </div>
    );
  }
  if (!signedIn) return null;

  const rows = applications.data ?? [];
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/experts"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Experts
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">My Expert Profile</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Track your application from draft through governance review and approval.
            </p>
          </div>
          <Link
            to="/experts/join"
            className="inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground hover:bg-navy"
          >
            <UserPlus className="h-4 w-4" />{" "}
            {rows.some((row) => row.draftStatus === "draft") ? "Continue Draft" : "New Application"}
          </Link>
        </div>

        {applications.isError ? (
          <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(applications.error as Error).message}
          </p>
        ) : rows.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <UserPlus className="mx-auto h-9 w-9 text-marine" />
            <h2 className="mt-4 font-display text-xl font-bold text-navy">
              No expert application yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Start an application to join BARUNA's curated marine and fisheries expert network.
            </p>
            <Link
              to="/experts/join"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-white"
            >
              Join as an Expert <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        ) : (
          <div className="mt-6 space-y-4">
            {rows.map((application) => {
              const status = statusFor(application);
              const Icon =
                status === "Approved" ? CheckCircle2 : status === "Draft" ? FilePenLine : Clock3;
              return (
                <article
                  key={application.draftId}
                  className="rounded-2xl border border-border bg-card p-6 shadow-soft"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-marine">
                        Expert Application
                      </p>
                      <h2 className="mt-1 font-display text-lg font-bold text-navy">
                        {application.title}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Updated {new Date(application.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-marine/10 px-3 py-1.5 text-xs font-bold text-marine">
                      <Icon className="h-3.5 w-3.5" /> {status}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Expertise</p>
                      <p className="mt-1 font-semibold text-navy">
                        {application.payload.expertise?.length ?? 0} areas
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Documents</p>
                      <p className="mt-1 font-semibold text-navy">
                        {application.payload.documents?.length ?? 0} secured files
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Review Reference</p>
                      <p className="mt-1 truncate font-mono text-xs text-navy">
                        {application.subjectId ?? "Not submitted"}
                      </p>
                    </div>
                  </div>
                  {application.draftStatus === "draft" && (
                    <Link
                      to="/experts/join"
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-marine hover:underline"
                    >
                      Continue editing <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
