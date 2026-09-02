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
  FINDING_SEVERITIES,
  FINDING_SEVERITY_LABELS,
  FINDING_STATUSES,
  FINDING_STATUS_LABELS,
  FINDING_SYSTEMS,
  FINDING_SYSTEM_LABELS,
  type FindingSeverity,
  type FindingSystem,
} from "@/lib/fieldService";
import {
  contactDisplayName,
  type InspectionFinding,
  type Project,
} from "@/types/database";
import { Loader2 } from "lucide-react";

export default function FindingsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<InspectionFinding[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [system, setSystem] = useState<FindingSystem>("roof");
  const [severity, setSeverity] = useState<FindingSeverity>("info");
  const [notes, setNotes] = useState("");
  const [moisture, setMoisture] = useState("");
  const [thermal, setThermal] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [f, j] = await Promise.all([
      fetch(`/api/inspection-findings?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const fj = await f.json();
    const jj = await j.json();
    if (f.ok) setRows(fj.findings ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !title.trim()) return;
    setSaving(true);
    await fetch("/api/inspection-findings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        title: title.trim(),
        system,
        severity,
        notes: notes.trim() || null,
        moisture_reading: moisture.trim() || null,
        thermal_notes: thermal.trim() || null,
        project_id: projectId || null,
        contact_id: jobs.find((j) => j.id === projectId)?.contact_id || null,
      }),
    });
    setSaving(false);
    setTitle("");
    setNotes("");
    setMoisture("");
    setThermal("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/inspection-findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Findings</h1>
        <p className="text-muted-foreground">
          Room- and system-level checklist items with severity. Type notes on
          site — voice-to-text is not live. Photos live on the estimate (kind
          finding, thermal, or moisture).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Finding title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Select
          value={system}
          onValueChange={(v) => setSystem(v as FindingSystem)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FINDING_SYSTEMS.map((s) => (
              <SelectItem key={s} value={s}>
                {FINDING_SYSTEM_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={severity}
          onValueChange={(v) => setSeverity(v as FindingSeverity)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FINDING_SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {FINDING_SEVERITY_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Input
          placeholder="Moisture reading"
          value={moisture}
          onChange={(e) => setMoisture(e.target.value)}
        />
        <Input
          placeholder="Thermal notes"
          value={thermal}
          onChange={(e) => setThermal(e.target.value)}
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
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log finding"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Finding</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.title}</div>
                <div className="text-sm text-muted-foreground">
                  {[
                    FINDING_SYSTEM_LABELS[r.system as FindingSystem],
                    r.moisture_reading,
                    r.thermal_notes,
                    r.notes,
                    r.contact
                      ? contactDisplayName(r.contact)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </TableCell>
              <TableCell>{r.project?.name ?? "—"}</TableCell>
              <TableCell>
                {FINDING_SEVERITY_LABELS[r.severity as FindingSeverity] ??
                  r.severity}
              </TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) => patch(r.id, { status: v })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINDING_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {FINDING_STATUS_LABELS[s]}
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
