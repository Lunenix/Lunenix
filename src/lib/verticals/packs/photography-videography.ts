import { PHOTO_LUNA_TOOLS } from "@/lib/verticals/photo/tools";

/**
 * Photography & Videography Luna pack. Key is `workspaces.industry_preset`
 * (`photography_videography`), not a parallel industry_category column.
 * Execute lives in `../photo/luna.ts` and writes photo_* tables — not
 * contacts.metadata.
 */
export const photographyVideographyPack = {
  key: "photography_videography",
  name: "Photography & Videography",
  tools: PHOTO_LUNA_TOOLS,
} as const;
