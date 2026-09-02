"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CUSTOM_INDUSTRY_PRESET,
  INDUSTRY_SECTORS,
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
  const selectId = `${idPrefix}-industry`;
  const customId = `${idPrefix}-industry-custom`;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={selectId}>
          Industry <span className="text-destructive">*</span>
        </Label>
        <Select
          value={value || undefined}
          onValueChange={(next) => {
            onValueChange(next);
            if (next !== CUSTOM_INDUSTRY_PRESET) onCustomLabelChange("");
          }}
        >
          <SelectTrigger id={selectId}>
            <SelectValue placeholder="Choose an industry" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {INDUSTRY_SECTORS.map((sector) => (
              <SelectGroup key={sector.id}>
                <SelectLabel>{sector.label}</SelectLabel>
                {sector.verticals.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
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
            Used when your model is not in the 62 listed verticals.
          </p>
        </div>
      )}
    </>
  );
}
