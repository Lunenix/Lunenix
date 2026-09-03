import type { FunctionDeclaration } from "@google/genai";

export const PLANNER_LUNA_TOOLS: FunctionDeclaration[] = [
  {
    name: "planner_log_event_specs",
    description:
      "Log an event planning job: date, venue, guests, planning tier, budget range, and deposit amount (never card numbers). Identify the client by name.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        title: { type: "string" },
        event_date: { type: "string" },
        venue_name: { type: "string" },
        venue_address: { type: "string" },
        guest_count: { type: "number" },
        event_type: { type: "string" },
        planning_tier: { type: "string" },
        budget_range: { type: "string" },
        deposit_paid: { type: "boolean" },
        retainer_amount: { type: "number" },
      },
      required: ["guest_count"],
    },
  },
  {
    name: "list_planner_events",
    description: "List planned events (date, venue, guests, tier). No IDs unless asked.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
];
