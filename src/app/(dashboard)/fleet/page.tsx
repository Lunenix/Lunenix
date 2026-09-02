"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABELS,
  ASSET_LOCATIONS,
  ASSET_LOCATION_LABELS,
  ASSET_STATUSES,
  ASSET_STATUS_LABELS,
  daysBetween,
  type AssetCategory,
  type AssetLocation,
  type AssetStatus,
} from "@/lib/fieldService";
import { formatCurrency } from "@/lib/format";
import type { RentalAsset, RentalReservation } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function FleetPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<RentalAsset[]>([]);
  const [reservations, setReservations] = useState<RentalReservation[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<AssetCategory>("other");
  const [daily, setDaily] = useState("");
  const [hourly, setHourly] = useState("");
  const [weekly, setWeekly] = useState("");
  const [purchase, setPurchase] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [a, r] = await Promise.all([
      fetch(`/api/rental-assets?workspaceId=${id}`),
      fetch(`/api/rental-reservations?workspaceId=${id}`),
    ]);
    const aj = await a.json();
    const rj = await r.json();
    if (a.ok) setRows(aj.assets ?? []);
    if (r.ok) setReservations(rj.reservations ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  const rentedDaysByAsset = useMemo(() => {
    const map = new Map<string, number>();
    for (const res of reservations) {
      if (!res.asset_id || res.status === "cancelled") continue;
      const days = Math.max(1, daysBetween(res.starts_on, res.ends_on));
      map.set(res.asset_id, (map.get(res.asset_id) ?? 0) + days);
    }
    return map;
  }, [reservations]);

  async function add() {
    if (!activeWorkspace || !name.trim()) return;
    setSaving(true);
    await fetch("/api/rental-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        sku: sku.trim() || null,
        category,
        daily_rate: Number(daily) || 0,
        hourly_rate: Number(hourly) || 0,
        weekly_rate: Number(weekly) || 0,
        purchase_cost: purchase.trim() ? Number(purchase) : null,
      }),
    });
    setSaving(false);
    setName("");
    setSku("");
    setDaily("");
    setHourly("");
    setWeekly("");
    setPurchase("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/rental-assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fleet</h1>
        <p className="text-muted-foreground">
          Equipment inventory, location, and utilization (rental days vs
          purchase cost). Put barcode/QR in SKU. GPS auto-track is not live —
          type last known location on the asset.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Asset name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="SKU / barcode"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
        />
        <Select
          value={category}
          onValueChange={(v) => setCategory(v as AssetCategory)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSET_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {ASSET_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Daily rate"
          value={daily}
          onChange={(e) => setDaily(e.target.value)}
        />
        <Input
          placeholder="Hourly rate"
          value={hourly}
          onChange={(e) => setHourly(e.target.value)}
        />
        <Input
          placeholder="Weekly rate"
          value={weekly}
          onChange={(e) => setWeekly(e.target.value)}
        />
        <Input
          placeholder="Purchase cost"
          value={purchase}
          onChange={(e) => setPurchase(e.target.value)}
        />
        <Button onClick={add} disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add asset"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Daily</TableHead>
            <TableHead>Utilization</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const rented = rentedDaysByAsset.get(r.id) ?? 0;
            const cost = Number(r.purchase_cost) || 0;
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {[
                      ASSET_CATEGORY_LABELS[r.category as AssetCategory],
                      r.sku,
                      r.hours_used ? `${r.hours_used} hrs` : null,
                      r.next_service_on
                        ? `service ${r.next_service_on}`
                        : null,
                      r.last_known_location,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={r.location}
                    onValueChange={(v) =>
                      patch(r.id, { location: v as AssetLocation })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_LOCATIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ASSET_LOCATION_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={r.status}
                    onValueChange={(v) =>
                      patch(r.id, { status: v as AssetStatus })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ASSET_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{formatCurrency(Number(r.daily_rate) || 0)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {rented} rental days
                  {cost
                    ? ` · buy ${formatCurrency(cost)}`
                    : ""}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
