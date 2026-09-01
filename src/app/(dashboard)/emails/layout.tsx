import type { ReactNode } from "react";
import { EmailsSubnav } from "@/components/emails/EmailsSubnav";

export default function EmailsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Emails</h1>
        <p className="text-muted-foreground">
          Sent mail and reusable templates for this workspace
        </p>
      </div>
      <EmailsSubnav />
      {children}
    </div>
  );
}
