import type { FunctionDeclaration } from "@google/genai";

export const CATERING_LUNA_TOOLS: FunctionDeclaration[] = [
  {
    name: "catering_log_event",
    description:
      "Log a catering job: date, venue, guests, service style, dietary notes, deposit amount (never card numbers). Identify the client by name.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        title: { type: "string" },
        event_date: { type: "string" },
        venue_name: { type: "string" },
        guest_count: { type: "number" },
        event_type: { type: "string" },
        service_style: { type: "string" },
        dietary_notes: { type: "string" },
        deposit_paid: { type: "boolean" },
        retainer_amount: { type: "number" },
      },
      required: ["guest_count"],
    },
  },
  {
    name: "list_catering_events",
    description:
      "List catering events (date, venue, guests, service style). No IDs unless asked.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
];
