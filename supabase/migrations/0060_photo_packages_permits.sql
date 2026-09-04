-- Photography ops expansion: packages, permits, fuller edit/gallery/gear fields.
-- Do not store specs on contacts.metadata.

ALTER TABLE public.photo_shoots
  ADD COLUMN IF NOT EXISTS budget_range TEXT,
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS add_ons TEXT,
  ADD COLUMN IF NOT EXISTS timeline TEXT,
  ADD COLUMN IF NOT EXISTS packed_checklist TEXT,
  ADD COLUMN IF NOT EXISTS scout_notes TEXT;

UPDATE public.photo_edits SET status = 'culling' WHERE status = 'queued';
UPDATE public.photo_edits SET status = 'editing' WHERE status = 'in_progress';

ALTER TABLE public.photo_shoots DROP CONSTRAINT IF EXISTS photo_shoots_shoot_type_check;
ALTER TABLE public.photo_shoots
  ADD CONSTRAINT photo_shoots_shoot_type_check
  CHECK (shoot_type IN (
    'wedding', 'engagement', 'family', 'commercial', 'headshots', 'product', 'event', 'other'
  ));

ALTER TABLE public.photo_shoots DROP CONSTRAINT IF EXISTS photo_shoots_status_check;
ALTER TABLE public.photo_shoots
  ADD CONSTRAINT photo_shoots_status_check
  CHECK (status IN (
    'inquiry', 'booked', 'shooting', 'wrapped', 'editing', 'delivered', 'cancelled'
  ));

ALTER TABLE public.photo_edits
  ADD COLUMN IF NOT EXISTS editor_name TEXT,
  ADD COLUMN IF NOT EXISTS video_stage TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.photo_edits DROP CONSTRAINT IF EXISTS photo_edits_status_check;
ALTER TABLE public.photo_edits
  ADD CONSTRAINT photo_edits_status_check
  CHECK (status IN ('culling', 'editing', 'grading', 'review', 'delivered'));

ALTER TABLE public.photo_edits DROP CONSTRAINT IF EXISTS photo_edits_video_stage_check;
ALTER TABLE public.photo_edits
  ADD CONSTRAINT photo_edits_video_stage_check
  CHECK (video_stage IN ('none', 'rough_cut', 'client_review', 'final_cut'));

ALTER TABLE public.photo_galleries
  ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'download',
  ADD COLUMN IF NOT EXISTS favorites TEXT;

ALTER TABLE public.photo_galleries DROP CONSTRAINT IF EXISTS photo_galleries_delivery_method_check;
ALTER TABLE public.photo_galleries
  ADD CONSTRAINT photo_galleries_delivery_method_check
  CHECK (delivery_method IN ('download', 'usb', 'album', 'file'));

ALTER TABLE public.photo_gear
  ADD COLUMN IF NOT EXISTS serial_no TEXT,
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS insurance_notes TEXT,
  ADD COLUMN IF NOT EXISTS checked_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_to TEXT;

ALTER TABLE public.photo_crew
  ADD COLUMN IF NOT EXISTS specialty TEXT;

CREATE TABLE IF NOT EXISTS public.photo_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  hours NUMERIC,
  shooters INT,
  coverage TEXT NOT NULL DEFAULT 'photo'
    CHECK (coverage IN ('photo', 'video', 'both')),
  deliverables TEXT,
  add_ons TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  venue_name TEXT,
  status TEXT NOT NULL DEFAULT 'needed'
    CHECK (status IN ('needed', 'submitted', 'approved')),
  due_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $policies$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['photo_packages', 'photo_permits']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS workspace_members_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY workspace_members_%I ON public.%I FOR ALL
        USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))
        WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()))',
      t, t
    );
  END LOOP;
END
$policies$;

CREATE INDEX IF NOT EXISTS photo_packages_workspace ON public.photo_packages (workspace_id);
CREATE INDEX IF NOT EXISTS photo_permits_workspace ON public.photo_permits (workspace_id, status);

DROP TRIGGER IF EXISTS photo_packages_updated_at ON public.photo_packages;
CREATE TRIGGER photo_packages_updated_at BEFORE UPDATE ON public.photo_packages
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS photo_permits_updated_at ON public.photo_permits;
CREATE TRIGGER photo_permits_updated_at BEFORE UPDATE ON public.photo_permits
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
