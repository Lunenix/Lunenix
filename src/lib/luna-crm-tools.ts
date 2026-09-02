import type { FunctionDeclaration } from "@google/genai";

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
];
