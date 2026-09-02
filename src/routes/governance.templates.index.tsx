import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listReviewTemplates,
  createReviewTemplate,
} from "@/lib/governance/governance-ops.functions";

type SubjectKind = "expert" | "module" | "knowledge_resource" | "training_need";
const KINDS: SubjectKind[] = ["expert", "module", "knowledge_resource", "training_need"];

export const Route = createFileRoute("/governance/templates/")({
  component: TemplatesIndex,
});

function TemplatesIndex() {
  const list = useServerFn(listReviewTemplates);
  const create = useServerFn(createReviewTemplate);
  const qc = useQueryClient();
  const [kind, setKind] = useState<SubjectKind | "">("");
  const [name, setName] = useState("");
  const [newKind, setNewKind] = useState<SubjectKind>("expert");

  const q = useQuery({
    queryKey: ["gov", "templates", kind],
    queryFn: () => list({ data: kind ? { kind } : {} }),
  });

  const createMut = useMutation({
    mutationFn: async () => create({ data: { subjectKind: newKind, name } }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["gov", "templates"] });
    },
  });

  return (
    <div className="space-y-6">
      <section className="rounded border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Create new template</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">
            Subject kind
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as SubjectKind)}
              className="mt-1 block rounded border border-border bg-background px-2 py-1 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground grow min-w-[240px]">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-sm"
              placeholder="e.g. Expert QA rubric v1"
            />
          </label>
          <button
            type="button"
            disabled={!name.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            Create
          </button>
        </div>
        {createMut.error ? (
          <p className="mt-2 text-xs text-destructive">{(createMut.error as Error).message}</p>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Templates</h2>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as SubjectKind | "")}
            className="ml-auto rounded border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="">All kinds</option>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates.</p>
        ) : (
          <ul className="divide-y divide-border rounded border border-border">
            {(q.data ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between p-3">
                <div>
                  <Link
                    to="/governance/templates/$id"
                    params={{ id: t.id }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {t.subject_kind} · {t.active_version_id ? "active version set" : "no active version"}
                    {t.deprecated_at ? " · deprecated" : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(t.updated_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
