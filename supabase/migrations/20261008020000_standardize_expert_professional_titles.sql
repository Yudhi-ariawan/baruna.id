-- Normalize Luh Dewi Komarini's public-facing title while preserving the
-- complete Indonesian institutional position in her biography.

UPDATE public.experts
SET headline = 'Learning Technology Specialist',
    bio = 'A dedicated learning technology professional and natural resource management expert serving in the institutional role of Pengembang Teknologi Pembelajaran Kelautan dan Perikanan. Holding a Doctoral degree (Ph.D./S-3) in Natural Resources and Environmental Management from IPB University, she combines strong academic rigor in environmental sustainability and fisheries governance with practical expertise in modern instructional design and capacity development. Experienced in curating technical training modules, digital learning frameworks, and competency-based curricula, her work focuses on advancing human capital, sustainable marine resource management, and innovative capacity building across the marine and fisheries sectors.',
    updated_at = now()
WHERE id = '88bd82f8-86d2-4706-8057-18e982e77e7f'
  AND display_name = 'Luh Dewi Komarini';

UPDATE public.expert_employment
SET role = 'Learning Technology Specialist',
    updated_at = now()
WHERE expert_id = '88bd82f8-86d2-4706-8057-18e982e77e7f'
  AND is_current = true;

UPDATE public.profiles
SET job_title = 'Learning Technology Specialist',
    updated_at = now()
WHERE id = '1ee61688-2d03-4745-b1d6-39eb40bc3969';

