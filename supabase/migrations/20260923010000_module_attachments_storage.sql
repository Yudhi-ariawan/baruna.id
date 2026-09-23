-- Private Trainer Portal module attachments.
-- Owners are isolated under users/<auth.uid()>/modules/... and only active
-- trainers may mutate their objects. Governance roles may read for review.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'module-attachments',
  'module-attachments',
  false,
  104857600,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS module_attachments_trainer_select ON storage.objects;
CREATE POLICY module_attachments_trainer_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'module-attachments'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public._active_trainer_expert_id(auth.uid()) IS NOT NULL
  );

DROP POLICY IF EXISTS module_attachments_trainer_insert ON storage.objects;
CREATE POLICY module_attachments_trainer_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'module-attachments'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND (storage.foldername(name))[3] = 'modules'
    AND public._active_trainer_expert_id(auth.uid()) IS NOT NULL
  );

DROP POLICY IF EXISTS module_attachments_trainer_update ON storage.objects;
CREATE POLICY module_attachments_trainer_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'module-attachments'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public._active_trainer_expert_id(auth.uid()) IS NOT NULL
  )
  WITH CHECK (
    bucket_id = 'module-attachments'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND (storage.foldername(name))[3] = 'modules'
    AND public._active_trainer_expert_id(auth.uid()) IS NOT NULL
  );

DROP POLICY IF EXISTS module_attachments_trainer_delete ON storage.objects;
CREATE POLICY module_attachments_trainer_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'module-attachments'
    AND (storage.foldername(name))[1] = 'users'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public._active_trainer_expert_id(auth.uid()) IS NOT NULL
  );

DROP POLICY IF EXISTS module_attachments_governance_select ON storage.objects;
CREATE POLICY module_attachments_governance_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'module-attachments'
    AND public.has_any_governance_role(auth.uid())
  );
