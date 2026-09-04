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
  if (resolved === "inspection_service") return "Inspection:";
  if (resolved === "rental_company") return "Rental:";
  if (resolved === "contractors_construction") return "Build:";
  if (resolved === "woodworking_custom_carpentry") return "Shop:";
  if (resolved === "steelworking_metal_fabrication") return "Steel:";
  if (resolved === "mobile_bartending") return "Bar:";
  if (resolved === "event_planner") return "Planner:";
  if (resolved === "event_venue") return "Venue:";
  if (resolved === "bridal_shop") return "Bridal:";
  if (resolved === "caterer") return "Catering:";
  if (resolved === "private_chef_services") return "Chef:";
  if (resolved === "photography_videography") return "Photo:";
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

function plannerWorkflows(): CatalogWorkflowDef[] {
  const prefix = "Planner:";
  return [
    {
      name: named(prefix, "New inquiry"),
      description: "When an inquiry lands, capture source and event basics.",
      trigger_type: "lead_stage_change",
      toStageName: "Inquiry",
      actions: [
        task(
          "New planner inquiry: {{lead.title}}",
          "Set lead source: wedding, corporate event, private party, referral, or venue partnership. Capture name, phone, email, event date, venue, guest count, event type, and budget range. Email to book a consult. Two-way SMS is not live yet.",
          0
        ),
        email(
          "Thanks for contacting {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We received your planning inquiry. Reply with your event date, venue if known, guest count, and a few times for a consultation.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Schedule consult"),
      description: "On Consultation, book the call or meeting.",
      trigger_type: "lead_stage_change",
      toStageName: "Consultation",
      actions: [
        task(
          "Schedule consult: {{lead.title}}",
          "On Events, log event date, venue, guest count, type, source, budget range, and consult time. Add it to the calendar. Send confirmation and a reminder. Two-way texting is not live.",
          0
        ),
        email(
          "Your consultation is booked — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We have your consult on the calendar. Reply if the time or venue changes.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Send proposal"),
      description: "On Proposal Sent, quote package plus add-ons.",
      trigger_type: "lead_stage_change",
      toStageName: "Proposal Sent",
      actions: [
        task(
          "Send planning proposal: {{lead.title}}",
          "Confirm planning tier (full, partial, or day-of) and add-ons (design, vendor sourcing, RSVP). On Estimates, quote the package. Email it. Track sent / viewed / approved / expired. On approval, convert to a booked event and invoice the deposit. Two-way SMS is not live. Luna never collects cards.",
          0
        ),
        email(
          "Your planning proposal from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your proposal is ready from package and add-ons. Please review and reply to approve. A deposit invoice follows approval.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Booked event ops"),
      description: "After Contract Signed, lock budget, vendors, and vision.",
      trigger_type: "lead_stage_change",
      toStageName: "Contract Signed",
      actions: [
        task(
          "Budget, vendors, and vision: {{lead.title}}",
          "On Budget, set planned vs actual by venue, catering, florals, entertainment, rentals, and attire. On Vendors, start sourcing and log COI dates. On Vision, collect wish-wall image URLs and theme colors. Invoice remaining milestones. OCR is not auto-filled.",
          1
        ),
      ],
    },
    {
      name: named(prefix, "Planning logistics"),
      description: "On Planning, lock guests, timeline, and rentals.",
      trigger_type: "lead_stage_change",
      toStageName: "Planning",
      actions: [
        task(
          "Lock guest list, timeline, and rentals: {{lead.title}}",
          "On Guests, import RSVPs and meals. On Timeline, set setup through breakdown. On Event rentals, track linens/chairs/lighting. Share the timeline by email — this is not a live vendor portal. Flag staffing gaps on Planner ops.",
          2
        ),
        email(
          "RSVP deadline and final payment — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Please confirm remaining RSVPs. Final payment is due before the event. Reply with seating or must-have changes.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Day-of"),
      description: "On Day-Of, run setup photos and issue notes.",
      trigger_type: "lead_stage_change",
      toStageName: "Day-Of",
      actions: [
        task(
          "Day-of planner checklist: {{lead.title}}",
          "Confirm coordinators and vendor arrivals. On Day-of, log setup photos, issues (no-show, timeline change), and walkthrough photos. Email that the team is on site. Two-way SMS is not live.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Follow-up"),
      description: "On Follow-Up, books, thank-you, and review.",
      trigger_type: "lead_stage_change",
      toStageName: "Follow-Up",
      actions: [
        task(
          "Close the event: {{lead.title}}",
          "On Invoices, collect remaining balance. Tag receipts on Books (OCR is not auto-filled). Request a review. Track repeat corporate or venue clients on the contact.",
          1
        ),
        email(
          "Thank you from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Thank you for having us. If anything is still open on the invoice, we will send it next. We would love a review when you have a moment.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "After contract signed (e-sign)"),
      description: "When an e-sign contract completes, start planning.",
      trigger_type: "contract_signed",
      actions: [
        task(
          "Start planning from signed contract",
          "Move the card to Contract Signed if needed. Create the booked event, invoice the deposit, and open budget lines.",
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
          "Follow up on planner invoice",
          "Watch aging. Send a reminder if overdue. Flag final payment due before the event.",
          3
        ),
      ],
    },
  ];
}

function venueWorkflows(): CatalogWorkflowDef[] {
  const prefix = "Venue:";
  return [
    {
      name: named(prefix, "New inquiry"),
      description: "When an inquiry lands, capture source and event basics.",
      trigger_type: "lead_stage_change",
      toStageName: "Inquiry",
      actions: [
        task(
          "New venue inquiry: {{lead.title}}",
          "Set lead source: wedding, corporate event, private party, referral, or planner partnership. Capture name, phone, email, desired date, event type, and guest count. Check Events for that date and space. Email to book a tour. Two-way SMS is not live.",
          0
        ),
        email(
          "Thanks for contacting {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We received your venue inquiry. Reply with your event date, guest count, and a few times for a tour.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Schedule tour"),
      description: "On Consultation, book the site tour.",
      trigger_type: "lead_stage_change",
      toStageName: "Consultation",
      actions: [
        task(
          "Schedule tour: {{lead.title}}",
          "On Tours, log time, space, talking points, and setup photo URLs. Confirm by email and add a reminder. Two-way texting is not live.",
          0
        ),
        email(
          "Your venue tour is booked — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We have your tour on the calendar. Reply if the time changes.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Send estimate"),
      description: "On Proposal Sent, quote package plus add-ons.",
      trigger_type: "lead_stage_change",
      toStageName: "Proposal Sent",
      actions: [
        task(
          "Send venue estimate: {{lead.title}}",
          "Confirm rental tier (ceremony + reception, reception only, or hourly corporate), included vs add-ons, hours, and overtime rate. On Estimates, quote the date. Email it. Track sent / viewed / approved / expired. On approval, book the event, invoice the deposit, and mark the date held. Two-way SMS is not live. Luna never collects cards.",
          0
        ),
        email(
          "Your venue estimate from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready from package, date, and add-ons. Please review and reply to approve. A deposit invoice follows approval and holds the date.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Booked event ops"),
      description: "After Contract Signed, lock insurance, layout, and vendors.",
      trigger_type: "lead_stage_change",
      toStageName: "Contract Signed",
      actions: [
        task(
          "Insurance, layout, and preferred vendors: {{lead.title}}",
          "On Insurance, collect client event insurance and vendor COIs. On Layouts, set banquet/theater/cocktail capacity notes and photo URLs for client approval. On Preferred vendors, confirm in-house vs outside. Invoice remaining balance due before the event. OCR is not auto-filled.",
          1
        ),
        email(
          "Insurance and COI reminder — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Please send event liability insurance and any outside-vendor certificates of insurance. Load-in details follow closer to the date.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Logistics"),
      description: "On Planning, lock load-in, staff, and turnover.",
      trigger_type: "lead_stage_change",
      toStageName: "Planning",
      actions: [
        task(
          "Lock load-in, staff, and turnover: {{lead.title}}",
          "On Events, set load-in, start/end, load-out, vendor windows, and access notes. On Staff, assign coordinator/setup/security. On Turnover, schedule reset if another event shares the day. Flag too-tight buffers on Venue ops.",
          2
        ),
        email(
          "Load-in details and final payment — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Final payment is due before the event. We will send load-in, parking, and dock notes. Reply with vendor arrival times.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Day-of"),
      description: "On Day-Of, run condition photos and walkthrough.",
      trigger_type: "lead_stage_change",
      toStageName: "Day-Of",
      actions: [
        task(
          "Day-of venue checklist: {{lead.title}}",
          "On Condition photos, log before/after URLs, incidents, and walkthrough. On Damage deposits, hold or assess. Email that the team is on site. Two-way SMS is not live.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Follow-up"),
      description: "On Follow-Up, books, deposit, thank-you, and review.",
      trigger_type: "lead_stage_change",
      toStageName: "Follow-Up",
      actions: [
        task(
          "Close the booking: {{lead.title}}",
          "On Invoices, collect overtime/add-ons if any. Refund or deduct the damage deposit with photos. Tag receipts on Books (OCR is not auto-filled). Request a review. Track repeat corporate or planner clients on the contact.",
          1
        ),
        email(
          "Thank you from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Thank you for hosting with us. We will follow up on the damage deposit after the condition check. We would love a review when you have a moment.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "After contract signed (e-sign)"),
      description: "When an e-sign contract completes, hold the date.",
      trigger_type: "contract_signed",
      actions: [
        task(
          "Hold the date from signed contract",
          "Move the card to Contract Signed if needed. Mark the booking booked, set date held, and invoice the deposit. This does not auto-block a live calendar.",
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
          "Follow up on venue invoice",
          "Watch aging. Send a reminder if overdue. Flag final payment due before the event.",
          3
        ),
      ],
    },
  ];
}

function bridalWorkflows(): CatalogWorkflowDef[] {
  const prefix = "Bridal:";
  return [
    {
      name: named(prefix, "New inquiry"),
      description: "When an inquiry lands, capture source and wedding basics.",
      trigger_type: "lead_stage_change",
      toStageName: "Inquiry",
      actions: [
        task(
          "New bridal inquiry: {{lead.title}}",
          "Set lead source: bride, bridesmaid, mother-of-bride, referral, online, or walk-in. Capture name, wedding date, party size, budget, and style prefs. Email to book a fitting. Two-way SMS is not live.",
          0
        ),
        email(
          "Thanks for contacting {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We received your inquiry. Reply with your wedding date, a few appointment times, and any silhouette or designer notes.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Schedule appointment"),
      description: "On Consultation, book the fitting.",
      trigger_type: "lead_stage_change",
      toStageName: "Consultation",
      actions: [
        task(
          "Schedule fitting: {{lead.title}}",
          "On Appointments, log time, wedding date, party size, budget, and stylist. Add it to the calendar. Send confirmation. Two-way texting is not live.",
          0
        ),
        email(
          "Your fitting is booked — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We have your appointment on the calendar. Reply if the time changes.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Fitting session"),
      description: "On Planning, pull tagged gowns.",
      trigger_type: "lead_stage_change",
      toStageName: "Planning",
      actions: [
        task(
          "Pull gowns for fitting: {{lead.title}}",
          "On Floor inventory, search style/size/designer and note rack/section/hanger. On Fittings, log pulled tags, try-on photo URLs, and favorites. Mark those items In fitting room. This is not live RFID or a 3D engine.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Write the order"),
      description: "On Proposal Sent, write the sale.",
      trigger_type: "lead_stage_change",
      toStageName: "Proposal Sent",
      actions: [
        task(
          "Write bridal order: {{lead.title}}",
          "On Orders, choose in-stock vs special order, designer ETA, and deposit. Use Contracts for the sale agreement. Invoice the deposit. Payment plans are later invoices. Luna never collects cards.",
          0
        ),
        email(
          "Your gown order from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your order is written. We will send the agreement to sign and a deposit invoice. Special orders include the expected arrival window.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Alterations"),
      description: "After Contract Signed, start alterations.",
      trigger_type: "lead_stage_change",
      toStageName: "Contract Signed",
      actions: [
        task(
          "Start alterations: {{lead.title}}",
          "On Alterations, log measurements, seamstress, and next fitting. Mark the gown In alterations on Floor inventory. Invoice remaining balance before pickup.",
          1
        ),
        email(
          "Alterations appointment — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your next fitting is on the calendar. Bring shoes you will wear with the gown if you have them.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Ready for pickup"),
      description: "On Follow-Up, pickup and review.",
      trigger_type: "lead_stage_change",
      toStageName: "Follow-Up",
      actions: [
        task(
          "Close the sale: {{lead.title}}",
          "Confirm balance paid, gown picked up, and accessories. Request a review. Tag receipts on Books (OCR is not auto-filled).",
          1
        ),
        email(
          "Thank you from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Congratulations. If the gown is ready, we will confirm pickup and any remaining balance. We would love a review when you have a moment.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "After contract signed (e-sign)"),
      description: "When an e-sign contract completes, start the order.",
      trigger_type: "contract_signed",
      actions: [
        task(
          "Start order from signed sale",
          "Move the card if needed. Create the order, invoice the deposit, and hold the gown tag.",
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
          "Follow up on bridal invoice",
          "Watch aging. Send a reminder if overdue. Flag balance due before pickup.",
          3
        ),
      ],
    },
  ];
}

function cateringWorkflows(): CatalogWorkflowDef[] {
  const prefix = "Catering:";
  return [
    {
      name: named(prefix, "New inquiry"),
      description: "When an inquiry lands, capture source and event basics.",
      trigger_type: "lead_stage_change",
      toStageName: "Inquiry",
      actions: [
        task(
          "New catering inquiry: {{lead.title}}",
          "Set lead source: wedding, corporate, private party, referral, or venue partnership. Capture date, venue, guest count, event type, budget, and dietary notes. Email to book a consult or tasting. Two-way SMS is not live.",
          0
        ),
        email(
          "Thanks for contacting {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We received your catering inquiry. Reply with your event date, guest count, venue, and a few times for a consultation or tasting.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Schedule tasting"),
      description: "On Consultation, book the tasting.",
      trigger_type: "lead_stage_change",
      toStageName: "Consultation",
      actions: [
        task(
          "Schedule tasting: {{lead.title}}",
          "On Tastings, log time and menu notes. On Events, capture dietary counts. Send confirmation. Two-way texting is not live.",
          0
        ),
        email(
          "Your tasting is booked — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We have your tasting on the calendar. Reply if the time changes. Please note allergies in advance.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Send estimate"),
      description: "On Proposal Sent, quote guests plus menu plus staffing.",
      trigger_type: "lead_stage_change",
      toStageName: "Proposal Sent",
      actions: [
        task(
          "Send catering estimate: {{lead.title}}",
          "Confirm guest count, service style, and menu. On Estimates, quote package plus staffing. Email it. On approval, book the event and invoice the deposit. Two-way SMS is not live. Luna never collects cards.",
          0
        ),
        email(
          "Your catering estimate from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready from guest count, menu, and service style. Please review and reply to approve. A deposit invoice follows approval.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Booked kitchen ops"),
      description: "After Contract Signed, order food and plan prep.",
      trigger_type: "lead_stage_change",
      toStageName: "Contract Signed",
      actions: [
        task(
          "Prep, orders, and licenses: {{lead.title}}",
          "On Food orders, scale ingredients to guest count in notes. On Kitchen prep, work backward from service. Confirm health licenses and COI. Ask for final headcount. OCR is not auto-filled.",
          1
        ),
        email(
          "Final headcount due — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Please confirm final headcount and remaining dietary counts so we can order and staff. Final payment is due before the event.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Service day"),
      description: "On Day-Of, pack, route, and log temps.",
      trigger_type: "lead_stage_change",
      toStageName: "Day-Of",
      actions: [
        task(
          "Service day checklist: {{lead.title}}",
          "Confirm load-in, staff, and packed equipment on Events. On Service log, record presentation photos and holding temperatures. Two-way SMS is not live. GPS routing is not live.",
          0
        ),
      ],
    },
    {
      name: named(prefix, "Follow-up"),
      description: "On Follow-Up, books, thank-you, and review.",
      trigger_type: "lead_stage_change",
      toStageName: "Follow-Up",
      actions: [
        task(
          "Close the event: {{lead.title}}",
          "Invoice overages if headcount changed. Enter food cost vs package price on Events. Tag receipts on Books. Request a review.",
          1
        ),
        email(
          "Thank you from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Thank you for having us. If guest count changed we will send any remaining balance. We would love a review when you have a moment.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "After contract signed (e-sign)"),
      description: "When an e-sign contract completes, start kitchen ops.",
      trigger_type: "contract_signed",
      actions: [
        task(
          "Start catering from signed contract",
          "Book the event, invoice the deposit, and open food orders and prep tasks.",
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
          "Follow up on catering invoice",
          "Watch aging. Send a reminder if overdue. Flag final payment due before the event.",
          3
        ),
      ],
    },
  ];
}

function chefWorkflows(): CatalogWorkflowDef[] {
  const prefix = "Chef:";
  return [
    {
      name: named(prefix, "New inquiry"),
      description: "When an inquiry lands, capture source and service type.",
      trigger_type: "lead_stage_change",
      toStageName: "Inquiry",
      actions: [
        task(
          "New chef inquiry: {{lead.title}}",
          "Set lead source: weekly meal prep, dinner party, special occasion, recurring household chef, or referral. Capture service type, household size, dietary needs, kitchen access, budget, and contact. Email to book an intro call or in-home consult. Two-way SMS is not live.",
          0
        ),
        email(
          "Thanks for contacting {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We received your private chef inquiry. Reply with the service you want (weekly meal prep, dinner party, or recurring in-home chef), household size, dietary needs, and a few times for an intro call or in-home consultation.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Schedule consultation"),
      description: "On Consultation, book the intro or in-home visit.",
      trigger_type: "lead_stage_change",
      toStageName: "Consultation",
      actions: [
        task(
          "Schedule chef consult: {{lead.title}}",
          "On Visits, log the consult date and service type. On Households, capture dietary profile. Send confirmation and a reminder. Two-way texting is not live.",
          0
        ),
        email(
          "Your consultation is booked — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We have your intro consultation on the calendar. Reply if the time changes. Please note allergies, household size, and kitchen access in advance.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Send estimate"),
      description:
        "On Proposal Sent, quote per-meal, weekly package, or event pricing.",
      trigger_type: "lead_stage_change",
      toStageName: "Proposal Sent",
      actions: [
        task(
          "Send chef estimate: {{lead.title}}",
          "On Estimates, quote per-meal, weekly package, or per-event pricing. Email it. Track sent/viewed/approved/expired on the estimate. On approval, add a Recurring plan or a scheduled visit. This does not auto-create Stripe subscriptions. Luna never collects cards.",
          0
        ),
        email(
          "Your chef estimate from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review and reply to approve. Recurring meal-prep clients typically invoice on a weekly cycle; dinner parties invoice per event. Grocery cost-plus can be itemized separately.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Menu approval"),
      description: "After Contract Signed, draft the menu for approval.",
      trigger_type: "lead_stage_change",
      toStageName: "Contract Signed",
      actions: [
        task(
          "Menu, access, and shopping: {{lead.title}}",
          "On Menus, draft weekly or event dishes and mark Pending for approval. On Access notes, record entry, kitchen on hand, pets, and storage. On Shopping, type the list from the approved menu — recipes are not auto-scaled. OCR is not auto-filled.",
          1
        ),
        email(
          "Menu ready for approval — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your menu is ready for review. Please approve before we shop and cook. Reply with any dish changes, allergies, or presentation notes.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Visit day"),
      description: "On Day-Of, shop, cook, label, and photograph.",
      trigger_type: "lead_stage_change",
      toStageName: "Day-Of",
      actions: [
        task(
          "Chef visit checklist: {{lead.title}}",
          "Move the visit scheduled → shopping → cooking → complete. Shop, prep, cook, package/label, clean kitchen. Photograph finished dishes. Log labels with date made, reheat, shelf life, and allergy precautions. Two-way SMS is not live.",
          0
        ),
        email(
          "Chef arriving today — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your chef visit is today. We will shop, cook, label, and leave the kitchen clean. Reply if access or timing changed.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Follow-up"),
      description: "On Follow-Up, invoice and books.",
      trigger_type: "lead_stage_change",
      toStageName: "Follow-Up",
      actions: [
        task(
          "Invoice the visit: {{lead.title}}",
          "Invoice per visit or weekly cycle. For cost-plus, itemize groceries vs chef fee on the visit and on Books. Watch aging. Flag skipped visits and menus still pending approval.",
          1
        ),
        email(
          "Thank you from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Thank you for having us in your kitchen. Your invoice is coming next. Grocery receipts can be itemized separately from the chef fee when we bill cost-plus.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "After contract signed (e-sign)"),
      description: "When an e-sign contract completes, start household ops.",
      trigger_type: "contract_signed",
      actions: [
        task(
          "Start chef service from signed contract",
          "Add a Recurring plan or a scheduled visit, invoice the first cycle or deposit, and open the household profile and first menu.",
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
          "Follow up on chef invoice",
          "Watch aging. Send a reminder if overdue. Weekly clients often auto-bill on a cycle you invoice — Stripe subscriptions are not auto-created.",
          3
        ),
      ],
    },
  ];
}

function photoWorkflows(): CatalogWorkflowDef[] {
  const prefix = "Photo:";
  return [
    {
      name: named(prefix, "New inquiry"),
      description: "When an inquiry lands, capture source and shoot type.",
      trigger_type: "lead_stage_change",
      toStageName: "Inquiry",
      actions: [
        task(
          "New photo inquiry: {{lead.title}}",
          "Set lead source: wedding, portrait session, corporate/commercial, referral, or Instagram/portfolio. Capture date, location, session type, budget, and contact. Email to book a consult. Two-way SMS is not live.",
          0
        ),
        email(
          "Thanks for contacting {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We received your photography/videography inquiry. Reply with your date, venue, whether you need photo, video, or both, and a few times for a consultation.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Schedule consultation"),
      description: "On Consultation, book the intro call or meeting.",
      trigger_type: "lead_stage_change",
      toStageName: "Consultation",
      actions: [
        task(
          "Schedule photo consult: {{lead.title}}",
          "On Shoots, log the consult date, location, session type, and budget. On Mood boards, collect inspiration URLs. Send confirmation. Two-way texting is not live.",
          0
        ),
        email(
          "Your consultation is booked — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We have your consultation on the calendar. Reply if the time changes. Bring inspiration photos if you have them.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Send estimate"),
      description: "On Proposal Sent, quote coverage hours and add-ons.",
      trigger_type: "lead_stage_change",
      toStageName: "Proposal Sent",
      actions: [
        task(
          "Send photo estimate: {{lead.title}}",
          "On Packages, confirm hours, shooters, photo vs video, and add-ons. On Estimates, quote package plus travel. Include usage rights on the contract. On approval, book the shoot and invoice the deposit. This does not auto-charge cards. Luna never collects cards.",
          0
        ),
        email(
          "Your photography estimate from {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Your estimate is ready. Please review coverage hours and delivery timing, then reply to approve. A contract follows approval.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Shot list"),
      description: "After Contract Signed, build the shot list.",
      trigger_type: "lead_stage_change",
      toStageName: "Contract Signed",
      actions: [
        task(
          "Shot list and crew: {{lead.title}}",
          "On Shot list, log family combinations or commercial deliverables. On Permits, check park/venue requirements. On Crew and Gear, assign shooters and check out bodies. This is not a live camera ingest.",
          1
        ),
        email(
          "Shot list next — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>Please send must-have family groupings and any shots we should not miss. We will confirm call times before the day.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Shoot day"),
      description: "On Day-Of, run the shot list.",
      trigger_type: "lead_stage_change",
      toStageName: "Day-Of",
      actions: [
        task(
          "Shoot day checklist: {{lead.title}}",
          "Move the shoot booked → on shoot → wrapped. Work the shot list. Confirm arrival and packed gear on the shoot row. Two-way SMS is not live.",
          0
        ),
        email(
          "See you today — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We are on site for your shoot today. Reply only if timing or access changed.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "Follow-up"),
      description: "On Follow-Up, edit, gallery, and invoice.",
      trigger_type: "lead_stage_change",
      toStageName: "Follow-Up",
      actions: [
        task(
          "Edit and deliver: {{lead.title}}",
          "On Edits, move culling → editing → grading → client review. Set video rough/final if needed. On Galleries, log the proofing URL and delivery method — this is not a hosted gallery. Invoice the remaining balance before or at delivery. Flag print/album orders.",
          1
        ),
        email(
          "Gallery coming soon — {{workspace.name}}",
          "<p>Hi {{contact.first_name}},</p><p>We are editing your gallery. You will get a delivery link when it is ready. Print and album orders can follow from that gallery.</p><p>{{workspace.name}}</p>"
        ),
      ],
    },
    {
      name: named(prefix, "After contract signed (e-sign)"),
      description: "When an e-sign contract completes, book the shoot.",
      trigger_type: "contract_signed",
      actions: [
        task(
          "Book shoot from signed contract",
          "Set the shoot to booked, invoice the retainer, and open the shot list.",
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
          "Follow up on photo invoice",
          "Watch aging. Send a reminder if overdue. Flag turnaround dates on Edits and galleries still in draft.",
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
          "Create the job. Assign a cleaner. Prefer the same team on Recurring plans for return visits. Check availability and background/training on Cleaners.",
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
  if (resolved === "event_planner") return plannerWorkflows();
  if (resolved === "event_venue") return venueWorkflows();
  if (resolved === "bridal_shop") return bridalWorkflows();
  if (resolved === "caterer") return cateringWorkflows();
  if (resolved === "private_chef_services") return chefWorkflows();
  if (resolved === "photography_videography") return photoWorkflows();
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
  if (resolved === "inspection_service") return false;
  if (resolved === "rental_company") return false;
  if (resolved === "woodworking_custom_carpentry") return false;
  return true;
}
