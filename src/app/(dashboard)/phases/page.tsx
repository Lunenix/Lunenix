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
  DELAY_CAUSES,
  DELAY_CAUSE_LABELS,
  PHASE_KINDS,
  PHASE_KIND_LABELS,
  PHASE_STATUSES,
  PHASE_STATUS_LABELS,
  type DelayCause,
  type PhaseKind,
  type PhaseStatus,
} from "@/lib/fieldService";
import type {
  ConstructionPhase,
  ConstructionSub,
  Project,
} from "@/types/database";
import { Loader2 } from "lucide-react";

export default function PhasesPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<ConstructionPhase[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [subs, setSubs] = useState<ConstructionSub[]>([]);
  const [kind, setKind] = useState<PhaseKind>("demo");
  const [projectId, setProjectId] = useState("");
  const [subId, setSubId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [p, j, s] = await Promise.all([
      fetch(`/api/construction-phases?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
      fetch(`/api/construction-subs?workspaceId=${id}`),
    ]);
    const pj = await p.json();
    const jj = await j.json();
    const sj = await s.json();
    if (p.ok) setRows(pj.phases ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
    if (s.ok) setSubs(sj.subs ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace) return;
    setSaving(true);
    await fetch("/api/construction-phases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        kind,
        project_id: projectId || null,
        sub_id: subId || null,
        starts_on: startsOn || null,
      }),
    });
    setSaving(false);
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/construction-phases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Phases</h1>
        <p className="text-muted-foreground">
          Demo → foundation → framing → rough-in → drywall → finish. This is a
          phase list with dates and delay causes — not a live Gantt. Crew
          assignment is on Techs; license/OSHA dates stay there.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={kind} onValueChange={(v) => setKind(v as PhaseKind)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHASE_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {PHASE_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Select
          value={subId || "none"}
          onValueChange={(v) => setSubId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sub" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No sub</SelectItem>
            {subs.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
        />
        <Button onClick={add} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add phase"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Phase</TableHead>
            <TableHead>Job / sub</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Delay</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">
                  {PHASE_KIND_LABELS[r.kind as PhaseKind] ?? r.kind}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[r.starts_on, r.ends_on, r.depends_on, `${r.percent_complete}%`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </TableCell>
              <TableCell>
                {[r.project?.name, r.sub?.name].filter(Boolean).join(" · ") ||
                  "—"}
              </TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) =>
                    patch(r.id, { status: v as PhaseStatus })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHASE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PHASE_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  value={r.delay_cause || "none"}
                  onValueChange={(v) =>
                    patch(r.id, {
                      delay_cause: v === "none" ? null : (v as DelayCause),
                    })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {DELAY_CAUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {DELAY_CAUSE_LABELS[s]}
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
