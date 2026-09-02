// ============================================================================
// Client-side hooks that talk to the Phase 1 backend for the pilot dashboard.
// Backend is the source of truth; localStorage is not consulted here.
// ============================================================================
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyEnrolments,
  enrolInOffering,
  getEnrolmentDetail,
  markActivityComplete,
  
  issueCertificate,
  checkEligibility,
  listMyCertificates,
  rollbackOwnEnrolment,
} from "./learning.functions";

export function useAuthUser() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, loading };
}

export function useMyEnrolments() {
  const { user } = useAuthUser();
  const fn = useServerFn(listMyEnrolments);
  return useQuery({
    queryKey: ["learning", "my-enrolments", user?.id],
    queryFn: () => fn(),
    enabled: !!user,
  });
}

export function useEnrolmentDetail(offeringCode: string | undefined) {
  const { user } = useAuthUser();
  const fn = useServerFn(getEnrolmentDetail);
  return useQuery({
    queryKey: ["learning", "detail", user?.id, offeringCode],
    queryFn: () => fn({ data: { offeringCode: offeringCode! } }),
    enabled: !!user && !!offeringCode,
  });
}

export function useEnrol(offeringCode: string) {
  const qc = useQueryClient();
  const fn = useServerFn(enrolInOffering);
  return useMutation({
    mutationFn: () => fn({ data: { offeringCode } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learning"] });
    },
  });
}

export function useMarkActivity(offeringCode: string) {
  const qc = useQueryClient();
  const fn = useServerFn(markActivityComplete);
  return useMutation({
    mutationFn: (v: { enrolmentId: string; activityId: string; status?: "in-progress" | "completed" }) =>
      fn({ data: { enrolmentId: v.enrolmentId, activityId: v.activityId, status: v.status ?? "completed" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learning", "detail"] });
      qc.invalidateQueries({ queryKey: ["learning", "my-enrolments"] });
      void offeringCode;
    },
  });
}

// NOTE: the legacy one-click `useSubmitEvaluation` hook was removed in the
// Increment 5 closure. The authoritative participant evaluation flow is the
// Completion Evaluation domain (see completionEvaluation.functions.ts). The
// legacy `submitEvaluation` server function is retained but is no longer
// reachable from any UI; its controlled decommissioning is deferred work.



export function useIssueCertificate() {
  const qc = useQueryClient();
  const fn = useServerFn(issueCertificate);
  return useMutation({
    mutationFn: (v: { enrolmentId: string; certificateType?: "completion" | "participation" | "program" | "applied-achievement" | "competency" | "statement-of-result" }) =>
      fn({ data: { enrolmentId: v.enrolmentId, certificateType: v.certificateType ?? "completion" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning"] }),
  });
}

export function useEligibility(enrolmentId: string | undefined) {
  const fn = useServerFn(checkEligibility);
  return useQuery({
    queryKey: ["learning", "eligibility", enrolmentId],
    queryFn: () => fn({ data: { enrolmentId: enrolmentId! } }),
    enabled: !!enrolmentId,
  });
}

export function useMyCertificates() {
  const { user } = useAuthUser();
  const fn = useServerFn(listMyCertificates);
  return useQuery({
    queryKey: ["learning", "certificates", user?.id],
    queryFn: () => fn(),
    enabled: !!user,
  });
}

export function useRollback() {
  const qc = useQueryClient();
  const fn = useServerFn(rollbackOwnEnrolment);
  return useMutation({
    mutationFn: (v: { enrolmentId: string; reason?: string }) => fn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning"] }),
  });
}
