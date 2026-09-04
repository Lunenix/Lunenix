"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ESTIMATE_STATUS_LABELS,
  defaultEstimateJobType,
} from "@/lib/fieldService";
import { formatCurrency } from "@/lib/format";
import {
  contactDisplayName,
  type Contact,
  type Estimate,
} from "@/types/database";
import { SendTextDialog } from "@/components/texts/SendTextDialog";
import { Loader2, MessageSquare, Plus } from "lucide-react";

export default function EstimatesPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<Estimate[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [jobType, setJobType] = useState("");
  const [visitAt, setVisitAt] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [textEstimate, setTextEstimate] = useState<Estimate | null>(null);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const [eRes, cRes] = await Promise.all([
      fetch(`/api/estimates?workspaceId=${activeWorkspace.id}`),
      fetch(`/api/contacts?workspaceId=${activeWorkspace.id}`),
    ]);
    const eJson = await eRes.json();
    const cJson = await cRes.json();
    if (eRes.ok) setRows(eJson.estimates ?? []);
    if (cRes.ok) setContacts(cJson.contacts ?? []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  useEffect(() => {
    if (!activeWorkspace) return;
    setJobType(
      defaultEstimateJobType(
        activeWorkspace.industry_preset,
        activeWorkspace.industry_custom_label
      )
    );
  }, [activeWorkspace]);

  async function createEstimate() {
    if (!activeWorkspace || !title.trim() || !contactId) return;
    setSaving(true);
    const contact = contacts.find((c) => c.id === contactId);
    let visitTaskId: string | null = null;
    if (visitAt) {
      const tRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          title: `Estimate visit: ${title.trim()}`,
          contact_id: contactId,
          due_date: visitAt.slice(0, 10),
          priority: "high",
          description: address || contact?.address || "",
          reminder_minutes_before: 1440,
        }),
      });
      const tJson = await tRes.json();
      if (tRes.ok) visitTaskId = tJson.task?.id ?? null;
    }
    const res = await fetch("/api/estimates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        contact_id: contactId,
        title: title.trim(),
        job_type: jobType.trim() || null,
        address: address || contact?.address || null,
        visit_at: visitAt || null,
        visit_task_id: visitTaskId,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      setTitle("");
      setContactId("");
      setVisitAt("");
      setAddress("");
      load();
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Estimates</h1>
          <p className="text-muted-foreground">
            Schedule the visit, add inspection/drone photos, email the
            estimate, then approve to open a job.
          </p>
        </div>
        <Button
          onClick={() => {
            if (activeWorkspace) {
              setJobType(
                defaultEstimateJobType(
                  activeWorkspace.industry_preset,
                  activeWorkspace.industry_custom_label
                )
              );
            }
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New estimate
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Visit</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total</TableHead>
            <TableHead className="text-right"> </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <Link className="font-medium underline" href={`/estimates/${e.id}`}>
                  {e.title}
                </Link>
              </TableCell>
              <TableCell>
                {e.contact ? contactDisplayName(e.contact) : "—"}
              </TableCell>
              <TableCell>
                {e.visit_at ? new Date(e.visit_at).toLocaleString() : "—"}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {ESTIMATE_STATUS_LABELS[e.status] ?? e.status}
                </Badge>
              </TableCell>
              <TableCell>{formatCurrency(Number(e.total))}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!e.contact_id}
                  onClick={() => setTextEstimate(e)}
                >
                  <MessageSquare className="mr-1 h-3.5 w-3.5" />
                  Text
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {activeWorkspace ? (
        <SendTextDialog
          open={Boolean(textEstimate)}
          onOpenChange={(open) => {
            if (!open) setTextEstimate(null);
          }}
          workspaceId={activeWorkspace.id}
          contactId={textEstimate?.contact_id}
          contactLabel={
            textEstimate?.contact
              ? contactDisplayName(textEstimate.contact)
              : null
          }
          defaultBody={
            textEstimate
              ? `Hi${
                  textEstimate.contact
                    ? ` ${contactDisplayName(textEstimate.contact)}`
                    : ""
                }, your estimate "${textEstimate.title}" is ready. Total ${formatCurrency(Number(textEstimate.total))}.`
              : undefined
          }
        />
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule estimate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Customer</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {contactDisplayName(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Job type</Label>
              <Input
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                placeholder="Matches this workspace’s trade"
              />
            </div>
            <div className="space-y-1">
              <Label>Visit date & time</Label>
              <Input
                type="datetime-local"
                value={visitAt}
                onChange={(e) => setVisitAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Job address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Used on the calendar task"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createEstimate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
