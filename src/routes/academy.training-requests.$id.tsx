import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, PencilLine, RotateCcw } from "lucide-react";
import { Navbar } from "@/components/baruna/Navbar";
import { StageBadge } from "@/components/baruna/academy/training-requests/shared";
import { formatDateTime, localToDetail } from "@/components/baruna/academy/training-requests/view-model";
import { RequestTimeline } from "@/components/baruna/academy/training-requests/RequestTimeline";
import { RequestDetails, RequesterCards } from "@/components/baruna/academy/training-requests/RequestContent";
import { WithdrawPanel } from "@/components/baruna/academy/training-requests/WithdrawPanel";
import { getMyTrainingRequest } from "@/lib/training-requests/my-requests.functions";
import { useRequest } from "@/lib/trainingRequests";
import { usePresentationMode } from "@/lib/demoMode";
import { useAuthUser } from "@/lib/learning/useBackendEnrolment";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/academy/training-requests/$id")({
  head: () => ({
    meta: [
      { title: "Training Request — Academy — BARUNA" },
      { name: "description", content: "View the status history of your BARUNA training request." },
    ],
  }),
  component: TrainingRequestDetailPage,
});

function TrainingRequestDetailPage() {
  const { id } = useParams({ from: Route.id });
  const [presentation] = usePresentationMode();
  const { user, loading: authLoading } = useAuthUser();
  const queryClient = useQueryClient();
  const getFn = useServerFn(getMyTrainingRequest);
  const query = useQuery({
    queryKey: ["training-requests", "detail", id, user?.id],
    queryFn: () => getFn({ data: { id } }),
    enabled: !presentation && Boolean(user) && UUID.test(id),
    staleTime: 15_000,
    retry: false,
  });
  const demo = useRequest(id);
  const request = presentation ? (demo ? localToDetail(demo) : null) : (query.data ?? null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["training-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  if (!presentation && (authLoading || (user && UUID.test(id) && query.isLoading))) {
    return <Shell><p className="py-16 text-center text-sm text-muted-foreground">Loading training request…</p></Shell>;
  }

  if (!request) {
    const signedOut = !presentation && !user;
    return (
      <Shell>
        <div className="mx-auto max-w-2xl py-8 text-center">
          <h1 className="font-display text-2xl font-extrabold text-navy">
            {signedOut ? "Sign in to view this request" : "Request not found"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {signedOut
              ? "Training requests are saved to your BARUNA account."
              : query.isError
                ? (query.error as Error).message
                : "This training request does not exist or belongs to another account."}
          </p>
          {signedOut ? (
            <Link
              to="/auth"
              search={{ redirect: `/academy/training-requests/${id}` }}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
            >
              Sign in
            </Link>
          ) : (
            <Link
              to="/academy/training-requests"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-3 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
            >
              <ArrowLeft className="h-4 w-4" /> Back to My Training Requests
            </Link>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Link
        to="/academy/training-requests"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-marine transition-colors hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> My Training Requests
      </Link>

      {/* Header */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-mono text-xs font-bold text-marine">{request.reference}</span>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-navy">{request.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[request.category, `Submitted ${formatDateTime(request.submittedAt)}`].filter(Boolean).join(" · ")}
              {request.revisionCount > 1 ? ` · revision ${request.revisionCount}` : ""}
            </p>
          </div>
          <StageBadge stage={request.stage.key} />
        </div>
      </div>

      {request.canRevise ? (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-navy">
            <RotateCcw className="h-4 w-4 text-destructive" /> The BARUNA team asked you to revise this request
          </p>
          {request.revisionNote ? (
            <p className="mt-2 whitespace-pre-line rounded-lg bg-card p-3 text-sm text-foreground/90">
              {request.revisionNote}
            </p>
          ) : null}
          <Link
            to="/academy/request-training"
            search={{ revise: request.id }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-marine px-5 py-2.5 text-sm font-semibold text-marine-foreground transition-colors hover:bg-navy"
          >
            <PencilLine className="h-4 w-4" /> Revise &amp; Resubmit
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <RequestTimeline request={request} />
        <RequesterCards form={request.form} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold text-navy">Request Details</h2>
        <div className="mt-4">
          <RequestDetails form={request.form} />
        </div>
        {request.canWithdraw ? (
          <div className="mt-6 border-t border-border pt-5">
            <WithdrawPanel requestId={request.id} onWithdrawn={refresh} />
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
