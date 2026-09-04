"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SCHEDULE_STATUSES,
  SCHEDULE_STATUS_LABELS,
} from "@/lib/hubSchedule";
import { toast } from "@/lib/toast";
import {
  contactDisplayName,
  type Contact,
  type ScheduleEvent,
} from "@/types/database";
import { SendTextDialog } from "@/components/texts/SendTextDialog";
import { Loader2, MessageSquare } from "lucide-react";

export default function SchedulePage() {
  const { activeWorkspace, isLoading: wsLoading } = useWorkspace();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState("60");
  const [location, setLocation] = useState("");
  const [contactId, setContactId] = useState("");
  const [notes, setNotes] = useState("");
  const [textEvent, setTextEvent] = useState<ScheduleEvent | null>(null);
  const [textPickerOpen, setTextPickerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const id = activeWorkspace.id;
    const [e, c] = await Promise.all([
      fetch(`/api/schedule?workspaceId=${id}`),
      fetch(`/api/contacts?workspaceId=${id}`),
    ]);
    const ej = await e.json().catch(() => ({}));
    const cj = await c.json().catch(() => ({}));
    if (e.ok) setEvents(ej.events ?? []);
    if (c.ok) setContacts(cj.contacts ?? []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function addBooking() {
    if (!activeWorkspace || !title.trim() || !startsAt) return;
    setSaving(true);
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        title: title.trim(),
        starts_at: new Date(startsAt).toISOString(),
        duration_minutes: Number(duration) || 60,
        location: location.trim() || null,
        contact_id: contactId || null,
        notes: notes.trim() || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast(json.error ?? "Could not save that booking.", "error");
      return;
    }
    setTitle("");
    setLocation("");
    setNotes("");
    setContactId("");
    toast("Booking saved.");
    load();
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/schedule/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast(json.error ?? "Could not update status.", "error");
      return;
    }
    load();
  }

  if (wsLoading || loading) {
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
          Create or select a workspace to manage the schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Bookings for {activeWorkspace.name}. They also appear on Calendar.
          Text a contact here or from Texts (Telegram).
        </p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => setTextPickerOpen(true)}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Send text
        </Button>
      </div>

      <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="booking-title">Title</Label>
          <Input
            id="booking-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Site visit, consult, install…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="booking-when">Starts</Label>
          <Input
            id="booking-when"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="booking-duration">Minutes</Label>
          <Input
            id="booking-duration"
            type="number"
            min={15}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="booking-location">Location</Label>
          <Input
            id="booking-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Address or video link"
          />
        </div>
        <div className="space-y-2">
          <Label>Contact</Label>
          <Select value={contactId || "none"} onValueChange={(v) => setContactId(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Optional contact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No contact</SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {contactDisplayName(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2 lg:col-span-1">
          <Label htmlFor="booking-notes">Notes</Label>
          <Textarea
            id="booking-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={1}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={addBooking} disabled={saving || !title.trim() || !startsAt}>
            {saving ? "Saving…" : "Add booking"}
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right"> </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No bookings yet.
              </TableCell>
            </TableRow>
          ) : (
            events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {new Date(event.starts_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{event.title}</div>
                  {event.location ? (
                    <div className="text-xs text-muted-foreground">{event.location}</div>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">
                  {event.contact ? contactDisplayName(event.contact) : "—"}
                </TableCell>
                <TableCell>
                  <Select
                    value={event.status}
                    onValueChange={(v) => setStatus(event.id, v)}
                  >
                    <SelectTrigger className="w-[9.5rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SCHEDULE_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!event.contact_id}
                    onClick={() => setTextEvent(event)}
                  >
                    <MessageSquare className="mr-1 h-3.5 w-3.5" />
                    Text
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <SendTextDialog
        open={Boolean(textEvent)}
        onOpenChange={(open) => {
          if (!open) setTextEvent(null);
        }}
        workspaceId={activeWorkspace.id}
        contactId={textEvent?.contact_id}
        contactLabel={
          textEvent?.contact ? contactDisplayName(textEvent.contact) : null
        }
        defaultBody={
          textEvent
            ? `Hi${
                textEvent.contact
                  ? ` ${contactDisplayName(textEvent.contact)}`
                  : ""
              }, confirming your booking "${textEvent.title}" on ${new Date(textEvent.starts_at).toLocaleString()}.`
            : undefined
        }
      />
      <SendTextDialog
        open={textPickerOpen}
        onOpenChange={setTextPickerOpen}
        workspaceId={activeWorkspace.id}
        contacts={contacts}
      />
    </div>
  );
}
