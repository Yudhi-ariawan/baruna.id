-- Private supporting documents for Become an Expert submissions.
-- Object paths are scoped to users/<auth.uid()>/<draft-id>/...

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expert-applications',
  'expert-applications',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS expert_applications_owner_select ON storage.objects;
CREATE POLICY expert_applications_owner_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'expert-applications'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS expert_applications_owner_insert ON storage.objects;
CREATE POLICY expert_applications_owner_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expert-applications'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS expert_applications_owner_update ON storage.objects;
CREATE POLICY expert_applications_owner_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'expert-applications'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'expert-applications'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS expert_applications_owner_delete ON storage.objects;
CREATE POLICY expert_applications_owner_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'expert-applications'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS expert_applications_governance_select ON storage.objects;
CREATE POLICY expert_applications_governance_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'expert-applications'
    AND public.has_any_governance_role(auth.uid())
  );

