import type { FunctionDeclaration } from "@google/genai";

export const BRIDAL_LUNA_TOOLS: FunctionDeclaration[] = [
  {
    name: "bridal_log_item",
    description:
      "Log a tagged bridal item: tag code, style, size, designer, rack/section/hanger location, and floor status. Never collect card numbers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        tag_code: { type: "string" },
        kind: { type: "string" },
        style_name: { type: "string" },
        size: { type: "string" },
        color: { type: "string" },
        designer: { type: "string" },
        price: { type: "number" },
        rack: { type: "string" },
        section: { type: "string" },
        hanger: { type: "string" },
        status: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_bridal_items",
    description:
      "Find tagged inventory by style, size, designer, or tag. Returns location labels like Rack 4, Section B, hanger 12. No IDs unless asked. This is not a live 3D map.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        style_name: { type: "string" },
        size: { type: "string" },
        designer: { type: "string" },
        tag_code: { type: "string" },
      },
    },
  },
];
