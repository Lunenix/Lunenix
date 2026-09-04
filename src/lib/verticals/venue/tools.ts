import type { FunctionDeclaration } from "@google/genai";

export const VENUE_LUNA_TOOLS: FunctionDeclaration[] = [
  {
    name: "venue_log_booking",
    description:
      "Log a venue booking: date, room/space, guests, rental package, deposit amount (never card numbers). Identify the client by name.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        title: { type: "string" },
        event_date: { type: "string" },
        space_name: { type: "string" },
        guest_count: { type: "number" },
        event_type: { type: "string" },
        rental_tier: { type: "string" },
        deposit_paid: { type: "boolean" },
        retainer_amount: { type: "number" },
      },
      required: ["guest_count"],
    },
  },
  {
    name: "list_venue_bookings",
    description:
      "List venue bookings (date, space, guests, package, held/booked). No IDs unless asked.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
];
