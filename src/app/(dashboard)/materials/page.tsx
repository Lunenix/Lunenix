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
  MATERIAL_ORDER_STATUSES,
  MATERIAL_ORDER_STATUS_LABELS,
  MATERIAL_TYPES,
  MATERIAL_TYPE_LABELS,
  type MaterialOrderStatus,
  type MaterialType,
} from "@/lib/fieldService";
import type { MaterialOrder, Project } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function MaterialsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<MaterialOrder[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState("");
  const [vendor, setVendor] = useState("");
  const [deliveryOn, setDeliveryOn] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [type, setType] = useState<MaterialType>("shingles");
  const [status, setStatus] = useState<MaterialOrderStatus>("needed");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [o, j] = await Promise.all([
      fetch(`/api/material-orders?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const oj = await o.json();
    const jj = await j.json();
    if (o.ok) setRows(oj.orders ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !name.trim()) return;
    setSaving(true);
    await fetch("/api/material-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        material_type: type,
        color: color.trim() || null,
        quantity: quantity.trim() || null,
        vendor: vendor.trim() || null,
        status,
        delivery_on: deliveryOn || null,
        dropoff_notes: dropoff.trim() || null,
        project_id: projectId || null,
      }),
    });
    setSaving(false);
    setName("");
    setColor("");
    setQuantity("");
    setVendor("");
    setDeliveryOn("");
    setDropoff("");
    setStatus("needed");
    setProjectId("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/material-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Material orders</h1>
        <p className="text-muted-foreground">
          Order shingles, underlayment, and dumpsters tied to the job. Track
          delivery date and site drop-off. Waiting or delayed orders show on
          Field ops.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Item (Architectural shingles, 20-yd dumpster)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select value={type} onValueChange={(v) => setType(v as MaterialType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATERIAL_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {MATERIAL_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Color / type"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <Input
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <Input
          placeholder="Vendor"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
        />
        <Input
          type="date"
          value={deliveryOn}
          onChange={(e) => setDeliveryOn(e.target.value)}
        />
        <Input
          placeholder="Drop-off notes"
          value={dropoff}
          onChange={(e) => setDropoff(e.target.value)}
        />
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as MaterialOrderStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATERIAL_ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {MATERIAL_ORDER_STATUS_LABELS[s]}
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
        <Button onClick={add} disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add order"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-muted-foreground">
                  {MATERIAL_TYPE_LABELS[r.material_type]}
                  {r.color ? ` · ${r.color}` : ""}
                  {r.quantity ? ` · ${r.quantity}` : ""}
                  {r.vendor ? ` · ${r.vendor}` : ""}
                </div>
              </TableCell>
              <TableCell>{r.project?.name ?? "—"}</TableCell>
              <TableCell className="text-sm">
                {r.delivery_on ?? "—"}
                {r.dropoff_notes ? ` · ${r.dropoff_notes}` : ""}
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
                    {MATERIAL_ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {MATERIAL_ORDER_STATUS_LABELS[s]}
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
