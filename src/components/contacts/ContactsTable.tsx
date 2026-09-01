"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Search, RefreshCw, Mail, Building, Loader2 } from "lucide-react";
import { ContactSheet } from "@/components/contacts/ContactSheet";
import {
  contactDisplayName,
  type Contact,
  type ContactType,
} from "@/types/database";

interface ContactsTableProps {
  workspaceId: string;
}

function typeBadge(type: ContactType) {
  if (type === "lead") {
    return (
      <Badge
        variant="secondary"
        className="border-blue-500/20 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
      >
        Lead
      </Badge>
    );
  }
  if (type === "organization") {
    return <Badge>Organization</Badge>;
  }
  return (
    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
      Person
    </Badge>
  );
}

export function ContactsTable({ workspaceId }: ContactsTableProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchContacts = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/contacts?workspaceId=${encodeURIComponent(workspaceId)}`
      );
      if (!res.ok) throw new Error("Failed to load contacts");
      const data = await res.json();
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (err) {
      console.error("Contacts fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const name = contactDisplayName(c).toLowerCase();
      const company = (c.organization_name ?? "").toLowerCase();
      const email = (c.email ?? "").toLowerCase();
      return name.includes(q) || company.includes(q) || email.includes(q);
    });
  }, [contacts, searchQuery]);

  return (
    <>
      <Card className="border-border/40">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-xl font-bold">Contacts &amp; Leads</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              People, organizations, and leads in this workspace.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchContacts()}
              className="h-8"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Sync
            </Button>
            <Button size="sm" className="h-8" onClick={() => setSheetOpen(true)}>
              <UserPlus className="mr-1 h-3.5 w-3.5" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts, emails, or companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-xs text-muted-foreground">
              No contacts found in this workspace. Ask Luna to add a contact or
              create one above.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border/40">
              <Table>
                <TableHeader className="bg-muted/30 text-xs">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filteredContacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <TableCell className="font-semibold text-foreground">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="hover:underline"
                        >
                          {contactDisplayName(contact)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground">
                          <Building className="mr-1.5 h-3 w-3 opacity-70" />
                          {contact.organization_name || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground">
                          <Mail className="mr-1.5 h-3 w-3 opacity-70" />
                          {contact.email || "—"}
                        </div>
                      </TableCell>
                      <TableCell>{typeBadge(contact.type)}</TableCell>
                      <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ContactSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        workspaceId={workspaceId}
        onSaved={() => void fetchContacts()}
      />
    </>
  );
}
