"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  PERMIT_STATUSES,
  PERMIT_STATUS_LABELS,
  type PermitStatus,
} from "@/lib/fieldService";
import type { JobPermit, Project } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function PermitsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<JobPermit[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState<PermitStatus>("needed");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [p, j] = await Promise.all([
      fetch(`/api/job-permits?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const pj = await p.json();
    const jj = await j.json();
    if (p.ok) setRows(pj.permits ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !name.trim()) return;
    setSaving(true);
    await fetch("/api/job-permits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        permit_number: number.trim() || null,
        status,
        project_id: projectId || null,
      }),
    });
    setSaving(false);
    setName("");
    setNumber("");
    setStatus("needed");
    setProjectId("");
    load();
  }

  async function setPermitStatus(id: string, next: PermitStatus) {
    await fetch(`/api/job-permits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Permits</h1>
        <p className="text-muted-foreground">
          Track every permit pulled and approved for Home &amp; Field jobs.
          Mark not required when the work does not need one.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Permit / work type"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Permit number"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as PermitStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERMIT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PERMIT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectId || "__none"} onValueChange={(v) => setProjectId(v === "__none" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">No job</SelectItem>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={add} disabled={saving || !name.trim()}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Log permit
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Permit</TableHead>
            <TableHead>Number</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Pulled</TableHead>
            <TableHead>Approved</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No permits logged yet. Record pulled and approved dates here
                for every Home &amp; Field job that needs one.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>{r.permit_number || "—"}</TableCell>
              <TableCell>{r.project?.name || "—"}</TableCell>
              <TableCell>
                {r.pulled_on
                  ? new Date(r.pulled_on).toLocaleDateString()
                  : "—"}
              </TableCell>
              <TableCell>
                {r.approved_on
                  ? new Date(r.approved_on).toLocaleDateString()
                  : "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === "approved" || r.status === "passed" ? "default" : "outline"}>
                    {PERMIT_STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                  <Select
                    value={r.status}
                    onValueChange={(v) =>
                      setPermitStatus(r.id, v as PermitStatus)
                    }
                  >
                    <SelectTrigger className="h-8 w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERMIT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {PERMIT_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
