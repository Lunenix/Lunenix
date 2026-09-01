"use client";

import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { Loader2 } from "lucide-react";

export default function ContactsPage() {
  const { activeWorkspace, isLoading: wsLoading } = useWorkspace();

  if (wsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <p className="text-muted-foreground">
          Create or select a workspace to manage contacts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ContactsTable workspaceId={activeWorkspace.id} />
    </div>
  );
}
