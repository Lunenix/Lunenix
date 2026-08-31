"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Contact, ContactType } from "@/types/database";

interface ContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  contact?: Contact | null;
  onSaved?: (contact: Contact) => void;
}

export function ContactSheet({
  open,
  onOpenChange,
  workspaceId,
  contact,
  onSaved,
}: ContactSheetProps) {
  const router = useRouter();
  const isEdit = Boolean(contact);

  const [type, setType] = useState<ContactType>("person");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType((contact?.type as ContactType) ?? "person");
      setFirstName(contact?.first_name ?? "");
      setLastName(contact?.last_name ?? "");
      setOrganizationName(contact?.organization_name ?? "");
      setEmail(contact?.email ?? "");
      setPhone(contact?.phone ?? "");
      setAddress(contact?.address ?? "");
      setNotes(contact?.notes ?? "");
      setTags((contact?.tags ?? []).join(", "));
      setError(null);
    }
  }, [open, contact]);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const payload = {
      workspace_id: workspaceId,
      type,
      first_name: firstName || null,
      last_name: lastName || null,
      organization_name: organizationName || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      notes: notes || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      const res = await fetch(
        isEdit ? `/api/contacts/${contact!.id}` : "/api/contacts",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save contact");
      }
      onSaved?.(json.contact);
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit contact" : "Add contact"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this contact's details."
              : "Create a new contact in this workspace."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ContactType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="person">Person</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "organization" ? (
            <div className="space-y-2">
              <Label htmlFor="org">Organization name</Label>
              <Input
                id="org"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input
                  id="first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input
                  id="last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
          )}

          {type !== "organization" && (
            <div className="space-y-2">
              <Label htmlFor="org2">Organization (optional)</Label>
              <Input
                id="org2"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Company"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="vip, sponsor, 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering…"
              rows={4}
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create contact"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
