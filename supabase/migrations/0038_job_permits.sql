-- Job permits for all Home & Field workspaces. Track pulled vs approved.

CREATE TABLE IF NOT EXISTS public.job_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  permit_number TEXT,
  status TEXT NOT NULL DEFAULT 'needed'
    CHECK (status IN (
      'needed','applied','pulled','approved',
      'inspection_scheduled','passed','failed','not_required'
    )),
  pulled_on DATE,
  approved_on DATE,
  inspection_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_permits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_job_permits ON public.job_permits;
CREATE POLICY workspace_members_job_permits ON public.job_permits
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS job_permits_workspace_status
  ON public.job_permits (workspace_id, status);

CREATE OR REPLACE FUNCTION seed_field_permit_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  sid_signed UUID;
  sid_closed UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND industry_pipeline_family(w.industry_preset) = 'field'
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO sid_signed FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Contract Signed'
    ORDER BY position LIMIT 1;
  SELECT id INTO sid_closed FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Closed'
    ORDER BY position LIMIT 1;

  IF sid_signed IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Field: Log permits pulled',
      'When a job is contracted, log whether a permit was pulled and track approval.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid_signed),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Log permits on Permits: {{lead.title}}',
            'description', 'Open Permits. If the work needs a city/county permit, log it as needed or applied, then mark pulled when issued and approved when the city approves. If no permit is required, log not required so the job still has a record.',
            'due_days', 1
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Field: Log permits pulled'
    );
  END IF;

  IF sid_closed IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'Field: Confirm permits approved',
      'Before close-out, confirm pulled permits are approved or inspection-passed.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid_closed),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Confirm permits approved: {{lead.title}}',
            'description', 'On Permits, confirm every pulled permit for this job is approved or inspection passed. Do not invoice permit-required work that is still applied/pulled without approval.',
            'due_days', 1
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Field: Confirm permits approved'
    );
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION seed_pipeline_stages(p_workspace_id UUID, p_preset TEXT)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  stages TEXT[];
  stage  TEXT;
  pos    INT := 1;
  family TEXT;
BEGIN
  family := industry_pipeline_family(p_preset);
  stages := CASE family
    WHEN 'creative' THEN ARRAY['Discovery','Proposal','Onboarding','In Production','Review','Final Delivery','Archived']
    WHEN 'field'    THEN ARRAY['Lead','Site Visit','Estimate Sent','Contract Signed','In Progress','Punch List','Closed']
    WHEN 'event'    THEN ARRAY['Inquiry','Consultation','Proposal Sent','Contract Signed','Planning','Day-Of','Follow-Up']
    WHEN 'wellness' THEN ARRAY['Lead','Consult Booked','Package Selected','In Care','Completed','Follow-Up','Closed']
    ELSE                 ARRAY['Lead','Qualified','Proposal','Negotiation','Won','Lost']
  END;

  FOREACH stage IN ARRAY stages LOOP
    INSERT INTO pipeline_stages (workspace_id, name, position, color)
    VALUES (p_workspace_id, stage, pos, '#6366f1')
    ON CONFLICT DO NOTHING;
    pos := pos + 1;
  END LOOP;

  IF COALESCE(p_preset, '') = 'hvac'
     AND to_regprocedure('seed_field_service_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_field_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'handyman'
     AND to_regprocedure('seed_handyman_service_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_handyman_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'plumbing'
     AND to_regprocedure('seed_plumbing_service_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_plumbing_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'electrician'
     AND to_regprocedure('seed_electrician_service_workflows(uuid)') IS NOT NULL THEN
    PERFORM seed_electrician_service_workflows(p_workspace_id);
  END IF;

  IF family = 'field' THEN
    PERFORM seed_field_permit_workflows(p_workspace_id);
  END IF;
END;
$fn$;

SELECT seed_field_permit_workflows(id)
FROM public.workspaces
WHERE industry_pipeline_family(industry_preset) = 'field';
