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
  SUB_TRADES,
  SUB_TRADE_LABELS,
  type SubTrade,
} from "@/lib/fieldService";
import type { ConstructionSub } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function SubsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<ConstructionSub[]>([]);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState<SubTrade>("other");
  const [phone, setPhone] = useState("");
  const [coi, setCoi] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const res = await fetch(
      `/api/construction-subs?workspaceId=${activeWorkspace.id}`
    );
    const json = await res.json();
    if (res.ok) setRows(json.subs ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !name.trim()) return;
    setSaving(true);
    await fetch("/api/construction-subs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        name: name.trim(),
        trade,
        phone: phone.trim() || null,
        coi_expires: coi || null,
      }),
    });
    setSaving(false);
    setName("");
    setPhone("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/construction-subs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subs</h1>
        <p className="text-muted-foreground">
          Trade directory, COI dates, and rate notes. Do not store license or
          policy numbers here. Pay sub bills in Books. Assign a sub on Phases.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Company / name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select value={trade} onValueChange={(v) => setTrade(v as SubTrade)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUB_TRADES.map((s) => (
              <SelectItem key={s} value={s}>
                {SUB_TRADE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input type="date" value={coi} onChange={(e) => setCoi(e.target.value)} />
        <Button onClick={add} disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add sub"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sub</TableHead>
            <TableHead>Trade</TableHead>
            <TableHead>COI expires</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-muted-foreground">
                  {[r.phone, r.email, r.rate_notes].filter(Boolean).join(" · ")}
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={r.trade}
                  onValueChange={(v) => patch(r.id, { trade: v as SubTrade })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUB_TRADES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SUB_TRADE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>{r.coi_expires ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
