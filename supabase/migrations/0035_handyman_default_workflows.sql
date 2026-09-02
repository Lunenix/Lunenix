-- Handyman Services default automations. HVAC pack stays on HVAC only.

CREATE OR REPLACE FUNCTION seed_handyman_service_workflows(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  sid UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id AND w.industry_preset = 'handyman'
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
      'Handyman: New lead',
      'When a new lead is created, capture source and reach out to book an estimate.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'New handyman lead: {{lead.title}}',
            'description', 'Track lead source. Capture contact name, phone, email, service address, and job type/notes (electrical, plumbing, general, or other). Email or text to set an estimate time.',
            'due_days', 0
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'Thanks for contacting {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>We got your request. Reply with a couple of times that work for an on-site estimate, plus the job address if we do not have it yet.</p><p>{{workspace.name}}</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Handyman: New lead'
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
      'Handyman: Schedule estimate visit',
      'On Site Visit, put the estimate on the calendar and send confirmation plus a reminder.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Schedule estimate visit: {{lead.title}}',
            'description', 'Confirm date/time, address, contact name and number, lead source, and job type. Add it to the calendar with the address for routing. Send confirmation now and a reminder before the visit.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'Your estimate visit is booked — {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>We have you down for an on-site estimate. We will come to the address on file. Reply if you need to change the time.</p><p>{{workspace.name}}</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Handyman: Schedule estimate visit'
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
      'Handyman: Estimate photos',
      'Before sending the estimate, capture existing condition and scope photos.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Upload estimate photos: {{lead.title}}',
            'description', 'On-site: photo existing condition and scope of work. Attach to the estimate, then generate pricing from the job, photos, and materials.',
            'due_days', 0
          )
        ),
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Send estimate for digital accept: {{lead.title}}',
            'description', 'Email the estimate. Track sent / viewed / approved / expired. On approval, convert to a job.',
            'due_days', 0
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'Your handyman estimate from {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review and reply to approve, or tell us what to adjust.</p><p>{{workspace.name}}</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Handyman: Estimate photos'
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
      'Handyman: Job from approved estimate',
      'After Contract Signed, create the job, assign a tech, and check skills/licenses.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Create job and assign tech: {{lead.title}}',
            'description', 'Create the job from the approved estimate. Assign a handyman. Check availability and skill/license for this job type (electrical, plumbing, or general) before dispatch. Flag urgent or unassigned.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'You are on the schedule — {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>Thanks for approving the work. We are assigning a tech and will confirm the window.</p><p>{{workspace.name}}</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Handyman: Job from approved estimate'
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
      'Handyman: Mileage, materials, and receipts',
      'When the job is In Progress, log mileage, inventory, and expenses.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Log mileage for this job: {{lead.title}}',
            'description', 'Log home base to first job and each job-to-job leg on Mileage. Tie miles to this job. Use the IRS standard mileage rate. GPS auto-track is not on yet — enter miles from the map or odometer.',
            'due_days', 0
          )
        ),
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Check materials and stock: {{lead.title}}',
            'description', 'Confirm inventory before/during the job. Tie materials to the job. Watch low-stock alerts.',
            'due_days', 0
          )
        ),
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Capture receipts on site: {{lead.title}}',
            'description', 'Photo/upload materials and supply receipts. Tag by job and customer. Categorize the expense. OCR is not auto-filled — enter the amount from the photo.',
            'due_days', 0
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Handyman: Mileage, materials, and receipts'
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
      'Handyman: Punch list and job close',
      'On Punch List, finish leftover items and get sign-off.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Punch list and customer sign-off: {{lead.title}}',
            'description', 'Walk leftover items, finish touch-ups, note property details on the customer, and get sign-off. Watch jobs running long.',
            'due_days', 1
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Handyman: Punch list and job close'
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
      'Handyman: Invoice, AR, and books',
      'When Closed, invoice labor + materials + billed mileage, then books and follow-up.',
      true, 'lead_stage_change',
      jsonb_build_object('to_stage_id', sid),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Invoice completed job: {{lead.title}}',
            'description', 'Generate the invoice from labor + materials + mileage if billed. Check AR aging. Send reminders if overdue. Review job costing (labor + materials + mileage vs. price). Log vendor bills in Books if still pending.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'create_task',
          'config', jsonb_build_object(
            'title', 'Update customer property and history: {{lead.title}}',
            'description', 'Save service history and property notes on the contact. Log this visit in communication history.',
            'due_days', 1
          )
        ),
        jsonb_build_object(
          'type', 'send_email',
          'config', jsonb_build_object(
            'to', '{{contact.email}}',
            'subject', 'Thanks — invoice from {{workspace.name}}',
            'body', '<p>Hi {{contact.first_name}},</p><p>The job is complete. Your invoice is coming next. Thank you for choosing {{workspace.name}}.</p>'
          )
        )
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.automation_workflows aw
      WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Handyman: Invoice, AR, and books'
    );
  END IF;

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Handyman: After contract signed (e-sign)',
    'When an e-sign contract completes, kick off the job.',
    true, 'contract_signed', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'create_task',
        'config', jsonb_build_object(
          'title', 'Kick off handyman job from signed contract',
          'description', 'Create or update the job from the signed estimate/contract, assign a tech, and move the pipeline card to Contract Signed if needed.',
          'due_days', 0
        )
      )
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Handyman: After contract signed (e-sign)'
  );

  INSERT INTO public.automation_workflows (
    workspace_id, name, description, is_active, trigger_type, trigger_config, actions
  )
  SELECT p_workspace_id,
    'Handyman: After invoice sent',
    'When an invoice is sent, follow AR and overdue reminders.',
    true, 'invoice_sent', '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'type', 'create_task',
        'config', jsonb_build_object(
          'title', 'Follow up on invoice payment',
          'description', 'Watch open invoices and aging. Send a reminder if overdue. Record payment status. Flag negative reviews if they come in.',
          'due_days', 3
        )
      )
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.automation_workflows aw
    WHERE aw.workspace_id = p_workspace_id AND aw.name = 'Handyman: After invoice sent'
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
  END IF;
END;
$fn$;

SELECT seed_handyman_service_workflows(id)
FROM public.workspaces
WHERE industry_preset = 'handyman';
