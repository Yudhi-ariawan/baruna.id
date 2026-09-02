DELETE FROM public.knowledge_resources
WHERE title IN (
  'RLS insert test','File URL host','File URL host 2','File URL host 3',
  'Duplicate DOI test A','Duplicate DOI test B','Pub immut','Bad URL test'
);