-- Task reminder lead time for Telegram (and later email) cron.
-- Does not create a personal_todos table; reminders hang off public.tasks.
-- Apply in the Supabase SQL editor if it is not run automatically.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_reminder_minutes_before_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_reminder_minutes_before_check
  CHECK (
    reminder_minutes_before IS NULL
    OR (reminder_minutes_before >= 1 AND reminder_minutes_before <= 10080)
  );

CREATE INDEX IF NOT EXISTS idx_tasks_reminders_due
  ON public.tasks (due_date, reminder_minutes_before)
  WHERE reminder_sent_at IS NULL
    AND reminder_minutes_before IS NOT NULL
    AND status <> 'done';
