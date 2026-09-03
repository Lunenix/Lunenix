import type { FunctionDeclaration } from "@google/genai";

/** Bar pack Luna tools. Wired through LUNA_CRM_TOOLS + executeLunaTool. */
export const BAR_LUNA_TOOLS: FunctionDeclaration[] = [
  {
    name: "bartending_log_event_specs",
    description:
      "Log beverage package, guest count, event date, liquor permit need, and signature drinks for a bartending client. Identify the client by name. Do not store card numbers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contact_name: {
          type: "string",
          description: "Client display name in this workspace",
        },
        contact_id: {
          type: "string",
          description: "Optional contact UUID in this workspace",
        },
        guest_count: { type: "number", description: "Estimated guest count" },
        event_date: {
          type: "string",
          description: "ISO date or datetime for the event",
        },
        bar_package: {
          type: "string",
          description:
            "Package: beer_wine, full_open, signature, mocktail, custom, or a label like Full Open Bar",
        },
        licensing_required: {
          type: "boolean",
          description: "Whether a local event liquor permit is still needed",
        },
        cocktail_list: {
          type: "array",
          items: { type: "string" },
          description: "Signature drinks",
        },
      },
      required: ["guest_count", "bar_package"],
    },
  },
];
