-- Materialize the approved business matrix as domain permission mappings.
-- Public access remains governed by existing published-data RLS and has no DB role.

DELETE FROM public.rbac_role_permissions rp
USING public.rbac_roles r, public.rbac_permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.code IN ('registered_user','participant','expert','operator',
                 'reviewer','verifier','approver','publisher')
  AND split_part(p.code, '.', 1) IN
      ('academy','knowledge','experts','events','partnership','community','fellowship','about');

WITH access(role_code, domain_code, access_level) AS (
  VALUES
    ('registered_user','academy','limited'), ('registered_user','knowledge','limited'),
    ('registered_user','experts','limited'), ('registered_user','events','limited'),
    ('registered_user','partnership','read'), ('registered_user','community','limited'),
    ('registered_user','fellowship','limited'), ('registered_user','about','limited'),
    ('participant','academy','full'), ('participant','knowledge','full'),
    ('participant','experts','read'), ('participant','events','limited'),
    ('participant','partnership','read'), ('participant','community','full'),
    ('participant','fellowship','limited'), ('participant','about','limited'),
    ('expert','academy','limited'), ('expert','knowledge','limited'),
    ('expert','experts','full'), ('expert','events','limited'),
    ('expert','partnership','limited'), ('expert','community','limited'),
    ('expert','fellowship','limited'), ('expert','about','limited'),
    ('operator','academy','full'), ('operator','knowledge','full'),
    ('operator','experts','full'), ('operator','events','full'),
    ('operator','partnership','full'), ('operator','community','limited'),
    ('operator','fellowship','full'), ('operator','about','limited'),
    ('reviewer','academy','limited'), ('reviewer','knowledge','limited'),
    ('reviewer','experts','limited'), ('reviewer','events','limited'),
    ('reviewer','partnership','limited'), ('reviewer','community','read'),
    ('reviewer','fellowship','limited'), ('reviewer','about','limited'),
    ('verifier','academy','limited'), ('verifier','knowledge','limited'),
    ('verifier','experts','full'), ('verifier','events','limited'),
    ('verifier','partnership','limited'), ('verifier','community','read'),
    ('verifier','fellowship','limited'), ('verifier','about','limited'),
    ('approver','academy','full'), ('approver','knowledge','full'),
    ('approver','experts','full'), ('approver','events','full'),
    ('approver','partnership','full'), ('approver','community','full'),
    ('approver','fellowship','full'), ('approver','about','full'),
    ('publisher','academy','limited'), ('publisher','knowledge','limited'),
    ('publisher','experts','limited'), ('publisher','events','full'),
    ('publisher','partnership','full'), ('publisher','community','full'),
    ('publisher','fellowship','limited'), ('publisher','about','full')
), expanded AS (
  SELECT role_code, domain_code, action_code
  FROM access
  CROSS JOIN LATERAL unnest(
    CASE access_level
      WHEN 'full' THEN ARRAY['read','create','update','delete']::text[]
      WHEN 'limited' THEN ARRAY['read','create','update']::text[]
      ELSE ARRAY['read']::text[]
    END
  ) action_code
  UNION
  SELECT role_code, domain_code,
    CASE role_code
      WHEN 'reviewer' THEN 'review'
      WHEN 'verifier' THEN 'verify'
      WHEN 'approver' THEN 'approve'
      WHEN 'publisher' THEN 'publish'
      WHEN 'operator' THEN 'archive'
    END
  FROM access
  WHERE (role_code IN ('reviewer','verifier') AND access_level <> 'read')
     OR role_code IN ('approver','publisher')
     OR (role_code = 'operator' AND access_level = 'full')
), resolved AS (
  SELECT r.id AS role_id, p.id AS permission_id
  FROM expanded e
  JOIN public.rbac_roles r ON r.code = e.role_code
  JOIN public.rbac_permissions p ON p.code = e.domain_code || '.' || e.action_code
)
INSERT INTO public.rbac_role_permissions(role_id, permission_id)
SELECT role_id, permission_id FROM resolved ON CONFLICT DO NOTHING;
