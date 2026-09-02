"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContactSheet } from "@/components/contacts/ContactSheet";
import { contactDisplayName, type Contact, type CustomerEquipment, type Lead } from "@/types/database";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: c } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .maybeSingle();
    setContact(c as Contact | null);

    const { data: l } = await supabase
      .from("leads")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });
    setLeads((l as Lead[]) ?? []);
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/contacts/${contactId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      router.push("/contacts");
      router.refresh();
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <p className="text-muted-foreground">Contact not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/contacts">Back to contacts</Link>
        </Button>
      </div>
    );
  }

  const details: { label: string; value: string | null }[] = [
    { label: "Email", value: contact.email },
    { label: "Phone", value: contact.phone },
    { label: "Organization", value: contact.organization_name },
    { label: "Address", value: contact.address },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/contacts">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {contactDisplayName(contact)}
            </h1>
            <Badge variant="secondary" className="mt-1">
              {contact.type}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {details.map((d) => (
              <div key={d.label} className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="text-right font-medium">{d.value || "—"}</span>
              </div>
            ))}
            {contact.tags && contact.tags.length > 0 && (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Tags</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {contact.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {contact.notes || "No notes."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipment on file</CardTitle>
        </CardHeader>
        <CardContent>
          <EquipmentPanel contactId={contact.id} workspaceId={contact.workspace_id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked deals</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No deals linked to this contact yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Expected close</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.title}</TableCell>
                    <TableCell>
                      {l.value != null
                        ? `$${Number(l.value).toLocaleString()}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.expected_close_date
                        ? new Date(l.expected_close_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ContactSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceId={contact.workspace_id}
        contact={contact}
        onSaved={() => load()}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete contact?</DialogTitle>
            <DialogDescription>
              This will permanently delete {contactDisplayName(contact)}. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
