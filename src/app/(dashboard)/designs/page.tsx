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
  SHOP_DESIGN_STATUSES,
  SHOP_DESIGN_STATUS_LABELS,
  type ShopDesignStatus,
} from "@/lib/fieldService";
import type { Project, ShopDesign } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function DesignsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<ShopDesign[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [d, j] = await Promise.all([
      fetch(`/api/shop-designs?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const dj = await d.json();
    const jj = await j.json();
    if (d.ok) setRows(dj.designs ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !title.trim()) return;
    setSaving(true);
    await fetch("/api/shop-designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        title: title.trim(),
        dimensions: dimensions.trim() || null,
        project_id: projectId || null,
      }),
    });
    setSaving(false);
    setTitle("");
    setDimensions("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/shop-designs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Designs</h1>
        <p className="text-muted-foreground">
          Shop drawings and 3D renders. Client review is approve or request
          revisions. Bump version when you send a new iteration. Finalize
          dimensions and joinery before the shop queue. Attach CAD files as a
          URL; site and inspiration photos live on Estimates.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Piece / drawing title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          placeholder="Dimensions"
          value={dimensions}
          onChange={(e) => setDimensions(e.target.value)}
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
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log design"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Drawing</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.title}</div>
                <div className="text-sm text-muted-foreground">
                  {r.dimensions ?? "—"}
                  {r.joinery_notes ? ` · ${r.joinery_notes}` : ""}
                </div>
              </TableCell>
              <TableCell>{r.project?.name ?? "—"}</TableCell>
              <TableCell>
                <Input
                  className="w-16"
                  defaultValue={String(r.version)}
                  key={`${r.id}-v-${r.version}`}
                  onBlur={(e) =>
                    patch(r.id, { version: Number(e.target.value) || 1 })
                  }
                />
              </TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) =>
                    patch(r.id, { status: v as ShopDesignStatus })
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOP_DESIGN_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SHOP_DESIGN_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
