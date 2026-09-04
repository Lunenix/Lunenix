"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  monthBounds,
  type CalendarEvent,
  type CalendarKind,
} from "@/lib/calendar";
import { SendTextDialog } from "@/components/texts/SendTextDialog";
import { contactDisplayName, type Contact } from "@/types/database";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
  MessageSquare,
} from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const KIND_LABEL: Record<CalendarKind, string> = {
  task: "Task",
  invoice: "Invoice",
  project: "Project",
  booking: "Booking",
};

function padDay(n: number): string {
  return String(n).padStart(2, "0");
}

export function CalendarView() {
  const { activeWorkspace, isLoading: wsLoading } = useWorkspace();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [textEvent, setTextEvent] = useState<CalendarEvent | null>(null);
  const [textPickerOpen, setTextPickerOpen] = useState(false);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const bounds = useMemo(
    () => monthBounds(year, monthIndex),
    [year, monthIndex]
  );

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const qs = new URLSearchParams({
      workspaceId: activeWorkspace.id,
      from: bounds.from,
      to: bounds.to,
    });
    const [calRes, cRes] = await Promise.all([
      fetch(`/api/calendar?${qs.toString()}`),
      fetch(`/api/contacts?workspaceId=${activeWorkspace.id}`),
    ]);
    const json = await calRes.json().catch(() => ({}));
    const cJson = await cRes.json().catch(() => ({}));
    if (calRes.ok) setEvents(Array.isArray(json.events) ? json.events : []);
    else setEvents([]);
    if (cRes.ok) setContacts(cJson.contacts ?? []);
    setLoading(false);
  }, [activeWorkspace, bounds.from, bounds.to]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const leading: Array<{ date: string | null; day: number | null }> =
      Array.from({ length: firstWeekday }, () => ({ date: null, day: null }));
    const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = `${year}-${padDay(monthIndex + 1)}-${padDay(day)}`;
      return { date, day };
    });
    return [...leading, ...monthDays];
  }, [year, monthIndex]);

  const todayYmd = `${today.getFullYear()}-${padDay(today.getMonth() + 1)}-${padDay(today.getDate())}`;
  const selectedDate = selected ?? todayYmd;
  const selectedEvents = byDate.get(selectedDate) ?? [];

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
          Create or select a workspace to see the calendar.
        </p>
      </div>
    );
  }

  const monthLabel = cursor.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const textContact = textEvent?.contactId
    ? contacts.find((c) => c.id === textEvent.contactId)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Bookings, tasks, invoices, and projects for {activeWorkspace.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, monthIndex - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium">
            {monthLabel}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, monthIndex + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1 font-medium">
                  {d}
                </div>
              ))}
            </div>
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, index) => {
                  if (!cell.date) {
                    return (
                      <div key={`empty-${index}`} className="min-h-[4.5rem]" />
                    );
                  }
                  const dayEvents = byDate.get(cell.date) ?? [];
                  const isToday = cell.date === todayYmd;
                  const isSelected = cell.date === selectedDate;
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      onClick={() => setSelected(cell.date)}
                      className={cn(
                        "min-h-[4.5rem] rounded-md border p-1 text-left text-xs transition-colors",
                        isSelected
                          ? "border-primary bg-accent"
                          : "border-transparent hover:bg-muted/60",
                        isToday && !isSelected && "border-primary/40"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full",
                          isToday && "bg-primary text-primary-foreground"
                        )}
                      >
                        {cell.day}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className="truncate text-[10px] text-muted-foreground"
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-muted-foreground">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              {selectedDate}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setTextPickerOpen(true)}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Send text
            </Button>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing dated this day. Add a booking on Schedule, or set due
                dates on tasks, invoices, and projects.
              </p>
            ) : (
              selectedEvents.map((event) => {
                const contact = event.contactId
                  ? contacts.find((c) => c.id === event.contactId)
                  : undefined;
                return (
                  <div
                    key={event.id}
                    className="rounded-md border p-3"
                  >
                    <Link
                      href={event.href}
                      className="block hover:underline"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{event.title}</p>
                        <Badge variant="secondary">
                          {KIND_LABEL[event.kind]}
                        </Badge>
                      </div>
                    </Link>
                    {event.status ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.status.replace(/_/g, " ")}
                      </p>
                    ) : null}
                    {contact ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {contactDisplayName(contact)}
                      </p>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 px-2 text-xs"
                      disabled={!event.contactId}
                      onClick={() => setTextEvent(event)}
                    >
                      <MessageSquare className="mr-1 h-3.5 w-3.5" />
                      Text
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <SendTextDialog
        open={Boolean(textEvent)}
        onOpenChange={(open) => {
          if (!open) setTextEvent(null);
        }}
        workspaceId={activeWorkspace.id}
        contactId={textEvent?.contactId}
        contactLabel={textContact ? contactDisplayName(textContact) : null}
        defaultBody={
          textEvent
            ? `Reminder: ${textEvent.title} on ${textEvent.date}.`
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
