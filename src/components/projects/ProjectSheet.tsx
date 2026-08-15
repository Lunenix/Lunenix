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
import { cn } from "@/lib/utils";
import {
  contactDisplayName,
  PROJECT_STATUS_LABELS,
  type Contact,
  type Project,
  type ProjectStatus,
} from "@/types/database";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

interface ProjectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  contacts: Contact[];
  project?: Project | null;
  onSaved: (project: Project) => void;
}

const STATUS_ORDER: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
];

export function ProjectSheet({
  open,
  onOpenChange,
  workspaceId,
  contacts,
  project,
  onSaved,
}: ProjectSheetProps) {
  const router = useRouter();
  const isEdit = Boolean(project);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [budget, setBudget] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setStatus((project?.status as ProjectStatus) ?? "planning");
      setStartDate(project?.start_date ?? "");
      setDueDate(project?.due_date ?? "");
      setBudget(project?.budget != null ? String(project.budget) : "");
      setContactId(project?.contact_id ?? null);
      setError(null);
    }
  }, [open, project]);

  const selectedContact = contacts.find((c) => c.id === contactId) || null;

  async function handleSave() {
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      workspace_id: workspaceId,
      name: name.trim(),
      description: description || null,
      status,
      start_date: startDate || null,
      due_date: dueDate || null,
      budget: budget ? Number(budget) : null,
      contact_id: contactId,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/projects/${project!.id}` : "/api/projects",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save project");
      onSaved(json.project);
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
          <SheetTitle>{isEdit ? "Edit project" : "New project"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this project's details."
              : "Create a new project or job in this workspace."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer gala event"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ProjectStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PROJECT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">Start date</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Budget (USD)</Label>
            <Input
              id="budget"
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="10000"
            />
          </div>

          <div className="space-y-2">
            <Label>Linked contact</Label>
            <Popover open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {selectedContact
                      ? contactDisplayName(selectedContact)
                      : "No contact"}
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
                        No contact
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Scope, deliverables, notes…"
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
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
