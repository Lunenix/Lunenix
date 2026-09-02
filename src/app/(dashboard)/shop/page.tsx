"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SHOP_FAB_STEPS,
  SHOP_FAB_STEP_LABELS,
  SHOP_STAGES,
  SHOP_STAGE_LABELS,
  type ShopFabStep,
  type ShopStage,
} from "@/lib/fieldService";
import type { Project, ShopQueueItem } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function ShopPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<ShopQueueItem[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [craftsman, setCraftsman] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [q, j] = await Promise.all([
      fetch(`/api/shop-queue?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const qj = await q.json();
    const jj = await j.json();
    if (q.ok) setRows(qj.queue ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !title.trim()) return;
    setSaving(true);
    await fetch("/api/shop-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        title: title.trim(),
        craftsman_name: craftsman.trim() || null,
        project_id: projectId || null,
      }),
    });
    setSaving(false);
    setTitle("");
    setCraftsman("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/shop-queue/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Shop</h1>
        <p className="text-muted-foreground">
          Fabrication queue: cut, mill, assembly, sanding, finishing. Stages
          run design approved → material in → in fabrication → finishing →
          ready → install or pickup. Add site-prep notes (stairs, tight
          spaces). Craftsman specialties live on Techs. Equipment service
          dates are on Inventory.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Piece / job name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          placeholder="Craftsman"
          value={craftsman}
          onChange={(e) => setCraftsman(e.target.value)}
        />
        <Select
          value={projectId || "none"}
          onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No job</SelectItem>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={add} disabled={saving || !title.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Queue piece"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Piece</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Fab step</TableHead>
            <TableHead>Install / pickup</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.title}</div>
                <div className="text-sm text-muted-foreground">
                  {r.craftsman_name ?? "Unassigned"}
                  {r.access_notes ? ` · ${r.access_notes}` : ""}
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={r.stage}
                  onValueChange={(v) =>
                    patch(r.id, { stage: v as ShopStage })
                  }
                >
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOP_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SHOP_STAGE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  value={r.fab_step || "none"}
                  onValueChange={(v) =>
                    patch(r.id, {
                      fab_step: v === "none" ? null : (v as ShopFabStep),
                    })
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {SHOP_FAB_STEPS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SHOP_FAB_STEP_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <input
                  className="rounded border bg-background px-2 py-1 text-sm"
                  type="date"
                  defaultValue={r.install_on ?? ""}
                  key={`${r.id}-d-${r.install_on ?? "x"}`}
                  onBlur={(e) =>
                    patch(r.id, { install_on: e.target.value || null })
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
