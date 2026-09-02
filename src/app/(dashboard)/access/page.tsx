"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACCESS_ENTRY_METHODS,
  ACCESS_ENTRY_METHOD_LABELS,
  type AccessEntryMethod,
} from "@/lib/fieldService";
import {
  contactDisplayName,
  type Contact,
  type PropertyAccess,
} from "@/types/database";
import { Loader2 } from "lucide-react";

export default function AccessPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<PropertyAccess[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState("");
  const [method, setMethod] = useState<AccessEntryMethod>("occupant");
  const [code, setCode] = useState("");
  const [pets, setPets] = useState("");
  const [kids, setKids] = useState("");
  const [sensitive, setSensitive] = useState("");
  const [special, setSpecial] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [a, c] = await Promise.all([
      fetch(`/api/property-access?workspaceId=${id}`),
      fetch(`/api/contacts?workspaceId=${id}`),
    ]);
    const aj = await a.json();
    const cj = await c.json();
    if (a.ok) setRows(aj.notes ?? []);
    if (c.ok) setContacts(cj.contacts ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !contactId) return;
    setSaving(true);
    await fetch("/api/property-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        contact_id: contactId,
        entry_method: method,
        entry_code: code.trim() || null,
        pets_notes: pets.trim() || null,
        child_safety: kids.trim() || null,
        chemical_sensitive: sensitive.trim() || null,
        special_instructions: special.trim() || null,
      }),
    });
    setSaving(false);
    setCode("");
    setPets("");
    setKids("");
    setSensitive("");
    setSpecial("");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Access &amp; safety</h1>
        <p className="text-muted-foreground">
          Gate/lockbox codes stay on this page for the office. Do not paste
          codes into Luna chat. Record pets, kids, aquariums, gardens, and
          allergy notes so techs treat safely.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger>
            <SelectValue placeholder="Customer" />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {contactDisplayName(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={method}
          onValueChange={(v) => setMethod(v as AccessEntryMethod)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCESS_ENTRY_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {ACCESS_ENTRY_METHOD_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Entry code (office only)"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
        />
        <Input
          placeholder="Pets / aquariums"
          value={pets}
          onChange={(e) => setPets(e.target.value)}
        />
        <Input
          placeholder="Kids / chemical-sensitive areas"
          value={kids}
          onChange={(e) => setKids(e.target.value)}
        />
        <Input
          placeholder="Gardens / sensitive plants"
          value={sensitive}
          onChange={(e) => setSensitive(e.target.value)}
        />
        <Input
          placeholder="Special (hive location, allergies)"
          value={special}
          onChange={(e) => setSpecial(e.target.value)}
        />
        <Button onClick={add} disabled={saving || !contactId}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save notes"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Entry</TableHead>
            <TableHead>Safety</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                {r.contact ? contactDisplayName(r.contact as Contact) : "—"}
              </TableCell>
              <TableCell className="text-sm">
                {ACCESS_ENTRY_METHOD_LABELS[r.entry_method as AccessEntryMethod] ??
                  r.entry_method}
                {r.has_entry_code ? " · code on file" : ""}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {[r.pets_notes, r.child_safety, r.chemical_sensitive, r.special_instructions]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
