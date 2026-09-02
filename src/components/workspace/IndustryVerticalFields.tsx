"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CUSTOM_INDUSTRY_PRESET,
  INDUSTRY_SECTORS,
  industryDisplayLabel,
  industrySectorId,
  type IndustrySectorId,
} from "@/lib/industryVerticals";

interface IndustryVerticalFieldsProps {
  idPrefix: string;
  value: string;
  customLabel: string;
  onValueChange: (value: string) => void;
  onCustomLabelChange: (value: string) => void;
}

export function IndustryVerticalFields({
  idPrefix,
  value,
  customLabel,
  onValueChange,
  onCustomLabelChange,
}: IndustryVerticalFieldsProps) {
  const typeId = `${idPrefix}-industry-type`;
  const verticalId = `${idPrefix}-industry`;
  const customId = `${idPrefix}-industry-custom`;
  const searchId = `${idPrefix}-industry-search`;

  const [sectorId, setSectorId] = useState<IndustrySectorId | "">("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!value) {
      setSectorId("");
      return;
    }
    const next = industrySectorId(value);
    if (next) setSectorId(next);
  }, [value]);

  const sector = INDUSTRY_SECTORS.find((s) => s.id === sectorId);
  const verticals = sector?.verticals ?? [];

  const pickVertical = (next: string, nextSector?: IndustrySectorId) => {
    onValueChange(next);
    if (nextSector) setSectorId(nextSector);
    if (next !== CUSTOM_INDUSTRY_PRESET) onCustomLabelChange("");
  };

  const pickSector = (next: IndustrySectorId) => {
    setSectorId(next);
    const group = INDUSTRY_SECTORS.find((s) => s.id === next);
    if (!group) return;
    if (group.verticals.length === 1) {
      pickVertical(group.verticals[0].value, next);
      return;
    }
    const stillInSector = group.verticals.some((v) => v.value === value);
    if (!stillInSector) onValueChange("");
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={typeId}>
          Industry type <span className="text-destructive">*</span>
        </Label>
        <Select
          value={sectorId || undefined}
          onValueChange={(next) => pickSector(next as IndustrySectorId)}
        >
          <SelectTrigger id={typeId}>
            <SelectValue placeholder="Choose a sector" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRY_SECTORS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={verticalId}>
          Industry <span className="text-destructive">*</span>
        </Label>
        <Select
          value={value || undefined}
          onValueChange={(next) => pickVertical(next)}
          disabled={!sectorId}
        >
          <SelectTrigger id={verticalId}>
            <SelectValue
              placeholder={
                sectorId ? "Choose an industry" : "Pick an industry type first"
              }
            />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {verticals.map((v) => (
              <SelectItem key={v.value} value={v.value}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={searchId}>Search industries</Label>
        <Popover open={searchOpen} onOpenChange={setSearchOpen} modal={false}>
          <PopoverTrigger asChild>
            <Button
              id={searchId}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={searchOpen}
              className="h-10 w-full justify-between font-normal"
            >
              <span className="truncate text-left">
                {value
                  ? industryDisplayLabel(value, customLabel)
                  : "Type to find an industry"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
          >
            <Command>
              <CommandInput placeholder="Search florist, HVAC, realtor…" />
              <CommandList>
                <CommandEmpty>No industry matches.</CommandEmpty>
                {INDUSTRY_SECTORS.map((s) => (
                  <CommandGroup key={s.id} heading={s.label}>
                    {s.verticals.map((v) => (
                      <CommandItem
                        key={v.value}
                        value={`${v.label} ${s.label}`}
                        onSelect={() => {
                          pickVertical(v.value, s.id);
                          setSearchOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            value === v.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {v.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">
          Optional. Search jumps to the matching industry and sector.
        </p>
      </div>

      {value === CUSTOM_INDUSTRY_PRESET && (
        <div className="space-y-2">
          <Label htmlFor={customId}>Your business type</Label>
          <Input
            id={customId}
            value={customLabel}
            onChange={(e) => onCustomLabelChange(e.target.value)}
            placeholder="e.g. Mobile auto detailing"
            maxLength={80}
          />
          <p className="text-xs text-muted-foreground">
            Used when your model is not in the listed verticals.
          </p>
        </div>
      )}
    </>
  );
}
