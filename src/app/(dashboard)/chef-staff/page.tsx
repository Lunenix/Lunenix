"use client";

import { ChefOpsPage } from "@/components/chef/ChefOpsPage";

export default function ChefStaffPage() {
  return (
    <ChefOpsPage
      title="Chefs"
      description="Availability notes, food handler / ServSafe text, and client ratings. Not a live roster."
      kind="crew"
      wrap="crew"
      fields={[
        { key: "name", label: "Name", kind: "text", required: true },
        { key: "cert", label: "Cert (ServSafe, food handler)", kind: "text" },
        { key: "rating", label: "Rating", kind: "number" },
        { key: "notes", label: "Availability / notes", kind: "textarea", list: false },
      ]}
    />
  );
}
