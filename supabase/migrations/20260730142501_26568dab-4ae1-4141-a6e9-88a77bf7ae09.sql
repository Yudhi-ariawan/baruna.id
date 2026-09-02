-- Least-privilege read access for review_subject_revisions
CREATE OR REPLACE FUNCTION public.can_read_review_subject(_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND _subject_id IS NOT NULL
     AND (
       public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'management')
       OR EXISTS (
         SELECT 1 FROM public.review_subjects s
         WHERE s.id = _subject_id AND s.submitted_by = auth.uid()
       )
       OR EXISTS (
         SELECT 1 FROM public.review_assignments ra
         WHERE ra.subject_id = _subject_id
           AND ra.reviewer_id = auth.uid()
           AND ra.status = 'active'
       )
     );
$$;

REVOKE ALL ON FUNCTION public.can_read_review_subject(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_review_subject(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "revisions_select_by_subject_visibility" ON public.review_subject_revisions;

CREATE POLICY "revisions_select_least_privilege"
ON public.review_subject_revisions
FOR SELECT
TO authenticated
USING (public.can_read_review_subject(subject_id));

REVOKE ALL ON public.review_subject_revisions FROM anon;
GRANT SELECT ON public.review_subject_revisions TO authenticated;
GRANT ALL ON public.review_subject_revisions TO service_role;