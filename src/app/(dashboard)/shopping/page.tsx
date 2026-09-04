"use client";

import { ChefOpsPage } from "@/components/chef/ChefOpsPage";

export default function ShoppingPage() {
  return (
    <ChefOpsPage
      title="Shopping"
      description="Typed list from the approved menu, preferred vendors, receipt notes for cost-plus billing. OCR is not auto-filled."
      kind="shopping"
      wrap="rows"
      fields={[
        { key: "title", label: "Visit / list", kind: "text", required: true },
        { key: "vendor_name", label: "Vendor (butcher, market)", kind: "text" },
        { key: "list_text", label: "Shopping list", kind: "textarea" },
        { key: "receipt_notes", label: "Receipt notes", kind: "textarea" },
        { key: "notes", label: "Notes", kind: "textarea", list: false },
      ]}
    />
  );
}
