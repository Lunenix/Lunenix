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
import {
  CUSTOM_INDUSTRY_PRESET,
  TEAM_SIZE_OPTIONS,
  TRIAL_DAYS,
} from "@/lib/workspace";
import { IndustryVerticalFields } from "@/components/workspace/IndustryVerticalFields";
import type { WorkspaceWithMembership } from "@/types/database";
import { Loader2 } from "lucide-react";

interface AddCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCompanyModal({ open, onOpenChange }: AddCompanyModalProps) {
  const {
    refreshWorkspaces,
    setActiveWorkspace,
    canCreateWorkspace,
    unlimitedWorkspaces,
    ownedWorkspaceCount,
    extraWorkspacePriceUsd,
    isLoading,
  } = useWorkspace();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [industryPreset, setIndustryPreset] = useState("");
  const [industryCustom, setIndustryCustom] = useState("");
  const [teamSize, setTeamSize] = useState("1-5");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const needsPaidSlot =
    !isLoading && !unlimitedWorkspaces && !canCreateWorkspace;
  const extraPaidCreate =
    !unlimitedWorkspaces && canCreateWorkspace && ownedWorkspaceCount > 0;

  const reset = () => {
    setName("");
    setPhone("");
    setIndustryPreset("");
    setIndustryCustom("");
    setTeamSize("1-5");
    setLogoFile(null);
  };

  const startCheckout = async () => {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/billing/workspace-slot", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not start checkout");
      }
      if (typeof data.url !== "string") {
        throw new Error("Checkout did not return a URL");
      }
      window.location.assign(data.url);
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Could not start checkout",
        "error"
      );
      setCheckingOut(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast("Company name is required", "error");
      return;
    }
    if (!phone.trim()) {
      toast("Company phone is required", "error");
      return;
    }
    if (!logoFile) {
      toast("Upload a company logo", "error");
      return;
    }
    if (!industryPreset) {
      toast("Choose an industry", "error");
      return;
    }
    if (industryPreset === CUSTOM_INDUSTRY_PRESET && !industryCustom.trim()) {
      toast("Describe your business type for Other", "error");
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("name", name.trim());
      body.append("phone", phone.trim());
      body.append("industry_preset", industryPreset);
      if (industryCustom.trim()) {
        body.append("industry_custom_label", industryCustom.trim());
      }
      body.append("team_size", teamSize);
      body.append("logo", logoFile);
      const res = await fetch("/api/workspaces", {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create workspace");
      }
      const data = await res.json();
      const created = data.workspace;

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
          industry_custom_label: created.industry_custom_label ?? null,
          phone: created.phone ?? null,
          team_size: created.team_size ?? null,
          max_seats: created.max_seats ?? undefined,
          tier: created.tier ?? undefined,
          trial_ends_at: created.trial_ends_at ?? null,
          membership_role: "owner",
        } as WorkspaceWithMembership);

      setActiveWorkspace(match);
      toast(
        extraPaidCreate
          ? "Workspace created."
          : "Workspace created. Your trial is active.",
        "success"
      );
      reset();
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {needsPaidSlot
              ? "Add another workspace"
              : "Add New Company / Workspace"}
          </DialogTitle>
          <DialogDescription>
            {needsPaidSlot
              ? `Your plan includes one owned workspace. Additional workspaces are $${extraWorkspacePriceUsd} each.`
              : extraPaidCreate
                ? "This uses a workspace slot you already purchased."
                : `Each company is a separate workspace. Your first workspace includes a ${TRIAL_DAYS}-day free trial.`}
          </DialogDescription>
        </DialogHeader>

        {needsPaidSlot ? (
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              Pay ${extraWorkspacePriceUsd} once to unlock one extra owned
              workspace. You can create it right after checkout.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={startCheckout} disabled={checkingOut}>
                {checkingOut && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Pay ${extraWorkspacePriceUsd}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              {!extraPaidCreate && (
                <div className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-center text-sm font-medium text-green-500">
                  {TRIAL_DAYS}-day free trial
                </div>
              )}

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

              <div className="space-y-2">
                <Label htmlFor="company-logo">
                  Logo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-phone">
                  Phone <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(512) 555-0100"
                />
              </div>

              <IndustryVerticalFields
                idPrefix="company"
                value={industryPreset}
                customLabel={industryCustom}
                onValueChange={setIndustryPreset}
                onCustomLabelChange={setIndustryCustom}
              />

              <div className="space-y-2">
                <Label htmlFor="team-size">Team size</Label>
                <Select value={teamSize} onValueChange={setTeamSize}>
                  <SelectTrigger id="team-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_SIZE_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || isLoading}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Workspace
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
