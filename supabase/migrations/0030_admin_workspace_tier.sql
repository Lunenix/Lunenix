-- Platform-owner companies use the admin workspace tier (not trial/paid).
-- Current Lunenix workspaces belong to the platform owner.

UPDATE workspaces
SET
  tier = 'admin',
  trial_ends_at = NULL;
