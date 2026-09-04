"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PROJECT_STATUS_LABELS, type Project } from "@/types/database";
import {
  JOB_WORK_PHASES,
  JOB_WORK_PHASE_LABELS,
  INSPECTION_PHASES,
  INSPECTION_PHASE_LABELS,
  isPaintingWorkspace,
  isInspectionWorkspace,
} from "@/lib/fieldService";
import { Loader2 } from "lucide-react";

export default function JobsPage() {
  const { activeWorkspace } = useWorkspace();
  const [jobs, setJobs] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const showPaintPhase = isPaintingWorkspace(activeWorkspace?.industry_preset);
  const showInspectionPhase = isInspectionWorkspace(
    activeWorkspace?.industry_preset
  );

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const res = await fetch(`/api/projects?workspaceId=${activeWorkspace.id}`);
    const json = await res.json();
    if (res.ok) setJobs(json.projects ?? []);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Jobs</h1>
        <p className="text-muted-foreground">
          Jobs are workspace projects. Approve an estimate to create one.
          Assign a tech, set route order
          {showPaintPhase ? ", paint phase" : ""}
          {showInspectionPhase
            ? ", inspection phase (scheduled → report pending → delivered)"
            : ""}
          , closing date, weather hold, and mark urgent for rush/same-day.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Route #</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due</TableHead>
            {showPaintPhase ? <TableHead>Phase</TableHead> : null}
            {showInspectionPhase ? <TableHead>Inspection</TableHead> : null}
            <TableHead>Close</TableHead>
            <TableHead>Weather</TableHead>
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => (
            <TableRow key={j.id}>
              <TableCell>
                <Link className="font-medium underline" href={`/projects/${j.id}`}>
                  {j.name}
                </Link>
              </TableCell>
              <TableCell>
                <input
                  className="w-16 rounded border bg-background px-2 py-1 text-sm"
                  type="number"
                  min={1}
                  defaultValue={j.route_position ?? ""}
                  key={`${j.id}-${j.route_position ?? "x"}`}
                  title="Stop order for today's route"
                  onBlur={async (e) => {
                    const raw = e.target.value.trim();
                    await fetch(`/api/projects/${j.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        route_position: raw === "" ? null : Number(raw),
                      }),
                    });
                    load();
                  }}
                />
              </TableCell>
              <TableCell>
                {PROJECT_STATUS_LABELS[j.status] ?? j.status}
              </TableCell>
              <TableCell>
                {j.due_date ? new Date(j.due_date).toLocaleDateString() : "—"}
              </TableCell>
              {showPaintPhase ? (
                <TableCell>
                  <select
                    className="rounded border bg-background px-2 py-1 text-sm"
                    value={j.work_phase ?? ""}
                    onChange={async (e) => {
                      await fetch(`/api/projects/${j.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          work_phase: e.target.value || null,
                        }),
                      });
                      load();
                    }}
                  >
                    <option value="">—</option>
                    {JOB_WORK_PHASES.map((p) => (
                      <option key={p} value={p}>
                        {JOB_WORK_PHASE_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </TableCell>
              ) : null}
              {showInspectionPhase ? (
                <TableCell>
                  <select
                    className="rounded border bg-background px-2 py-1 text-sm"
                    value={j.inspection_phase ?? ""}
                    onChange={async (e) => {
                      await fetch(`/api/projects/${j.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          inspection_phase: e.target.value || null,
                        }),
                      });
                      load();
                    }}
                  >
                    <option value="">—</option>
                    {INSPECTION_PHASES.map((p) => (
                      <option key={p} value={p}>
                        {INSPECTION_PHASE_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </TableCell>
              ) : null}
              <TableCell>
                <input
                  className="rounded border bg-background px-2 py-1 text-sm"
                  type="date"
                  defaultValue={j.closing_on ?? ""}
                  key={`${j.id}-close-${j.closing_on ?? "x"}`}
                  onBlur={async (e) => {
                    await fetch(`/api/projects/${j.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        closing_on: e.target.value || null,
                      }),
                    });
                    load();
                  }}
                />
              </TableCell>
              <TableCell>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(j.weather_hold)}
                    onChange={async (e) => {
                      await fetch(`/api/projects/${j.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          weather_hold: e.target.checked,
                          weather_hold_reason: e.target.checked
                            ? j.weather_hold_reason || "Weather delay"
                            : null,
                        }),
                      });
                      load();
                    }}
                  />
                  Hold
                </label>
              </TableCell>
              <TableCell className="space-x-1">
                {j.urgent ? <Badge>Urgent</Badge> : null}
                {j.weather_hold ? <Badge variant="outline">Weather</Badge> : null}
                {!j.assignee_id &&
                j.status !== "completed" &&
                j.status !== "cancelled" ? (
                  <Badge variant="outline">Unassigned</Badge>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
