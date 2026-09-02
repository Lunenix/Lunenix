"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InventoryItem } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function InventoryPage() {
  const { activeWorkspace } = useWorkspace();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("0");
  const [reorder, setReorder] = useState("2");

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const res = await fetch(`/api/inventory?workspaceId=${activeWorkspace.id}`);
    const json = await res.json();
    if (res.ok) setItems(json.items ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !name.trim()) return;
    await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        quantity: Number(qty) || 0,
        reorder_at: Number(reorder) || 0,
      }),
    });
    setName("");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory</h1>
        <p className="text-muted-foreground">
          Stock check before a job. Low-stock rows are highlighted. Set
          calibrated-on for meters and cameras.
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Part name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          className="w-24"
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <Input
          className="w-28"
          placeholder="Reorder at"
          value={reorder}
          onChange={(e) => setReorder(e.target.value)}
        />
        <Button onClick={add}>Add part</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Part</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Reorder at</TableHead>
            <TableHead>Calibrated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => (
            <TableRow
              key={i.id}
              className={
                Number(i.quantity) <= Number(i.reorder_at) ? "bg-destructive/10" : ""
              }
            >
              <TableCell>{i.name}</TableCell>
              <TableCell>{i.quantity}</TableCell>
              <TableCell>{i.reorder_at}</TableCell>
              <TableCell>
                <input
                  className="rounded border bg-background px-2 py-1 text-sm"
                  type="date"
                  defaultValue={i.calibrated_on ?? ""}
                  key={`${i.id}-cal-${i.calibrated_on ?? "x"}`}
                  onBlur={async (e) => {
                    await fetch(`/api/inventory/${i.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        calibrated_on: e.target.value || null,
                      }),
                    });
                    load();
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!activeWorkspace ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : null}
    </div>
  );
}
