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
  STEEL_DRAWING_STATUSES,
  STEEL_DRAWING_STATUS_LABELS,
  STEEL_PE_STATUSES,
  STEEL_PE_STATUS_LABELS,
  type SteelDrawingStatus,
  type SteelPeStatus,
} from "@/lib/fieldService";
import type { Project, SteelDrawing } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function DrawingsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<SteelDrawing[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [d, j] = await Promise.all([
      fetch(`/api/steel-drawings?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const dj = await d.json();
    const jj = await j.json();
    if (d.ok) setRows(dj.drawings ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !title.trim()) return;
    setSaving(true);
    await fetch("/api/steel-drawings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        title: title.trim(),
        dimensions: dimensions.trim() || null,
        project_id: projectId || null,
        pe_status: "needed",
      }),
    });
    setSaving(false);
    setTitle("");
    setDimensions("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/steel-drawings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Drawings</h1>
        <p className="text-muted-foreground">
          Shop drawings with welds and connections. Track PE stamp if
          load-bearing, plus client or architect approval. Bump version on
          revisions. Site and mill photos live on Estimates.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Drawing title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          placeholder="Dimensions / connections"
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
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log drawing"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Drawing</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Client / AE</TableHead>
            <TableHead>PE stamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.title}</div>
                <div className="text-sm text-muted-foreground">
                  {r.project?.name ?? "No job"}
                  {r.dimensions ? ` · ${r.dimensions}` : ""}
                </div>
              </TableCell>
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
                    patch(r.id, { status: v as SteelDrawingStatus })
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STEEL_DRAWING_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STEEL_DRAWING_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  value={r.pe_status}
                  onValueChange={(v) =>
                    patch(r.id, { pe_status: v as SteelPeStatus })
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STEEL_PE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STEEL_PE_STATUS_LABELS[s]}
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
