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
  PICKUP_METHODS,
  PICKUP_METHOD_LABELS,
  RATE_TYPES,
  RATE_TYPE_LABELS,
  RESERVATION_STATUSES,
  RESERVATION_STATUS_LABELS,
  CONDITION_KIND_LABELS,
  type PickupMethod,
  type RateType,
  type ReservationStatus,
  type ConditionKind,
} from "@/lib/fieldService";
import { formatCurrency } from "@/lib/format";
import {
  contactDisplayName,
  type Contact,
  type RentalAsset,
  type RentalReservation,
} from "@/types/database";
import { Loader2 } from "lucide-react";

export default function RentalsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<RentalReservation[]>([]);
  const [assets, setAssets] = useState<RentalAsset[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [pickup, setPickup] = useState<PickupMethod>("pickup");
  const [rateType, setRateType] = useState<RateType>("daily");
  const [rateAmount, setRateAmount] = useState("");
  const [deposit, setDeposit] = useState("");
  const [site, setSite] = useState("");
  const [waiver, setWaiver] = useState(false);
  const [photo, setPhoto] = useState("");
  const [fuel, setFuel] = useState("");
  const [damage, setDamage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [r, a, c] = await Promise.all([
      fetch(`/api/rental-reservations?workspaceId=${id}`),
      fetch(`/api/rental-assets?workspaceId=${id}`),
      fetch(`/api/contacts?workspaceId=${id}`),
    ]);
    const rj = await r.json();
    const aj = await a.json();
    const cj = await c.json();
    if (r.ok) setRows(rj.reservations ?? []);
    if (a.ok) setAssets(aj.assets ?? []);
    if (c.ok) setContacts(cj.contacts ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !startsOn || !endsOn) return;
    setSaving(true);
    await fetch("/api/rental-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        contact_id: contactId || null,
        asset_id: assetId || null,
        starts_on: startsOn,
        ends_on: endsOn,
        pickup_method: pickup,
        rate_type: rateType,
        rate_amount: Number(rateAmount) || 0,
        deposit_amount: Number(deposit) || 0,
        job_site_address: site.trim() || null,
        damage_waiver: waiver,
        status: "hold",
      }),
    });
    setSaving(false);
    setSite("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/rental-reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rentals</h1>
        <p className="text-muted-foreground">
          Holds, reservations, check-out and check-in. Deposit is an amount
          only — do not store card or ID numbers here. Late fees calculate from
          due date vs return date. Two-way SMS is not live.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          value={contactId || "none"}
          onValueChange={(v) => setContactId(v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No customer</SelectItem>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {contactDisplayName(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
        />
        <Input
          type="date"
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
        />
        <Select
          value={pickup}
          onValueChange={(v) => setPickup(v as PickupMethod)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PICKUP_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {PICKUP_METHOD_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={rateType}
          onValueChange={(v) => setRateType(v as RateType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATE_TYPES.map((m) => (
              <SelectItem key={m} value={m}>
                {RATE_TYPE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Rate amount"
          value={rateAmount}
          onChange={(e) => setRateAmount(e.target.value)}
        />
        <Input
          placeholder="Deposit amount"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
        />
        <Input
          placeholder="Job site (if delivery)"
          value={site}
          onChange={(e) => setSite(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={waiver}
            onChange={(e) => setWaiver(e.target.checked)}
          />
          Damage waiver
        </label>
        <Button onClick={add} disabled={saving || !startsOn || !endsOn}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create hold"}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Photo URL for check-out/in"
          value={photo}
          onChange={(e) => setPhoto(e.target.value)}
        />
        <Input
          placeholder="Fuel / hours reading"
          value={fuel}
          onChange={(e) => setFuel(e.target.value)}
        />
        <Input
          placeholder="Damage charge on return"
          value={damage}
          onChange={(e) => setDamage(e.target.value)}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rental</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Fees</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">
                  {r.asset?.name ?? "Unassigned"} · {r.starts_on} → {r.ends_on}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[
                    r.contact ? contactDisplayName(r.contact) : null,
                    PICKUP_METHOD_LABELS[r.pickup_method as PickupMethod],
                    r.job_site_address,
                    r.damage_waiver ? "waiver" : null,
                    r.account_terms,
                    ...(r.logs ?? []).map(
                      (log) =>
                        `${CONDITION_KIND_LABELS[log.kind as ConditionKind] ?? log.kind}${
                          log.fuel_level ? ` ${log.fuel_level}` : ""
                        }`
                    ),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) =>
                    patch(r.id, { status: v as ReservationStatus })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESERVATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {RESERVATION_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-sm">
                {formatCurrency(Number(r.rate_amount) || 0)} · dep{" "}
                {formatCurrency(Number(r.deposit_amount) || 0)}
                {Number(r.late_fee) > 0
                  ? ` · late ${formatCurrency(Number(r.late_fee))}`
                  : ""}
                {Number(r.damage_charge) > 0
                  ? ` · dmg ${formatCurrency(Number(r.damage_charge))}`
                  : ""}
              </TableCell>
              <TableCell className="space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch(r.id, {
                      action: "checkout",
                      photo_url: photo.trim() || null,
                      fuel_level: fuel.trim() || null,
                    })
                  }
                >
                  Check out
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch(r.id, {
                      action: "checkin",
                      photo_url: photo.trim() || null,
                      fuel_level: fuel.trim() || null,
                      damage_charge: Number(damage) || 0,
                    })
                  }
                >
                  Check in
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
