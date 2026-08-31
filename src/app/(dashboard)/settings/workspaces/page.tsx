"use client";

import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AddCompanyModal,
  INDUSTRY_PRESETS,
} from "@/components/workspace/AddCompanyModal";
import { toast } from "@/lib/toast";
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

function presetLabel(preset?: string | null): string {
  if (!preset) return "—";
  return INDUSTRY_PRESETS.find((p) => p.value === preset)?.label ?? preset;
}

export default function WorkspaceManagementPage() {
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    refreshWorkspaces,
    isLoading,
  } = useWorkspace();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const canManage = (ws: WorkspaceWithMembership) =>
    ws.membership_role === "owner" || ws.membership_role === "admin";

  const startEdit = (ws: WorkspaceWithMembership) => {
    setEditingId(ws.id);
    setEditValue(ws.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (ws: WorkspaceWithMembership) => {
    const newName = editValue.trim();
    if (!newName || newName === ws.name) {
      cancelEdit();
      return;
    }
    setSavingId(ws.id);
    try {
      const res = await fetch(`/api/workspaces/${ws.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to rename workspace");
      }
      const data = await res.json();
      const list = await refreshWorkspaces();

      // If we renamed the active workspace, update it so the sidebar reflects it.
      if (activeWorkspace?.id === ws.id) {
        const updated =
          list.find((w) => w.id === ws.id) ??
          ({ ...activeWorkspace, name: data.workspace.name } as WorkspaceWithMembership);
        setActiveWorkspace(updated);
      }

      toast("Workspace renamed", "success");
      cancelEdit();
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Failed to rename workspace",
        "error"
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Workspace Management</h1>
          <p className="text-muted-foreground">
            Manage the companies and workspaces you belong to
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Company
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
                  <TableHead>Industry Preset</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((ws) => {
                  const isActive = activeWorkspace?.id === ws.id;
                  const isEditing = editingId === ws.id;
                  return (
                    <TableRow key={ws.id}>
                      {/* Name (inline rename) */}
                      <TableCell className="font-medium">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(ws);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              onBlur={() => saveEdit(ws)}
                              autoFocus
                              className="h-8 max-w-[220px]"
                              disabled={savingId === ws.id}
                            />
                            {savingId === ws.id && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{ws.name}</span>
                            {isActive && (
                              <Badge className="border-green-500/40 bg-green-500/10 text-green-400">
                                <Check className="mr-1 h-3 w-3" />
                                Active
                              </Badge>
                            )}
                          </div>
                        )}
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
                        {presetLabel(ws.industry_preset)}
                      </TableCell>

                      {/* Tier */}
                      <TableCell>
                        <Badge className="border-green-500/40 bg-green-500/10 text-green-400">
                          Free Beta
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
                              onClick={() => startEdit(ws)}
                              disabled={isEditing}
                              aria-label="Rename workspace"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 cursor-not-allowed opacity-40"
                              disabled
                              title="Only Admins can rename this workspace"
                              aria-label="Only Admins can rename this workspace"
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
    </div>
  );
}
