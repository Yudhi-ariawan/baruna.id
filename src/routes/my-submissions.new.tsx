import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { saveMyDraft } from "@/lib/governance/governance-ops.functions";

export const Route = createFileRoute("/my-submissions/new")({
  component: NewSubmission,
});

type Kind = "expert" | "module" | "knowledge_resource" | "training_need";

function NewSubmission() {
  const navigate = useNavigate();
  const save = useServerFn(saveMyDraft);
  const [kind, setKind] = useState<Kind>("knowledge_resource");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [payload, setPayload] = useState("{}");
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      let parsed: Record<string, unknown> = {};
      if (payload.trim()) {
        try {
          parsed = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          throw new Error("payload must be valid JSON");
        }
      }
      return save({
        data: {
          subjectKind: kind,
          title,
          description: description || undefined,
          externalRef: externalRef || undefined,
          payload: parsed,
        },
      });
    },
    onSuccess: (created) => navigate({ to: "/my-submissions/$id", params: { id: created.id } }),
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        m.mutate();
      }}
      className="space-y-4 rounded border border-border p-4"
    >
      <label className="block text-sm">
        Subject kind
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
        >
          <option value="knowledge_resource">Knowledge resource</option>
          <option value="module">Module</option>
          <option value="expert">Expert profile</option>
          <option value="training_need">Training need</option>
        </select>
      </label>
      <label className="block text-sm">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          rows={4}
          className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        External reference (optional)
        <input
          value={externalRef}
          onChange={(e) => setExternalRef(e.target.value)}
          maxLength={200}
          className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        Payload (JSON)
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded border border-border bg-background p-2 font-mono text-xs"
        />
      </label>
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
      <button
        type="submit"
        disabled={m.isPending || !title.trim()}
        className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {m.isPending ? "Saving…" : "Save draft"}
      </button>
    </form>
  );
}
