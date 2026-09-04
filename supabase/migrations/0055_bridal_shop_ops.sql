-- Bridal Shop ops. Isolated tables + RLS. Does not merge Bar, Planner, Venue, or Field.
-- Shared CRM (contacts, invoices, contracts, estimates, books, inventory) stays as-is.
-- Location is rack / section / hanger text plus an optional floor-plan photo URL.
-- Tag codes are QR/barcode strings. This is not live RFID or a 3D engine.

CREATE TABLE IF NOT EXISTS public.bridal_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  wedding_on DATE,
  party_size INT,
  budget_range TEXT,
  style_prefs TEXT,
  venue_type TEXT,
  season TEXT,
  theme_colors TEXT,
  lead_source TEXT,
  stylist_name TEXT,
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'completed', 'no_show', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bridal_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  zone TEXT,
  map_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bridal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tag_code TEXT,
  kind TEXT NOT NULL DEFAULT 'gown'
    CHECK (kind IN ('gown', 'veil', 'jewelry', 'shoes', 'undergarment', 'bridesmaid', 'other')),
  style_name TEXT,
  size TEXT,
  color TEXT,
  designer TEXT,
  price NUMERIC,
  cost NUMERIC,
  qty INT NOT NULL DEFAULT 1,
  reorder_below INT,
  status TEXT NOT NULL DEFAULT 'showroom'
    CHECK (status IN ('showroom', 'fitting_room', 'on_hold', 'alterations', 'sold', 'in_transit', 'returned')),
  rack TEXT,
  section TEXT,
  hanger TEXT,
  location_label TEXT,
  sample_sale BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bridal_vision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image_url TEXT,
  silhouette TEXT,
  neckline TEXT,
  fabric TEXT,
  match_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bridal_fittings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  pulled_tags TEXT,
  photo_url TEXT,
  favorites TEXT,
  loved TEXT,
  disliked TEXT,
  sizing_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bridal_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'in_stock'
    CHECK (kind IN ('in_stock', 'special_order')),
  tag_code TEXT,
  designer TEXT,
  eta_on DATE,
  deposit_paid BOOLEAN NOT NULL DEFAULT false,
  retainer_amount NUMERIC NOT NULL DEFAULT 0,
  wedding_on DATE,
  status TEXT NOT NULL DEFAULT 'deposit'
    CHECK (status IN ('deposit', 'ordered', 'arrived', 'picked_up', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bridal_alterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tag_code TEXT,
  measurements TEXT,
  seamstress_name TEXT,
  outsourced BOOLEAN NOT NULL DEFAULT false,
  photo_url TEXT,
  next_fitting_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'measured'
    CHECK (status IN ('measured', 'in_alterations', 'ready_fitting', 'final_complete', 'ready_pickup')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bridal_party (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  role TEXT,
  dress_notes TEXT,
  tag_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bridal_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'stylist'
    CHECK (role IN ('stylist', 'seamstress')),
  conversion_notes TEXT,
  rating NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bridal_receiving (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tag_code TEXT,
  rack TEXT,
  section TEXT,
  hanger TEXT,
  status TEXT NOT NULL DEFAULT 'expected'
    CHECK (status IN ('expected', 'received', 'placed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $policies$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bridal_appointments', 'bridal_locations', 'bridal_items', 'bridal_vision',
    'bridal_fittings', 'bridal_orders', 'bridal_alterations', 'bridal_party',
    'bridal_crew', 'bridal_receiving'
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

CREATE INDEX IF NOT EXISTS bridal_appointments_workspace ON public.bridal_appointments (workspace_id, starts_at);
CREATE INDEX IF NOT EXISTS bridal_locations_workspace ON public.bridal_locations (workspace_id);
CREATE INDEX IF NOT EXISTS bridal_items_workspace ON public.bridal_items (workspace_id, status);
CREATE INDEX IF NOT EXISTS bridal_items_tag ON public.bridal_items (workspace_id, tag_code);
CREATE INDEX IF NOT EXISTS bridal_vision_workspace ON public.bridal_vision (workspace_id);
CREATE INDEX IF NOT EXISTS bridal_fittings_workspace ON public.bridal_fittings (workspace_id, starts_at);
CREATE INDEX IF NOT EXISTS bridal_orders_workspace ON public.bridal_orders (workspace_id, status);
CREATE INDEX IF NOT EXISTS bridal_alterations_workspace ON public.bridal_alterations (workspace_id, status);
CREATE INDEX IF NOT EXISTS bridal_party_workspace ON public.bridal_party (workspace_id);
CREATE INDEX IF NOT EXISTS bridal_crew_workspace ON public.bridal_crew (workspace_id, role);
CREATE INDEX IF NOT EXISTS bridal_receiving_workspace ON public.bridal_receiving (workspace_id, status);

DROP TRIGGER IF EXISTS bridal_appointments_updated_at ON public.bridal_appointments;
CREATE TRIGGER bridal_appointments_updated_at BEFORE UPDATE ON public.bridal_appointments
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bridal_locations_updated_at ON public.bridal_locations;
CREATE TRIGGER bridal_locations_updated_at BEFORE UPDATE ON public.bridal_locations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bridal_items_updated_at ON public.bridal_items;
CREATE TRIGGER bridal_items_updated_at BEFORE UPDATE ON public.bridal_items
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bridal_vision_updated_at ON public.bridal_vision;
CREATE TRIGGER bridal_vision_updated_at BEFORE UPDATE ON public.bridal_vision
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bridal_fittings_updated_at ON public.bridal_fittings;
CREATE TRIGGER bridal_fittings_updated_at BEFORE UPDATE ON public.bridal_fittings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bridal_orders_updated_at ON public.bridal_orders;
CREATE TRIGGER bridal_orders_updated_at BEFORE UPDATE ON public.bridal_orders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bridal_alterations_updated_at ON public.bridal_alterations;
CREATE TRIGGER bridal_alterations_updated_at BEFORE UPDATE ON public.bridal_alterations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bridal_party_updated_at ON public.bridal_party;
CREATE TRIGGER bridal_party_updated_at BEFORE UPDATE ON public.bridal_party
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bridal_crew_updated_at ON public.bridal_crew;
CREATE TRIGGER bridal_crew_updated_at BEFORE UPDATE ON public.bridal_crew
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
DROP TRIGGER IF EXISTS bridal_receiving_updated_at ON public.bridal_receiving;
CREATE TRIGGER bridal_receiving_updated_at BEFORE UPDATE ON public.bridal_receiving
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
