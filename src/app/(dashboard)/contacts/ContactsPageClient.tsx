"use client";

import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { Loader2 } from "lucide-react";

export function ContactsPageClient() {
  const { activeWorkspace, isLoading } = useWorkspace();

  if (isLoading) {
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

  return <ContactsTable workspaceId={activeWorkspace.id} />;
}
