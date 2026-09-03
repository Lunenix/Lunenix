-- Event Planner ops. Isolated tables + RLS. Does not merge Bar or Field packs.
-- Shared CRM (contacts, invoices, contracts, estimates, books) stays as-is.

CREATE TABLE IF NOT EXISTS public.planner_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_on DATE,
  venue_name TEXT,
  venue_address TEXT,
  guest_count INT,
  event_type TEXT NOT NULL DEFAULT 'wedding'
    CHECK (event_type IN ('wedding', 'corporate', 'private_party', 'other')),
  lead_source TEXT,
  planning_tier TEXT NOT NULL DEFAULT 'full'
    CHECK (planning_tier IN ('full', 'partial', 'day_of')),
  addons TEXT,
  budget_range TEXT,
  budget_total NUMERIC,
  deposit_paid BOOLEAN NOT NULL DEFAULT false,
  retainer_amount NUMERIC NOT NULL DEFAULT 0,
  consult_at TIMESTAMPTZ,
  theme_colors TEXT,
  must_haves TEXT,
  avoid_items TEXT,
  status TEXT NOT NULL DEFAULT 'inquiry'
    CHECK (status IN ('inquiry', 'booked', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planner_vision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'wish'
    CHECK (kind IN ('wish', 'mood', 'suggestion')),
  image_url TEXT,
  client_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (client_status IN ('pending', 'approved', 'revision')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planner_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  venue_photo_url TEXT,
  layout_notes TEXT,
  seating_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planner_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'venue', 'catering', 'florals', 'entertainment', 'rentals', 'attire', 'other'
    )),
  label TEXT NOT NULL,
  planned_amount NUMERIC NOT NULL DEFAULT 0,
  actual_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planner_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'caterer', 'florist', 'dj', 'photographer', 'rentals', 'transportation', 'other'
    )),
  status TEXT NOT NULL DEFAULT 'sourcing'
    CHECK (status IN ('sourcing', 'proposed', 'booked', 'paid')),
  coi_expires_on DATE,
  payment_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planner_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rsvp TEXT NOT NULL DEFAULT 'pending'
    CHECK (rsvp IN ('pending', 'attending', 'declined')),
  meal TEXT,
  dietary TEXT,
  table_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planner_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT 'setup'
    CHECK (segment IN ('setup', 'ceremony', 'cocktail', 'reception', 'breakdown')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  assignee_name TEXT,
  vendor_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planner_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'lead'
    CHECK (role IN ('lead', 'assistant', 'setup')),
  rating NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planner_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  vendor_name TEXT,
  status TEXT NOT NULL DEFAULT 'needed'
    CHECK (status IN ('needed', 'ordered', 'delivered', 'returned')),
  delivery_on DATE,
  pickup_on DATE,
  owned BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planner_onsite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'setup_photo'
    CHECK (kind IN ('setup_photo', 'issue', 'walkthrough')),
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $policies$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'planner_events', 'planner_vision', 'planner_layouts', 'planner_budget_lines',
    'planner_vendors', 'planner_guests', 'planner_timeline', 'planner_crew',
    'planner_rentals', 'planner_onsite'
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

CREATE INDEX IF NOT EXISTS planner_events_workspace ON public.planner_events (workspace_id, event_on);
CREATE INDEX IF NOT EXISTS planner_vision_workspace ON public.planner_vision (workspace_id, kind);
CREATE INDEX IF NOT EXISTS planner_layouts_workspace ON public.planner_layouts (workspace_id);
CREATE INDEX IF NOT EXISTS planner_budget_workspace ON public.planner_budget_lines (workspace_id, category);
CREATE INDEX IF NOT EXISTS planner_vendors_workspace ON public.planner_vendors (workspace_id, status);
CREATE INDEX IF NOT EXISTS planner_guests_workspace ON public.planner_guests (workspace_id, rsvp);
CREATE INDEX IF NOT EXISTS planner_timeline_workspace ON public.planner_timeline (workspace_id, starts_at);
CREATE INDEX IF NOT EXISTS planner_crew_workspace ON public.planner_crew (workspace_id, role);
CREATE INDEX IF NOT EXISTS planner_rentals_workspace ON public.planner_rentals (workspace_id, status);
CREATE INDEX IF NOT EXISTS planner_onsite_workspace ON public.planner_onsite (workspace_id, kind);

DROP TRIGGER IF EXISTS planner_events_updated_at ON public.planner_events;
CREATE TRIGGER planner_events_updated_at BEFORE UPDATE ON public.planner_events
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS planner_vision_updated_at ON public.planner_vision;
CREATE TRIGGER planner_vision_updated_at BEFORE UPDATE ON public.planner_vision
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS planner_layouts_updated_at ON public.planner_layouts;
CREATE TRIGGER planner_layouts_updated_at BEFORE UPDATE ON public.planner_layouts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS planner_budget_updated_at ON public.planner_budget_lines;
CREATE TRIGGER planner_budget_updated_at BEFORE UPDATE ON public.planner_budget_lines
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS planner_vendors_updated_at ON public.planner_vendors;
CREATE TRIGGER planner_vendors_updated_at BEFORE UPDATE ON public.planner_vendors
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS planner_guests_updated_at ON public.planner_guests;
CREATE TRIGGER planner_guests_updated_at BEFORE UPDATE ON public.planner_guests
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS planner_timeline_updated_at ON public.planner_timeline;
CREATE TRIGGER planner_timeline_updated_at BEFORE UPDATE ON public.planner_timeline
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS planner_crew_updated_at ON public.planner_crew;
CREATE TRIGGER planner_crew_updated_at BEFORE UPDATE ON public.planner_crew
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS planner_rentals_updated_at ON public.planner_rentals;
CREATE TRIGGER planner_rentals_updated_at BEFORE UPDATE ON public.planner_rentals
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS planner_onsite_updated_at ON public.planner_onsite;
CREATE TRIGGER planner_onsite_updated_at BEFORE UPDATE ON public.planner_onsite
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
