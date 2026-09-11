-- Restore the conservative mappings introduced by Step 1.
DELETE FROM public.rbac_role_permissions rp
USING public.rbac_roles r, public.rbac_permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.code IN ('registered_user','participant','expert','operator',
                 'reviewer','verifier','approver','publisher')
  AND split_part(p.code, '.', 1) IN
      ('academy','knowledge','experts','events','partnership','community','fellowship','about');

WITH mapping(role_code, action_codes) AS (
  VALUES
    ('registered_user', ARRAY['read']::text[]),
    ('participant', ARRAY['read']::text[]),
    ('expert', ARRAY['read']::text[]),
    ('operator', ARRAY['read','create','update','delete','archive']::text[]),
    ('reviewer', ARRAY['read','review']::text[]),
    ('verifier', ARRAY['read','verify']::text[]),
    ('approver', ARRAY['read','approve']::text[]),
    ('publisher', ARRAY['read','publish','archive']::text[])
), domains(code) AS (
  VALUES ('academy'), ('knowledge'), ('experts'), ('events'),
         ('partnership'), ('community'), ('fellowship'), ('about')
)
INSERT INTO public.rbac_role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM mapping m
JOIN public.rbac_roles r ON r.code = m.role_code
CROSS JOIN domains d CROSS JOIN unnest(m.action_codes) a(code)
JOIN public.rbac_permissions p ON p.code = d.code || '.' || a.code
ON CONFLICT DO NOTHING;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260911081000';
