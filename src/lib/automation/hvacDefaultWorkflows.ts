import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationAction, AutomationTriggerType } from "@/types/database";
import { isFieldServiceWorkspace } from "@/lib/fieldService";

export type IndustryWorkflowDef = {
  name: string;
  description: string;
  trigger_type: AutomationTriggerType;
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

/** Default HVAC automations — HVAC workspaces only. */
export const HVAC_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
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
      task(
        "Log permits pulled or not required: {{lead.title}}",
        "On Permits, record any permit pulled for this job (mechanical, refrigerant, or other). Mark pulled and approved when the city issues and approves it. If none is required, log not required.",
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

/**
 * Handyman Services default automations.
 * Starts when a new lead is created (Lead stage) and follows the field pipeline.
 */
export const HANDYMAN_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Handyman: New lead",
    description:
      "When a new lead is created, capture source and reach out to book an estimate.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New handyman lead: {{lead.title}}",
        "Track lead source. Capture contact name, phone, email, service address, and job type/notes (electrical, plumbing, general, or other). Email or text to set an estimate time. Two-way SMS is not live yet — use email and the contact record until a text provider is connected.",
        0
      ),
      email(
        "Thanks for contacting {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We got your request. Reply with a couple of times that work for an on-site estimate, plus the job address if we do not have it yet.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Handyman: Schedule estimate visit",
    description:
      "On Site Visit, put the estimate on the calendar and send confirmation plus a reminder.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule estimate visit: {{lead.title}}",
        "Confirm date/time, address, contact name and number, lead source, and job type. Add it to the calendar with the address for routing. Send confirmation now and a reminder before the visit.",
        1
      ),
      email(
        "Your estimate visit is booked — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We have you down for an on-site estimate. We will come to the address on file. Reply if you need to change the time.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Handyman: Estimate photos",
    description: "Before sending the estimate, capture existing condition and scope photos.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Upload estimate photos: {{lead.title}}",
        "On-site: photo existing condition and scope of work. Attach to the estimate, then generate pricing from the job, photos, and materials.",
        0
      ),
      task(
        "Send estimate for digital accept: {{lead.title}}",
        "Email the estimate. Track sent / viewed / approved / expired. On approval, convert to a job. Texting the estimate still needs a two-way SMS provider.",
        0
      ),
      email(
        "Your handyman estimate from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review and reply to approve, or tell us what to adjust.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Handyman: Job from approved estimate",
    description:
      "After Contract Signed, create the job, assign a tech, and check skills/licenses.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Create job and assign tech: {{lead.title}}",
        "Create the job from the approved estimate. Assign a handyman. Check availability and skill/license for this job type (electrical, plumbing, or general) before dispatch. Flag urgent or unassigned.",
        1
      ),
      task(
        "Log permits pulled or not required: {{lead.title}}",
        "On Permits, log electrical/plumbing/building permits pulled for this job. Mark pulled and approved. If the work does not need a permit, log not required.",
        1
      ),
      email(
        "You are on the schedule — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Thanks for approving the work. We are assigning a tech and will confirm the window.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Handyman: Mileage, materials, and receipts",
    description:
      "When the job is In Progress, log mileage, inventory, and expenses.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Log mileage for this job: {{lead.title}}",
        "Log home base → first job and each job-to-job leg on Mileage. Tie miles to this job. Use the IRS standard mileage rate for the deduction. GPS auto-track is not on yet — enter miles from the map or odometer until then. This feeds job costing and books.",
        0
      ),
      task(
        "Check materials and stock: {{lead.title}}",
        "Confirm inventory before/during the job. Tie materials to the job. Watch low-stock alerts.",
        0
      ),
      task(
        "Capture receipts on site: {{lead.title}}",
        "Photo/upload materials and supply receipts. Tag by job and customer. Categorize the expense. OCR is not auto-filled — enter the amount from the photo.",
        0
      ),
    ],
  },
  {
    name: "Handyman: Punch list and job close",
    description: "On Punch List, finish leftover items and get sign-off.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Punch list and customer sign-off: {{lead.title}}",
        "Walk leftover items, finish touch-ups, note property details on the customer, and get sign-off. Watch jobs running long.",
        1
      ),
    ],
  },
  {
    name: "Handyman: Invoice, AR, and books",
    description:
      "When Closed, invoice labor + materials + billed mileage, then books and follow-up.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Invoice completed job: {{lead.title}}",
        "Generate the invoice from labor + materials + mileage if billed. Check AR aging. Send reminders if overdue. Review job costing (labor + materials + mileage vs. price). Log vendor bills in Books if still pending.",
        1
      ),
      task(
        "Update customer property and history: {{lead.title}}",
        "Save service history and property notes on the contact. Log this visit in communication history.",
        1
      ),
      email(
        "Thanks — invoice from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>The job is complete. Your invoice is coming next. Thank you for choosing {{workspace.name}}.</p>"
      ),
    ],
  },
  {
    name: "Handyman: After contract signed (e-sign)",
    description: "When an e-sign contract completes, kick off the job.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off handyman job from signed contract",
        "Create or update the job from the signed estimate/contract, assign a tech, and move the pipeline card to Contract Signed if needed.",
        0
      ),
    ],
  },
  {
    name: "Handyman: After invoice sent",
    description: "When an invoice is sent, follow AR and overdue reminders.",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on invoice payment",
        "Watch open invoices and aging. Send a reminder if overdue. Record payment status. Flag negative reviews if they come in.",
        3
      ),
    ],
  },
];

/**
 * Plumbing default automations.
 * Starts when a new lead is created. Adds emergency dispatch and permit/inspection tasks.
 */
export const PLUMBING_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Plumbing: New lead",
    description:
      "When a new lead is created, capture source and whether this is emergency/same-day.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New plumbing lead: {{lead.title}}",
        "Track lead source. Mark emergency/urgent vs routine (same-day calls). Capture name, phone, email, service address, and job type/notes (leak, clog, water heater, sewer, fixture). Email or text to set a visit. Two-way SMS is not live yet — use email and the contact record.",
        0
      ),
      email(
        "We got your plumbing request — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We received your request. If this is an emergency (active leak, no water, sewage backup), reply EMERGENCY and we will prioritize dispatch. Otherwise reply with times that work for a visit and confirm the address.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Plumbing: Schedule visit",
    description:
      "On Site Visit, book diagnostic/estimate time and send confirmation plus a reminder.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule plumbing visit: {{lead.title}}",
        "Confirm date/time, address, contact, lead source, and emergency vs routine. Put it on the calendar with the address for routing. Send confirmation now and a reminder before the visit. Flag urgent/unassigned if same-day.",
        1
      ),
      email(
        "Your plumbing visit is booked — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We have you on the schedule. We will come to the address on file. Reply if you need to change the time, especially if the leak or backup gets worse.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Plumbing: Diagnostic photos and estimate",
    description:
      "On Estimate Sent, capture pipe/leak/fixture photos and send the estimate.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Upload diagnostic photos: {{lead.title}}",
        "On-site: photo pipe condition, leak source, and fixture issues. Attach to the estimate, then price labor, parts, and any permit fees.",
        0
      ),
      task(
        "Send plumbing estimate: {{lead.title}}",
        "Email the estimate. Track sent / viewed / approved / expired. On approval, convert to a job. Texting still needs a two-way SMS provider.",
        0
      ),
      email(
        "Your plumbing estimate from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready, including parts and any permit fees if this work needs a permit. Reply to approve or tell us what to adjust.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Plumbing: Job, dispatch, and permits",
    description:
      "After Contract Signed, create the job, prioritize emergency dispatch, and flag permits.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Create job and dispatch tech: {{lead.title}}",
        "Create the job from the approved estimate. Assign a plumber with emergency dispatch priority if urgent. Check availability and licenses (plumbing license, backflow cert, gas line cert) before dispatch. Flag urgent or unassigned.",
        1
      ),
      task(
        "Permits and inspections: {{lead.title}}",
        "Flag if this job needs a permit (water heater replacement, repiping, sewer line). On Permits, log it as applied/pulled, then mark approved when the city approves. Track inspection scheduled/passed. Store the permit number on that record.",
        1
      ),
      email(
        "You are on the plumbing schedule — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Thanks for approving the work. We are assigning a tech. If a permit or inspection is required, we will keep you posted.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Plumbing: Mileage, truck stock, and receipts",
    description:
      "When In Progress, log mileage, parts, and supplier receipts.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Log mileage for this job: {{lead.title}}",
        "Log home base to first job and job-to-job legs on Mileage. Tie miles to this job for costing and the IRS mileage deduction. GPS auto-track is not on yet — enter miles from the map or odometer.",
        0
      ),
      task(
        "Check truck stock and parts: {{lead.title}}",
        "Confirm pipe, fittings, fixtures, and water heaters. Tie parts to the job. Watch low-stock alerts, especially truck stock for emergency calls.",
        0
      ),
      task(
        "Capture parts receipts: {{lead.title}}",
        "Photo/upload supplier receipts. Tag by job and customer. Categorize the expense. OCR is not auto-filled — enter the amount from the photo.",
        0
      ),
    ],
  },
  {
    name: "Plumbing: Inspection and punch list",
    description:
      "On Punch List, finish leftover work and track inspection pass.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Punch list and inspection: {{lead.title}}",
        "Walk leftover items, confirm inspection scheduled/passed if a permit was required, note fixture/equipment on the customer, and get sign-off. Watch jobs running long and permit delays.",
        1
      ),
    ],
  },
  {
    name: "Plumbing: Invoice, AR, and books",
    description:
      "When Closed, invoice labor + parts + billed mileage + permit fees.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Invoice completed plumbing job: {{lead.title}}",
        "Generate the invoice from labor + parts + mileage if billed + permit fees. Check AR aging and send reminders if overdue. Review job costing. Log vendor bills in Books if pending.",
        1
      ),
      task(
        "Update fixture history: {{lead.title}}",
        "Save service history and equipment/fixture notes on the contact (water heater, backflow, main line). Log this visit in communication history.",
        1
      ),
      email(
        "Thanks — plumbing invoice from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>The work is complete. Your invoice is coming next (including permit fees if they applied). Thank you for choosing {{workspace.name}}.</p>"
      ),
    ],
  },
  {
    name: "Plumbing: After contract signed (e-sign)",
    description: "When an e-sign contract completes, kick off the job.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off plumbing job from signed contract",
        "Create or update the job, assign a tech with emergency priority if urgent, start permit tracking if needed, and move the pipeline card to Contract Signed.",
        0
      ),
    ],
  },
  {
    name: "Plumbing: After invoice sent",
    description: "When an invoice is sent, follow AR and overdue reminders.",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on invoice payment",
        "Watch open invoices and aging. Send a reminder if overdue. Record payment. Flag permit delays or negative reviews if they come in.",
        3
      ),
    ],
  },
];

/**
 * Electrical default automations.
 * Starts when a new lead is created. Adds emergency/safety dispatch, permits, and panel history.
 */
export const ELECTRICIAN_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Electrical: New lead",
    description:
      "When a new lead is created, capture source and whether this is an outage or safety hazard.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New electrical lead: {{lead.title}}",
        "Track lead source. Mark emergency/urgent vs routine (outage, sparking, burning smell, exposed wiring). Capture name, phone, email, service address, and job type/notes (panel, circuit, fixture, EV charger, solar). Email or text to set a visit. Two-way SMS is not live yet — use email and the contact record.",
        0
      ),
      email(
        "We got your electrical request — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We received your request. If this is an emergency (no power, sparking, burning smell, or a safety hazard), reply EMERGENCY and we will prioritize dispatch. Otherwise reply with times that work for a visit and confirm the address.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Electrical: Schedule visit",
    description:
      "On Site Visit, book diagnostic/estimate time and send confirmation plus a reminder.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule electrical visit: {{lead.title}}",
        "Confirm date/time, address, contact, lead source, and emergency vs routine. Put it on the calendar with the address for routing. Send confirmation now and a reminder before the visit. Flag urgent/unassigned if same-day.",
        1
      ),
      email(
        "Your electrical visit is booked — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We have you on the schedule. We will come to the address on file. Reply if you need to change the time, especially if sparking or an outage gets worse.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Electrical: Diagnostic photos and estimate",
    description:
      "On Estimate Sent, capture panel/wiring photos and send the estimate.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Upload diagnostic photos: {{lead.title}}",
        "On-site: photo panel condition, wiring, code violations, and damage. Attach to the estimate, then price labor, parts, and any permit fees.",
        0
      ),
      task(
        "Send electrical estimate: {{lead.title}}",
        "Email the estimate. Track sent / viewed / approved / expired. On approval, convert to a job. Texting still needs a two-way SMS provider.",
        0
      ),
      email(
        "Your electrical estimate from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready, including parts and any permit fees if this work needs a permit (panel upgrade, rewiring, new circuits, EV charger). Reply to approve or tell us what to adjust.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Electrical: Job, dispatch, and permits",
    description:
      "After Contract Signed, create the job, prioritize emergency dispatch, and flag permits.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Create job and dispatch tech: {{lead.title}}",
        "Create the job from the approved estimate. Assign an electrician with emergency dispatch priority if urgent. Check availability and licenses (electrical license, journeyman/master, solar or EV specialty) before dispatch. Flag urgent or unassigned.",
        1
      ),
      task(
        "Permits and inspections: {{lead.title}}",
        "Flag if this job needs a permit (panel upgrades, rewiring, new circuits, EV chargers). On Permits, log it as applied/pulled, then mark approved when the city approves. Track inspection scheduled/passed. Store the permit number on that record.",
        1
      ),
      email(
        "You are on the electrical schedule — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Thanks for approving the work. We are assigning a tech. If a permit or inspection is required, we will keep you posted.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Electrical: Mileage, truck stock, and receipts",
    description:
      "When In Progress, log mileage, parts, and supplier receipts.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Log mileage for this job: {{lead.title}}",
        "Log home base to first job and job-to-job legs on Mileage. Tie miles to this job for costing and the IRS mileage deduction. GPS auto-track is not on yet — enter miles from the map or odometer.",
        0
      ),
      task(
        "Check truck stock and parts: {{lead.title}}",
        "Confirm wire, breakers, panels, fixtures, and conduit. Tie parts to the job. Watch low-stock alerts, especially truck stock for emergency calls.",
        0
      ),
      task(
        "Capture parts receipts: {{lead.title}}",
        "Photo/upload supplier receipts. Tag by job and customer. Categorize the expense. OCR is not auto-filled — enter the amount from the photo.",
        0
      ),
    ],
  },
  {
    name: "Electrical: Inspection and punch list",
    description:
      "On Punch List, finish leftover work and track inspection pass.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Punch list and inspection: {{lead.title}}",
        "Walk leftover items, confirm inspection scheduled/passed if a permit was required, note panel/equipment on the customer, and get sign-off. Watch jobs running long and permit/inspection delays.",
        1
      ),
    ],
  },
  {
    name: "Electrical: Invoice, AR, and books",
    description:
      "When Closed, invoice labor + parts + billed mileage + permit fees.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Invoice completed electrical job: {{lead.title}}",
        "Generate the invoice from labor + parts + mileage if billed + permit fees. Check AR aging and send reminders if overdue. Review job costing. Log vendor bills in Books if pending.",
        1
      ),
      task(
        "Update panel and equipment history: {{lead.title}}",
        "Save service history and panel/equipment notes on the contact (panel size, main breaker, EV circuit). Log this visit in communication history.",
        1
      ),
      email(
        "Thanks — electrical invoice from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>The work is complete. Your invoice is coming next (including permit fees if they applied). Thank you for choosing {{workspace.name}}.</p>"
      ),
    ],
  },
  {
    name: "Electrical: After contract signed (e-sign)",
    description: "When an e-sign contract completes, kick off the job.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off electrical job from signed contract",
        "Create or update the job, assign a tech with emergency priority if urgent, start permit tracking if needed, and move the pipeline card to Contract Signed.",
        0
      ),
    ],
  },
  {
    name: "Electrical: After invoice sent",
    description: "When an invoice is sent, follow AR and overdue reminders.",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on invoice payment",
        "Watch open invoices and aging. Send a reminder if overdue. Record payment. Flag permit/inspection delays or negative reviews if they come in.",
        3
      ),
    ],
  },
];

/**
 * Landscaping & Lawn Care default automations.
 * Recurring mow/maintain plus one-off installs. Landscaping workspaces only.
 */
export const LANDSCAPING_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Landscaping: New lead",
    description:
      "When a new lead is created, capture source and property/service interest.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New landscaping lead: {{lead.title}}",
        "Track lead source on the pipeline card. Capture name, phone, email, property address, lot notes, and interest (mow, seasonal, install, irrigation, tree). Email to book an estimate visit. Two-way SMS is not live yet — use email and the contact record.",
        0
      ),
      email(
        "Thanks for contacting {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We received your landscaping request. Reply with the property address and a couple of times that work for a site visit.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Landscaping: Schedule estimate visit",
    description:
      "On Site Visit, book the estimate and capture property/contact details.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule estimate visit: {{lead.title}}",
        "Set the estimate time on the calendar with the property address. Confirm access, gate codes, HOA rules, and who will be on site. Save property notes on the contact.",
        1
      ),
      email(
        "Your landscape visit is booked — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We have you down for an on-site estimate. We will come to the address on file. Reply if you need to change the time.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Landscaping: Property photos and estimate",
    description:
      "On Estimate Sent, attach property photos and send the estimate for digital approval.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Upload property photos: {{lead.title}}",
        "On-site: photo lawn, beds, drainage, and existing hardscape. Attach to the estimate, then price labor, materials, and any permit or HOA fees.",
        0
      ),
      task(
        "Send estimate for digital accept: {{lead.title}}",
        "Email the estimate. Track sent / viewed / approved. On approval, convert to a job. Recurring mow plans are set up after contract on Recurring plans.",
        0
      ),
      email(
        "Your landscape estimate from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review and reply to approve, or tell us what to adjust.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Landscaping: Job, crew, permits, and plan",
    description:
      "After Contract Signed, assign crew, log city/HOA approvals, and set recurring visits.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Create job and assign crew: {{lead.title}}",
        "Create the job from the approved estimate. Assign a tech. Check availability and certifications (pesticide/herbicide if applying chemicals) on Techs before dispatch. Set route order on Jobs.",
        1
      ),
      task(
        "City permit or HOA sign-off: {{lead.title}}",
        "On Permits, log city/county permits and HOA sign-off when the work qualifies (hardscape, trees, irrigation, fences). Mark pulled and approved. If none is required, log not required with kind other.",
        1
      ),
      task(
        "Set recurring service plan: {{lead.title}}",
        "If this is mow/maintain, open Recurring plans. Set weekly, biweekly, monthly, or seasonal, next visit, and auto-invoice. Toggle seasonal off in the off-season so visits stop generating.",
        1
      ),
      email(
        "You are on the landscape schedule — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Thanks for approving. We are assigning a crew and will confirm the first visit window. If HOA or city approval is required, we will keep you posted.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Landscaping: Route, stock, and receipts",
    description:
      "When In Progress, order the route, log mileage, stock, and receipts.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Route order and mileage: {{lead.title}}",
        "Set route order on Jobs for today's stops. Log home base → first job and job-to-job legs on Mileage for the tax deduction. GPS auto-optimize is not live — order stops by drive time from the map.",
        0
      ),
      task(
        "Check equipment and materials: {{lead.title}}",
        "Confirm mowers, trimmers, and materials in Inventory. Log equipment maintenance notes. Watch low-stock alerts.",
        0
      ),
      task(
        "Capture receipts: {{lead.title}}",
        "Photo/upload materials and supply receipts on Books. Tag by job. OCR is not auto-filled — enter the amount from the photo.",
        0
      ),
    ],
  },
  {
    name: "Landscaping: Punch list and weather",
    description:
      "On Punch List, finish leftover work and note weather delays.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Punch list and weather delays: {{lead.title}}",
        "Walk leftover items, get sign-off, and note property details on the contact. If rain or freeze skipped a visit, log it on the job and reschedule. Ask Luna for weather before dispatch. Watch permit/HOA delays on Field ops.",
        1
      ),
    ],
  },
  {
    name: "Landscaping: Invoice, AR, books, and reviews",
    description:
      "When Closed, invoice, check aging, books, tax set-aside, and reviews.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Invoice and recurring billing: {{lead.title}}",
        "Invoice labor + materials + billed mileage. For recurring plans, auto-draft invoices generate from Recurring plans when a visit is due. Check AR aging and send reminders if overdue. Review job profit on Field ops.",
        1
      ),
      task(
        "Books, tax set-aside, and history: {{lead.title}}",
        "Log vendor bills in Books. Field ops shows income vs expenses and a 30% tax set-aside hint from profit. Save service/plan history and property notes on the contact. Flag reviews.",
        1
      ),
      email(
        "Thanks — invoice from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>The visit or job is complete. Your invoice is coming next. Thank you for choosing {{workspace.name}}.</p>"
      ),
    ],
  },
  {
    name: "Landscaping: After contract signed (e-sign)",
    description: "When an e-sign contract completes, kick off the job and plan.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off landscape job from signed contract",
        "Create or update the job, assign a crew, start permit/HOA tracking if needed, and add a recurring plan when this is ongoing service.",
        0
      ),
    ],
  },
  {
    name: "Landscaping: After invoice sent",
    description: "When an invoice is sent, follow AR and overdue reminders.",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on invoice payment",
        "Watch open invoices and aging. Send a reminder if overdue. Record payment. Flag permit/HOA delays, weather skips, or negative reviews.",
        3
      ),
    ],
  },
];

/** Shared Home & Field permit tracking — seeded for every field-service workspace. */
export const FIELD_PERMIT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Field: Log permits pulled",
    description:
      "When a job is contracted, log whether a permit was pulled and track approval.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Log permits on Permits: {{lead.title}}",
        "Open Permits. If the work needs a city/county permit, log it as needed or applied, then mark pulled when issued and approved when the city approves. If no permit is required, log not required so the job still has a record.",
        1
      ),
    ],
  },
  {
    name: "Field: Confirm permits approved",
    description:
      "Before close-out, confirm pulled permits are approved or inspection-passed.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Confirm permits approved: {{lead.title}}",
        "On Permits, confirm every pulled permit for this job is approved or inspection passed. Do not invoice permit-required work that is still applied/pulled without approval. Flag delays on Field ops.",
        1
      ),
    ],
  },
];

const PACKS: Record<string, IndustryWorkflowDef[]> = {
  hvac: HVAC_DEFAULT_WORKFLOWS,
  handyman: HANDYMAN_DEFAULT_WORKFLOWS,
  plumbing: PLUMBING_DEFAULT_WORKFLOWS,
  electrician: ELECTRICIAN_DEFAULT_WORKFLOWS,
  landscaping_lawn_care: LANDSCAPING_DEFAULT_WORKFLOWS,
};

/** Default workflow name prefixes. Each trade pack stays on its own preset. */
const TRADE_PACK_PREFIXES: { preset: string; prefix: string }[] = [
  { preset: "hvac", prefix: "HVAC:" },
  { preset: "handyman", prefix: "Handyman:" },
  { preset: "plumbing", prefix: "Plumbing:" },
  { preset: "electrician", prefix: "Electrical:" },
  { preset: "landscaping_lawn_care", prefix: "Landscaping:" },
];

async function pruneForeignIndustryWorkflows(
  supabase: SupabaseClient,
  workspaceId: string,
  preset: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("automation_workflows")
    .select("id, name")
    .eq("workspace_id", workspaceId);
  const field = isFieldServiceWorkspace(preset);
  const ids = (existing ?? [])
    .filter((w: { id: string; name: string }) => {
      const name = w.name ?? "";
      for (const pack of TRADE_PACK_PREFIXES) {
        if (name.startsWith(pack.prefix) && preset !== pack.preset) return true;
      }
      if (name.startsWith("Field:") && !field) return true;
      return false;
    })
    .map((w: { id: string }) => w.id);
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("automation_workflows")
    .delete()
    .eq("workspace_id", workspaceId)
    .in("id", ids);
  if (error) {
    console.error("pruneForeignIndustryWorkflows:", error.message);
  }
}

export async function seedIndustryDefaultWorkflows(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("industry_preset")
    .eq("id", workspaceId)
    .maybeSingle();
  const preset = workspace?.industry_preset ?? "";
  await pruneForeignIndustryWorkflows(supabase, workspaceId, preset);
  const trade = PACKS[preset] ?? [];
  const pack = isFieldServiceWorkspace(preset)
    ? [...trade, ...FIELD_PERMIT_WORKFLOWS]
    : trade;
  if (pack.length === 0) return 0;

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

  const rows = pack.flatMap((def) => {
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
    console.error("seedIndustryDefaultWorkflows:", error.message);
    return 0;
  }
  return rows.length;
}

/** @deprecated Use seedIndustryDefaultWorkflows */
export const seedHvacDefaultWorkflows = seedIndustryDefaultWorkflows;
