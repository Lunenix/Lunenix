-- Default HVAC / field-service automation workflows.
-- Hooks into seed_pipeline_stages when the industry family is field.
-- Safe to re-run: skips workflows that already exist by name.

CREATE OR REPLACE FUNCTION seed_field_service_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  sid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND industry_pipeline_family(w.industry_preset) = 'field'
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Lead'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'HVAC: Qualify new lead',
      'When a deal lands in Lead, create a same-day qualify task.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Qualify HVAC lead: {{lead.title}}',
            'description', 'Confirm source, phone, service address, and system type (AC, furnace, heat pump). Log notes on the contact.',
            'due_days', 0
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'HVAC: Qualify new lead'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Site Visit'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'HVAC: Schedule estimate visit',
      'On Site Visit, book the estimate and confirm with the customer.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Schedule estimate visit: {{lead.title}}',
            'description', 'Put the visit on the calendar with the job address. Confirm access, photos, and who will be on site.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'We are scheduling your estimate visit — {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>Thanks for reaching out. We are booking an on-site estimate. We will confirm the time and address shortly.</p><p>{{workspace.name}}</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'HVAC: Schedule estimate visit'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Estimate Sent'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'HVAC: Send estimate',
      'When the estimate is sent, follow up and attach photos.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Follow up on estimate: {{lead.title}}',
            'description', 'Send or confirm the written estimate. Include site photos. Ask for questions and a decision date.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'Your estimate from {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review it and reply with any questions. We are happy to walk through options.</p><p>{{workspace.name}}</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'HVAC: Send estimate'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Contract Signed'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'HVAC: Job after contract',
      'After Contract Signed, open the job and pull parts.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Create job and pull parts: {{lead.title}}',
            'description', 'Turn this deal into a job, assign a tech, check inventory, and order anything short.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'You are on the schedule — {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>Thank you for signing. We are scheduling the work and will confirm the install or repair window.</p><p>{{workspace.name}}</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'HVAC: Job after contract'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'In Progress'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'HVAC: Job in progress',
      'On In Progress, log parts, mileage, and receipts.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Log parts, mileage, and receipts: {{lead.title}}',
            'description', 'Record parts used, trip miles, and vendor receipts on the job before leaving the site.',
            'due_days', 0
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'HVAC: Job in progress'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Punch List'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'HVAC: Punch list',
      'On Punch List, walk the job and get sign-off.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Punch list walk-through: {{lead.title}}',
            'description', 'Walk leftover items with the customer, complete touch-ups, and get sign-off.',
            'due_days', 1
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'HVAC: Punch list'
    );
  END IF;

  SELECT id INTO sid FROM public.pipeline_stages
    WHERE workspace_id = p_workspace_id AND name = 'Closed'
    ORDER BY position LIMIT 1;
  IF sid IS NOT NULL THEN
    INSERT INTO public.automation_workflows (
      workspace_id, name, description, is_active, trigger_type, trigger_config, actions
    )
    SELECT p_workspace_id,
      'HVAC: Close and invoice',
      'When Closed, invoice and ask for a review.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Send invoice and request review: {{lead.title}}',
            'description', 'Send the invoice, confirm payment terms, and ask for a review if the job went well.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'Thank you — invoice from {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>The job is complete. We are sending your invoice next. Thank you for trusting {{workspace.name}}.</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'HVAC: Close and invoice'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'HVAC: After contract signed (e-sign)',
    'When an e-sign contract completes, create a kickoff task.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'create_task',
        'config', jsonb_build_object(
          'title', 'Kick off HVAC job from signed contract',
          'description', 'Create or update the job, assign a tech, and move the pipeline card to Contract Signed if it is not already there.',
          'due_days', 0
        )
      )
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'HVAC: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'HVAC: After invoice sent',
    'When an invoice is sent, follow up on payment.',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'create_task',
        'config', jsonb_build_object(
          'title', 'Follow up on invoice payment',
          'description', 'If unpaid, follow up. Log the receipt when paid.',
          'due_days', 3
        )
      )
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'HVAC: After invoice sent'
  );
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

  IF family = 'field' THEN
    PERFORM seed_field_service_workflows(p_workspace_id);
  END IF;
END;
$fn$;

SELECT seed_field_service_workflows(id)
FROM public.workspaces
WHERE industry_pipeline_family(industry_preset) = 'field';
