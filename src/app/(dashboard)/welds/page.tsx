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
  NDT_RESULTS,
  NDT_RESULT_LABELS,
  WELD_RESULTS,
  WELD_RESULT_LABELS,
  WELD_TYPES,
  WELD_TYPE_LABELS,
  type NdtResult,
  type WeldResult,
  type WeldType,
} from "@/lib/fieldService";
import type { Project, SteelWeldLog } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function WeldsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<SteelWeldLog[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [welder, setWelder] = useState("");
  const [joint, setJoint] = useState("");
  const [weldType, setWeldType] = useState<WeldType>("mig");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [w, j] = await Promise.all([
      fetch(`/api/steel-welds?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const wj = await w.json();
    const jj = await j.json();
    if (w.ok) setRows(wj.welds ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !welder.trim()) return;
    setSaving(true);
    await fetch("/api/steel-welds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        welder_name: welder.trim(),
        weld_type: weldType,
        joint: joint.trim() || null,
        project_id: projectId || null,
      }),
    });
    setSaving(false);
    setWelder("");
    setJoint("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/steel-welds/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welds</h1>
        <p className="text-muted-foreground">
          Weld log per job: welder, type, joint, visual result, and NDT.
          Welder WPS/AWS and crane/OSHA dates live on Techs (license and CE).
          Failed welds and failed NDT show on Field ops.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Welder"
          value={welder}
          onChange={(e) => setWelder(e.target.value)}
        />
        <Select
          value={weldType}
          onValueChange={(v) => setWeldType(v as WeldType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WELD_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {WELD_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Joint"
          value={joint}
          onChange={(e) => setJoint(e.target.value)}
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
        <Button onClick={add} disabled={saving || !welder.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log weld"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Weld</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Visual</TableHead>
            <TableHead>NDT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.welder_name}</div>
                <div className="text-sm text-muted-foreground">
                  {r.joint ?? "—"}
                  {r.project?.name ? ` · ${r.project.name}` : ""}
                </div>
              </TableCell>
              <TableCell>
                {WELD_TYPE_LABELS[r.weld_type as WeldType] ?? r.weld_type}
              </TableCell>
              <TableCell>
                <Select
                  value={r.result}
                  onValueChange={(v) =>
                    patch(r.id, { result: v as WeldResult })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WELD_RESULTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {WELD_RESULT_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  value={r.ndt_result}
                  onValueChange={(v) =>
                    patch(r.id, { ndt_result: v as NdtResult })
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NDT_RESULTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {NDT_RESULT_LABELS[s]}
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
