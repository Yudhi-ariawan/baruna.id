-- ============================================================================
-- Live updates for enrolment and completion decisions (Slide 13: every status change
-- notifies; KESIAPAN_RILIS bagian E "notifikasi belum real-time"; CATATAN_PERBAIKAN
-- 2ay). Proven by `npm run test:live-notifications`.
--
-- Before: a decision by the administrator reached the participant only when a page
-- was opened or reloaded (the bell, the dashboard and the notification page fetch
-- once and cache for 15 seconds).
-- Now: course_enrollment_applications and course_completions are published to
-- Supabase Realtime. The app subscribes to the signed-in user's own rows and
-- refreshes notifications, dashboard and application status as soon as a row changes.
-- Realtime applies the tables' RLS to every subscriber, so a participant only
-- receives changes to their own rows (enrollment_apps_own_read,
-- course_completions_own_read); people who decide enrolments receive all
-- applications (enrollment_apps_admin_read), which keeps the approval queue live.
-- No data or rule changes. Re-runnable.
-- ============================================================================

DO $$
DECLARE t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'publication supabase_realtime not found: nothing to do';
    RETURN;
  END IF;
  IF (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN; -- already publishes every table
  END IF;
  FOREACH t IN ARRAY ARRAY['course_enrollment_applications', 'course_completions'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
