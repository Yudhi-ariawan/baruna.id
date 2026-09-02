import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getReviewTemplateFull,
  addTemplateVersion,
  publishTemplateVersion,
  setActiveTemplateVersion,
  deprecateReviewTemplate,
} from "@/lib/governance/governance-ops.functions";

export const Route = createFileRoute("/governance/templates/$id")({
  component: TemplateDetail,
});

function TemplateDetail() {
  const { id } = Route.useParams();
  const getFull = useServerFn(getReviewTemplateFull);
  const addVer = useServerFn(addTemplateVersion);
  const publishVer = useServerFn(publishTemplateVersion);
  const setActive = useServerFn(setActiveTemplateVersion);
  const deprecate = useServerFn(deprecateReviewTemplate);
  const qc = useQueryClient();
  const [schemaText, setSchemaText] = useState(
    '{\n  "criteria": [\n    { "id": "rigor", "label": "Rigor", "type": "rating", "min": 1, "max": 5 }\n  ]\n}',
  );
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["gov", "template", id],
    queryFn: () => getFull({ data: { id } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gov", "template", id] });

  const addMut = useMutation({
    mutationFn: async () => {
      setErr(null);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(schemaText);
      } catch {
        throw new Error("Invalid JSON");
      }
      return addVer({ data: { templateId: id, criteriaSchema: parsed } });
    },
    onError: (e) => setErr((e as Error).message),
    onSuccess: invalidate,
  });

  const pubMut = useMutation({
    mutationFn: async (versionId: string) => publishVer({ data: { versionId } }),
    onSuccess: invalidate,
  });
  const activeMut = useMutation({
    mutationFn: async (versionId: string) => setActive({ data: { templateId: id, versionId } }),
    onSuccess: invalidate,
  });
  const depMut = useMutation({
    mutationFn: async () => deprecate({ data: { templateId: id } }),
    onSuccess: invalidate,
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!q.data) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Template not found.</p>
        <Link to="/governance/templates" className="text-xs text-primary hover:underline">
          ← Back
        </Link>
      </div>
    );
  }

  const { template, versions } = q.data;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/governance/templates" className="text-xs text-primary hover:underline">
          ← All templates
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-foreground">{template.name}</h2>
        <p className="text-xs text-muted-foreground">
          Kind: {template.subject_kind}
          {template.deprecated_at ? " · deprecated" : ""}
        </p>
      </div>

      {!template.deprecated_at ? (
        <button
          onClick={() => {
            if (confirm("Deprecate this template? Existing assignments continue.")) depMut.mutate();
          }}
          className="rounded border border-border px-3 py-1 text-xs text-destructive hover:bg-muted"
        >
          Deprecate template
        </button>
      ) : null}

      <section className="rounded border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Add new version</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Draft criteria schema (JSON). Version is immutable once published.
        </p>
        <textarea
          value={schemaText}
          onChange={(e) => setSchemaText(e.target.value)}
          rows={8}
          className="mt-2 block w-full rounded border border-border bg-background p-2 font-mono text-xs"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => addMut.mutate()}
            disabled={addMut.isPending || Boolean(template.deprecated_at)}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            Add draft version
          </button>
          {err ? <span className="text-xs text-destructive">{err}</span> : null}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Versions</h3>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No versions yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded border border-border">
            {versions.map((v) => {
              const isActive = template.active_version_id === v.id;
              const published = Boolean(v.published_at);
              return (
                <li key={v.id} className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        v{v.version}
                        {isActive ? (
                          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                            active
                          </span>
                        ) : null}
                        {published ? (
                          <span className="ml-2 text-xs text-muted-foreground">published</span>
                        ) : (
                          <span className="ml-2 text-xs text-muted-foreground">draft</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!published ? (
                        <button
                          onClick={() => pubMut.mutate(v.id)}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          Publish
                        </button>
                      ) : null}
                      {published && !isActive && !template.deprecated_at ? (
                        <button
                          onClick={() => activeMut.mutate(v.id)}
                          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                        >
                          Set active
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">Schema</summary>
                    <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(v.criteria_schema, null, 2)}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
