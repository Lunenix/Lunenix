"use client";

import { PhotoOpsPage } from "@/components/photo/PhotoOpsPage";
import {
  PHOTO_DELIVERY_METHOD_LABELS,
  PHOTO_DELIVERY_METHODS,
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
      description="Proofing URL, client favorites, delivery method, and expiry. This is not a hosted gallery (Pixieset, ShootProof) or live selection tool."
      kind="galleries"
      wrap="rows"
      fields={[
        { key: "title", label: "Gallery / client", kind: "text", required: true },
        { key: "gallery_url", label: "Gallery / download URL", kind: "text" },
        {
          key: "delivery_method",
          label: "Delivery",
          kind: "select",
          options: opts(PHOTO_DELIVERY_METHODS, PHOTO_DELIVERY_METHOD_LABELS),
        },
        { key: "favorites", label: "Client favorites / selects", kind: "textarea" },
        { key: "expires_on", label: "Expires", kind: "date" },
        {
          key: "status",
          label: "Status",
          kind: "select",
          options: opts(PHOTO_GALLERY_STATUSES, PHOTO_GALLERY_STATUS_LABELS),
        },
        { key: "notes", label: "Password / print release notes", kind: "textarea", list: false },
      ]}
    />
  );
}
