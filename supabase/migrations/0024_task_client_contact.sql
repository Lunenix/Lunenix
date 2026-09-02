-- Optional client (contact) on workspace tasks.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON public.tasks(contact_id);
