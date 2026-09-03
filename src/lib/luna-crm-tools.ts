import type { FunctionDeclaration } from "@google/genai";
import { BAR_LUNA_TOOLS } from "@/lib/verticals/bar/tools";

/** Extra CRM tools for Luna. Telegram stays cron + env, not a tool. */
export const LUNA_CRM_TOOLS: FunctionDeclaration[] = [
  {
    name: "update_task",
    description:
      "Edit an existing task in this workspace. Identify it by title. Pass only fields that should change.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Current task title to look up" },
        task_title: { type: "string" },
        lookup: { type: "string" },
        new_title: { type: "string" },
        description: { type: "string" },
        status: {
          type: "string",
          description: "todo, in_progress, or done",
        },
        priority: {
          type: "string",
          description: "low, medium, high, or urgent",
        },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        project_name: { type: "string" },
        contact_name: { type: "string", description: "Client contact name" },
        contact_email: { type: "string" },
        reminder_minutes_before: { type: "number" },
      },
    },
  },
  {
    name: "complete_task",
    description:
      "Mark a task done in this workspace. Identify it by title. Use when they say complete, finish, or done.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        task_title: { type: "string" },
        lookup: { type: "string" },
      },
    },
  },
  {
    name: "delete_task",
    description:
      "Permanently delete a task in this workspace. Only when the user clearly asks to delete or remove it.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        task_title: { type: "string" },
        lookup: { type: "string" },
      },
    },
  },
  {
    name: "update_invoice",
    description:
      "Edit a draft or existing invoice. Identify by invoice number or client name. Amount maps to total. Do not charge cards.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        invoice_number: { type: "string" },
        lookup: { type: "string" },
        contact_name: { type: "string" },
        notes: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        amount: { type: "number" },
        total: { type: "number" },
        currency: { type: "string" },
        status: {
          type: "string",
          description: "draft, sent, paid, overdue, or cancelled",
        },
      },
    },
  },
  {
    name: "send_invoice",
    description:
      "Email a workspace invoice to the billed contact and mark it sent. Identify by invoice number or client. Does not charge a card.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        invoice_number: { type: "string" },
        lookup: { type: "string" },
        contact_name: { type: "string" },
      },
    },
  },
  {
    name: "void_invoice",
    description:
      "Void an invoice by setting status to cancelled. Identify by invoice number or client.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        invoice_number: { type: "string" },
        lookup: { type: "string" },
        contact_name: { type: "string" },
      },
    },
  },
  {
    name: "record_invoice_payment",
    description:
      "Record that an invoice was paid in the CRM (status paid and paid_at). Does not process card payments or store payment secrets.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        invoice_number: { type: "string" },
        lookup: { type: "string" },
        contact_name: { type: "string" },
      },
    },
  },
  {
    name: "generate_payment_link",
    description:
      "Create or reuse a Stripe Payment Link for an existing invoice total. Identify by invoice number or client name. Does not take card numbers. Does not pass a workspace id.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        invoice_number: { type: "string" },
        lookup: { type: "string" },
        contact_name: { type: "string" },
      },
    },
  },
  {
    name: "update_form",
    description:
      "Edit an existing form after create. Identify by name. Pass only fields that should change.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        form_name: { type: "string", description: "Current form name to look up" },
        name: { type: "string" },
        new_name: { type: "string" },
        description: { type: "string" },
        status: {
          type: "string",
          description: "draft, active, or archived",
        },
        fields: {
          type: "string",
          description: "Replacement comma-separated field labels",
        },
      },
    },
  },
  {
    name: "update_contract",
    description:
      "Edit a contract after create. Identify by name or contract number. Statuses: draft, sent, active, completed, cancelled.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contract_name: { type: "string" },
        name: { type: "string" },
        lookup: { type: "string" },
        new_name: { type: "string" },
        description: { type: "string" },
        terms: { type: "string" },
        value: { type: "number" },
        currency: { type: "string" },
        status: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        contact_name: { type: "string" },
      },
    },
  },
  {
    name: "send_esign",
    description:
      "Email a signing link for an e-sign document that already has a PDF and at least one field. Identify by document name. Does not create the PDF.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        document_name: { type: "string" },
        name: { type: "string" },
        signer_email: { type: "string" },
        signer_name: { type: "string" },
      },
    },
  },
  {
    name: "search_contacts",
    description:
      "Search or list contacts in this workspace. Empty query lists recent contacts.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name, company, or email fragment" },
      },
    },
  },
  {
    name: "list_emails",
    description:
      "List recent outbound email history for this workspace. Does not include body HTML.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional subject or recipient filter" },
      },
    },
  },
  {
    name: "list_inbox",
    description: "List recent inbound inbox messages for this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional subject or sender filter" },
      },
    },
  },
  {
    name: "list_templates",
    description: "List email templates in this workspace by name and subject.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "send_calendar_invite",
    description:
      "Create a dated workspace task (a meeting is a task with a due date) and email a calendar file (.ics) to a contact. This is not Google Calendar. Only call when they want an invite emailed.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_date: { type: "string", description: "Meeting date YYYY-MM-DD" },
        description: { type: "string" },
        contact_name: { type: "string" },
        contact_email: { type: "string" },
        to: { type: "string" },
      },
      required: ["title", "due_date"],
    },
  },
  {
    name: "get_contact",
    description:
      "Look up one contact in this workspace by name or email. Returns name, email, phone, type, and notes. No IDs unless asked.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        lookup: { type: "string" },
        contact_name: { type: "string" },
        email: { type: "string" },
      },
    },
  },
  {
    name: "delete_contact",
    description:
      "Delete a contact in this workspace. Only when they clearly say delete or remove that contact.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        lookup: { type: "string" },
        contact_name: { type: "string" },
        email: { type: "string" },
      },
    },
  },
  {
    name: "list_tasks",
    description: "List tasks in this workspace. Optional status todo, in_progress, or done.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        status: { type: "string" },
      },
    },
  },
  {
    name: "list_invoices",
    description: "List invoices in this workspace. Optional status draft, sent, paid, overdue, cancelled.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        status: { type: "string" },
      },
    },
  },
  {
    name: "list_projects",
    description: "List projects in this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: { query: { type: "string" }, status: { type: "string" } },
    },
  },
  {
    name: "list_forms",
    description: "List forms in this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: { query: { type: "string" } },
    },
  },
  {
    name: "list_contracts",
    description: "List contracts in this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: { query: { type: "string" } },
    },
  },
  {
    name: "list_leads",
    description: "List pipeline leads in this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: { query: { type: "string" } },
    },
  },
  {
    name: "list_workflows",
    description: "List automation workflows in this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_submissions",
    description: "List recent form submissions in this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: { form_name: { type: "string" } },
    },
  },
  {
    name: "list_esign",
    description: "List e-sign documents in this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: { query: { type: "string" } },
    },
  },
  {
    name: "list_knowledge_base",
    description: "List SOP or knowledge article titles in this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: { query: { type: "string" } },
    },
  },
  {
    name: "create_lead",
    description:
      "Create a pipeline lead in this workspace. Identify an optional contact by name. Stage names like New Lead, Qualified, Won.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        stage_name: { type: "string" },
        contact_name: { type: "string" },
        value: { type: "number" },
        notes: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "create_knowledge_entry",
    description: "Save an SOP or knowledge article in this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        category: { type: "string" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "create_email_template",
    description:
      "Create an email template in this workspace. Body is plain text. Does not send mail.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["name", "subject", "body"],
    },
  },
  {
    name: "remind_esign",
    description:
      "Re-send the signing email for an e-sign document that is already sent or viewed.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        document_name: { type: "string" },
        name: { type: "string" },
      },
    },
  },
  {
    name: "delete_form",
    description:
      "Permanently delete a form in this workspace. Only when they clearly ask to delete or remove it. Identify by name.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        form_name: { type: "string" },
        name: { type: "string" },
        lookup: { type: "string" },
      },
    },
  },
  {
    name: "delete_contract",
    description:
      "Permanently delete a contract in this workspace. Identify by name or contract number.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contract_name: { type: "string" },
        name: { type: "string" },
        lookup: { type: "string" },
      },
    },
  },
  {
    name: "delete_workflow",
    description:
      "Permanently delete an automation workflow in this workspace. Identify by name.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        workflow_name: { type: "string" },
        lookup: { type: "string" },
      },
    },
  },
  {
    name: "delete_project",
    description:
      "Permanently delete a project in this workspace. Tasks on that project are removed with it. Identify by name.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        project_name: { type: "string" },
        lookup: { type: "string" },
      },
    },
  },
  {
    name: "delete_invoice",
    description:
      "Permanently delete an invoice in this workspace. Identify by invoice number or client. Does not charge or refund cards.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        invoice_number: { type: "string" },
        lookup: { type: "string" },
        contact_name: { type: "string" },
      },
    },
  },
  {
    name: "delete_lead",
    description:
      "Permanently delete a pipeline lead in this workspace. Identify by title.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        lead_title: { type: "string" },
        lookup: { type: "string" },
        name: { type: "string" },
      },
    },
  },
  {
    name: "delete_esign",
    description:
      "Permanently delete an e-sign document in this workspace. Identify by document name.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        document_name: { type: "string" },
        name: { type: "string" },
        lookup: { type: "string" },
      },
    },
  },
  {
    name: "delete_email_template",
    description:
      "Permanently delete an email template in this workspace. Identify by name. Does not unsend mail.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        template_name: { type: "string" },
        lookup: { type: "string" },
      },
    },
  },
  {
    name: "delete_knowledge_entry",
    description:
      "Permanently delete a knowledge article or SOP in this workspace. Identify by title.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        name: { type: "string" },
        lookup: { type: "string" },
      },
    },
  },
  {
    name: "list_job_permits",
    description:
      "List job permits in this workspace (pulled, approved, inspection). Optional filter by status.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description:
            "needed, applied, pulled, approved, inspection_scheduled, passed, failed, or not_required",
        },
      },
    },
  },
  {
    name: "log_job_permit",
    description:
      "Log a city/county or HOA permit for a field job: pulled, approved, or not required.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Permit or work type" },
        permit_number: { type: "string" },
        status: {
          type: "string",
          description:
            "needed, applied, pulled, approved, inspection_scheduled, passed, failed, or not_required",
        },
        project_name: { type: "string" },
        notes: { type: "string" },
        kind: {
          type: "string",
          description: "city, hoa, or other",
        },
      },
    },
  },
  {
    name: "list_insurance_claims",
    description:
      "List roofing insurance claims (status, company, adjuster). Does not return policy or claim numbers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description:
            "filed, adjuster_scheduled, approved, denied, supplement_pending, paid, or closed",
        },
      },
    },
  },
  {
    name: "log_insurance_claim",
    description:
      "Log an insurance claim file for a roofing job. Do not ask the user to paste policy numbers into chat.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        insurance_company: { type: "string" },
        status: {
          type: "string",
          description:
            "filed, adjuster_scheduled, approved, denied, supplement_pending, paid, or closed",
        },
        pricing_mode: {
          type: "string",
          description: "insurance or out_of_pocket",
        },
        project_name: { type: "string" },
        adjuster_name: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "list_material_orders",
    description:
      "List material and dumpster orders (status, delivery date, color).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description:
            "needed, ordered, in_transit, delivered, delayed, or cancelled",
        },
      },
    },
  },
  {
    name: "log_material_order",
    description:
      "Log shingles, underlayment, dumpster, or other materials for a job, including delivery date.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        material_type: {
          type: "string",
          description: "shingles, underlayment, dumpster, or other",
        },
        status: {
          type: "string",
          description:
            "needed, ordered, in_transit, delivered, delayed, or cancelled",
        },
        project_name: { type: "string" },
        color: { type: "string" },
        quantity: { type: "string" },
        vendor: { type: "string" },
        delivery_on: { type: "string", description: "YYYY-MM-DD" },
        dropoff_notes: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "list_finish_specs",
    description:
      "List paint color and finish specs (room, brand, code, sheen, client sign-off).",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_finish_spec",
    description:
      "Log a paint color or finish for a room or surface in this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        room_or_surface: { type: "string" },
        name: { type: "string" },
        brand: { type: "string" },
        color_name: { type: "string" },
        color_code: { type: "string" },
        sheen: {
          type: "string",
          description: "flat, eggshell, satin, semi_gloss, or gloss",
        },
        quantity: { type: "string" },
        supplier: { type: "string" },
        match_notes: { type: "string" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_prep_items",
    description:
      "List surface prep items (patching, sanding, priming, taping, mudding, texture).",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_prep_item",
    description: "Log a surface prep or drywall item for a job.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description:
            "patching, sanding, caulking, priming, taping, mudding, texture, or other",
        },
        status: {
          type: "string",
          description: "todo, in_progress, done, or skipped",
        },
        billed_separately: { type: "boolean" },
        notes: { type: "string" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_hoa_color_approvals",
    description: "List HOA exterior color approval records and their status.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_hoa_color_approval",
    description:
      "Log HOA exterior color approval (needed, submitted, approved, denied, or not_required).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        scheme_notes: { type: "string" },
        notes: { type: "string" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_pest_treatments",
    description:
      "List pest treatments (product, method, pest, guarantee window). Does not return access codes.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_pest_treatment",
    description:
      "Log a chemical or treatment for a pest visit (product, EPA number, method, pest, area, guarantee days).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        product_name: { type: "string" },
        epa_number: { type: "string" },
        method: {
          type: "string",
          description: "spray, bait, trap, granular, foam, or other",
        },
        quantity: { type: "string" },
        target_pest: { type: "string" },
        treatment_area: { type: "string" },
        treated_on: { type: "string", description: "YYYY-MM-DD" },
        guarantee_days: { type: "number" },
        project_name: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "list_property_access",
    description:
      "List property access and safety notes. Never returns gate or lockbox codes.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_property_access",
    description:
      "Save pet/child/garden safety notes and entry method. Do not collect or store entry codes through this tool.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        entry_method: {
          type: "string",
          description: "occupant, gate, garage, lockbox, or other",
        },
        has_entry_code: { type: "boolean" },
        pets_notes: { type: "string" },
        child_safety: { type: "string" },
        chemical_sensitive: { type: "string" },
        special_instructions: { type: "string" },
      },
    },
  },
  {
    name: "list_inspection_findings",
    description:
      "List inspection findings (system, severity, title). Does not return share links.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_inspection_finding",
    description:
      "Log a home inspection finding (roof, HVAC, electrical, plumbing, foundation, appliances) with severity.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        system: {
          type: "string",
          description:
            "roof, hvac, electrical, plumbing, foundation, appliances, interior, exterior, or other",
        },
        severity: {
          type: "string",
          description: "safety, major, minor, cosmetic, or info",
        },
        status: {
          type: "string",
          description: "open, noted, or included_in_report",
        },
        notes: { type: "string" },
        moisture_reading: { type: "string" },
        thermal_notes: { type: "string" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_inspection_reports",
    description:
      "List inspection reports (title, status, due date). Does not return share tokens.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_inspection_report",
    description:
      "Create an inspection report record. Do not read or speak share tokens.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        status: {
          type: "string",
          description: "draft, ready, sent, viewed, or downloaded",
        },
        agent_name: { type: "string" },
        seller_agent_name: { type: "string" },
        property_type: { type: "string" },
        property_size: { type: "string" },
        closing_on: { type: "string", description: "YYYY-MM-DD" },
        due_at: { type: "string", description: "YYYY-MM-DD" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_inspection_addons",
    description:
      "List specialty inspection add-ons (radon, mold, termite/WDO, sewer, pool).",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_inspection_addon",
    description: "Log a specialty add-on and specialist coordination for a job.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description: "radon, mold, termite_wdo, sewer, pool, or other",
        },
        status: {
          type: "string",
          description:
            "ordered, scheduled, in_progress, complete, or cancelled",
        },
        specialist_name: { type: "string" },
        result_summary: { type: "string" },
        due_on: { type: "string", description: "YYYY-MM-DD" },
        notes: { type: "string" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_rental_assets",
    description:
      "List rental fleet assets (name, category, location, status). Does not return card or ID numbers.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_rental_asset",
    description:
      "Add a rental fleet asset. Rates are hourly/daily/weekly. Do not store card numbers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        sku: { type: "string" },
        category: {
          type: "string",
          description:
            "excavator, loader, lift, generator, trailer, tool, or other",
        },
        location: {
          type: "string",
          description: "yard, out, in_transit, or in_repair",
        },
        status: {
          type: "string",
          description: "available, reserved, out, maintenance, or retired",
        },
        hourly_rate: { type: "number" },
        daily_rate: { type: "number" },
        weekly_rate: { type: "number" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "list_rental_reservations",
    description:
      "List rental holds and check-outs (dates, status, deposit amount). Does not return payment cards.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_rental_reservation",
    description:
      "Create a rental hold. Deposit is an amount only. Do not collect card or license numbers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        asset_name: { type: "string" },
        starts_on: { type: "string", description: "YYYY-MM-DD" },
        ends_on: { type: "string", description: "YYYY-MM-DD" },
        pickup_method: { type: "string", description: "pickup or delivery" },
        rate_type: { type: "string", description: "hourly, daily, or weekly" },
        rate_amount: { type: "number" },
        deposit_amount: { type: "number" },
        job_site_address: { type: "string" },
        status: {
          type: "string",
          description:
            "hold, reserved, checked_out, returned, cancelled, or overdue",
        },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "list_rental_maintenance",
    description: "List equipment service and repair records.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_rental_maintenance",
    description: "Log a service or repair for a rental asset.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        asset_name: { type: "string" },
        status: {
          type: "string",
          description: "scheduled, in_repair, or complete",
        },
        due_on: { type: "string", description: "YYYY-MM-DD" },
        hours_at_service: { type: "number" },
        cost: { type: "number" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "list_construction_change_orders",
    description:
      "List construction change orders (title, status, cost impact). Does not return payment cards.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_construction_change_order",
    description:
      "Log a change order. Extra work should wait until status is approved.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        status: {
          type: "string",
          description: "draft, sent, approved, or rejected",
        },
        cost_impact: { type: "number" },
        notes: { type: "string" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_construction_subs",
    description:
      "List subcontractors (name, trade, COI date). Does not return license numbers.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_construction_sub",
    description:
      "Add a subcontractor. Do not store license or policy numbers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        trade: {
          type: "string",
          description:
            "electrical, plumbing, hvac, concrete, framing, roofing, or other",
        },
        phone: { type: "string" },
        email: { type: "string" },
        coi_expires: { type: "string", description: "YYYY-MM-DD" },
        rate_notes: { type: "string" },
      },
    },
  },
  {
    name: "list_construction_phases",
    description: "List project phases (kind, status, delay cause).",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_construction_phase",
    description: "Add a construction phase on a job.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description:
            "demo, foundation, framing, rough_in, drywall, or finish",
        },
        status: {
          type: "string",
          description: "planned, in_progress, delayed, or complete",
        },
        delay_cause: {
          type: "string",
          description: "weather, permit, material, sub_no_show, or other",
        },
        percent_complete: { type: "number" },
        starts_on: { type: "string", description: "YYYY-MM-DD" },
        ends_on: { type: "string", description: "YYYY-MM-DD" },
        project_name: { type: "string" },
        sub_name: { type: "string" },
      },
    },
  },
  {
    name: "list_construction_daily_logs",
    description: "List daily job-site logs (date, weather, work completed).",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_construction_daily_log",
    description: "Log a daily job-site entry (not a payroll timesheet).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        logged_on: { type: "string", description: "YYYY-MM-DD" },
        weather: { type: "string" },
        crew_notes: { type: "string" },
        work_completed: { type: "string" },
        issues: { type: "string" },
        safety_notes: { type: "string" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_construction_draws",
    description:
      "List deposit/progress/retainage draws and lien waiver status. Does not return cards.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_construction_draw",
    description:
      "Log a draw. Deposit is an amount only. Do not collect card numbers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description: "deposit, progress, or retainage",
        },
        status: { type: "string", description: "draft, sent, or paid" },
        amount: { type: "number" },
        percent_complete: { type: "number" },
        due_on: { type: "string", description: "YYYY-MM-DD" },
        lien_waiver: {
          type: "string",
          description: "needed, received, or not_required",
        },
        project_name: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "list_shop_designs",
    description:
      "List shop drawings (title, version, status). Does not return CAD files.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_shop_design",
    description:
      "Log a shop drawing. Status is draft, sent, revision requested, or approved.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        status: {
          type: "string",
          description: "draft, sent, revision_requested, or approved",
        },
        version: { type: "number" },
        dimensions: { type: "string" },
        joinery_notes: { type: "string" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_shop_selections",
    description:
      "List wood, finish, and hardware selections and whether they are signed off.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_shop_selection",
    description: "Log a species, finish, or hardware selection with cost.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        kind: {
          type: "string",
          description: "species, finish, or hardware",
        },
        cost: { type: "number" },
        signed_off: { type: "boolean" },
        project_name: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "list_shop_queue",
    description:
      "List the shop fabrication queue (stage, fab step, craftsman).",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_shop_queue_item",
    description: "Add a piece to the shop queue.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        stage: {
          type: "string",
          description:
            "design_approved, material_in, in_fabrication, finishing, ready, install, or pickup",
        },
        fab_step: {
          type: "string",
          description: "cut, mill, assembly, sanding, or finishing",
        },
        craftsman_name: { type: "string" },
        install_on: { type: "string", description: "YYYY-MM-DD" },
        access_notes: { type: "string" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_steel_drawings",
    description:
      "List steel shop drawings (title, version, client status, PE stamp). Does not return CAD files.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_steel_drawing",
    description:
      "Log a shop drawing. Client status is draft, sent, revision requested, or approved. PE is needed, submitted, stamped, or not required.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        status: { type: "string" },
        pe_status: { type: "string" },
        version: { type: "number" },
        dimensions: { type: "string" },
        weld_notes: { type: "string" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_steel_specs",
    description:
      "List steel/aluminum specs (metal, finish, quote valid date, sign-off).",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_steel_spec",
    description: "Log a metal spec with cost and optional quote validity date.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        metal: {
          type: "string",
          description: "mild, stainless, aluminum, or other",
        },
        finish: {
          type: "string",
          description: "powder, galvanized, raw, or paint",
        },
        thickness: { type: "string" },
        cost: { type: "number" },
        quote_valid_until: { type: "string", description: "YYYY-MM-DD" },
        signed_off: { type: "boolean" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_steel_queue",
    description: "List the steel fab queue (stage, fab step, fabricator).",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_steel_queue_item",
    description: "Add a piece to the steel fab queue.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        stage: { type: "string" },
        fab_step: {
          type: "string",
          description: "cut, weld, assembly, or finishing",
        },
        fabricator_name: { type: "string" },
        install_on: { type: "string", description: "YYYY-MM-DD" },
        access_notes: { type: "string" },
        project_name: { type: "string" },
      },
    },
  },
  {
    name: "list_steel_weld_logs",
    description:
      "List weld logs (welder, type, visual result, NDT). Does not return cert numbers.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_steel_weld",
    description: "Log a weld: welder, type, joint, visual result, and NDT.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        welder_name: { type: "string" },
        weld_type: {
          type: "string",
          description: "tig, mig, stick, or other",
        },
        joint: { type: "string" },
        result: { type: "string", description: "pending, pass, or fail" },
        ndt_result: {
          type: "string",
          description: "none, pending, pass, or fail",
        },
        project_name: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "list_service_plans",
    description:
      "List recurring service plans (mow/maintain frequency, next visit, seasonal toggle).",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_bar_events",
    description:
      "List bartending events (date, venue, guests, package). Does not return IDs unless asked.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_bar_event",
    description:
      "Log a bartending event: date, venue, guest count, deposit/retainer (amount only, never card numbers), type, package, and consult kind.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        event_on: { type: "string", description: "YYYY-MM-DD" },
        event_date: {
          type: "string",
          description: "ISO datetime; sets event date and start if event_on is omitted",
        },
        venue_name: { type: "string" },
        venue_address: { type: "string" },
        guest_count: { type: "number" },
        deposit_paid: { type: "boolean" },
        retainer_amount: { type: "number" },
        event_type: { type: "string" },
        package_tier: { type: "string" },
        consult_kind: { type: "string" },
        contact_name: { type: "string" },
      },
    },
  },
  {
    name: "list_bar_menus",
    description: "List bar menus and package tiers.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_bar_menu",
    description: "Log a bar package/menu with setup style and cocktail notes.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        package_tier: { type: "string" },
        setup_style: { type: "string" },
        cocktails: { type: "string" },
        dietary_notes: { type: "string" },
      },
    },
  },
  {
    name: "list_bar_compliance",
    description: "List liquor licenses, permits, insurance, and TIPS certs.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_bar_compliance",
    description: "Log a license, permit, COI, venue requirement, or TIPS cert.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        kind: { type: "string" },
        holder_name: { type: "string" },
        expires_on: { type: "string", description: "YYYY-MM-DD" },
        status: { type: "string" },
      },
    },
  },
  {
    name: "list_bar_orders",
    description: "List alcohol and supply orders.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_bar_order",
    description: "Log a liquor-store or supply order.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        vendor_name: { type: "string" },
        kind: { type: "string" },
        status: { type: "string" },
        pickup_on: { type: "string", description: "YYYY-MM-DD" },
      },
    },
  },
  {
    name: "list_bar_crew",
    description: "List bartenders and barbacks (no cert numbers).",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_bar_crew",
    description: "Log a bartender or barback with optional TIPS expiry date.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        role: { type: "string" },
        tips_expires_on: { type: "string", description: "YYYY-MM-DD" },
        rating: { type: "number" },
      },
    },
  },
  {
    name: "list_bar_onsite",
    description: "List on-site setup photos, consumption notes, and incidents.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "log_bar_onsite",
    description: "Log a setup photo, consumption note, or incident.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        kind: { type: "string" },
        incident_kind: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "create_service_plan",
    description:
      "Create a recurring service plan for a customer in this workspace.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        contact_name: { type: "string" },
        frequency: {
          type: "string",
          description: "weekly, biweekly, monthly, or seasonal",
        },
        next_visit_on: { type: "string", description: "YYYY-MM-DD" },
        amount: { type: "number" },
        auto_invoice: { type: "boolean" },
      },
    },
  },
  ...BAR_LUNA_TOOLS,
];
