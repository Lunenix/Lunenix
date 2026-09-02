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
  DRAW_KINDS,
  DRAW_KIND_LABELS,
  DRAW_STATUSES,
  DRAW_STATUS_LABELS,
  LIEN_WAIVER_STATUSES,
  LIEN_WAIVER_STATUS_LABELS,
  type DrawKind,
  type DrawStatus,
  type LienWaiverStatus,
} from "@/lib/fieldService";
import { formatCurrency } from "@/lib/format";
import type { ConstructionDraw, Project } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function DrawsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<ConstructionDraw[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [kind, setKind] = useState<DrawKind>("deposit");
  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [d, j] = await Promise.all([
      fetch(`/api/construction-draws?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const dj = await d.json();
    const jj = await j.json();
    if (d.ok) setRows(dj.draws ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace) return;
    setSaving(true);
    await fetch("/api/construction-draws", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        kind,
        amount: Number(amount) || 0,
        percent_complete: Number(pct) || 0,
        project_id: projectId || null,
      }),
    });
    setSaving(false);
    setAmount("");
    setPct("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/construction-draws/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Draws</h1>
        <p className="text-muted-foreground">
          Deposit, progress, and retainage. Send the actual invoice from
          Invoices. Track lien waivers here — Luna never collects cards.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={kind} onValueChange={(v) => setKind(v as DrawKind)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DRAW_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {DRAW_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          placeholder="% complete"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
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
        <Button onClick={add} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log draw"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Draw</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Lien waiver</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">
                  {DRAW_KIND_LABELS[r.kind as DrawKind] ?? r.kind}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[r.project?.name, r.percent_complete ? `${r.percent_complete}%` : null, r.due_on]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </TableCell>
              <TableCell>{formatCurrency(Number(r.amount) || 0)}</TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) => patch(r.id, { status: v as DrawStatus })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRAW_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {DRAW_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  value={r.lien_waiver}
                  onValueChange={(v) =>
                    patch(r.id, { lien_waiver: v as LienWaiverStatus })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LIEN_WAIVER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {LIEN_WAIVER_STATUS_LABELS[s]}
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
