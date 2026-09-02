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
  MAINT_STATUSES,
  MAINT_STATUS_LABELS,
  type MaintStatus,
} from "@/lib/fieldService";
import { formatCurrency } from "@/lib/format";
import type { RentalAsset, RentalMaintenance } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function MaintenancePage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<RentalMaintenance[]>([]);
  const [assets, setAssets] = useState<RentalAsset[]>([]);
  const [title, setTitle] = useState("");
  const [assetId, setAssetId] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [hours, setHours] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [m, a] = await Promise.all([
      fetch(`/api/rental-maintenance?workspaceId=${id}`),
      fetch(`/api/rental-assets?workspaceId=${id}`),
    ]);
    const mj = await m.json();
    const aj = await a.json();
    if (m.ok) setRows(mj.items ?? []);
    if (a.ok) setAssets(aj.assets ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !title.trim()) return;
    setSaving(true);
    await fetch("/api/rental-maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        title: title.trim(),
        asset_id: assetId || null,
        due_on: dueOn || null,
        hours_at_service: hours.trim() ? Number(hours) : null,
        cost: cost.trim() ? Number(cost) : null,
        status: "scheduled",
      }),
    });
    setSaving(false);
    setTitle("");
    setHours("");
    setCost("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/rental-maintenance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Maintenance</h1>
        <p className="text-muted-foreground">
          Service intervals, repairs, and hours on the meter. Completing a
          repair returns the asset to the yard. This is fleet servicing — not
          consumable inventory.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Service / repair title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Select
          value={assetId || "none"}
          onValueChange={(v) => setAssetId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Asset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No asset</SelectItem>
            {assets.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dueOn}
          onChange={(e) => setDueOn(e.target.value)}
        />
        <Input
          placeholder="Hours at service"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
        <Input
          placeholder="Cost"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
        <Button onClick={add} disabled={saving || !title.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log service"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Work</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Due</TableHead>
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
                    r.hours_at_service != null
                      ? `${r.hours_at_service} hrs`
                      : null,
                    r.cost != null ? formatCurrency(Number(r.cost)) : null,
                    r.notes,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </TableCell>
              <TableCell>{r.asset?.name ?? "—"}</TableCell>
              <TableCell>{r.due_on ?? "—"}</TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) =>
                    patch(r.id, { status: v as MaintStatus })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {MAINT_STATUS_LABELS[s]}
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
