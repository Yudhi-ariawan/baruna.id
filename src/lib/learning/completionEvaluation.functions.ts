// ============================================================================
// BARUNA — Completion Evaluation domain (Phase 1.4 Increment 5)
// ----------------------------------------------------------------------------
// End-of-course / end-of-training evaluation. This is NOT a learning
// assessment, NOT a course review, NOT a testimonial, and NOT a complaint
// channel. Answer content never affects results, completion, or certificates.
//
// Certificate boundary (Increment 5 closure): certificate eligibility remains
// on its pre-Increment-5 basis (the legacy `public.evaluations` record).
// Completion-evaluation submission is reported as an INDEPENDENT,
// NON-GATING fact only. Wiring it into eligibility is deferred to a later
// increment together with the legacy decommissioning decision.

// Every write goes through an authorized database operation; the client never
// writes evaluation tables directly.
// ============================================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AnswerValue = string | number | boolean | string[];
export type AnswerMap = Record<string, AnswerValue>;

export const getCompletionEvaluationForm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enrolmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: state, error } = await context.supabase.rpc(
      "resolve_completion_evaluation_state" as never,
      { _enrolment_id: data.enrolmentId } as never,
    );
    if (error) throw new Error(error.message);
    const s = state as {
      state: "not_required" | "not_started" | "in_progress" | "submitted";
      completion_evaluation_submitted: boolean;
      submission_id: string | null;
      draft_version: number | null;
      context: string | null;
      template_id: string | null;
      submitted_at: string | null;
    };

    if (!s.template_id || s.state === "not_required") {
      return { state: s, template: null, questions: [], answers: {} as AnswerMap };
    }

    const [{ data: template }, { data: questions }] = await Promise.all([
      context.supabase
        .from("completion_evaluation_templates" as never)
        .select("id, title, intro_text, context, status")
        .eq("id", s.template_id)
        .maybeSingle(),
      context.supabase
        .from("completion_evaluation_questions" as never)
        .select(
          "id, category, question_text, question_type, is_required, display_order, choices, rating_min, rating_max, help_text",
        )
        .eq("template_id", s.template_id)
        .eq("active", true)
        .order("display_order"),
    ]);

    const answers: AnswerMap = {};
    if (s.submission_id) {
      const { data: rows } = await context.supabase
        .from("completion_evaluation_responses" as never)
        .select("question_id, value_text, value_number, value_choices, value_bool")
        .eq("submission_id", s.submission_id);
      for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
        const key = r.question_id as string;
        const v = (r.value_number ?? r.value_bool ?? r.value_choices ?? r.value_text) as
          | AnswerValue
          | null;
        if (v !== null && v !== undefined) answers[key] = v;
      }
    }

    return {
      state: s,
      template: template as { id: string; title: string; intro_text: string | null; context: string } | null,
      questions: (questions ?? []) as Array<{
        id: string;
        category: string | null;
        question_text: string;
        question_type: string;
        is_required: boolean;
        display_order: number;
        choices: string[];
        rating_min: number | null;
        rating_max: number | null;
        help_text: string | null;
      }>,
      answers,
    };
  });

export const startCompletionEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enrolmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc(
      "start_completion_evaluation" as never,
      { _enrolment_id: data.enrolmentId } as never,
    );
    if (error) throw new Error(error.message);
    return res as { submission_id: string; status: string; draft_version: number; created: boolean };
  });

export const saveCompletionEvaluationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        submissionId: z.string().uuid(),
        expectedVersion: z.number().int().min(1),
        answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc(
      "save_completion_evaluation_draft" as never,
      {
        _submission_id: data.submissionId,
        _expected_version: data.expectedVersion,
        _answers: data.answers,
      } as never,
    );
    if (error) throw new Error(error.message);
    return res as { submission_id: string; status: string; draft_version: number; no_op: boolean };
  });

export const submitCompletionEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        submissionId: z.string().uuid(),
        expectedVersion: z.number().int().min(1).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc(
      "submit_completion_evaluation" as never,
      {
        _submission_id: data.submissionId,
        _expected_version: data.expectedVersion ?? null,
      } as never,
    );
    if (error) throw new Error(error.message);
    return res as { submission_id: string; status: string; submitted_at: string; no_op: boolean };
  });
