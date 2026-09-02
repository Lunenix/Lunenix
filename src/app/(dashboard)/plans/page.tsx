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
  SERVICE_PLAN_FREQUENCIES,
  SERVICE_PLAN_FREQUENCY_LABELS,
  type ServicePlanFrequency,
} from "@/lib/fieldService";
import { formatCurrency } from "@/lib/format";
import {
  contactDisplayName,
  type Contact,
  type ServicePlan,
} from "@/types/database";
import { Loader2 } from "lucide-react";

export default function RecurringPlansPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<ServicePlan[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [frequency, setFrequency] =
    useState<ServicePlanFrequency>("weekly");
  const [nextVisit, setNextVisit] = useState("");
  const [amount, setAmount] = useState("");
  const [autoInvoice, setAutoInvoice] = useState(false);
  const [seasonalOn, setSeasonalOn] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [p, c] = await Promise.all([
      fetch(`/api/service-plans?workspaceId=${id}`),
      fetch(`/api/contacts?workspaceId=${id}`),
    ]);
    const pj = await p.json();
    const cj = await c.json();
    if (p.ok) setRows(pj.plans ?? []);
    if (c.ok) setContacts(cj.contacts ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !name.trim() || !contactId || !nextVisit) return;
    setSaving(true);
    await fetch("/api/service-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        contact_id: contactId,
        frequency,
        next_visit_on: nextVisit,
        amount: Number(amount) || 0,
        auto_invoice: autoInvoice,
        seasonal_on: seasonalOn,
      }),
    });
    setSaving(false);
    setName("");
    setContactId("");
    setNextVisit("");
    setAmount("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/service-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recurring plans</h1>
        <p className="text-muted-foreground">
          Set visit frequency (including quarterly), skip until a date, and a
          seasonal toggle (mosquito/termite/rodent season). Due visits create a
          task (and a draft invoice if auto-bill is on). Two-way texting is not
          live — confirm by email.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Plan name (e.g. Weekly mow)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          value={frequency}
          onValueChange={(v) => setFrequency(v as ServicePlanFrequency)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SERVICE_PLAN_FREQUENCIES.map((f) => (
              <SelectItem key={f} value={f}>
                {SERVICE_PLAN_FREQUENCY_LABELS[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={nextVisit}
          onChange={(e) => setNextVisit(e.target.value)}
        />
        <Input
          placeholder="Visit amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoInvoice}
            onChange={(e) => setAutoInvoice(e.target.checked)}
          />
          Auto-draft invoice
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={seasonalOn}
            onChange={(e) => setSeasonalOn(e.target.checked)}
          />
          Seasonal on
        </label>
        <Button onClick={add} disabled={saving || !name.trim() || !contactId || !nextVisit}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add plan
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plan</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Next visit</TableHead>
            <TableHead>Skip until</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                No recurring plans yet. Add weekly or seasonal service after a
                contract is signed.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>
                {r.contact ? contactDisplayName(r.contact as Contact) : "—"}
              </TableCell>
              <TableCell>
                {SERVICE_PLAN_FREQUENCY_LABELS[r.frequency] ?? r.frequency}
              </TableCell>
              <TableCell>
                {r.next_visit_on
                  ? new Date(r.next_visit_on).toLocaleDateString()
                  : "—"}
              </TableCell>
              <TableCell>
                <Input
                  type="date"
                  className="h-8 w-36"
                  defaultValue={r.skip_until ?? ""}
                  key={`${r.id}-skip-${r.skip_until ?? "x"}`}
                  title="Pause visit generation until this date"
                  onBlur={(e) =>
                    patch(r.id, { skip_until: e.target.value || null })
                  }
                />
              </TableCell>
              <TableCell>{formatCurrency(Number(r.amount))}</TableCell>
              <TableCell className="space-x-2 text-sm">
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={r.is_active}
                    onChange={(e) =>
                      patch(r.id, { is_active: e.target.checked })
                    }
                  />
                  Active
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={r.seasonal_on}
                    onChange={(e) =>
                      patch(r.id, { seasonal_on: e.target.checked })
                    }
                  />
                  In season
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={r.auto_invoice}
                    onChange={(e) =>
                      patch(r.id, { auto_invoice: e.target.checked })
                    }
                  />
                  Auto-bill
                </label>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
