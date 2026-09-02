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
  CHANGE_ORDER_STATUSES,
  CHANGE_ORDER_STATUS_LABELS,
  type ChangeOrderStatus,
} from "@/lib/fieldService";
import { formatCurrency } from "@/lib/format";
import type { ConstructionChangeOrder, Project } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function ChangeOrdersPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<ConstructionChangeOrder[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [c, j] = await Promise.all([
      fetch(`/api/construction-change-orders?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const cj = await c.json();
    const jj = await j.json();
    if (c.ok) setRows(cj.change_orders ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !title.trim()) return;
    setSaving(true);
    await fetch("/api/construction-change-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        title: title.trim(),
        cost_impact: Number(impact) || 0,
        project_id: projectId || null,
      }),
    });
    setSaving(false);
    setTitle("");
    setImpact("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/construction-change-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Change orders</h1>
        <p className="text-muted-foreground">
          Scope and cost changes need client approval before extra work. Impact
          rolls into Field ops margin. E-sign the original contract on
          Contracts.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Change title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          placeholder="Cost impact"
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
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
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log change"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Change</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Impact</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.title}</div>
                <div className="text-sm text-muted-foreground">{r.notes}</div>
              </TableCell>
              <TableCell>{r.project?.name ?? "—"}</TableCell>
              <TableCell>{formatCurrency(Number(r.cost_impact) || 0)}</TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) =>
                    patch(r.id, { status: v as ChangeOrderStatus })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANGE_ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CHANGE_ORDER_STATUS_LABELS[s]}
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
