import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getMyDraft,
  saveMyDraft,
  submitMyDraftForReview,
  withdrawMyDraft,
} from "@/lib/governance/governance-ops.functions";

export const Route = createFileRoute("/my-submissions/$id")({
  component: DraftDetail,
});

function DraftDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getMyDraft);
  const saveFn = useServerFn(saveMyDraft);
  const submitFn = useServerFn(submitMyDraftForReview);
  const withdrawFn = useServerFn(withdrawMyDraft);

  const q = useQuery({
    queryKey: ["my-submissions", "detail", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [payload, setPayload] = useState("{}");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (q.data?.draft) {
      setTitle(q.data.draft.title ?? "");
      setDescription(q.data.draft.description ?? "");
      setExternalRef(q.data.draft.external_ref ?? "");
      setPayload(JSON.stringify(q.data.draft.payload ?? {}, null, 2));
    }
  }, [q.data?.draft]);

  const save = useMutation({
    mutationFn: async () => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = payload.trim() ? (JSON.parse(payload) as Record<string, unknown>) : {};
      } catch {
        throw new Error("payload must be valid JSON");
      }
      return saveFn({
        data: {
          id,
          subjectKind: q.data!.draft.subject_kind,
          title,
          description: description || undefined,
          externalRef: externalRef || undefined,
          payload: parsed,
        },
      });
    },
    onSuccess: () => {
      setMsg("Saved.");
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const submit = useMutation({
    mutationFn: () => submitFn({ data: { id } }),
    onSuccess: () => {
      setMsg("Submitted for review.");
      qc.invalidateQueries({ queryKey: ["my-submissions"] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawFn({ data: { id } }),
    onSuccess: () => navigate({ to: "/my-submissions" }),
    onError: (e: Error) => setMsg(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  if (!q.data) return <p className="text-sm text-muted-foreground">Draft not found.</p>;

  const { draft, subject, revisions } = q.data;
  const editable = draft.status === "draft";

  return (
    <div className="space-y-6">
      <section className="rounded border border-border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {draft.subject_kind} · status: {draft.status}
          {subject ? ` · subject: ${(subject as { current_status: string }).current_status}` : ""}
        </p>
        <div className="mt-3 space-y-3">
          <label className="block text-sm">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!editable}
              className="mt-1 w-full rounded border border-border bg-background p-2 text-sm disabled:opacity-60"
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={!editable}
              className="mt-1 w-full rounded border border-border bg-background p-2 text-sm disabled:opacity-60"
            />
          </label>
          <label className="block text-sm">
            External reference
            <input
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              disabled={!editable}
              className="mt-1 w-full rounded border border-border bg-background p-2 text-sm disabled:opacity-60"
            />
          </label>
          <label className="block text-sm">
            Payload (JSON)
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={8}
              disabled={!editable}
              className="mt-1 w-full rounded border border-border bg-background p-2 font-mono text-xs disabled:opacity-60"
            />
          </label>
        </div>
        {msg ? <p className="mt-2 text-xs text-muted-foreground">{msg}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => save.mutate()}
            disabled={!editable || save.isPending}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            onClick={() => submit.mutate()}
            disabled={!editable || submit.isPending}
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            Request review
          </button>
          <button
            onClick={() => withdraw.mutate()}
            disabled={!editable || withdraw.isPending}
            className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            Withdraw
          </button>
        </div>
      </section>

      {revisions.length > 0 ? (
        <section className="rounded border border-border p-4">
          <h2 className="text-sm font-semibold">Revision history</h2>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {(revisions as Array<{ id: string; revision: number; content_hash: string; submitted_at: string }>).map(
              (r) => (
                <li key={r.id}>
                  Rev {r.revision} · {new Date(r.submitted_at).toLocaleString()} · hash{" "}
                  <span className="font-mono">{r.content_hash.slice(0, 12)}…</span>
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
