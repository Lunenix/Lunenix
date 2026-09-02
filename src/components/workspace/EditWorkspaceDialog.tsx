"use client";

import { useEffect, useState } from "react";
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
import { IndustryVerticalFields } from "@/components/workspace/IndustryVerticalFields";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "@/lib/toast";
import {
  CUSTOM_INDUSTRY_PRESET,
  resolveIndustryPreset,
} from "@/lib/workspace";
import type { WorkspaceWithMembership } from "@/types/database";
import { Loader2 } from "lucide-react";

interface EditWorkspaceDialogProps {
  workspace: WorkspaceWithMembership | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
}: EditWorkspaceDialogProps) {
  const { refreshWorkspaces, activeWorkspace, setActiveWorkspace } =
    useWorkspace();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryCustom, setIndustryCustom] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workspace || !open) return;
    setName(workspace.name);
    setIndustry(resolveIndustryPreset(workspace.industry_preset) ?? "");
    setIndustryCustom(workspace.industry_custom_label ?? "");
  }, [workspace, open]);

  const handleSave = async () => {
    if (!workspace) return;
    if (!name.trim()) {
      toast("Company name is required", "error");
      return;
    }
    if (!industry) {
      toast("Choose an industry", "error");
      return;
    }
    if (industry === CUSTOM_INDUSTRY_PRESET && !industryCustom.trim()) {
      toast("Describe your business type for Other", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry_preset: industry,
          industry_custom_label: industryCustom.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update workspace");
      }
      const list = await refreshWorkspaces();
      if (activeWorkspace?.id === workspace.id) {
        const updated =
          list.find((w) => w.id === workspace.id) ??
          ({
            ...activeWorkspace,
            name: data.workspace?.name ?? name.trim(),
            industry_preset: data.workspace?.industry_preset ?? industry,
            industry_custom_label:
              data.workspace?.industry_custom_label ??
              (industryCustom.trim() || null),
          } as WorkspaceWithMembership);
        setActiveWorkspace(updated);
      }
      toast("Workspace updated", "success");
      onOpenChange(false);
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Failed to update workspace",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit workspace</DialogTitle>
          <DialogDescription>
            Change this company&apos;s name or industry. Pipeline stages already
            in use are left as they are.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-ws-name">Company name</Label>
            <Input
              id="edit-ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <IndustryVerticalFields
            idPrefix="edit-ws"
            value={industry}
            customLabel={industryCustom}
            onValueChange={setIndustry}
            onCustomLabelChange={setIndustryCustom}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !workspace}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
