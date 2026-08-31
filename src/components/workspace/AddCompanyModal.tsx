"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "@/lib/toast";
import type { WorkspaceWithMembership } from "@/types/database";
import { Loader2 } from "lucide-react";

interface AddCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const INDUSTRY_PRESETS: { value: string; label: string }[] = [
  { value: "bridal", label: "Bridal / Specialty Retail" },
  { value: "mobile_bar", label: "Mobile Bar / Catering" },
  { value: "contractor", label: "Trade Contractor" },
  { value: "creative", label: "Creative Studio" },
  { value: "general", label: "General Business" },
];

export function AddCompanyModal({ open, onOpenChange }: AddCompanyModalProps) {
  const { refreshWorkspaces, setActiveWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [industryPreset, setIndustryPreset] = useState("general");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast("Company name is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry_preset: industryPreset,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create workspace");
      }
      const data = await res.json();
      const created = data.workspace;

      // Refresh the list, then switch to the newly created workspace.
      const list = await refreshWorkspaces();
      const match =
        list.find((w) => w.id === created.id) ??
        ({
          id: created.id,
          name: created.name,
          slug: created.slug,
          created_at: created.created_at,
          logo_url: created.logo_url ?? null,
          industry_preset: created.industry_preset ?? null,
          max_seats: created.max_seats ?? undefined,
          tier: created.tier ?? undefined,
          membership_role: "owner",
        } as WorkspaceWithMembership);

      setActiveWorkspace(match);
      toast("Workspace created! Switching now...", "success");

      // Reset + close.
      setName("");
      setIndustryPreset("general");
      onOpenChange(false);
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Failed to create workspace",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Company / Workspace</DialogTitle>
          <DialogDescription>
            Spin up a separate workspace for another business.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Free beta badge */}
          <div className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-center text-sm font-medium text-green-500">
            🚀 Free Beta Access — Unlimited Features Included
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="company-name">
              Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Events Co."
              autoFocus
            />
          </div>

          {/* Industry Preset */}
          <div className="space-y-2">
            <Label htmlFor="industry-preset">Industry Preset</Label>
            <Select value={industryPreset} onValueChange={setIndustryPreset}>
              <SelectTrigger id="industry-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              We&apos;ll pre-configure your pipeline stages to match.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
