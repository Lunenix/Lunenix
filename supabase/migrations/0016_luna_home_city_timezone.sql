-- Luna home city + timezone so weather and local time don't need to be restated.
-- Apply in the Supabase SQL editor if it is not run automatically.

ALTER TABLE workspace_ai_settings
  ADD COLUMN IF NOT EXISTS home_city TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT NULL;
