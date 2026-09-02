import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignReviewer,
  cancelAssignment,
  getReviewTemplateFull,
  listReviewers,
  listReviewTemplates,
  reassignReviewer,
  setRequiredRecommendations,
} from "@/lib/governance/governance-ops.functions";

type Assignment = {
  id: string;
  reviewer_id: string;
  status: string;
  due_at: string | null;
  conflict_of_interest_declared: boolean;
  conflict_of_interest_reason: string | null;
  template_version_id: string | null;
};

type SubjectKind = "expert" | "module" | "knowledge_resource" | "training_need";

type Props = {
  subjectId: string;
  subjectKind: SubjectKind;
  requiredRecommendations: number;
  assignments: Assignment[];
  onChanged: () => void;
};

export function AssignmentPanel({
  subjectId,
  subjectKind,
  requiredRecommendations,
  assignments,
  onChanged,
}: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listReviewers);
  const assignFn = useServerFn(assignReviewer);
  const reassignFn = useServerFn(reassignReviewer);
  const cancelFn = useServerFn(cancelAssignment);
  const setReqFn = useServerFn(setRequiredRecommendations);
  const listTemplatesFn = useServerFn(listReviewTemplates);
  const getTemplateFn = useServerFn(getReviewTemplateFull);

  const reviewersQ = useQuery({
    queryKey: ["governance", "reviewers"],
    queryFn: () => listFn(),
  });

  const templatesQ = useQuery({
    queryKey: ["governance", "templates", subjectKind],
    queryFn: () => listTemplatesFn({ data: { kind: subjectKind } }),
  });

  const [reviewerId, setReviewerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [required, setRequired] = useState(requiredRecommendations);
  const [reassignFor, setReassignFor] = useState<string | null>(null);
  const [newReviewerId, setNewReviewerId] = useState("");
  const [reassignTemplateId, setReassignTemplateId] = useState("");

  const templateDetailQ = useQuery({
    queryKey: ["governance", "template-detail", templateId],
    queryFn: () => getTemplateFn({ data: { id: templateId } }),
    enabled: !!templateId,
  });
  const reassignTemplateDetailQ = useQuery({
    queryKey: ["governance", "template-detail", reassignTemplateId],
    queryFn: () => getTemplateFn({ data: { id: reassignTemplateId } }),
    enabled: !!reassignTemplateId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["governance", "subjects", "detail", subjectId] });
    onChanged();
  };

  const activeVersionId = templateDetailQ.data?.template?.active_version_id ?? null;
  const reassignVersionId =
    reassignTemplateDetailQ.data?.template?.active_version_id ?? null;

  const mAssign = useMutation({
    mutationFn: () =>
      assignFn({
        data: {
          subjectId,
          reviewerId,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          templateVersionId: activeVersionId ?? undefined,
        },
      }),
    onSuccess: () => {
      setReviewerId("");
      setDueAt("");
      setTemplateId("");
      invalidate();
    },
  });

  const mReassign = useMutation({
    mutationFn: (assignmentId: string) =>
      reassignFn({
        data: {
          assignmentId,
          newReviewerId,
          templateVersionId: reassignVersionId ?? undefined,
        },
      }),
    onSuccess: () => {
      setReassignFor(null);
      setNewReviewerId("");
      setReassignTemplateId("");
      invalidate();
    },
  });

  const mCancel = useMutation({
    mutationFn: (assignmentId: string) => cancelFn({ data: { assignmentId } }),
    onSuccess: invalidate,
  });

  const mSetReq = useMutation({
    mutationFn: () => setReqFn({ data: { subjectId, n: required } }),
    onSuccess: invalidate,
  });

  const reviewerOptions = reviewersQ.data ?? [];
  const templateOptions = (templatesQ.data ?? []).filter((t) => !t.deprecated_at);

  return (
    <div className="space-y-4">
      <div className="rounded border border-border p-3">
        <div className="flex items-end gap-2">
          <label className="flex flex-col text-xs">
            <span className="mb-1 text-muted-foreground">Required recommendations</span>
            <input
              type="number"
              min={1}
              max={10}
              value={required}
              onChange={(e) => setRequired(Number(e.target.value))}
              className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
            />
          </label>
          <button
            onClick={() => mSetReq.mutate()}
            disabled={mSetReq.isPending || required === requiredRecommendations}
            className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
          >
            Update
          </button>
          {mSetReq.error ? (
            <span className="text-xs text-destructive">
              {(mSetReq.error as Error).message}
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded border border-border p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide">Assign reviewer</h4>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs">
            <span className="mb-1 text-muted-foreground">Reviewer (qa_reviewer)</span>
            <select
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
              className="w-64 rounded border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="">Select…</option>
              {reviewerOptions.map((r) => (
                <option key={r.user_id} value={r.user_id}>
                  {r.user_id.slice(0, 8)}…
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 text-muted-foreground">Review template (optional)</span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-64 rounded border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="">None (rationale only)</option>
              {templateOptions.map((t) => (
                <option key={t.id} value={t.id} disabled={!t.active_version_id}>
                  {t.name}
                  {t.active_version_id ? "" : " (no active version)"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 text-muted-foreground">Due date (optional)</span>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-sm"
            />
          </label>
          <button
            onClick={() => mAssign.mutate()}
            disabled={
              !reviewerId ||
              mAssign.isPending ||
              (!!templateId && !activeVersionId)
            }
            className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
          >
            Assign
          </button>
        </div>
        {mAssign.error ? (
          <p className="mt-2 text-xs text-destructive">{(mAssign.error as Error).message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        {assignments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No reviewers assigned.</p>
        ) : (
          assignments.map((a) => {
            const active = a.status === "assigned" || a.status === "in_review";
            return (
              <div key={a.id} className="rounded border border-border p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono">{a.reviewer_id.slice(0, 8)}…</span> ·{" "}
                    <strong>{a.status}</strong>
                    {a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString()}` : ""}
                    {a.template_version_id
                      ? ` · template v${a.template_version_id.slice(0, 6)}…`
                      : " · no template"}
                    {a.conflict_of_interest_declared
                      ? ` · COI: ${a.conflict_of_interest_reason ?? "declared"}`
                      : ""}
                  </div>
                  {active ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setReassignFor(reassignFor === a.id ? null : a.id)
                        }
                        className="rounded border border-border px-2 py-1 hover:bg-muted"
                      >
                        Reassign
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Cancel this assignment?")) mCancel.mutate(a.id);
                        }}
                        disabled={mCancel.isPending}
                        className="rounded border border-destructive/40 px-2 py-1 text-destructive hover:bg-destructive/10"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </div>
                {reassignFor === a.id ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2">
                    <select
                      value={newReviewerId}
                      onChange={(e) => setNewReviewerId(e.target.value)}
                      className="w-64 rounded border border-border bg-background px-2 py-1"
                    >
                      <option value="">New reviewer…</option>
                      {reviewerOptions
                        .filter((r) => r.user_id !== a.reviewer_id)
                        .map((r) => (
                          <option key={r.user_id} value={r.user_id}>
                            {r.user_id.slice(0, 8)}…
                          </option>
                        ))}
                    </select>
                    <select
                      value={reassignTemplateId}
                      onChange={(e) => setReassignTemplateId(e.target.value)}
                      className="w-64 rounded border border-border bg-background px-2 py-1"
                    >
                      <option value="">Keep / no template</option>
                      {templateOptions.map((t) => (
                        <option key={t.id} value={t.id} disabled={!t.active_version_id}>
                          {t.name}
                          {t.active_version_id ? "" : " (no active version)"}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => mReassign.mutate(a.id)}
                      disabled={
                        !newReviewerId ||
                        mReassign.isPending ||
                        (!!reassignTemplateId && !reassignVersionId)
                      }
                      className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
                    >
                      Confirm reassign
                    </button>
                    {mReassign.error ? (
                      <span className="text-destructive">
                        {(mReassign.error as Error).message}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
