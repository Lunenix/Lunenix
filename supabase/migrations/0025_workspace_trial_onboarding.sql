-- Company onboarding + 21-day trial on existing workspaces table.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

COMMENT ON COLUMN public.workspaces.phone IS 'Company phone collected at workspace setup.';
COMMENT ON COLUMN public.workspaces.team_size IS 'Team size bucket, e.g. 1-5, 6-20.';
COMMENT ON COLUMN public.workspaces.trial_ends_at IS 'End of complimentary trial. Null for legacy free_beta rows.';
