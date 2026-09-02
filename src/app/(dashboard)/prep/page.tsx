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
  PREP_KINDS,
  PREP_KIND_LABELS,
  PREP_STATUSES,
  PREP_STATUS_LABELS,
  type PrepKind,
  type PrepStatus,
} from "@/lib/fieldService";
import type { JobPrepItem, Project } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function PrepPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<JobPrepItem[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [kind, setKind] = useState<PrepKind>("patching");
  const [notes, setNotes] = useState("");
  const [billed, setBilled] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [p, j] = await Promise.all([
      fetch(`/api/prep-items?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const pj = await p.json();
    const jj = await j.json();
    if (p.ok) setRows(pj.items ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace) return;
    setSaving(true);
    await fetch("/api/prep-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        kind,
        notes: notes.trim() || null,
        billed_separately: billed,
        project_id: projectId || null,
        status: "todo",
      }),
    });
    setSaving(false);
    setNotes("");
    setBilled(false);
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/prep-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Surface prep</h1>
        <p className="text-muted-foreground">
          Track patching, sanding, caulking, priming, taping, mudding, and
          texture match. Mark billed separately when prep is its own line.
          Upload before/after on the estimate as prep photos. OCR is not
          auto-filled.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={kind} onValueChange={(v) => setKind(v as PrepKind)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PREP_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {PREP_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Notes (texture match, drywall repair)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={billed}
            onChange={(e) => setBilled(e.target.checked)}
          />
          Billed separately
        </label>
        <Button onClick={add} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add prep item"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Prep</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Billed sep.</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">
                  {PREP_KIND_LABELS[r.kind as PrepKind] ?? r.kind}
                </div>
                {r.notes ? (
                  <div className="text-sm text-muted-foreground">{r.notes}</div>
                ) : null}
              </TableCell>
              <TableCell>{r.project?.name ?? "—"}</TableCell>
              <TableCell>{r.billed_separately ? "Yes" : "No"}</TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) => patch(r.id, { status: v })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PREP_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PREP_STATUS_LABELS[s]}
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
