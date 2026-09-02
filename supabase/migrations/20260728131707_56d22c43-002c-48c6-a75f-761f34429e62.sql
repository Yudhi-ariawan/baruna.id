
-- ============================================================
-- Helper: assignment-scoped registry review predicate
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_review_registry_subject(_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND _subject_id IS NOT NULL
     AND public.has_role(auth.uid(), 'qa_reviewer')
     AND EXISTS (
       SELECT 1 FROM public.review_assignments ra
       WHERE ra.subject_id  = _subject_id
         AND ra.reviewer_id = auth.uid()
         AND ra.status = 'active'
     );
$$;

REVOKE EXECUTE ON FUNCTION public.can_review_registry_subject(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_review_registry_subject(uuid) TO authenticated, service_role;

-- ============================================================
-- KNOWLEDGE RESOURCES: replace broad governance read
-- ============================================================
DROP POLICY IF EXISTS kr_select_governance ON public.knowledge_resources;

CREATE POLICY kr_select_admin_mgmt ON public.knowledge_resources
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

CREATE POLICY kr_select_reviewer_assigned ON public.knowledge_resources
FOR SELECT TO authenticated
USING (
  source_submission_id IS NOT NULL
  AND public.can_review_registry_subject(source_submission_id)
);

-- ============================================================
-- KR child tables: tighten governance branch to admin/mgmt OR assigned reviewer
-- ============================================================
DROP POLICY IF EXISTS krf_read ON public.knowledge_resource_files;
CREATE POLICY krf_read ON public.knowledge_resource_files
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.knowledge_resources r
  WHERE r.id = knowledge_resource_files.resource_id
    AND ( r.created_by = auth.uid()
       OR public.has_role(auth.uid(),'admin')
       OR public.has_role(auth.uid(),'management')
       OR (r.source_submission_id IS NOT NULL AND public.can_review_registry_subject(r.source_submission_id))
       OR (r.current_status = 'published' AND r.visibility = 'public') )
));

DROP POLICY IF EXISTS kra_read ON public.knowledge_resource_authors;
CREATE POLICY kra_read ON public.knowledge_resource_authors
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.knowledge_resources r
  WHERE r.id = knowledge_resource_authors.resource_id
    AND ( r.created_by = auth.uid()
       OR public.has_role(auth.uid(),'admin')
       OR public.has_role(auth.uid(),'management')
       OR (r.source_submission_id IS NOT NULL AND public.can_review_registry_subject(r.source_submission_id))
       OR (r.current_status = 'published' AND r.visibility = 'public') )
));

DROP POLICY IF EXISTS krr_read ON public.knowledge_resource_related;
CREATE POLICY krr_read ON public.knowledge_resource_related
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.knowledge_resources r
  WHERE r.id = knowledge_resource_related.resource_id
    AND ( r.created_by = auth.uid()
       OR public.has_role(auth.uid(),'admin')
       OR public.has_role(auth.uid(),'management')
       OR (r.source_submission_id IS NOT NULL AND public.can_review_registry_subject(r.source_submission_id))
       OR (r.current_status = 'published' AND r.visibility = 'public') )
));

DROP POLICY IF EXISTS krv_read ON public.knowledge_resource_versions;
CREATE POLICY krv_read ON public.knowledge_resource_versions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.knowledge_resources r
  WHERE r.id = knowledge_resource_versions.resource_id
    AND ( r.created_by = auth.uid()
       OR public.has_role(auth.uid(),'admin')
       OR public.has_role(auth.uid(),'management')
       OR (r.source_submission_id IS NOT NULL AND public.can_review_registry_subject(r.source_submission_id))
       OR (r.current_status = 'published' AND r.visibility = 'public') )
));

-- ============================================================
-- EXPERTS: replace broad governance read; tighten child helper
-- ============================================================
DROP POLICY IF EXISTS experts_governance_read ON public.experts;

CREATE POLICY experts_admin_mgmt_read ON public.experts
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'management'));

CREATE POLICY experts_reviewer_assigned_read ON public.experts
FOR SELECT TO authenticated
USING (
  source_submission_id IS NOT NULL
  AND public.can_review_registry_subject(source_submission_id)
);

-- Tighten helper used by all expert child tables
CREATE OR REPLACE FUNCTION public._expert_child_read(_expert_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._expert_is_owner(_expert_id)
      OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'management')
      OR EXISTS (
        SELECT 1 FROM public.experts e
        WHERE e.id = _expert_id
          AND e.source_submission_id IS NOT NULL
          AND public.can_review_registry_subject(e.source_submission_id)
      );
$$;

-- The four expert child tables that used has_any_governance_role directly
-- must now route through the (tightened) _expert_child_read helper.
DROP POLICY IF EXISTS expert_certifications_read ON public.expert_certifications;
CREATE POLICY expert_certifications_read ON public.expert_certifications
FOR SELECT TO authenticated
USING (public._expert_child_read(expert_id));

DROP POLICY IF EXISTS expert_education_read ON public.expert_education;
CREATE POLICY expert_education_read ON public.expert_education
FOR SELECT TO authenticated
USING (public._expert_child_read(expert_id));

DROP POLICY IF EXISTS expert_employment_read ON public.expert_employment;
CREATE POLICY expert_employment_read ON public.expert_employment
FOR SELECT TO authenticated
USING (public._expert_child_read(expert_id));

DROP POLICY IF EXISTS expert_publications_read ON public.expert_publications;
CREATE POLICY expert_publications_read ON public.expert_publications
FOR SELECT TO authenticated
USING (public._expert_child_read(expert_id));

-- expert_contact_private is intentionally left untouched: admin/mgmt + owner only.
