/**
 * System default email templates.
 *
 * These are seeded per workspace and used by automation workflow triggers.
 * They are editable by the user but cannot be deleted (enforced in the API and
 * a DB trigger). Each is identified by a stable `template_key`.
 */

export interface SystemTemplateDef {
  template_key: string;
  name: string;
  subject: string;
  body: string; // HTML with smart-field tokens
}

export const SYSTEM_TEMPLATE_KEYS = [
  "invoice_sent",
  "contract_completed",
  "appointment_rescheduled",
  "appointment_cancelled",
  "form_reminder",
  "payment_failed",
] as const;

export type SystemTemplateKey = (typeof SYSTEM_TEMPLATE_KEYS)[number];

export const SYSTEM_TEMPLATES: SystemTemplateDef[] = [
  {
    template_key: "invoice_sent",
    name: "Invoice Sent",
    subject: "Your invoice {{invoice.number}} from {{workspace.name}}",
    body:
      "<p>Hi {{client.first_name}},</p>" +
      "<p>Please find your invoice <strong>{{invoice.number}}</strong> for a total of {{invoice.total}}. It is due on {{invoice.due_date}}.</p>" +
      "<p>{{invoice.link|View Invoice}}</p>" +
      "<p>Thank you,<br>{{workspace.name}}</p>",
  },
  {
    template_key: "contract_completed",
    name: "Contract Completed",
    subject: "Your contract with {{workspace.name}} is complete",
    body:
      "<p>Hi {{client.first_name}},</p>" +
      "<p>Great news — your contract <strong>{{contract.name}}</strong> has been fully signed and completed.</p>" +
      "<p>{{contract.link|View Contract}}</p>" +
      "<p>We look forward to working with you.</p>" +
      "<p>Best,<br>{{workspace.name}}</p>",
  },
  {
    template_key: "appointment_rescheduled",
    name: "Appointment Rescheduled",
    subject: "Your appointment has been rescheduled",
    body:
      "<p>Hi {{client.first_name}},</p>" +
      "<p>Your appointment has been rescheduled. Please pick a new time that works for you.</p>" +
      "<p>{{scheduler.link|Book a Time}}</p>" +
      "<p>Thanks,<br>{{workspace.name}}</p>",
  },
  {
    template_key: "appointment_cancelled",
    name: "Appointment Cancelled",
    subject: "Your appointment has been cancelled",
    body:
      "<p>Hi {{client.first_name}},</p>" +
      "<p>We're writing to let you know your appointment has been cancelled. If you'd like to reschedule, you can book a new time below.</p>" +
      "<p>{{scheduler.link|Book a Time}}</p>" +
      "<p>Sorry for any inconvenience,<br>{{workspace.name}}</p>",
  },
  {
    template_key: "form_reminder",
    name: "Form Reminder",
    subject: "Reminder: please complete your form",
    body:
      "<p>Hi {{client.first_name}},</p>" +
      "<p>Just a friendly reminder to complete the form we sent over. It only takes a few minutes.</p>" +
      "<p>{{form.link|Open Form}}</p>" +
      "<p>Thank you,<br>{{workspace.name}}</p>",
  },
  {
    template_key: "payment_failed",
    name: "Payment Failed",
    subject: "Action needed: your payment didn't go through",
    body:
      "<p>Hi {{client.first_name}},</p>" +
      "<p>Unfortunately, the payment for invoice <strong>{{invoice.number}}</strong> ({{invoice.total}}) didn't go through. Please try again using the link below.</p>" +
      "<p>{{invoice.link|Pay Invoice}}</p>" +
      "<p>Thank you,<br>{{workspace.name}}</p>",
  },
];
