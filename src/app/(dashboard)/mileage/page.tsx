"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DEFAULT_MILEAGE_RATE } from "@/lib/fieldService";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { MileageLog, Project } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function MileagePage() {
  const { activeWorkspace } = useWorkspace();
  const [logs, setLogs] = useState<MileageLog[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [miles, setMiles] = useState("");
  const [rate, setRate] = useState(String(DEFAULT_MILEAGE_RATE));
  const [drivenOn, setDrivenOn] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("Job visit");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [m, p] = await Promise.all([
      fetch(`/api/mileage?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const mj = await m.json();
    const pj = await p.json();
    if (m.ok) setLogs(mj.logs ?? []);
    if (p.ok) setJobs(pj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function addLog() {
    if (!activeWorkspace || !miles) return;
    setSaving(true);
    const res = await fetch("/api/mileage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        miles: Number(miles),
        rate_per_mile: Number(rate) || DEFAULT_MILEAGE_RATE,
        driven_on: drivenOn,
        origin: origin || null,
        destination: destination || null,
        purpose: purpose || null,
        project_id: projectId || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast(json.error || "Could not save mileage", "error");
      return;
    }
    setMiles("");
    setOrigin("");
    setDestination("");
    load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/mileage/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast("Could not delete trip", "error");
      return;
    }
    load();
  }

  const totalMiles = logs.reduce((s, l) => s + Number(l.miles), 0);
  const totalAmount = logs.reduce((s, l) => s + Number(l.amount), 0);

  if (!activeWorkspace) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mileage</h1>
        <p className="text-muted-foreground">
          Log trips for jobs and estimate visits. Amount is miles × rate (default
          ${DEFAULT_MILEAGE_RATE.toFixed(2)}/mi). Totals roll into Field ops
          expenses.
        </p>
      </div>
      <p className="text-sm">
        {totalMiles.toFixed(1)} miles · {formatCurrency(totalAmount) ?? "$0"}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Miles</Label>
          <Input
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            placeholder="24.5"
          />
        </div>
        <div className="space-y-1">
          <Label>Rate per mile</Label>
          <Input value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Date</Label>
          <Input
            type="date"
            value={drivenOn}
            onChange={(e) => setDrivenOn(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Job (optional)</Label>
          <Select
            value={projectId || "none"}
            onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
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
        </div>
        <div className="space-y-1">
          <Label>From</Label>
          <Input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Shop"
          />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Job address"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>Purpose</Label>
          <Input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>
      </div>
      <Button onClick={addLog} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Log trip
      </Button>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Miles</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.driven_on}</TableCell>
              <TableCell>
                {[l.origin, l.destination].filter(Boolean).join(" → ") ||
                  l.purpose ||
                  "—"}
              </TableCell>
              <TableCell>{l.project?.name ?? "—"}</TableCell>
              <TableCell>{Number(l.miles).toFixed(1)}</TableCell>
              <TableCell>{formatCurrency(Number(l.amount))}</TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(l.id)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
