"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";
import {
  PHOTO_GALLERY_STATUS_LABELS,
  PHOTO_GALLERY_STATUSES,
} from "@/lib/photoService";

function opts(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] ?? value }));
}

export default function GalleriesPage() {
  return (
    <PhotoOpsPage
      title="Galleries"
      description="Delivery URL, expiry date, and sent/expired status. This is not a hosted gallery (Pixieset, ShootProof)."
      kind="galleries"
      wrap="rows"
      fields={[
        { key: "title", label: "Gallery / client", kind: "text", required: true },
        { key: "gallery_url", label: "Gallery URL", kind: "text" },
        { key: "expires_on", label: "Expires", kind: "date" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(PHOTO_GALLERY_STATUSES, PHOTO_GALLERY_STATUS_LABELS),
        },
        { key: "notes", label: "Password / notes", kind: "textarea", list: false },
      ]}
    />
  );
}
