import { BAR_LUNA_TOOLS } from "@/lib/verticals/bar/tools";

/**
 * Mobile Bartending Luna pack. Key is `workspaces.industry_preset`, not a
 * parallel industry_category column. execute lives in `../bar/luna.ts`.
 */
export const mobileBartendingPack = {
  key: "mobile_bartending",
  name: "Mobile Bartending Services",
  tools: BAR_LUNA_TOOLS,
} as const;
