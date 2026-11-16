// "Enroll Now" on a Full Training page: goes to the Course Offering that replaced the
// program when one is set (CATATAN_PERBAIKAN 2bb), otherwise to the old apply form.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFullTrainingReplacement } from "@/lib/academy/full-training-replacement.functions";

export function useFullTrainingReplacement(slug: string) {
  const fn = useServerFn(getFullTrainingReplacement);
  return useQuery({ queryKey: ["academy", "full-training-replacement", slug], queryFn: () => fn({ data: { slug } }), staleTime: 60_000 });
}

export function FullTrainingEnrollLink({ slug, className, children }: { slug: string; className: string; children: ReactNode }) {
  const q = useFullTrainingReplacement(slug);
  if (q.data) {
    return <Link to="/academy/course/$offeringId" params={{ offeringId: q.data }} className={className}>{children}</Link>;
  }
  return <Link to="/academy/apply/$slug" params={{ slug }} className={className}>{children}</Link>;
}
