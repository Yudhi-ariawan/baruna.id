import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getTemplateVersionSchema } from "@/lib/governance/governance-ops.functions";

type FieldSpec = {
  type?: "string" | "number" | "boolean" | "enum";
  label?: string;
  required?: boolean;
  min?: number;
  max?: number;
  values?: unknown[];
};

type Props = {
  templateVersionId: string | null;
  initial: Record<string, unknown>;
  disabled?: boolean;
  onChange: (criteria: Record<string, unknown>) => void;
};

export function ReviewCriteriaForm({ templateVersionId, initial, disabled, onChange }: Props) {
  const fn = useServerFn(getTemplateVersionSchema);
  const q = useQuery({
    queryKey: ["governance", "template-version", templateVersionId],
    queryFn: () => fn({ data: { templateVersionId: templateVersionId! } }),
    enabled: !!templateVersionId,
  });

  const fields = useMemo(() => {
    const schema = (q.data?.criteria_schema ?? {}) as { fields?: Record<string, FieldSpec> };
    return Object.entries(schema.fields ?? {});
  }, [q.data]);

  const [values, setValues] = useState<Record<string, unknown>>(initial ?? {});
  useEffect(() => {
    setValues(initial ?? {});
  }, [initial]);

  if (!templateVersionId) {
    return (
      <p className="text-xs text-muted-foreground">
        No review template attached to this assignment. Rationale-only submission.
      </p>
    );
  }
  if (q.isLoading) return <p className="text-xs text-muted-foreground">Loading criteria…</p>;
  if (q.error) return <p className="text-xs text-destructive">{(q.error as Error).message}</p>;
  if (fields.length === 0) {
    return <p className="text-xs text-muted-foreground">Template has no criteria fields.</p>;
  }

  const update = (key: string, v: unknown) => {
    const next = { ...values, [key]: v };
    setValues(next);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {fields.map(([key, spec]) => {
        const label = spec.label ?? key;
        const req = spec.required ? " *" : "";
        const val = values[key];
        if (spec.type === "number") {
          return (
            <label key={key} className="flex flex-col text-xs">
              <span className="mb-1">{label}{req}</span>
              <input
                type="number"
                min={spec.min}
                max={spec.max}
                disabled={disabled}
                value={typeof val === "number" ? val : ""}
                onChange={(e) => update(key, e.target.value === "" ? null : Number(e.target.value))}
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
          );
        }
        if (spec.type === "boolean") {
          return (
            <label key={key} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                disabled={disabled}
                checked={Boolean(val)}
                onChange={(e) => update(key, e.target.checked)}
              />
              <span>{label}{req}</span>
            </label>
          );
        }
        if (spec.type === "enum") {
          return (
            <label key={key} className="flex flex-col text-xs">
              <span className="mb-1">{label}{req}</span>
              <select
                disabled={disabled}
                value={typeof val === "string" ? val : ""}
                onChange={(e) => update(key, e.target.value || null)}
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">Select…</option>
                {(spec.values ?? []).map((v) => (
                  <option key={String(v)} value={String(v)}>
                    {String(v)}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        return (
          <label key={key} className="flex flex-col text-xs">
            <span className="mb-1">{label}{req}</span>
            <textarea
              disabled={disabled}
              value={typeof val === "string" ? val : ""}
              onChange={(e) => update(key, e.target.value)}
              rows={2}
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
        );
      })}
    </div>
  );
}
