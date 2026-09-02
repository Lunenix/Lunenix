-- Mileage logs for field jobs (HVAC and other home/field workspaces).

CREATE TABLE IF NOT EXISTS public.mileage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  driven_on DATE NOT NULL DEFAULT CURRENT_DATE,
  miles NUMERIC(10,2) NOT NULL CHECK (miles > 0),
  rate_per_mile NUMERIC(8,4) NOT NULL DEFAULT 0.70,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  origin TEXT,
  destination TEXT,
  purpose TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mileage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_mileage_logs ON public.mileage_logs;
CREATE POLICY workspace_members_mileage_logs ON public.mileage_logs
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS mileage_logs_workspace_driven_on
  ON public.mileage_logs (workspace_id, driven_on DESC);
