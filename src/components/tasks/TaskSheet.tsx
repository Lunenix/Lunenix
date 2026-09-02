"use client";

import { useEffect, useState } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ContactSheet } from "@/components/contacts/ContactSheet";
import { cn } from "@/lib/utils";
import {
  contactDisplayName,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Contact,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/types/database";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";

interface TaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projectId: string | null;
  task?: Task | null;
  onSaved: (task: Task) => void;
}

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];
const PRIORITY_ORDER: TaskPriority[] = ["low", "medium", "high", "urgent"];

export function TaskSheet({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  task,
  onSaved,
}: TaskSheetProps) {
  const isEdit = Boolean(task);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setStatus((task?.status as TaskStatus) ?? "todo");
      setPriority((task?.priority as TaskPriority) ?? "medium");
      setDueDate(task?.due_date ?? "");
      setReminderMinutes(
        task?.reminder_minutes_before != null
          ? String(task.reminder_minutes_before)
          : ""
      );
      setContactId(task?.contact_id ?? null);
      setError(null);
    }
  }, [open, task]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/contacts?workspaceId=${workspaceId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setContacts(json.contacts ?? []);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  const selectedContact =
    contacts.find((c) => c.id === contactId) ??
    (task?.contact && task.contact.id === contactId ? (task.contact as Contact) : null);

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (reminderMinutes.trim() && !dueDate) {
      setError("Set a due date to use a reminder.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      workspace_id: workspaceId,
      project_id: task?.project_id ?? projectId,
      contact_id: contactId,
      title: title.trim(),
      description: description || null,
      status,
      priority,
      due_date: dueDate || null,
      reminder_minutes_before: reminderMinutes.trim()
        ? Number(reminderMinutes)
        : null,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/tasks/${task!.id}` : "/api/tasks",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save task");
      onSaved(json.task);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{isEdit ? "Edit task" : "New task"}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? "Update this task's details."
                : "Add a task. You can assign a client from your contacts."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Confirm catering headcount"
              />
            </div>

            <div className="space-y-2">
              <Label>Client</Label>
              <div className="flex gap-2">
                <Popover
                  open={contactPickerOpen}
                  onOpenChange={setContactPickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="min-w-0 flex-1 justify-between font-normal"
                    >
                      <span className="truncate">
                        {selectedContact
                          ? contactDisplayName(selectedContact)
                          : "No client"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Search contacts…" />
                      <CommandList>
                        <CommandEmpty>No contacts found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setContactId(null);
                              setContactPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                contactId === null ? "opacity-100" : "opacity-0"
                              )}
                            />
                            No client
                          </CommandItem>
                          {contacts.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={contactDisplayName(c) + " " + c.id}
                              onSelect={() => {
                                setContactId(c.id);
                                setContactPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  contactId === c.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {contactDisplayName(c)}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Add contact"
                  onClick={() => setContactSheetOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Assign an existing contact, or add a new one as the client.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as TaskStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {TASK_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TaskPriority)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>
                        {TASK_PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due">Due date</Label>
              <Input
                id="due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminder">Remind me (minutes before)</Label>
              <Input
                id="reminder"
                type="number"
                min={1}
                max={10080}
                placeholder="Leave blank for no reminder"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Telegram posts to the workspace bot chat when this window opens.
                Due dates are treated as 9:00 AM UTC that day. Max 10080 (7 days).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Details…"
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
              {isEdit ? "Save changes" : "Create task"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ContactSheet
        open={contactSheetOpen}
        onOpenChange={setContactSheetOpen}
        workspaceId={workspaceId}
        onSaved={(created) => {
          setContacts((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
          setContactId(created.id);
        }}
      />
    </>
  );
}
