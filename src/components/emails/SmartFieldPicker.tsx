"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Braces } from "lucide-react";
import {
  SMART_FIELDS,
  SMART_FIELD_GROUP_LABELS,
  type SmartFieldDef,
  type SmartFieldGroup,
} from "@/lib/email/smartFields";

interface SmartFieldPickerProps {
  /**
   * Called with the token to insert (already wrapped, e.g. "{{client.first_name}}"
   * or "{{contract.link|Review & Sign}}") and the field definition.
   */
  onInsert: (token: string, field: SmartFieldDef) => void;
  /** Condensed icon-only trigger for mobile toolbars. */
  compact?: boolean;
  disabled?: boolean;
}

export function SmartFieldPicker({
  onInsert,
  compact = false,
  disabled = false,
}: SmartFieldPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = SMART_FIELDS.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      f.label.toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q)
    );
  });

  // Group the filtered fields
  const groups = filtered.reduce((acc, f) => {
    (acc[f.group] ||= []).push(f);
    return acc;
  }, {} as Record<SmartFieldGroup, SmartFieldDef[]>);

  const handlePick = (f: SmartFieldDef) => {
    const token = f.isActionLink
      ? `{{${f.key}|${f.defaultLinkText || "Open"}}}`
      : `{{${f.key}}}`;
    onInsert(token, f);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon" : "sm"}
          type="button"
          disabled={disabled}
          title="Insert smart field"
        >
          <Braces className="h-4 w-4" />
          {!compact && <span className="ml-1">Smart field</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <Input
            autoFocus
            placeholder="Search smart fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {Object.keys(groups).length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">No fields found.</p>
          )}
          {(Object.keys(groups) as SmartFieldGroup[]).map((g) => (
            <div key={g} className="mb-2">
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {SMART_FIELD_GROUP_LABELS[g]}
              </div>
              {groups[g].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => handlePick(f)}
                  className="group w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium group-hover:text-primary">
                      {f.label}
                    </span>
                    {f.isActionLink && (
                      <Badge variant="secondary" className="text-[10px]">
                        button
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {f.description}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
