"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContactSheet } from "@/components/contacts/ContactSheet";
import { contactDisplayName, type Contact } from "@/types/database";
import { Loader2, Plus, Users } from "lucide-react";

const typeVariant: Record<string, "default" | "secondary" | "outline"> = {
  person: "secondary",
  organization: "default",
  lead: "outline",
};

export default function ContactsPage() {
  const { activeWorkspace, isLoading: wsLoading } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const res = await fetch(`/api/contacts?workspaceId=${activeWorkspace.id}`);
    const json = await res.json();
    if (res.ok) setContacts(json.contacts ?? []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            People and organizations in {activeWorkspace.name}
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No contacts yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Add your first contact to get started.
          </p>
          <Button onClick={() => setSheetOpen(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/contacts/${c.id}`} className="hover:underline">
                      {contactDisplayName(c)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={typeVariant[c.type] ?? "secondary"}>
                      {c.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.phone || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(c.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ContactSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        workspaceId={activeWorkspace.id}
        onSaved={() => load()}
      />
    </div>
  );
}
