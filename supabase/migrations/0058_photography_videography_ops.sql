-- Photography & Videography ops. Isolated tables + RLS.
-- Catalog preset is photography_videography on Event & Wedding — not Creative.
-- Do not add industry_group / industry_category (no second industries model).
-- Do not GIN-index contacts.metadata (that column does not exist).
-- Shot-list rows live on photo_shots, not contact JSON.

UPDATE public.workspaces
SET industry_preset = 'photography_videography'
WHERE industry_preset IS NOT NULL
  AND industry_preset IS DISTINCT FROM 'photography_videography'
  AND (
    industry_preset IN (
      'photography',
      'videography',
      'photo_video',
      'photo-video',
      'photography_and_videography'
    )
    OR industry_preset ILIKE '%photography%'
    OR industry_preset ILIKE '%videography%'
  );

CREATE TABLE IF NOT EXISTS public.photo_shoots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  shoot_on DATE,
  starts_at TIMESTAMPTZ,
  venue_name TEXT,
  shoot_type TEXT NOT NULL DEFAULT 'wedding'
    CHECK (shoot_type IN ('wedding', 'engagement', 'family', 'commercial', 'other')),
  coverage TEXT NOT NULL DEFAULT 'photo'
    CHECK (coverage IN ('photo', 'video', 'both')),
  hours NUMERIC,
  lead_source TEXT,
  must_haves TEXT,
  status TEXT NOT NULL DEFAULT 'inquiry'
    CHECK (status IN ('inquiry', 'booked', 'shooting', 'editing', 'delivered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scene TEXT,
  priority TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'captured', 'skip')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_mood (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image_url TEXT,
  style_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_on DATE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'in_progress', 'delivered')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_galleries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  gallery_url TEXT,
  expires_on DATE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'expired')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  vendor_name TEXT,
  status TEXT NOT NULL DEFAULT 'needed'
    CHECK (status IN ('needed', 'ordered', 'delivered')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_gear (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  qty INT,
  reorder_below INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  rating NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  usage_notes TEXT,
  signed_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $policies$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'photo_shoots', 'photo_shots', 'photo_mood', 'photo_edits', 'photo_galleries',
    'photo_orders', 'photo_gear', 'photo_crew', 'photo_releases'
  ]
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

CREATE INDEX IF NOT EXISTS photo_shoots_workspace ON public.photo_shoots (workspace_id, shoot_on);
CREATE INDEX IF NOT EXISTS photo_shots_workspace ON public.photo_shots (workspace_id, status);
CREATE INDEX IF NOT EXISTS photo_mood_workspace ON public.photo_mood (workspace_id);
CREATE INDEX IF NOT EXISTS photo_edits_workspace ON public.photo_edits (workspace_id, status);
CREATE INDEX IF NOT EXISTS photo_galleries_workspace ON public.photo_galleries (workspace_id, status);
CREATE INDEX IF NOT EXISTS photo_orders_workspace ON public.photo_orders (workspace_id);
CREATE INDEX IF NOT EXISTS photo_gear_workspace ON public.photo_gear (workspace_id);
CREATE INDEX IF NOT EXISTS photo_crew_workspace ON public.photo_crew (workspace_id);
CREATE INDEX IF NOT EXISTS photo_releases_workspace ON public.photo_releases (workspace_id);

DROP TRIGGER IF EXISTS photo_shoots_updated_at ON public.photo_shoots;
CREATE TRIGGER photo_shoots_updated_at BEFORE UPDATE ON public.photo_shoots
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS photo_shots_updated_at ON public.photo_shots;
CREATE TRIGGER photo_shots_updated_at BEFORE UPDATE ON public.photo_shots
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS photo_mood_updated_at ON public.photo_mood;
CREATE TRIGGER photo_mood_updated_at BEFORE UPDATE ON public.photo_mood
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS photo_edits_updated_at ON public.photo_edits;
CREATE TRIGGER photo_edits_updated_at BEFORE UPDATE ON public.photo_edits
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS photo_galleries_updated_at ON public.photo_galleries;
CREATE TRIGGER photo_galleries_updated_at BEFORE UPDATE ON public.photo_galleries
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS photo_orders_updated_at ON public.photo_orders;
CREATE TRIGGER photo_orders_updated_at BEFORE UPDATE ON public.photo_orders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS photo_gear_updated_at ON public.photo_gear;
CREATE TRIGGER photo_gear_updated_at BEFORE UPDATE ON public.photo_gear
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS photo_crew_updated_at ON public.photo_crew;
CREATE TRIGGER photo_crew_updated_at BEFORE UPDATE ON public.photo_crew
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS photo_releases_updated_at ON public.photo_releases;
CREATE TRIGGER photo_releases_updated_at BEFORE UPDATE ON public.photo_releases
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
