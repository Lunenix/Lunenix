-- Migration 0015: Luna AI Command Center + Multi-Company Workspace
-- Apply manually in Supabase SQL Editor.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Extend workspaces table with new columns
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS industry_preset TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_seats       INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tier            TEXT DEFAULT 'free_beta';

-- Backfill existing rows
UPDATE workspaces
SET tier = 'free_beta', max_seats = 5
WHERE tier IS NULL OR max_seats IS NULL;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Luna AI settings per workspace
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_ai_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_name   TEXT NOT NULL DEFAULT 'Luna',
  avatar_id    TEXT NOT NULL DEFAULT 'avatar_1',
  avatar_url   TEXT DEFAULT NULL,
  voice_id     TEXT NOT NULL DEFAULT 'ava',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

-- RLS
ALTER TABLE workspace_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_ai_settings_select" ON workspace_ai_settings
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_ai_settings_insert" ON workspace_ai_settings
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

CREATE POLICY "workspace_ai_settings_update" ON workspace_ai_settings
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Allow workspace name updates (owners/admins only)
-- ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workspaces' AND policyname = 'workspaces_update_owner_admin'
  ) THEN
    CREATE POLICY "workspaces_update_owner_admin" ON workspaces
      FOR UPDATE USING (
        id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND role IN ('owner','admin')
        )
      );
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Pipeline stages seed function (called after workspace creation)
--    Creates default stages for each industry preset.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION seed_pipeline_stages(p_workspace_id UUID, p_preset TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  stages TEXT[];
  stage  TEXT;
  pos    INT := 1;
BEGIN
  stages := CASE p_preset
    WHEN 'bridal'     THEN ARRAY['Inquiry','Consultation','Proposal Sent','Contract Signed','Planning','Day-Of','Follow-Up']
    WHEN 'mobile_bar' THEN ARRAY['Lead','Quote Sent','Deposit Paid','Event Prep','Event Day','Invoice Sent','Closed']
    WHEN 'contractor' THEN ARRAY['Lead','Site Visit','Estimate Sent','Contract Signed','In Progress','Punch List','Closed']
    WHEN 'creative'   THEN ARRAY['Discovery','Proposal','Onboarding','In Production','Review','Final Delivery','Archived']
    ELSE                   ARRAY['Lead','Qualified','Proposal','Negotiation','Won','Lost']
  END;

  FOREACH stage IN ARRAY stages LOOP
    INSERT INTO pipeline_stages (workspace_id, name, position, color)
    VALUES (p_workspace_id, stage, pos, '#6366f1')
    ON CONFLICT DO NOTHING;
    pos := pos + 1;
  END LOOP;
END;
$$;
