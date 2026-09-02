// Client hooks for the Completion Evaluation domain. All writes go through
// authorized server operations; the browser never writes evaluation tables.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCompletionEvaluationForm,
  startCompletionEvaluation,
  saveCompletionEvaluationDraft,
  submitCompletionEvaluation,
  type AnswerMap,
} from "./completionEvaluation.functions";

export function useCompletionEvaluationForm(enrolmentId: string | undefined) {
  const fn = useServerFn(getCompletionEvaluationForm);
  return useQuery({
    queryKey: ["learning", "completion-evaluation", enrolmentId],
    queryFn: () => fn({ data: { enrolmentId: enrolmentId! } }),
    enabled: !!enrolmentId,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["learning"] });
}

export function useStartCompletionEvaluation() {
  const invalidate = useInvalidate();
  const fn = useServerFn(startCompletionEvaluation);
  return useMutation({
    mutationFn: (v: { enrolmentId: string }) => fn({ data: v }),
    onSuccess: invalidate,
  });
}

export function useSaveCompletionEvaluationDraft() {
  const invalidate = useInvalidate();
  const fn = useServerFn(saveCompletionEvaluationDraft);
  return useMutation({
    mutationFn: (v: {
      submissionId: string;
      expectedVersion: number;
      answers: AnswerMap;
    }) => fn({ data: v }),
    onSuccess: invalidate,
  });
}

export function useSubmitCompletionEvaluation() {
  const invalidate = useInvalidate();
  const fn = useServerFn(submitCompletionEvaluation);
  return useMutation({
    mutationFn: (v: { submissionId: string; expectedVersion?: number }) => fn({ data: v }),
    onSuccess: invalidate,
  });
}
