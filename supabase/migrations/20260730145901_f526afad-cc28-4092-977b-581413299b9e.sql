DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'inc3-%@example.com');
DELETE FROM auth.users WHERE email LIKE 'inc3-%@example.com';