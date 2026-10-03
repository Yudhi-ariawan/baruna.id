INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('knowledge-resource-submissions', 'knowledge-resource-submissions', false, 52428800,
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','video/mp4','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=EXCLUDED.public, file_size_limit=EXCLUDED.file_size_limit, allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS knowledge_submission_owner_all ON storage.objects;
CREATE POLICY knowledge_submission_owner_all ON storage.objects FOR ALL TO authenticated
USING (bucket_id='knowledge-resource-submissions' AND (storage.foldername(name))[1]='users' AND (storage.foldername(name))[2]=auth.uid()::text)
WITH CHECK (bucket_id='knowledge-resource-submissions' AND (storage.foldername(name))[1]='users' AND (storage.foldername(name))[2]=auth.uid()::text AND EXISTS (
  SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.id=ur.role_id
  WHERE ur.user_id=auth.uid() AND ur.status='active' AND r.code='expert'
));

DROP POLICY IF EXISTS knowledge_submission_governance_read ON storage.objects;
CREATE POLICY knowledge_submission_governance_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='knowledge-resource-submissions' AND public.has_any_governance_role(auth.uid()));
