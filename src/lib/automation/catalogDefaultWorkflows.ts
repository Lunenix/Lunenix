import type { AutomationAction, AutomationTriggerType } from "@/types/database";
import {
  CUSTOM_INDUSTRY_PRESET,
  INDUSTRY_PRESETS,
  industrySectorId,
  resolveIndustryPreset,
} from "@/lib/industryVerticals";

export type CatalogWorkflowDef = {
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

/** Unique workflow name prefix per vertical so packs never merge. */
export function workflowNamePrefix(preset: string): string {
  const resolved = resolveIndustryPreset(preset) ?? preset;
  if (resolved === "hvac") return "HVAC:";
  if (resolved === "electrician") return "Electrical:";
  if (resolved === "landscaping_lawn_care") return "Landscaping:";
  if (resolved === "roofing_exterior_repair") return "Roofing:";
  if (resolved === "painting_drywall") return "Painting:";
  if (resolved === "pest_control") return "Pest:";
  if (resolved === CUSTOM_INDUSTRY_PRESET) return "Other:";
  const label =
    INDUSTRY_PRESETS.find((p) => p.value === resolved)?.label ?? resolved;
  const short = label.replace(/\s*\([^)]*\)\s*/g, "").trim();
  return `${short}:`;
}

export function allWorkflowPrefixes(): { preset: string; prefix: string }[] {
  const seen = new Set<string>();
  const rows: { preset: string; prefix: string }[] = [];
  for (const p of INDUSTRY_PRESETS) {
    const prefix = workflowNamePrefix(p.value);
    if (seen.has(p.value)) continue;
    seen.add(p.value);
    rows.push({ preset: p.value, prefix });
  }
  return rows;
}

function named(
  prefix: string,
  rest: string
): string {
  return `${prefix} ${rest}`.replace(":  ", ": ");
}

function fieldPack(prefix: string, label: string): CatalogWorkflowDef[] {
  return [
    {
      name: named(prefix, "New lead"),
      description: `When a new ${label} lead is created, capture source and reach out.`,
      trigger_type: "lead_stage_change",
      toStageName: "Lead",
      actions: [
        task(
          `Qualify ${label} lead: {{lead.title}}`,
          "Track lead source. Capture name, phone, email, address, and job type/notes. Email to book a visit. Two-way SMS is not live yet — use email and the contact record.",
          0
        ),
        email(
          "Thanks for contacting {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We received your request. Reply with a couple of times that work and confirm the address if we do not have it yet.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Schedule visit"),
      description: "On Site Visit, book the estimate and put it on the calendar.",
      trigger_type: "lead_stage_change",
      toStageName: "Site Visit",
      actions: [
        task(
          "Schedule estimate visit: {{lead.title}}",
          "Confirm date/time, address, and contact. Add it to the calendar with the address for routing. Send confirmation and a reminder. Two-way texting is not live yet.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Send estimate"),
      description: "On Estimate Sent, attach photos and send for digital accept.",
      trigger_type: "lead_stage_change",
      toStageName: "Estimate Sent",
      actions: [
        task(
          "Send estimate: {{lead.title}}",
          "Attach site photos on the estimate. Email it. Track sent / viewed / approved / expired. On approval, convert to a job.",
          0
        ),
        email(
          `Your ${label} estimate from {{workspace.name}}`,
          "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review and reply to approve, or tell us what to adjust.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Job after contract"),
      description: "After Contract Signed, open the job and assign a tech.",
      trigger_type: "lead_stage_change",
      toStageName: "Contract Signed",
      actions: [
        task(
          "Create job and assign tech: {{lead.title}}",
          "Turn this deal into a job, assign a tech, set route order if needed, and start permit tracking when the work requires it.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Job in progress"),
      description: "On In Progress, log parts, mileage, and receipts.",
      trigger_type: "lead_stage_change",
      toStageName: "In Progress",
      actions: [
        task(
          "Log parts, mileage, and receipts: {{lead.title}}",
          "Record materials, trip miles, and vendor receipts. OCR is not auto-filled — enter amounts from photos. GPS auto-route is not live.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Punch list"),
      description: "On Punch List, walk leftover items and get sign-off.",
      trigger_type: "lead_stage_change",
      toStageName: "Punch List",
      actions: [
        task(
          "Punch list walk-through: {{lead.title}}",
          "Finish leftover items, get customer sign-off, and note property details on the contact.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Close and invoice"),
      description: "When Closed, invoice, books, and a review request.",
      trigger_type: "lead_stage_change",
      toStageName: "Closed",
      actions: [
        task(
          "Invoice and books: {{lead.title}}",
          "Send the invoice, check AR aging, log expenses in Books, and ask for a review if the job went well.",
          1
        ),
        email(
          "Thank you — invoice from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>The work is complete. We are sending your invoice next. Thank you for choosing {{workspace.name}}.</p>"
        ),
      ],
    },
    {
      name: named(prefix, "After contract signed (e-sign)"),
      description: "When an e-sign contract completes, kick off the job.",
      trigger_type: "contract_signed",
      actions: [
        task(
          `Kick off ${label} job from signed contract`,
          "Create or update the job, assign a tech, and move the pipeline card to Contract Signed if needed.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "After invoice sent"),
      description: "When an invoice is sent, follow AR.",
      trigger_type: "invoice_sent",
      actions: [
        task(
          "Follow up on invoice payment",
          "Watch aging. Send a reminder if overdue. Record payment.",
          3
        ),
      ],
    },
  ];
}

function creativePack(prefix: string, label: string): CatalogWorkflowDef[] {
  return [
    {
      name: named(prefix, "Discovery"),
      description: "When a deal lands in Discovery, qualify and capture source.",
      trigger_type: "lead_stage_change",
      toStageName: "Discovery",
      actions: [
        task(
          `Qualify ${label} lead: {{lead.title}}`,
          "Track lead source. Confirm scope, budget range, and timeline. Log notes on the contact.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Proposal"),
      description: "On Proposal, send the proposal and follow up.",
      trigger_type: "lead_stage_change",
      toStageName: "Proposal",
      actions: [
        task(
          "Send proposal: {{lead.title}}",
          "Send the written proposal. Ask for questions and a decision date.",
          1
        ),
        email(
          "Your proposal from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your proposal is ready. Please review it and reply with any questions.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Onboarding"),
      description: "On Onboarding, kick off and collect assets.",
      trigger_type: "lead_stage_change",
      toStageName: "Onboarding",
      actions: [
        task(
          "Kickoff and collect assets: {{lead.title}}",
          "Send a kickoff note, collect files/access, and put milestones on the calendar.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "In production"),
      description: "On In Production, deliver work against the timeline.",
      trigger_type: "lead_stage_change",
      toStageName: "In Production",
      actions: [
        task(
          "Produce deliverables: {{lead.title}}",
          "Work the scope, log time/notes, and flag blockers before review.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Review"),
      description: "On Review, collect client feedback.",
      trigger_type: "lead_stage_change",
      toStageName: "Review",
      actions: [
        task(
          "Collect review feedback: {{lead.title}}",
          "Send the draft for review. Log revision rounds on the contact.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Final delivery"),
      description: "On Final Delivery, hand off files and invoice.",
      trigger_type: "lead_stage_change",
      toStageName: "Final Delivery",
      actions: [
        task(
          "Deliver and invoice: {{lead.title}}",
          "Hand off final files, send the invoice, and confirm payment terms.",
          1
        ),
        email(
          "Final delivery from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your work is ready. Invoice details are coming next. Thank you.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Archived"),
      description: "When Archived, request a review and close the file.",
      trigger_type: "lead_stage_change",
      toStageName: "Archived",
      actions: [
        task(
          "Request review and archive: {{lead.title}}",
          "Ask for a review if the engagement went well. Archive files and notes on the contact.",
          3
        ),
      ],
    },
    {
      name: named(prefix, "After contract signed (e-sign)"),
      description: "When an e-sign contract completes, start onboarding.",
      trigger_type: "contract_signed",
      actions: [
        task(
          `Start ${label} onboarding from signed contract`,
          "Move the pipeline card to Onboarding if needed and collect kickoff assets.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "After invoice sent"),
      description: "When an invoice is sent, follow AR.",
      trigger_type: "invoice_sent",
      actions: [
        task(
          "Follow up on invoice payment",
          "Watch aging. Send a reminder if overdue. Record payment.",
          3
        ),
      ],
    },
  ];
}

function eventPack(prefix: string, label: string): CatalogWorkflowDef[] {
  return [
    {
      name: named(prefix, "Inquiry"),
      description: "When an inquiry lands, capture source and event basics.",
      trigger_type: "lead_stage_change",
      toStageName: "Inquiry",
      actions: [
        task(
          `New ${label} inquiry: {{lead.title}}`,
          "Track lead source. Capture event date, venue/location, guest count if relevant, and contact details. Email to book a consult. Two-way SMS is not live yet.",
          0
        ),
        email(
          "Thanks for reaching out — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We received your inquiry. Reply with your event date and a few times that work for a consultation.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Consultation"),
      description: "On Consultation, book and confirm the meeting.",
      trigger_type: "lead_stage_change",
      toStageName: "Consultation",
      actions: [
        task(
          "Book consultation: {{lead.title}}",
          "Put the consult on the calendar. Send confirmation and a reminder.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Proposal sent"),
      description: "On Proposal Sent, send the package and follow up.",
      trigger_type: "lead_stage_change",
      toStageName: "Proposal Sent",
      actions: [
        task(
          "Follow up on proposal: {{lead.title}}",
          "Email the proposal/package. Track a decision date.",
          1
        ),
        email(
          "Your proposal from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your proposal is ready. Please review and reply with questions.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Contract signed"),
      description: "After Contract Signed, kick off planning.",
      trigger_type: "lead_stage_change",
      toStageName: "Contract Signed",
      actions: [
        task(
          "Kick off event planning: {{lead.title}}",
          "Collect remaining details, vendors, and deposits. Put the event on the calendar.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Planning"),
      description: "On Planning, run the timeline and vendors.",
      trigger_type: "lead_stage_change",
      toStageName: "Planning",
      actions: [
        task(
          "Advance event plan: {{lead.title}}",
          "Update timeline, staffing, and vendor notes. Flag gaps before day-of.",
          2
        ),
      ],
    },
    {
      name: named(prefix, "Day-of"),
      description: "On Day-Of, run the event checklist.",
      trigger_type: "lead_stage_change",
      toStageName: "Day-Of",
      actions: [
        task(
          "Day-of checklist: {{lead.title}}",
          "Confirm crew, load-in, and run of show. Capture photos/notes after.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Follow-up"),
      description: "On Follow-Up, invoice and ask for a review.",
      trigger_type: "lead_stage_change",
      toStageName: "Follow-Up",
      actions: [
        task(
          "Invoice and review: {{lead.title}}",
          "Send the invoice, check AR, and request a review if it went well.",
          1
        ),
        email(
          "Thank you from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Thank you for having us. Your invoice is coming next.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "After contract signed (e-sign)"),
      description: "When an e-sign contract completes, start planning.",
      trigger_type: "contract_signed",
      actions: [
        task(
          `Start ${label} planning from signed contract`,
          "Move the card to Contract Signed if needed and collect remaining event details.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "After invoice sent"),
      description: "When an invoice is sent, follow AR.",
      trigger_type: "invoice_sent",
      actions: [
        task(
          "Follow up on invoice payment",
          "Watch aging. Send a reminder if overdue. Record payment.",
          3
        ),
      ],
    },
  ];
}

function wellnessPack(prefix: string, label: string): CatalogWorkflowDef[] {
  return [
    {
      name: named(prefix, "New lead"),
      description: "When a lead is created, capture source and interest.",
      trigger_type: "lead_stage_change",
      toStageName: "Lead",
      actions: [
        task(
          `Qualify ${label} lead: {{lead.title}}`,
          "Track lead source. Capture goals, availability, and contact details. Email to book a consult. Two-way SMS is not live yet.",
          0
        ),
        email(
          "Thanks for contacting {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We received your inquiry. Reply with times that work for a consult.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Consult booked"),
      description: "On Consult Booked, confirm and send a reminder.",
      trigger_type: "lead_stage_change",
      toStageName: "Consult Booked",
      actions: [
        task(
          "Confirm consult: {{lead.title}}",
          "Put the consult on the calendar. Send confirmation and a reminder.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Package selected"),
      description: "On Package Selected, collect intake and payment terms.",
      trigger_type: "lead_stage_change",
      toStageName: "Package Selected",
      actions: [
        task(
          "Intake and package: {{lead.title}}",
          "Collect intake notes, confirm the package, and send the agreement or invoice deposit.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "In care"),
      description: "On In Care, deliver sessions and log notes.",
      trigger_type: "lead_stage_change",
      toStageName: "In Care",
      actions: [
        task(
          "Session notes: {{lead.title}}",
          "Deliver care, log session notes on the contact, and schedule the next visit.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Completed"),
      description: "On Completed, invoice remaining balance.",
      trigger_type: "lead_stage_change",
      toStageName: "Completed",
      actions: [
        task(
          "Close-out invoice: {{lead.title}}",
          "Send remaining invoice, check AR, and offer a follow-up package.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Follow-up"),
      description: "On Follow-Up, rebook or check in.",
      trigger_type: "lead_stage_change",
      toStageName: "Follow-Up",
      actions: [
        task(
          "Follow-up check-in: {{lead.title}}",
          "Email a check-in and offer the next package or rebook.",
          3
        ),
      ],
    },
    {
      name: named(prefix, "Closed"),
      description: "When Closed, request a review.",
      trigger_type: "lead_stage_change",
      toStageName: "Closed",
      actions: [
        task(
          "Request review: {{lead.title}}",
          "Ask for a review if care went well. Archive notes on the contact.",
          3
        ),
      ],
    },
    {
      name: named(prefix, "After invoice sent"),
      description: "When an invoice is sent, follow AR.",
      trigger_type: "invoice_sent",
      actions: [
        task(
          "Follow up on invoice payment",
          "Watch aging. Send a reminder if overdue. Record payment.",
          3
        ),
      ],
    },
  ];
}

function generalPack(prefix: string, label: string): CatalogWorkflowDef[] {
  return [
    {
      name: named(prefix, "New lead"),
      description: "When a lead is created, capture source.",
      trigger_type: "lead_stage_change",
      toStageName: "Lead",
      actions: [
        task(
          `Qualify ${label} lead: {{lead.title}}`,
          "Track lead source. Capture need, timeline, and contact details. Follow up by email.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Qualified"),
      description: "On Qualified, confirm fit and next step.",
      trigger_type: "lead_stage_change",
      toStageName: "Qualified",
      actions: [
        task(
          "Confirm fit: {{lead.title}}",
          "Confirm budget/timeline fit and schedule a proposal conversation.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Proposal"),
      description: "On Proposal, send the offer.",
      trigger_type: "lead_stage_change",
      toStageName: "Proposal",
      actions: [
        task(
          "Send proposal: {{lead.title}}",
          "Send the proposal and set a follow-up date.",
          1
        ),
        email(
          "Your proposal from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your proposal is ready. Please review and reply with questions.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Negotiation"),
      description: "On Negotiation, close remaining terms.",
      trigger_type: "lead_stage_change",
      toStageName: "Negotiation",
      actions: [
        task(
          "Close terms: {{lead.title}}",
          "Resolve remaining terms and send the agreement for signature.",
          2
        ),
      ],
    },
    {
      name: named(prefix, "Won"),
      description: "When Won, kick off delivery and invoice.",
      trigger_type: "lead_stage_change",
      toStageName: "Won",
      actions: [
        task(
          "Kick off and invoice: {{lead.title}}",
          "Create the project/job, send a kickoff note, and invoice the deposit or first bill.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Lost"),
      description: "When Lost, log the reason.",
      trigger_type: "lead_stage_change",
      toStageName: "Lost",
      actions: [
        task(
          "Log lost reason: {{lead.title}}",
          "Note why it was lost on the contact for later follow-up.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "After invoice sent"),
      description: "When an invoice is sent, follow AR.",
      trigger_type: "invoice_sent",
      actions: [
        task(
          "Follow up on invoice payment",
          "Watch aging. Send a reminder if overdue. Record payment.",
          3
        ),
      ],
    },
  ];
}

/** Cleaning Services — one-time vs recurring, access notes, quality photos. */
export function cleaningWorkflows(): CatalogWorkflowDef[] {
  const prefix = "Cleaning Services:";
  return [
    {
      name: named(prefix, "New lead"),
      description:
        "When a lead is created, capture source and one-time vs recurring.",
      trigger_type: "lead_stage_change",
      toStageName: "Lead",
      actions: [
        task(
          "New cleaning lead: {{lead.title}}",
          "Track lead source. Mark one-time deep clean vs recurring. Capture name, phone, email, address, property size/rooms, pets/allergies, and notes. Email to set a walkthrough. Two-way SMS is not live yet.",
          0
        ),
        email(
          "Thanks for contacting {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We received your cleaning request. Reply with whether this is a one-time deep clean or recurring service, plus the address and a couple of times that work for a walkthrough.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Schedule visit"),
      description: "On Site Visit, book the walkthrough and capture property details.",
      trigger_type: "lead_stage_change",
      toStageName: "Site Visit",
      actions: [
        task(
          "Schedule cleaning walkthrough: {{lead.title}}",
          "Confirm date/time, address, rooms, contact, and source. Add to the calendar with the address for routing. Send confirmation and a reminder. Two-way texting is not live yet.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Photos and estimate"),
      description: "On Estimate Sent, capture room photos and send one-time vs recurring options.",
      trigger_type: "lead_stage_change",
      toStageName: "Estimate Sent",
      actions: [
        task(
          "Upload property photos: {{lead.title}}",
          "Photo room condition and special areas. Note pets/allergies. Attach to the estimate.",
          0
        ),
        task(
          "Send cleaning estimate: {{lead.title}}",
          "Email one-time and/or recurring plan options. Track sent / viewed / approved / expired. On approval, convert to a job and add a Recurring plan if they chose ongoing service.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Job, access, and plan"),
      description:
        "After Contract Signed, assign a cleaner, store access, and set recurring visits.",
      trigger_type: "lead_stage_change",
      toStageName: "Contract Signed",
      actions: [
        task(
          "Create job and assign cleaner: {{lead.title}}",
          "Create the job. Assign a cleaner. Prefer the same team on Recurring plans for return visits. Check availability and background/training on Techs.",
          1
        ),
        task(
          "Store access and key notes: {{lead.title}}",
          "On Access, store entry method (key, lockbox, garage, doorman, hidden key), alarm instructions, pet notes, supply location, and areas to avoid. Do not put codes in email.",
          1
        ),
        task(
          "Set recurring plan if ongoing: {{lead.title}}",
          "If recurring, open Recurring plans: weekly, biweekly, or monthly, next visit, auto-invoice, same-cleaner preference, and skip-until for vacation/holidays.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Visit in progress"),
      description: "On In Progress, route, supplies, checklist, and photos.",
      trigger_type: "lead_stage_change",
      toStageName: "In Progress",
      actions: [
        task(
          "Route, mileage, and supplies: {{lead.title}}",
          "Set route order on Jobs. Log mileage. Check Inventory (eco/allergy notes). OCR is not auto-filled. GPS auto-route is not live.",
          0
        ),
        task(
          "Quality checklist and photos: {{lead.title}}",
          "Complete the room-by-room checklist on Quality. Capture before/after photos. Get sign-off or a satisfaction rating at the end.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Punch list"),
      description: "On Punch List, callbacks and leftover rooms.",
      trigger_type: "lead_stage_change",
      toStageName: "Punch List",
      actions: [
        task(
          "Callbacks and leftover rooms: {{lead.title}}",
          "Finish missed areas, log callbacks on the cleaner, and get sign-off.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Invoice and books"),
      description: "When Closed, invoice, AR, books, and a review request.",
      trigger_type: "lead_stage_change",
      toStageName: "Closed",
      actions: [
        task(
          "Invoice completed clean: {{lead.title}}",
          "Invoice the visit or let Recurring auto-draft. Check AR aging. Log supply receipts in Books. Ask for a review. Field ops shows profit, recurring, and tax set-aside.",
          1
        ),
        email(
          "Thanks — invoice from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your clean is complete. Invoice details are coming next. Thank you for choosing {{workspace.name}}.</p>"
        ),
      ],
    },
    {
      name: named(prefix, "After contract signed (e-sign)"),
      description: "When an e-sign contract completes, kick off the job.",
      trigger_type: "contract_signed",
      actions: [
        task(
          "Kick off cleaning job from signed contract",
          "Create the job, assign a cleaner, store access notes, and add a recurring plan when this is ongoing service.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "After invoice sent"),
      description: "When an invoice is sent, follow AR.",
      trigger_type: "invoice_sent",
      actions: [
        task(
          "Follow up on invoice payment",
          "Watch aging. Send a reminder if overdue. Flag missed/skipped visits or negative reviews.",
          3
        ),
      ],
    },
  ];
}

export function catalogWorkflowsForPreset(preset: string): CatalogWorkflowDef[] {
  const resolved = resolveIndustryPreset(preset) ?? preset;
  const prefix = workflowNamePrefix(resolved);
  const label =
    INDUSTRY_PRESETS.find((p) => p.value === resolved)?.label ?? "this business";
  if (resolved === "cleaning_services") return cleaningWorkflows();
  const sector = industrySectorId(resolved);
  if (sector === "home_field") return fieldPack(prefix, label);
  if (sector === "creative_professional") return creativePack(prefix, label);
  if (sector === "event_wedding") return eventPack(prefix, label);
  if (sector === "personal_wellness") return wellnessPack(prefix, label);
  return generalPack(prefix, label);
}

/** Field trades that should also get the shared Field: permit pair. */
export function fieldPresetUsesSharedPermits(preset: string): boolean {
  const resolved = resolveIndustryPreset(preset) ?? preset;
  if (industrySectorId(resolved) !== "home_field") return false;
  if (resolved === "cleaning_services") return false;
  return true;
}
