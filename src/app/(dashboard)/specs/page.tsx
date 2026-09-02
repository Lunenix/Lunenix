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
  STEEL_FINISHES,
  STEEL_FINISH_LABELS,
  STEEL_METALS,
  STEEL_METAL_LABELS,
  type SteelFinish,
  type SteelMetal,
} from "@/lib/fieldService";
import { formatCurrency } from "@/lib/format";
import type { Project, SteelSpec } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function SpecsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<SteelSpec[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [thickness, setThickness] = useState("");
  const [metal, setMetal] = useState<SteelMetal>("mild");
  const [finish, setFinish] = useState<SteelFinish>("raw");
  const [validUntil, setValidUntil] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [s, j] = await Promise.all([
      fetch(`/api/steel-specs?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const sj = await s.json();
    const jj = await j.json();
    if (s.ok) setRows(sj.specs ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !name.trim()) return;
    setSaving(true);
    await fetch("/api/steel-specs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        metal,
        finish,
        thickness: thickness.trim() || null,
        cost: Number(cost) || 0,
        quote_valid_until: validUntil || null,
        project_id: projectId || null,
      }),
    });
    setSaving(false);
    setName("");
    setCost("");
    setThickness("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/steel-specs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Specs</h1>
        <p className="text-muted-foreground">
          Grade, gauge/thickness, and finish with client sign-off. Set quote
          valid-until because mill pricing moves. Orders use steel, aluminum,
          stainless, hardware, and gas types on Materials.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          value={metal}
          onValueChange={(v) => setMetal(v as SteelMetal)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STEEL_METALS.map((k) => (
              <SelectItem key={k} value={k}>
                {STEEL_METAL_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={finish}
          onValueChange={(v) => setFinish(v as SteelFinish)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STEEL_FINISHES.map((k) => (
              <SelectItem key={k} value={k}>
                {STEEL_FINISH_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="A36 / 1/4 in"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Thickness / gauge"
          value={thickness}
          onChange={(e) => setThickness(e.target.value)}
        />
        <Input
          placeholder="Material cost"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
        <Input
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
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
        <Button onClick={add} disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log spec"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Spec</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Quote valid</TableHead>
            <TableHead>Sign-off</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">
                  {STEEL_METAL_LABELS[r.metal as SteelMetal] ?? r.metal} ·{" "}
                  {r.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {STEEL_FINISH_LABELS[r.finish as SteelFinish] ?? r.finish}
                  {r.thickness ? ` · ${r.thickness}` : ""}
                  {r.project?.name ? ` · ${r.project.name}` : ""}
                </div>
              </TableCell>
              <TableCell>{formatCurrency(Number(r.cost) || 0)}</TableCell>
              <TableCell>{r.quote_valid_until ?? "—"}</TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant={r.signed_off_at ? "secondary" : "outline"}
                  onClick={() =>
                    patch(r.id, { signed_off: !r.signed_off_at })
                  }
                >
                  {r.signed_off_at ? "Signed off" : "Needs sign-off"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
