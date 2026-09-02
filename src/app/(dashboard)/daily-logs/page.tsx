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
import type { ConstructionDailyLog, Project } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function DailyLogsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<ConstructionDailyLog[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [loggedOn, setLoggedOn] = useState("");
  const [weather, setWeather] = useState("");
  const [crew, setCrew] = useState("");
  const [work, setWork] = useState("");
  const [issues, setIssues] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [l, j] = await Promise.all([
      fetch(`/api/construction-daily-logs?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const lj = await l.json();
    const jj = await j.json();
    if (l.ok) setRows(lj.logs ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace) return;
    setSaving(true);
    await fetch("/api/construction-daily-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        project_id: projectId || null,
        logged_on: loggedOn || null,
        weather: weather.trim() || null,
        crew_notes: crew.trim() || null,
        work_completed: work.trim() || null,
        issues: issues.trim() || null,
      }),
    });
    setSaving(false);
    setWeather("");
    setCrew("");
    setWork("");
    setIssues("");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Daily logs</h1>
        <p className="text-muted-foreground">
          Weather, crew on site, work completed, issues, and safety notes.
          Progress and before-covering photos go on the estimate (kind
          progress, existing, or concealed). This is not a payroll timesheet.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          type="date"
          value={loggedOn}
          onChange={(e) => setLoggedOn(e.target.value)}
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
        <Input
          placeholder="Weather"
          value={weather}
          onChange={(e) => setWeather(e.target.value)}
        />
        <Input
          placeholder="Crew on site"
          value={crew}
          onChange={(e) => setCrew(e.target.value)}
        />
        <Input
          placeholder="Work completed"
          value={work}
          onChange={(e) => setWork(e.target.value)}
        />
        <Input
          placeholder="Issues / safety"
          value={issues}
          onChange={(e) => setIssues(e.target.value)}
        />
        <Button onClick={add} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log day"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.logged_on}</TableCell>
              <TableCell>{r.project?.name ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {[r.weather, r.crew_notes, r.work_completed, r.issues, r.safety_notes]
                  .filter(Boolean)
                  .join(" · ")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
