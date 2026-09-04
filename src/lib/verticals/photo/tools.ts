import type { FunctionDeclaration } from "@google/genai";

export const PHOTO_LUNA_TOOLS: FunctionDeclaration[] = [
  {
    name: "photo_log_shoot",
    description:
      "Log a photography or videography shoot: date, venue, shoot type, coverage, hours (never card numbers). Identify the client by name.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        title: { type: "string" },
        event_date: { type: "string" },
        venue_name: { type: "string" },
        shoot_type: { type: "string" },
        coverage: { type: "string" },
        hours: { type: "number" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_photo_shoots",
    description:
      "List photo/video shoots (date, type, coverage, status). No IDs unless asked.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
];
