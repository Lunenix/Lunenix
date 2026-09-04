import type { FunctionDeclaration } from "@google/genai";

export const CHEF_LUNA_TOOLS: FunctionDeclaration[] = [
  {
    name: "chef_log_visit",
    description:
      "Log a private chef visit or dinner: date, household size, service type, grocery cost and chef fee (never card numbers). Identify the client by name.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        title: { type: "string" },
        event_date: { type: "string" },
        household_size: { type: "number" },
        service_type: { type: "string" },
        grocery_cost: { type: "number" },
        chef_fee: { type: "number" },
      },
      required: ["household_size"],
    },
  },
  {
    name: "list_chef_visits",
    description:
      "List chef visits (date, household size, status). No IDs unless asked.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
];
