"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddCompanyModal } from "@/components/workspace/AddCompanyModal";
import { EditWorkspaceDialog } from "@/components/workspace/EditWorkspaceDialog";
import { toast } from "@/lib/toast";
import { industryDisplayLabel, workspaceTierLabel } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import type { WorkspaceWithMembership } from "@/types/database";
import { Check, Loader2, Pencil, Plus } from "lucide-react";

function roleBadgeClasses(role?: string): string {
  switch (role) {
    case "owner":
      return "border-purple-500/40 bg-purple-500/10 text-purple-400";
    case "admin":
      return "border-blue-500/40 bg-blue-500/10 text-blue-400";
    default:
      return "border-gray-500/40 bg-gray-500/10 text-gray-400";
  }
}

function presetLabel(
  preset?: string | null,
  custom?: string | null
): string {
  return industryDisplayLabel(preset, custom);
}

export default function WorkspaceManagementPage() {
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    refreshWorkspaces,
    isLoading,
    extraWorkspacePriceUsd,
    unlimitedWorkspaces,
    canCreateWorkspace,
  } = useWorkspace();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState<WorkspaceWithMembership | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slot = params.get("workspace_slot");
    const sessionId = params.get("session_id");
    if (slot === "cancel") {
      toast("Checkout canceled", "error");
      window.history.replaceState({}, "", "/settings/workspaces");
      return;
    }
    if (slot !== "success" || !sessionId) return;

    let cancelled = false;
    (async () => {
      const res = await fetch("/api/billing/workspace-slot/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (cancelled) return;
      if (res.ok) {
        await refreshWorkspaces();
        toast("Workspace slot added. You can create another company now.", "success");
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "Could not confirm payment", "error");
      }
      window.history.replaceState({}, "", "/settings/workspaces");
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshWorkspaces]);

  const canManage = (ws: WorkspaceWithMembership) =>
    ws.membership_role === "owner" || ws.membership_role === "admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Workspace Management</h1>
          <p className="text-muted-foreground">
            {unlimitedWorkspaces
              ? "You can create unlimited workspaces."
              : `You get one owned workspace included. Additional workspaces are $${extraWorkspacePriceUsd} each.`}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {canCreateWorkspace || unlimitedWorkspaces
            ? "Add Company"
            : `Add Company ($${extraWorkspacePriceUsd})`}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <p>No workspaces yet</p>
              <Button size="sm" onClick={() => setShowAddModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Company
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace Name</TableHead>
                  <TableHead>Your Role</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((ws) => {
                  const isActive = activeWorkspace?.id === ws.id;
                  return (
                    <TableRow key={ws.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{ws.name}</span>
                          {isActive && (
                            <Badge className="border-green-500/40 bg-green-500/10 text-green-400">
                              <Check className="mr-1 h-3 w-3" />
                              Active
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Role */}
                      <TableCell>
                        <Badge
                          className={cn(
                            "capitalize",
                            roleBadgeClasses(ws.membership_role)
                          )}
                        >
                          {ws.membership_role ?? "member"}
                        </Badge>
                      </TableCell>

                      {/* Industry preset */}
                      <TableCell className="text-muted-foreground">
                        {presetLabel(
                          ws.industry_preset,
                          ws.industry_custom_label
                        )}
                      </TableCell>

                      {/* Tier */}
                      <TableCell>
                        <Badge
                          className={
                            ws.tier === "admin"
                              ? "border-purple-500/40 bg-purple-500/10 text-purple-400"
                              : "border-green-500/40 bg-green-500/10 text-green-400"
                          }
                        >
                          {workspaceTierLabel(ws.tier, ws.trial_ends_at)}
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant={isActive ? "secondary" : "outline"}
                            onClick={() => setActiveWorkspace(ws)}
                            disabled={isActive}
                          >
                            {isActive ? "Current" : "Switch"}
                          </Button>
                          {canManage(ws) ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditing(ws)}
                              aria-label="Edit workspace"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 cursor-not-allowed opacity-40"
                              disabled
                              title="Only owners and admins can edit this workspace"
                              aria-label="Only owners and admins can edit this workspace"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddCompanyModal open={showAddModal} onOpenChange={setShowAddModal} />
      <EditWorkspaceDialog
        workspace={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}
