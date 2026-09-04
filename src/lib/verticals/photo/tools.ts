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
    name: "photo_log_session_specs",
    description:
      "Log session coverage, shot-list must-haves, style notes, second shooter, and usage rights onto photo tables (not contact metadata). Identify the client by name. Never collect card numbers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        contact_id: { type: "string" },
        title: { type: "string" },
        session_type: { type: "string" },
        coverage_hours: { type: "number" },
        second_shooter_required: { type: "boolean" },
        shot_list: {
          type: "array",
          items: { type: "string" },
        },
        style_notes: { type: "string" },
        usage_rights: { type: "string" },
        venue_name: { type: "string" },
      },
      required: ["session_type", "coverage_hours"],
    },
  },
  {
    name: "photo_update_post_production",
    description:
      "Update the editing queue and optional gallery URL for a client. Writes photo_edits and photo_galleries, not contact metadata. Never collect card numbers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        contact_id: { type: "string" },
        culling_status: { type: "string" },
        editing_stage: { type: "string" },
        gallery_url: { type: "string" },
        turnaround_deadline: { type: "string" },
      },
      required: ["editing_stage"],
    },
  },
  {
    name: "list_photo_shoots",
    description:
      "List photo/video shoots (date, type, coverage, status). No IDs unless asked.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
];
