import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationAction, AutomationTriggerType } from "@/types/database";
import { resolveIndustryPreset } from "@/lib/industryVerticals";
import {
  allWorkflowPrefixes,
  catalogWorkflowsForPreset,
  fieldPresetUsesSharedPermits,
} from "@/lib/automation/catalogDefaultWorkflows";

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

/**
 * Roofing & Exterior Repair default automations.
 * Insurance claims, drone/inspection photos, materials, weather holds.
 * Roofing workspaces only — not merged with HVAC or landscaping.
 */
export const ROOFING_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Roofing: New lead",
    description:
      "When a new lead is created, capture storm/insurance vs out-of-pocket vs referral.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New roofing lead: {{lead.title}}",
        "Set lead source on the pipeline card: storm damage/insurance, out-of-pocket, or referral. Capture name, phone, email, property address, and damage notes. Email to book an inspection. Two-way SMS is not live yet — use email and the contact record.",
        0
      ),
      email(
        "Thanks for contacting {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We received your roofing request. Reply with the property address, a couple of inspection times, and whether this is insurance or out-of-pocket work.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Roofing: Schedule inspection",
    description:
      "On Site Visit, book the inspection/estimate and put it on the calendar.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule roof inspection: {{lead.title}}",
        "Confirm date/time, address, contact name and number, lead source, damage type/notes, and insurance info if applicable. Add it to the calendar with the address for routing. Send confirmation and a reminder. Two-way texting is not live yet.",
        1
      ),
      email(
        "Your roof inspection is booked — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We have you down for an on-site roof inspection. We will come to the address on file. Reply if you need to change the time. If this is an insurance claim, have your claim number handy for the visit.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Roofing: Inspection photos and estimate",
    description:
      "On Estimate Sent, attach drone/roof photos and send insurance or out-of-pocket pricing.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Upload inspection photos: {{lead.title}}",
        "On Estimates, upload roof photos, drone shots, and measurements (set photo kind). Document damage for the claim. Video files can be linked in notes until a drone video uploader is added.",
        0
      ),
      task(
        "Send roofing estimate: {{lead.title}}",
        "Price from insurance scope or out-of-pocket. Email the estimate. Track sent / viewed / approved / expired. Approval converts to a job.",
        0
      ),
      email(
        "Your roofing estimate from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review and reply to approve, or tell us what to adjust. If this is an insurance job, we will also keep the claim file updated.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Roofing: Job, claim, permits, and materials",
    description:
      "After Contract Signed, open the job, claim file, permits, and material orders.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Create roofing job and assign crew: {{lead.title}}",
        "Create the job from the approved estimate. Assign a crew. Confirm fall protection/OSHA and ladder safety on Techs. Flag weather hold on Jobs if rain, wind, or extreme heat delays work.",
        1
      ),
      task(
        "Open insurance claim file: {{lead.title}}",
        "On Claims, log company, claim status, adjuster, and meet-the-adjuster time. Store Xactimate/scope notes. Track supplements if extra damage is found. Policy numbers stay on the claim record — do not paste them into Luna chat.",
        1
      ),
      task(
        "Permits for replacement or structural repair: {{lead.title}}",
        "On Permits, flag full roof replacement or structural repair. Track applied, approved, inspection scheduled/passed. Store permit numbers and notes. If none is required, log not required.",
        1
      ),
      task(
        "Order materials and dumpster: {{lead.title}}",
        "On Material orders, log shingles (color/type/qty), underlayment, and dumpster/roll-off with delivery date and drop-off notes. Flag delayed or waiting-on-delivery jobs.",
        1
      ),
      email(
        "You are on the roofing schedule — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Thanks for approving. We are assigning a crew, ordering materials, and tracking any permit or insurance steps. We will confirm the work window and let you know when materials are arriving.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Roofing: Weather, stock, and receipts",
    description: "When In Progress, check weather, stock, and receipts.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Weather, inventory, and receipts: {{lead.title}}",
        "Ask Luna for weather before dispatch. Toggle weather hold on Jobs for rain, wind, or extreme heat. Confirm ladders, harnesses, nail guns, leftover stock, and dumpsters in Inventory. Photo receipts on Books (materials, dumpster, supplier invoices). OCR is not auto-filled. GPS auto-route is not live.",
        0
      ),
      email(
        "Crew update from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We are lining up the crew and materials for your roof. We will reschedule if weather makes the job unsafe. Reply to this email with questions.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Roofing: Punch list and city inspection",
    description: "On Punch List, finish leftovers and city inspection.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Punch list and permit inspection: {{lead.title}}",
        "Walk leftover items, get sign-off, and log city inspection on Permits. Note roof history and insurance company on the contact. Watch pending supplements on Field ops.",
        1
      ),
    ],
  },
  {
    name: "Roofing: Invoice, ACV, books, and reviews",
    description: "When Closed, invoice to insurance or customer and close books.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Invoice and insurance payments: {{lead.title}}",
        "Invoice to match insurance scope or out-of-pocket pricing. On Claims, track ACV vs depreciation payments. Check AR aging and send reminders if overdue. Review job profit (materials + labor + dumpster vs price/claim payout) on Field ops.",
        1
      ),
      task(
        "Books, tax set-aside, and history: {{lead.title}}",
        "Log vendor/supplier bills in Books. Field ops shows income vs expenses and a 30% tax set-aside hint from profit. Save roof history on the contact. Flag negative reviews.",
        1
      ),
      email(
        "Thanks — invoice from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>The roof work is complete. Your invoice is coming next. If this is an insurance job, we will also note ACV and any remaining depreciation payment on the claim file.</p>"
      ),
    ],
  },
  {
    name: "Roofing: After contract signed (e-sign)",
    description:
      "When an e-sign contract completes, kick off the job, claim, and materials.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off roofing job from signed contract",
        "Create or update the job, open the claim file if insurance, order materials, and start permit tracking for full replacement or structural repair.",
        0
      ),
    ],
  },
  {
    name: "Roofing: After invoice sent",
    description: "When an invoice is sent, follow AR and claim payments.",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on invoice and claim payment",
        "Watch aging. Track ACV and depreciation on Claims. Flag permit delays, weather holds, pending supplements, or negative reviews.",
        3
      ),
    ],
  },
];

/**
 * Painting & Drywall default automations.
 * Colors, HOA exterior approval, surface prep. Painting workspaces only.
 */
export const PAINTING_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Painting: New lead",
    description:
      "When a new lead is created, capture interior vs exterior and repaint vs new/drywall.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New painting lead: {{lead.title}}",
        "Set lead source: interior repaint, exterior, new construction, or drywall. Capture name, phone, email, address, rooms/sq ft, and notes. Email to book an estimate. Two-way SMS is not live yet.",
        0
      ),
      email(
        "Thanks for contacting {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We received your painting or drywall request. Reply with the address, interior vs exterior, and a couple of times that work for an estimate visit.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Painting: Schedule estimate visit",
    description: "On Site Visit, book the estimate and put it on the calendar.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule paint estimate: {{lead.title}}",
        "Confirm date/time, address, contact, source, rooms/sq ft, interior vs exterior. Add to the calendar with the address. Send confirmation and a reminder. Two-way texting is not live yet.",
        1
      ),
      email(
        "Your painting estimate visit is booked — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We have you down for an on-site estimate. We will come to the address on file. Reply if you need to change the time.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Painting: Photos and estimate",
    description:
      "On Estimate Sent, attach surface photos and send for digital accept.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Upload surface photos: {{lead.title}}",
        "On Estimates, upload surface condition, drywall damage, existing color, and trim/detail shots. Set photo kind to surface, swatch, or prep.",
        0
      ),
      task(
        "Send painting estimate: {{lead.title}}",
        "Price from photos and sq ft. Email the estimate. Track sent / viewed / approved / expired. Approval converts to a job.",
        0
      ),
      email(
        "Your painting estimate from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review and reply to approve. We will lock colors and sheen with you before work starts.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Painting: Job, colors, HOA, and prep",
    description:
      "After Contract Signed, assign crew, lock colors, HOA if exterior, and prep.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Create paint job and assign crew: {{lead.title}}",
        "Create the job from the approved estimate. Assign a crew. Check Techs for drywall finishing, spray vs brush/roll, and lead-safe certs on older homes. Set work phase on Jobs (scheduled → prep → priming → painting).",
        1
      ),
      task(
        "Lock colors and sheen: {{lead.title}}",
        "On Colors, log brand, code, sheen, and quantity per room. Capture match notes or swatch. Get client sign-off before paint. Link the supplier order on Materials (paint/primer).",
        1
      ),
      task(
        "HOA exterior color approval: {{lead.title}}",
        "If exterior, add an HOA record on Colors and track submitted / approved / denied. Interior: mark not required. Store the approved scheme in notes.",
        1
      ),
      task(
        "Build surface prep list: {{lead.title}}",
        "On Prep, add patching, sanding, caulking, priming, taping, mudding, and texture match. Mark billed separately when prep is its own line. Upload before/after as prep photos on the estimate.",
        1
      ),
      email(
        "You are on the painting schedule — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Thanks for approving. Please confirm color and sheen so we can order paint. If the HOA must approve an exterior color, we will keep you posted.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Painting: Weather, stock, and receipts",
    description: "When In Progress, check weather for exterior, stock, and receipts.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Weather, inventory, and receipts: {{lead.title}}",
        "Ask Luna for weather before exterior dispatch (rain, temperature, humidity). Toggle weather hold on Jobs. Confirm sprayers, ladders, scaffolding, paint, primer, drywall, and compound in Inventory. Photo receipts on Books. OCR is not auto-filled. GPS auto-route is not live.",
        0
      ),
      email(
        "Crew update from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Prep is lining up and painting follows once surfaces are ready. We will reschedule exterior work if weather is unsafe. Reply to this email with questions.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Painting: Punch list",
    description: "On Punch List, walk leftover items and confirm colors on file.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Punch list and color history: {{lead.title}}",
        "Walk leftover items, get sign-off, and confirm Colors are signed off. Save color/paint history on the contact for the next repaint. Watch HOA delays on Field ops.",
        1
      ),
    ],
  },
  {
    name: "Painting: Invoice, books, and reviews",
    description: "When Closed, invoice prep + paint and close books.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Invoice painting job: {{lead.title}}",
        "Invoice labor + materials, including separately billed prep. Check AR aging and reminders. Review job profit on Field ops.",
        1
      ),
      task(
        "Books, tax set-aside, and history: {{lead.title}}",
        "Log supplier bills in Books. Field ops shows income vs expenses and a 30% tax set-aside hint. Keep color history on the contact. Flag negative reviews.",
        1
      ),
      email(
        "Thanks — invoice from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>The painting or drywall work is complete. Your invoice is coming next. We saved your colors for next time.</p>"
      ),
    ],
  },
  {
    name: "Painting: After contract signed (e-sign)",
    description: "When an e-sign contract completes, kick off colors and prep.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off painting job from signed contract",
        "Create or update the job, lock colors, start HOA if exterior, and build the prep list.",
        0
      ),
    ],
  },
  {
    name: "Painting: After invoice sent",
    description: "When an invoice is sent, follow AR.",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on invoice payment",
        "Watch aging. Flag weather holds, HOA pending, leftover prep, or negative reviews.",
        3
      ),
    ],
  },
];

/**
 * Pest Control default automations.
 * Recurring plans, chemical logs, access notes. Pest workspaces only.
 */
export const PEST_CONTROL_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Pest: New lead",
    description:
      "When a new lead is created, capture one-time vs recurring and pest type.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New pest lead: {{lead.title}}",
        "Set lead source: one-time treatment vs recurring plan, and pest type. Capture name, phone, email, address, property size, and notes. Email to book a visit. Two-way SMS is not live yet.",
        0
      ),
      email(
        "Thanks for contacting {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We received your pest control request. Reply with the address, pest type if you know it, and a couple of times that work for an inspection.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Pest: Schedule visit",
    description: "On Site Visit, book the inspection and put it on the calendar.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule pest visit: {{lead.title}}",
        "Confirm date/time, address, contact, source, pest type, and property size. Add to the calendar with the address for routing. Send confirmation and a reminder. Two-way texting is not live yet.",
        1
      ),
      email(
        "Your pest inspection is booked — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We have you down for an on-site inspection. Please keep pets and kids clear of the areas we will check. Reply if you need to change the time.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Pest: Photos and estimate",
    description:
      "On Estimate Sent, attach inspection photos and send one-time or plan pricing.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Upload inspection photos: {{lead.title}}",
        "On Estimates, upload infestation evidence, entry points, damage, and problem areas (photo kind infestation or entry point).",
        0
      ),
      task(
        "Send pest estimate: {{lead.title}}",
        "Price one-time treatment and/or a recurring plan. Email the estimate. Track sent / viewed / approved / expired. Approval converts to a job. Recurring plans are set on Recurring plans.",
        0
      ),
      email(
        "Your pest control estimate from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready, including one-time and recurring options if they apply. Please review and reply to approve.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Pest: Job, plan, access, and licenses",
    description:
      "After Contract Signed, assign a licensed tech, set the plan, and capture access/safety.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Create visit and assign tech: {{lead.title}}",
        "Create the job from the approved estimate. Assign a tech. Confirm pesticide applicator license and renewal date on Techs. Set route order on Jobs. GPS auto-optimize is not live — order stops by drive time.",
        1
      ),
      task(
        "Set recurring service plan: {{lead.title}}",
        "If this is ongoing service, open Recurring plans. Set monthly, quarterly, or seasonal (mosquito/termite/rodent). Use skip-until for vacation holds. Turn seasonal off in the off-season.",
        1
      ),
      task(
        "Access and safety notes: {{lead.title}}",
        "On Access, log entry method, pets, kids, aquariums, gardens, and allergy notes. Gate/lockbox codes stay on Access — do not paste them into Luna chat.",
        1
      ),
      email(
        "You are on the pest control schedule — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Thanks for approving. We will confirm the visit window and any prep (pets inside, kids away from treated areas). If this is a recurring plan, visits will follow the schedule we set.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Pest: Treatment log, stock, and mileage",
    description:
      "When In Progress, log chemicals, route miles, and receipts.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Log treatment and guarantee: {{lead.title}}",
        "On Treatments, log product, EPA number, method, quantity, target pest, and area. Set guarantee days for free re-treatment. Check chemical/bait/trap stock in Inventory. Log mileage for the tax deduction. OCR is not auto-filled. GPS auto-track is not live.",
        0
      ),
      email(
        "Tech update from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We are on the way or on site for your treatment. Please keep pets and children away from treated areas until we say it is safe. Reply to this email with questions.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Pest: Punch list and callbacks",
    description: "On Punch List, note leftover entry points and callbacks.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Follow-up and re-treatment window: {{lead.title}}",
        "Note leftover entry points on the contact. If pests return inside the guarantee, mark the treatment re-treatment due on Treatments. Watch license renewals on Field ops.",
        1
      ),
    ],
  },
  {
    name: "Pest: Invoice, books, and reviews",
    description: "When Closed, invoice the visit or plan and close books.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Invoice visit or recurring cycle: {{lead.title}}",
        "Invoice the job or let Recurring plans auto-draft. Check AR aging and reminders. Review route profit and recurring revenue on Field ops.",
        1
      ),
      task(
        "Books, tax set-aside, and history: {{lead.title}}",
        "Log chemical supplier bills in Books. Field ops shows income vs expenses, mileage, and a 30% tax set-aside hint. Save pest/treatment history on the contact. Flag negative reviews.",
        1
      ),
      email(
        "Thanks — invoice from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>The visit is complete. Your invoice is coming next. If pests return inside the guarantee window, reply and we will schedule a re-treatment.</p>"
      ),
    ],
  },
  {
    name: "Pest: After contract signed (e-sign)",
    description: "When an e-sign contract completes, kick off the visit and plan.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off pest job from signed contract",
        "Create or update the job, set a recurring plan if ongoing, and capture access/safety notes (no codes in chat).",
        0
      ),
    ],
  },
  {
    name: "Pest: After invoice sent",
    description: "When an invoice is sent, follow AR.",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on invoice payment",
        "Watch aging. Flag re-treatment requests, license renewals, or negative reviews.",
        3
      ),
    ],
  },
];

/**
 * Inspection Services default automations.
 * Findings, reports, add-ons. Inspection workspaces only.
 */
export const INSPECTION_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Inspection: New lead",
    description:
      "When a new lead is created, capture buyer vs seller vs realtor vs investor.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New inspection lead: {{lead.title}}",
        "Set lead source: buyer, seller/pre-listing, realtor referral, or investor. Capture buyer, listing agent, and seller agent names/phones, address, property type/size, and closing date if known. Email to book. Two-way SMS is not live yet.",
        0
      ),
      email(
        "Thanks for contacting {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We received your inspection request. Reply with the property address, a few times that work, and the closing date if you have it. Turnaround is often tight near closing.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Inspection: Schedule visit",
    description:
      "On Site Visit, book the inspection on the calendar with the address.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule inspection: {{lead.title}}",
        "Confirm date/time, address, buyer + agents, source, property type/size, closing date. Add to the calendar with the address. Send confirmation and a reminder. Mark urgent on Jobs if same-day or closing is close. Two-way texting is not live. GPS auto-route is not live.",
        0
      ),
      email(
        "Your inspection is booked — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We have you on the calendar. Reply to this email if the time or access changes. We will confirm again before we arrive.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Inspection: Agreement and fee",
    description: "On Estimate Sent, send the inspection agreement and fee.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Send inspection agreement: {{lead.title}}",
        "Email the estimate/agreement. Many inspectors collect payment at scheduling or before the report is released. Track sent / viewed / approved. Add-ons (radon, mold, WDO, sewer, pool) go on Add-ons.",
        0
      ),
      email(
        "Your inspection agreement from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your inspection agreement is ready. Please review and reply to approve. We can add radon, mold, WDO, sewer, or pool if you need them.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Inspection: Assign inspector and add-ons",
    description:
      "After Contract Signed, assign a licensed inspector and log specialty add-ons.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Assign inspector and check license: {{lead.title}}",
        "Create the job. Assign an inspector. Confirm state license, E&O, and CE dates on Techs. Set inspection phase scheduled. Set closing date and rush if needed. Do not paste license numbers into Luna chat.",
        0
      ),
      task(
        "Log specialty add-ons: {{lead.title}}",
        "On Add-ons, log radon, mold, termite/WDO, sewer scope, or pool if ordered. Coordinate the specialist. Separate results stay on the same job.",
        1
      ),
      email(
        "You are on the inspection schedule — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Thanks for approving. We will confirm the visit window and any add-on specialists. Payment is often due before the report is released.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Inspection: On-site findings",
    description:
      "When In Progress, run the system checklist and capture photos.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Log room and system findings: {{lead.title}}",
        "On Findings, log roof, HVAC, electrical, plumbing, foundation, and appliances with severity (safety, major, minor, cosmetic). Type notes — voice-to-text is not live. Moisture/thermal fields are on the finding. Upload photos on Estimates (kind finding, thermal, or moisture). Check meter calibration on Inventory. Log mileage. OCR is not auto-filled. GPS auto-track is not live.",
        0
      ),
    ],
  },
  {
    name: "Inspection: Report pending",
    description:
      "On Punch List, assemble the report and notify client and agent.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Build and send inspection report: {{lead.title}}",
        "On Reports, build the summary from findings, set due date (often the closing window), mark ready, and email the share link. Track viewed/downloaded. Offer a phone/video walkthrough. Confirm payment before release if that is your policy. Set job phase report pending then delivered.",
        0
      ),
      email(
        "Your inspection report is ready — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your report is ready to review. We will send the share link next. You can print it to PDF. Reply if you want a walkthrough of the findings.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Inspection: Invoice, books, and reviews",
    description: "When Closed, confirm payment, books, and a review request.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Invoice and books: {{lead.title}}",
        "Confirm same-day or completion invoice is paid. Check AR aging. Log specialist bills in Books. Mileage is on Mileage. Field ops shows profit and a 30% tax set-aside hint. Save property history on the contact for re-inspections. Flag negative reviews.",
        1
      ),
    ],
  },
  {
    name: "Inspection: After contract signed (e-sign)",
    description: "When an e-sign agreement completes, assign the inspector.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off inspection from signed agreement",
        "Create or update the job, assign an inspector, log add-ons, and put the visit on the calendar.",
        0
      ),
    ],
  },
  {
    name: "Inspection: After invoice sent",
    description:
      "When an invoice is sent, follow AR — often before report release.",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on inspection payment",
        "Watch aging. Many offices hold the report until paid. Flag reports past due, license/E&O/CE renewals, or negative reviews.",
        2
      ),
    ],
  },
];

/**
 * Rental Company default automations.
 * Fleet, reservations, check-out/in. Rental workspaces only.
 */
export const RENTAL_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Rental: New inquiry",
    description:
      "When a new inquiry is created, capture walk-in vs phone vs online vs contractor.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New rental inquiry: {{lead.title}}",
        "Set lead source: walk-in, phone, online booking, or contractor account. Capture name, phone, email, needed dates, pickup vs delivery, and job site if delivered. Email to confirm. Two-way SMS is not live yet.",
        0
      ),
      email(
        "Thanks for contacting {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We received your rental request. Reply with the dates you need, pickup or delivery, and the equipment type if you know it.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Rental: Availability and hold",
    description: "On Site Visit, check fleet availability and place a hold.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Check availability and hold: {{lead.title}}",
        "On Fleet, confirm the item is available for those dates. On Rentals, create a hold with pickup vs delivery and job site. Record deposit amount — do not take card numbers in Luna. GPS auto-track is not live. Two-way texting is not live.",
        0
      ),
    ],
  },
  {
    name: "Rental: Quote and waiver",
    description: "On Estimate Sent, send rates, add-ons, and damage waiver.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Send rental quote: {{lead.title}}",
        "Build the estimate from hourly/daily/weekly rates plus attachments. Include damage waiver. Email it. Approval converts to a job and a reserved rental on Rentals.",
        0
      ),
      email(
        "Your rental quote from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your rental quote is ready. Please review rates, add-ons, and the damage waiver, then reply to approve.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Rental: Confirm reservation and delivery",
    description:
      "After Contract Signed, confirm the reservation and schedule delivery if needed.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Confirm reservation and logistics: {{lead.title}}",
        "Mark the rental reserved. If delivery, assign a driver on Techs (CDL if required) and set route order. Send confirmation and a reminder before pickup/delivery. GPS auto-route is not live.",
        0
      ),
      email(
        "Your rental is reserved — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your reservation is confirmed. We will remind you before pickup or delivery. Reply if dates change.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Rental: Check-out",
    description:
      "When In Progress, document condition and check the unit out.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Check out equipment: {{lead.title}}",
        "On Rentals, log check-out photos/notes and fuel if it uses gas. Verify ID and signed contract in person — do not store ID or card numbers in Luna. Record the deposit amount only. Set the asset out. OCR is not auto-filled.",
        0
      ),
    ],
  },
  {
    name: "Rental: Check-in and damage",
    description:
      "On Punch List, check the unit in, compare condition, and apply late or damage charges.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Check in and inspect: {{lead.title}}",
        "On Rentals, log check-in photos and fuel. Compare to check-out notes. Late fees calculate from the due date vs return. Add damage charges if needed. Return the asset to the yard or send it to Maintenance.",
        0
      ),
    ],
  },
  {
    name: "Rental: Invoice, books, and utilization",
    description:
      "When Closed, invoice the rental period plus fees and review utilization.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Invoice rental and books: {{lead.title}}",
        "Invoice base rate + extensions + late fees + damage. Contractor net terms stay on the rental notes. Check AR. Log parts/fuel in Books. Field ops shows overdue returns, maintenance due, and utilization on Fleet. Flag negative reviews.",
        1
      ),
    ],
  },
  {
    name: "Rental: After contract signed (e-sign)",
    description: "When an e-sign rental agreement completes, confirm the hold.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Confirm rental from signed agreement",
        "Create or update the reservation, assign delivery if needed, and send pickup/delivery confirmation.",
        0
      ),
    ],
  },
  {
    name: "Rental: After invoice sent",
    description: "When an invoice is sent, follow AR.",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on rental invoice",
        "Watch aging. Flag overdue returns, maintenance due, or negative reviews.",
        3
      ),
    ],
  },
];

/**
 * General Contractors & Construction default automations.
 * Change orders, subs, phases, draws. contractors_construction only.
 */
export const CONSTRUCTION_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Build: New lead",
    description:
      "When a new lead is created, capture referral vs bid invite vs repeat vs project type.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New construction lead: {{lead.title}}",
        "Set lead source: referral, bid invite, repeat client, remodel, addition, or new build. Capture name, phone, email, address, scope, and budget range. Email to book a site visit. Two-way SMS is not live yet.",
        0
      ),
      email(
        "Thanks for contacting {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We received your project inquiry. Reply with the address, a few visit times, and a short scope or budget range.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Build: Schedule site visit",
    description:
      "On Site Visit, book the consultation on the calendar with the address.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule site visit: {{lead.title}}",
        "Confirm date/time, address, source, scope, budget range. Add to the calendar with the address. Send confirmation and a reminder. Two-way texting is not live. GPS auto-route is not live.",
        0
      ),
      email(
        "Your site visit is booked — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We have you on the calendar for a site visit. Reply to this email if the time or address changes.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Build: Bid and estimate",
    description:
      "On Estimate Sent, send a line-item bid (labor, materials, subs, margin).",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Send bid: {{lead.title}}",
        "On Estimates, build labor/materials/subs line items and margin. Upload existing-condition photos (kind existing or measurement). Email the bid. Approval creates the job.",
        0
      ),
      email(
        "Your bid from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your bid is ready. Please review the line items and reply to approve. We will send a contract next.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Build: Contract, permits, and phases",
    description:
      "After Contract Signed, e-sign the contract, log permits, and set the phase schedule.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Contract and kickoff: {{lead.title}}",
        "Send the e-sign contract (scope, payment schedule, timeline). On Permits, log building/electrical/plumbing/mechanical as needed. On Phases, set demo through finish. On Draws, log the deposit. Check sub COIs on Subs. Do not paste license numbers into Luna.",
        0
      ),
    ],
  },
  {
    name: "Build: Active job",
    description:
      "When In Progress, run daily logs, subs, materials, and change orders.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Run the job: {{lead.title}}",
        "On Daily logs, record weather, crew, work completed, and safety. Upload progress and before-covering photos on Estimates. Assign subs per phase. Order materials by phase. Change orders must be approved before extra work. OCR is not auto-filled. GPS auto-track is not live.",
        0
      ),
    ],
  },
  {
    name: "Build: Punch and inspections",
    description:
      "On Punch List, finish inspections and punch/warranty items.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Punch list and final inspections: {{lead.title}}",
        "On Permits, confirm inspections passed. Walk punch items on the job. Keep warranty notes on the contact. Collect remaining lien waivers on Draws.",
        0
      ),
    ],
  },
  {
    name: "Build: Final draw, books, and margin",
    description: "When Closed, collect retainage, books, and project margin.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Close-out draw and books: {{lead.title}}",
        "Invoice retainage. Confirm lien waivers. Pay sub bills in Books. Compare budget vs actual and approved change-order impact on Field ops. Flag negative reviews.",
        1
      ),
    ],
  },
  {
    name: "Build: After contract signed (e-sign)",
    description:
      "When an e-sign contract completes, kick off permits and phases.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off job from signed contract",
        "Create or update the job, log permits, set phases, assign crew/subs, and send the deposit draw.",
        0
      ),
    ],
  },
  {
    name: "Build: After invoice sent",
    description:
      "When an invoice or draw is sent, follow AR and lien waivers.",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on draw / invoice",
        "Watch aging. Confirm lien waiver status on Draws. Flag delayed permits, expired sub COIs, or jobs behind schedule.",
        3
      ),
    ],
  },
];

export const WOODWORKING_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Shop: New lead",
    description:
      "When a new lead is created, capture furniture vs built-in vs millwork source.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New shop lead: {{lead.title}}",
        "Set lead source: custom furniture, built-ins, cabinetry, trim/millwork, referral, or portfolio. Capture name, phone, email, address, piece vs built-in vs install, and notes. Email to book a consult. Two-way SMS is not live yet.",
        0
      ),
      email(
        "Thanks for contacting {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We received your inquiry. Reply with a couple of consult times, the address, and whether this is a furniture piece, built-in, cabinetry, or millwork.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Shop: Schedule consult",
    description:
      "On Site Visit, book the consult on the calendar with the address.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule consult / site visit: {{lead.title}}",
        "Confirm date/time, address, source, project type, space dimensions. Add to the calendar with the address. Capture site and inspiration photos (kinds inspiration or measurement). Send confirmation and a reminder. Two-way texting is not live. GPS auto-route is not live.",
        0
      ),
      email(
        "Your consult is booked — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We have you on the calendar for a consult. Reply to this email if the time or address changes. Bring inspiration photos if you have them.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Shop: Quote after design",
    description:
      "On Estimate Sent, quote from approved design, selections, and labor.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Send shop quote: {{lead.title}}",
        "Confirm design approved and wood/finish/hardware signed off. On Estimates, build the quote from design + materials + labor. Email it. Track sent / viewed / approved / expired. Approval creates the job. Two-way SMS is not live.",
        0
      ),
      email(
        "Your quote from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your quote is ready based on the approved drawings and material selections. Please review and reply to approve.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Shop: Materials and queue",
    description:
      "After Contract Signed, order lumber/hardware and put the piece on the shop queue.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Order materials and queue the shop: {{lead.title}}",
        "On Materials, order lumber and hardware (types lumber, hardware, stain) and track lead time. On Shop, add the piece (stage design approved then material in). Invoice the deposit. Check low stock on Inventory. OCR is not auto-filled.",
        0
      ),
    ],
  },
  {
    name: "Shop: Fabrication",
    description:
      "When In Progress, run cut/mill/assembly/sanding/finishing and progress photos.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Run the shop: {{lead.title}}",
        "On Shop, move stages (in fabrication → finishing → ready). Assign craftsman. Upload shop, joinery, and progress photos on Estimates. QC fit and dimensions before finishing. Email “your piece is in the shop.” GPS auto-track is not live.",
        0
      ),
    ],
  },
  {
    name: "Shop: Delivery and install",
    description:
      "On Punch List, schedule delivery or install and walk punch items.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Deliver or install: {{lead.title}}",
        "On Shop, set install/pickup date, crew, and site prep (access, stairs, tight spaces). Upload final photos. Walk punch items. Email ready for delivery. Two-way SMS is not live.",
        0
      ),
      email(
        "Ready for delivery — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your piece is ready. We will confirm delivery or pickup next. Reply if access or stairs need extra planning.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Shop: Invoice and books",
    description:
      "When Closed, invoice remaining milestones and check shop margin.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Completion invoice and books: {{lead.title}}",
        "Invoice remaining (material and completion). Check AR aging. Log lumber/hardware receipts in Books. Compare materials + shop labor + install vs price on Field ops. Flag negative reviews. OCR is not auto-filled.",
        1
      ),
    ],
  },
  {
    name: "Shop: After contract signed (e-sign)",
    description:
      "When an e-sign contract completes, order materials and queue the shop.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off shop from signed contract",
        "Create or update the job, order lumber/hardware, add the shop queue row, and send the deposit invoice.",
        0
      ),
    ],
  },
  {
    name: "Shop: After invoice sent",
    description:
      "When an invoice is sent, follow AR (deposit, material, completion).",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on shop invoice",
        "Watch aging. Send a reminder if overdue. Flag delayed material, pending design approvals, or jobs behind on the shop queue.",
        3
      ),
    ],
  },
];

export const STEELWORKING_DEFAULT_WORKFLOWS: IndustryWorkflowDef[] = [
  {
    name: "Steel: New lead",
    description:
      "When a new lead is created, capture structural vs ornamental vs fab source.",
    trigger_type: "lead_stage_change",
    toStageName: "Lead",
    actions: [
      task(
        "New steel lead: {{lead.title}}",
        "Set lead source: structural steel, ornamental/railings, custom fab, industrial equipment, referral, or bid invite. Capture name, phone, email, address, project type, and load requirements if structural. Email to book a consult. Two-way SMS is not live yet.",
        0
      ),
      email(
        "Thanks for contacting {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We received your fabrication inquiry. Reply with a couple of visit times, the address, and whether this is structural, ornamental, custom fab, or equipment.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Steel: Schedule consult",
    description:
      "On Site Visit, book the consult on the calendar with the address.",
    trigger_type: "lead_stage_change",
    toStageName: "Site Visit",
    actions: [
      task(
        "Schedule consult / site visit: {{lead.title}}",
        "Confirm date/time, address, source, project type, load notes. Add to the calendar with the address. Capture existing-structure and measurement photos. Send confirmation and a reminder. Two-way texting is not live. GPS auto-route is not live.",
        0
      ),
      email(
        "Your site visit is booked — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>We have you on the calendar for a site visit. Reply if the time or address changes.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Steel: Quote after drawings",
    description:
      "On Estimate Sent, quote from drawings, specs, labor, and engineering fees. Lock quote validity.",
    trigger_type: "lead_stage_change",
    toStageName: "Estimate Sent",
    actions: [
      task(
        "Send steel quote: {{lead.title}}",
        "Confirm drawings approved and PE stamped if load-bearing. Specs signed off with quote-valid date (steel pricing is volatile). On Estimates, include drawings + materials + labor + engineering. Email it. Approval creates the job. Two-way SMS is not live.",
        0
      ),
      email(
        "Your fabrication quote from {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your quote is ready based on the shop drawings and material specs. Please review and reply to approve. Pricing is valid through the date on the quote.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Steel: Materials, permits, and queue",
    description:
      "After Contract Signed, order mill steel, log permits, and queue fab.",
    trigger_type: "lead_stage_change",
    toStageName: "Contract Signed",
    actions: [
      task(
        "Order steel, log permits, queue fab: {{lead.title}}",
        "On Materials, order steel/aluminum/stainless/hardware/gas and track mill lead time. On Permits, log structural or weld inspection if required. On Fab, add the piece. Invoice the deposit. Check low stock on Inventory. OCR is not auto-filled.",
        0
      ),
    ],
  },
  {
    name: "Steel: Fabrication and weld logs",
    description:
      "When In Progress, run cut/weld/assembly/finish and weld/NDT documentation.",
    trigger_type: "lead_stage_change",
    toStageName: "In Progress",
    actions: [
      task(
        "Run the fab shop: {{lead.title}}",
        "On Fab, move stages. Assign welder/fabricator. On Welds, log weld type, joint, inspection, and NDT. Upload mill, weld, and progress photos on Estimates. Check welder certs on Techs. GPS auto-track is not live.",
        0
      ),
    ],
  },
  {
    name: "Steel: Delivery and erection",
    description:
      "On Punch List, schedule delivery/erection and walk punch items.",
    trigger_type: "lead_stage_change",
    toStageName: "Punch List",
    actions: [
      task(
        "Deliver or erect: {{lead.title}}",
        "On Fab, set install date, crew, and site prep (access, power, crane/rigging). Confirm weld inspections passed on Permits. Upload erection/final photos. Walk punch items. Two-way SMS is not live.",
        0
      ),
      email(
        "Ready for install — {{workspace.name}}",
        "<p>Hi {{contact.first_name}},</p><p>Your steel is ready. We will confirm delivery or erection next. Reply if crane access or power needs extra planning.</p><p>{{workspace.name}}</p>"
      ),
    ],
  },
  {
    name: "Steel: Invoice and books",
    description:
      "When Closed, invoice remaining milestones and check fab margin vs steel cost.",
    trigger_type: "lead_stage_change",
    toStageName: "Closed",
    actions: [
      task(
        "Completion invoice and books: {{lead.title}}",
        "Invoice remaining (material, fab complete, install/final). Check AR aging. Log mill and gas receipts in Books. Compare materials + shop labor + install vs price on Field ops. Flag negative reviews. OCR is not auto-filled.",
        1
      ),
    ],
  },
  {
    name: "Steel: After contract signed (e-sign)",
    description:
      "When an e-sign contract completes, order mill steel and queue fab.",
    trigger_type: "contract_signed",
    actions: [
      task(
        "Kick off fab from signed contract",
        "Create or update the job, log permits, order steel, add the fab queue row, and send the deposit invoice.",
        0
      ),
    ],
  },
  {
    name: "Steel: After invoice sent",
    description:
      "When an invoice is sent, follow AR (deposit, material, fab, install).",
    trigger_type: "invoice_sent",
    actions: [
      task(
        "Follow up on steel invoice",
        "Watch aging. Send a reminder if overdue. Flag delayed mill delivery, pending PE stamps, failed weld inspections, or jobs behind on Fab.",
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
  roofing_exterior_repair: ROOFING_DEFAULT_WORKFLOWS,
  painting_drywall: PAINTING_DEFAULT_WORKFLOWS,
  pest_control: PEST_CONTROL_DEFAULT_WORKFLOWS,
  inspection_service: INSPECTION_DEFAULT_WORKFLOWS,
  rental_company: RENTAL_DEFAULT_WORKFLOWS,
  contractors_construction: CONSTRUCTION_DEFAULT_WORKFLOWS,
  woodworking_custom_carpentry: WOODWORKING_DEFAULT_WORKFLOWS,
  steelworking_metal_fabrication: STEELWORKING_DEFAULT_WORKFLOWS,
};

async function pruneForeignIndustryWorkflows(
  supabase: SupabaseClient,
  workspaceId: string,
  preset: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("automation_workflows")
    .select("id, name")
    .eq("workspace_id", workspaceId);
  const prefixes = allWorkflowPrefixes();
  const keepSharedPermits = fieldPresetUsesSharedPermits(preset);
  const ids = (existing ?? [])
    .filter((w: { id: string; name: string }) => {
      const name = w.name ?? "";
      for (const pack of prefixes) {
        if (name.startsWith(pack.prefix) && preset !== pack.preset) return true;
      }
      if (
        preset === "roofing_exterior_repair" &&
        name.startsWith("Roofing & Exterior Repair:")
      ) {
        return true;
      }
      if (
        preset === "painting_drywall" &&
        name.startsWith("Painting & Drywall:")
      ) {
        return true;
      }
      if (
        preset === "pest_control" &&
        name.startsWith("Pest Control:")
      ) {
        return true;
      }
      if (
        preset === "inspection_service" &&
        name.startsWith("Inspection Services:")
      ) {
        return true;
      }
      if (
        preset === "rental_company" &&
        name.startsWith("Rental Company:")
      ) {
        return true;
      }
      if (
        preset === "contractors_construction" &&
        (name.startsWith("Contractors & Construction:") ||
          name.startsWith("General Contractor:") ||
          name.startsWith("General Contractors & Construction:"))
      ) {
        return true;
      }
      if (
        preset !== "contractors_construction" &&
        (name.startsWith("General Contractor:") ||
          name.startsWith("Contractors & Construction:") ||
          name.startsWith("General Contractors & Construction:"))
      ) {
        return true;
      }
      if (
        preset === "woodworking_custom_carpentry" &&
        name.startsWith("Woodworking & Custom Carpentry:")
      ) {
        return true;
      }
      if (
        preset === "steelworking_metal_fabrication" &&
        name.startsWith("Steelworking & Metal Fabrication:")
      ) {
        return true;
      }
      if (name.startsWith("Field:") && !keepSharedPermits) return true;
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
  const preset =
    resolveIndustryPreset(workspace?.industry_preset) ??
    workspace?.industry_preset ??
    "";
  await pruneForeignIndustryWorkflows(supabase, workspaceId, preset);
  const trade = PACKS[preset] ?? catalogWorkflowsForPreset(preset);
  const pack = fieldPresetUsesSharedPermits(preset)
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
