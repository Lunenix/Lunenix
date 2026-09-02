-- Electrical default automations (emergency/safety dispatch + permits/inspections).

CREATE OR REPLACE FUNCTION seed_electrician_service_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  sid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.industry_preset = 'electrician'
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
      'Electrical: New lead',
      'When a new lead is created, capture source and whether this is an outage or safety hazard.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'New electrical lead: {{lead.title}}',
            'description', 'Track lead source. Mark emergency/urgent vs routine (outage, sparking, burning smell, exposed wiring). Capture name, phone, email, service address, and job type/notes (panel, circuit, fixture, EV charger, solar). Email or text to set a visit.',
            'due_days', 0
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'We got your electrical request — {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>We received your request. If this is an emergency (no power, sparking, burning smell, or a safety hazard), reply EMERGENCY and we will prioritize dispatch. Otherwise reply with times that work for a visit and confirm the address.</p><p>{{workspace.name}}</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Electrical: New lead'
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
      'Electrical: Schedule visit',
      'On Site Visit, book diagnostic/estimate time and send confirmation plus a reminder.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Schedule electrical visit: {{lead.title}}',
            'description', 'Confirm date/time, address, contact, lead source, and emergency vs routine. Put it on the calendar with the address for routing. Send confirmation now and a reminder before the visit. Flag urgent/unassigned if same-day.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'Your electrical visit is booked — {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>We have you on the schedule. We will come to the address on file. Reply if you need to change the time, especially if sparking or an outage gets worse.</p><p>{{workspace.name}}</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Electrical: Schedule visit'
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
      'Electrical: Diagnostic photos and estimate',
      'On Estimate Sent, capture panel/wiring photos and send the estimate.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Upload diagnostic photos: {{lead.title}}',
            'description', 'On-site: photo panel condition, wiring, code violations, and damage. Attach to the estimate, then price labor, parts, and any permit fees.',
            'due_days', 0
          )
        ),
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Send electrical estimate: {{lead.title}}',
            'description', 'Email the estimate. Track sent / viewed / approved / expired. On approval, convert to a job.',
            'due_days', 0
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'Your electrical estimate from {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>Your estimate is ready, including parts and any permit fees if this work needs a permit (panel upgrade, rewiring, new circuits, EV charger). Reply to approve or tell us what to adjust.</p><p>{{workspace.name}}</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Electrical: Diagnostic photos and estimate'
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
      'Electrical: Job, dispatch, and permits',
      'After Contract Signed, create the job, prioritize emergency dispatch, and flag permits.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Create job and dispatch tech: {{lead.title}}',
            'description', 'Create the job from the approved estimate. Assign an electrician with emergency dispatch priority if urgent. Check availability and licenses (electrical license, journeyman/master, solar or EV specialty) before dispatch. Flag urgent or unassigned.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Permits and inspections: {{lead.title}}',
            'description', 'Flag if this job needs a permit (panel upgrades, rewiring, new circuits, EV chargers). Track status: applied, approved, inspection scheduled/passed. Store permit docs/photos on the job or contact notes.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'You are on the electrical schedule — {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>Thanks for approving the work. We are assigning a tech. If a permit or inspection is required, we will keep you posted.</p><p>{{workspace.name}}</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Electrical: Job, dispatch, and permits'
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
      'Electrical: Mileage, truck stock, and receipts',
      'When In Progress, log mileage, parts, and supplier receipts.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Log mileage for this job: {{lead.title}}',
            'description', 'Log home base to first job and job-to-job legs on Mileage. Tie miles to this job for costing and the IRS mileage deduction. GPS auto-track is not on yet.',
            'due_days', 0
          )
        ),
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Check truck stock and parts: {{lead.title}}',
            'description', 'Confirm wire, breakers, panels, fixtures, and conduit. Tie parts to the job. Watch low-stock alerts, especially truck stock for emergency calls.',
            'due_days', 0
          )
        ),
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Capture parts receipts: {{lead.title}}',
            'description', 'Photo/upload supplier receipts. Tag by job and customer. Categorize the expense. OCR is not auto-filled — enter the amount from the photo.',
            'due_days', 0
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Electrical: Mileage, truck stock, and receipts'
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
      'Electrical: Inspection and punch list',
      'On Punch List, finish leftover work and track inspection pass.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Punch list and inspection: {{lead.title}}',
            'description', 'Walk leftover items, confirm inspection scheduled/passed if a permit was required, note panel/equipment on the customer, and get sign-off. Watch jobs running long and permit/inspection delays.',
            'due_days', 1
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Electrical: Inspection and punch list'
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
      'Electrical: Invoice, AR, and books',
      'When Closed, invoice labor + parts + billed mileage + permit fees.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Invoice completed electrical job: {{lead.title}}',
            'description', 'Generate the invoice from labor + parts + mileage if billed + permit fees. Check AR aging and send reminders if overdue. Review job costing. Log vendor bills in Books if pending.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Update panel and equipment history: {{lead.title}}',
            'description', 'Save service history and panel/equipment notes on the contact (panel size, main breaker, EV circuit). Log this visit in communication history.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'Thanks — electrical invoice from {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>The work is complete. Your invoice is coming next (including permit fees if they applied). Thank you for choosing {{workspace.name}}.</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Electrical: Invoice, AR, and books'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Electrical: After contract signed (e-sign)',
    'When an e-sign contract completes, kick off the job.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'create_task',
        'config', jsonb_build_object(
          'title', 'Kick off electrical job from signed contract',
          'description', 'Create or update the job, assign a tech with emergency priority if urgent, start permit tracking if needed, and move the pipeline card to Contract Signed.',
          'due_days', 0
        )
      )
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Electrical: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Electrical: After invoice sent',
    'When an invoice is sent, follow AR and overdue reminders.',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'create_task',
        'config', jsonb_build_object(
          'title', 'Follow up on invoice payment',
          'description', 'Watch open invoices and aging. Send a reminder if overdue. Record payment. Flag permit/inspection delays or negative reviews if they come in.',
          'due_days', 3
        )
      )
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Electrical: After invoice sent'
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

  IF COALESCE(p_preset, '') = 'hvac' THEN
    PERFORM seed_field_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'handyman' THEN
    PERFORM seed_handyman_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'plumbing' THEN
    PERFORM seed_plumbing_service_workflows(p_workspace_id);
  ELSIF COALESCE(p_preset, '') = 'electrician' THEN
    PERFORM seed_electrician_service_workflows(p_workspace_id);
  END IF;
END;
$fn$;

SELECT seed_electrician_service_workflows(id)
FROM public.workspaces
WHERE industry_preset = 'electrician';
