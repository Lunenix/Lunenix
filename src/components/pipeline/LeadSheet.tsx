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
import { FIELD_LEAD_SOURCE_SUGGESTIONS } from "@/lib/fieldService";
import {
  contactDisplayName,
  isArchived,
  type Contact,
  type Lead,
} from "@/types/database";
import { Check, ChevronsUpDown, Loader2, Archive, ArchiveRestore } from "lucide-react";

interface LeadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  pipelineId: string;
  stageId: string;
  contacts: Contact[];
  lead?: Lead | null;
  onSaved: (lead: Lead) => void;
  sourceSuggestions?: readonly string[];
}

export function LeadSheet({
  open,
  onOpenChange,
  workspaceId,
  pipelineId,
  stageId,
  contacts,
  lead,
  onSaved,
  sourceSuggestions = FIELD_LEAD_SOURCE_SUGGESTIONS,
}: LeadSheetProps) {
  const isEdit = Boolean(lead);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(lead?.title ?? "");
      setValue(lead?.value != null ? String(lead.value) : "");
      setCloseDate(lead?.expected_close_date ?? "");
      setNotes(lead?.notes ?? "");
      setSource(lead?.source ?? "");
      setContactId(lead?.contact_id ?? null);
      setError(null);
    }
  }, [open, lead]);

  const selectedContact = contacts.find((c) => c.id === contactId) || null;

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      workspace_id: workspaceId,
      pipeline_id: pipelineId,
      stage_id: lead?.stage_id ?? stageId,
      title: title.trim(),
      value: value ? Number(value) : null,
      expected_close_date: closeDate || null,
      notes: notes || null,
      source: source.trim() || null,
      contact_id: contactId,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/leads/${lead!.id}` : "/api/leads",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save deal");
      onSaved(json.lead);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(archived: boolean) {
    if (!lead) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update deal");
      onSaved(json.lead);
      onOpenChange(false);
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
          <SheetTitle>{isEdit ? "Edit deal" : "Add deal"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update this deal's details."
              : "Create a new deal in this stage."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Website redesign"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Value (USD)</Label>
            <Input
              id="value"
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="5000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="closeDate">Expected close date</Label>
            <Input
              id="closeDate"
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
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
            <Label htmlFor="source">Lead source</Label>
            <Input
              id="source"
              list="lead-source-suggestions"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Wedding, corporate, referral…"
            />
            <datalist id="lead-source-suggestions">
              {sourceSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Details about this deal…"
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </div>

        <SheetFooter className="mt-6 gap-2 sm:justify-between">
          {isEdit ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleArchive(!isArchived(lead!))}
              disabled={saving}
            >
              {isArchived(lead!) ? (
                <ArchiveRestore className="mr-2 h-4 w-4" />
              ) : (
                <Archive className="mr-2 h-4 w-4" />
              )}
              {isArchived(lead!) ? "Restore deal" : "Archive deal"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create deal"}
          </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
