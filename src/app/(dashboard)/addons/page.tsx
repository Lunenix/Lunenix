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
  ADDON_KINDS,
  ADDON_KIND_LABELS,
  ADDON_STATUSES,
  ADDON_STATUS_LABELS,
  type AddonKind,
} from "@/lib/fieldService";
import type { InspectionAddon, Project } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function AddonsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<InspectionAddon[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [kind, setKind] = useState<AddonKind>("radon");
  const [specialist, setSpecialist] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [a, j] = await Promise.all([
      fetch(`/api/inspection-addons?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const aj = await a.json();
    const jj = await j.json();
    if (a.ok) setRows(aj.addons ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace) return;
    setSaving(true);
    await fetch("/api/inspection-addons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        kind,
        specialist_name: specialist.trim() || null,
        due_on: due || null,
        notes: notes.trim() || null,
        project_id: projectId || null,
        contact_id: jobs.find((j) => j.id === projectId)?.contact_id || null,
      }),
    });
    setSaving(false);
    setSpecialist("");
    setNotes("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/inspection-addons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add-ons</h1>
        <p className="text-muted-foreground">
          Radon, mold, termite/WDO, sewer scope, and pool. Track the specialist
          and result on the same property file.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={kind} onValueChange={(v) => setKind(v as AddonKind)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADDON_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {ADDON_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Specialist / vendor"
          value={specialist}
          onChange={(e) => setSpecialist(e.target.value)}
        />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Input
          placeholder="Notes / result"
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
        <Button onClick={add} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log add-on"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Add-on</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">
                  {ADDON_KIND_LABELS[r.kind as AddonKind] ?? r.kind}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[r.specialist_name, r.result_summary, r.notes]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </TableCell>
              <TableCell>{r.project?.name ?? "—"}</TableCell>
              <TableCell>{r.due_on ?? "—"}</TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) => patch(r.id, { status: v })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDON_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ADDON_STATUS_LABELS[s]}
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
