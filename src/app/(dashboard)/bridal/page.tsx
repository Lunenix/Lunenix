"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type Overview = {
  floor: { showroom: number; fitting: number };
  money: { overdue_invoices: number; open_invoices: number; bills_pending: number };
  alerts: { kind: string; label: string; href: string }[];
};

export default function BridalOpsHubPage() {
  const { activeWorkspace, isLoading } = useWorkspace();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const res = await fetch(
      `/api/bridal/overview?workspaceId=${activeWorkspace.id}`
    );
    const json = await res.json();
    if (res.ok) setData(json);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) void load();
  }, [activeWorkspace, load]);

  if (isLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!activeWorkspace || !data) {
    return <p className="text-muted-foreground">Select a workspace first.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bridal ops</h1>
        <p className="text-sm text-muted-foreground">
          Tagged floor inventory: rack, section, hanger, and QR/barcode text.
          Search Floor inventory by style, size, or designer. This is not a live
          3D engine or RFID reader. Style matching is notes plus inspiration
          image URLs — not AR try-on. Two-way SMS and receipt OCR are not live.
          Luna never collects cards.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Floor</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.floor.showroom} in showroom · {data.floor.fitting} in fitting
            room
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.money.overdue_invoices} overdue · {data.money.open_invoices}{" "}
            sent
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bills</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.money.bills_pending} designer / vendor bills pending
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.alerts.length === 0 ? (
            <p className="text-muted-foreground">No exceptions right now.</p>
          ) : (
            data.alerts.map((a, i) => (
              <p key={`${a.href}-${i}`}>
                <Link href={a.href} className="underline">
                  {a.label}
                </Link>
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
