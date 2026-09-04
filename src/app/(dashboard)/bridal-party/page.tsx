"use client";

import { BridalOpsPage } from "@/components/bridal/BridalOpsPage";

export default function BridalPartyPage() {
  return (
    <BridalOpsPage
      title="Bridal party"
      description="Bridesmaid and MOB looks linked to the same wedding. Track dress notes and inventory tags separately from the bride's gown."
      kind="party"
      wrap="rows"
      fields={[
        { key: "title", label: "Name / wedding", kind: "text", required: true },
        { key: "role", label: "Role (bridesmaid, MOB)", kind: "text" },
        { key: "dress_notes", label: "Dress notes", kind: "textarea" },
        { key: "tag_code", label: "Inventory tag", kind: "text" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
