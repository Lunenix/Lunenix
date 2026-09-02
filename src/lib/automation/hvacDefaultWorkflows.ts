import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationAction, AutomationTriggerType } from "@/types/database";
import { isFieldServiceWorkspace } from "@/lib/fieldService";

type HvacWorkflowDef = {
  name: string;
  description: string;
  trigger_type: AutomationTriggerType;
  /** Field pipeline stage this workflow listens for. */
  toStageName?: string;
  actions: AutomationAction[];
};

function task(
  title: string,
  description: string,
  due_days: number
): AutomationAction {
  return { type: "create_task", config: { title, description, due_days } };
}

function email(subject: string, body: string): AutomationAction {
  return {
    type: "send_email",
    config: { to: "{{contact.email}}", subject, body },
  };
}

/** Default HVAC / field-service automations keyed to the seeded pipeline. */
export const HVAC_DEFAULT_WORKFLOWS: HvacWorkflowDef[] = [
  {
    name: "HVAC: Qualify new lead",
    description: "When a deal lands in Lead, create a same-day qualify task.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "Qualify HVAC lead: {{lead.title}}",
        "Confirm source, phone, service address, and system type (AC, furnace, heat pump). Log notes on the contact.",
        0
      ),
    ],
  },
  {
    name: "HVAC: Schedule estimate visit",
    description: "On Site Visit, book the estimate and confirm with the customer.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule estimate visit: {{lead.title}}",
        "Put the visit on the calendar with the job address. Confirm access, photos, and who will be on site.",
        1
      ),
      email(
        "We are scheduling your estimate visit — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Thanks for reaching out. We are booking an on-site estimate. We will confirm the time and address shortly.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "HVAC: Send estimate",
    description: "When the estimate is sent, follow up and attach photos.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Follow up on estimate: {{lead.title}}",
        "Send or confirm the written estimate. Include site photos. Ask for questions and a decision date.",
        1
      ),
      email(
        "Your estimate from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review it and reply with any questions. We are happy to walk through options.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "HVAC: Job after contract",
    description: "After Contract Signed, open the job and pull parts.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Create job and pull parts: {{lead.title}}",
        "Turn this deal into a job, assign a tech, check inventory, and order anything short.",
        1
      ),
      email(
        "You are on the schedule — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Thank you for signing. We are scheduling the work and will confirm the install or repair window.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "HVAC: Job in progress",
    description: "On In Progress, log parts, mileage, and receipts.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Log parts, mileage, and receipts: {{lead.title}}",
        "Record parts used, trip miles, and vendor receipts on the job before leaving the site.",
        0
      ),
    ],
  },
  {
    name: "HVAC: Punch list",
    description: "On Punch List, walk the job and get sign-off.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Punch list walk-through: {{lead.title}}",
        "Walk leftover items with the customer, complete touch-ups, and get sign-off.",
        1
      ),
    ],
  },
  {
    name: "HVAC: Close and invoice",
    description: "When Closed, invoice and ask for a review.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Send invoice and request review: {{lead.title}}",
        "Send the invoice, confirm payment terms, and ask for a review if the job went well.",
        1
      ),
      email(
        "Thank you — invoice from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>The job is complete. We are sending your invoice next. Thank you for trusting {{workspace.name}}.</p>"
      ),
    ],
  },
  {
    name: "HVAC: After contract signed (e-sign)",
    description: "When an e-sign contract completes, create a kickoff task.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off HVAC job from signed contract",
        "Create or update the job, assign a tech, and move the pipeline card to Contract Signed if it is not already there.",
        0
      ),
    ],
  },
  {
    name: "HVAC: After invoice sent",
    description: "When an invoice is sent, follow up on payment.",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on invoice payment",
        "If unpaid, follow up. Log the receipt when paid.",
        3
      ),
    ],
  },
];

export async function seedHvacDefaultWorkflows(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("industry_preset")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!isFieldServiceWorkspace(workspace?.industry_preset)) return 0;

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name")
    .eq("workspace_id", workspaceId);
  const byName = new Map(
    (stages ?? []).map((s: { id: string; name: string }) => [s.name, s.id])
  );

  const { data: existing } = await supabase
    .from("automation_workflows")
    .select("name")
    .eq("workspace_id", workspaceId);
  const names = new Set(
    (existing ?? []).map((w: { name: string }) => w.name)
  );

  const rows = HVAC_DEFAULT_WORKFLOWS.flatMap((def) => {
    if (names.has(def.name)) return [];
    if (def.toStageName) {
      const toId = byName.get(def.toStageName);
      if (!toId) return [];
      return [
        {
          workspace_id: workspaceId,
          name: def.name,
          description: def.description,
          is_active: true,
          trigger_type: def.trigger_type,
          trigger_config: { to_stage_id: toId },
          actions: def.actions,
        },
      ];
    }
    return [
      {
        workspace_id: workspaceId,
        name: def.name,
        description: def.description,
        is_active: true,
        trigger_type: def.trigger_type,
        trigger_config: {},
        actions: def.actions,
      },
    ];
  });

  if (rows.length === 0) return 0;
  const { error } = await supabase.from("automation_workflows").insert(rows);
  if (error) {
    console.error("seedHvacDefaultWorkflows:", error.message);
    return 0;
  }
  return rows.length;
}
