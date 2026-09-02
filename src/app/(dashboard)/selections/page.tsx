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
  SHOP_SELECTION_KINDS,
  SHOP_SELECTION_KIND_LABELS,
  type ShopSelectionKind,
} from "@/lib/fieldService";
import { formatCurrency } from "@/lib/format";
import type { Project, ShopSelection } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function SelectionsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<ShopSelection[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [kind, setKind] = useState<ShopSelectionKind>("species");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [s, j] = await Promise.all([
      fetch(`/api/shop-selections?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const sj = await s.json();
    const jj = await j.json();
    if (s.ok) setRows(sj.selections ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !name.trim()) return;
    setSaving(true);
    await fetch("/api/shop-selections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        kind,
        cost: Number(cost) || 0,
        project_id: projectId || null,
      }),
    });
    setSaving(false);
    setName("");
    setCost("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/shop-selections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Selections</h1>
        <p className="text-muted-foreground">
          Species, finish/stain samples, and hardware with client sign-off.
          Cost rolls into the quote. Sample photos can be a URL here or
          inspiration/swatch photos on Estimates. Material orders use lumber,
          hardware, and stain types.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          value={kind}
          onValueChange={(v) => setKind(v as ShopSelectionKind)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHOP_SELECTION_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {SHOP_SELECTION_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Walnut / oil / Blum"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Material cost"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
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
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log selection"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Selection</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Sign-off</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">
                  {SHOP_SELECTION_KIND_LABELS[r.kind as ShopSelectionKind] ??
                    r.kind}
                  : {r.name}
                </div>
              </TableCell>
              <TableCell>{r.project?.name ?? "—"}</TableCell>
              <TableCell>{formatCurrency(Number(r.cost) || 0)}</TableCell>
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
