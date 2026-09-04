"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type Overview = {
  events: { booked: number; upcoming: number };
  food_cost_pct: number | null;
  money: { overdue_invoices: number; open_invoices: number; bills_pending: number };
  alerts: { kind: string; label: string; href: string }[];
};

export default function CateringOpsHubPage() {
  const { activeWorkspace, isLoading } = useWorkspace();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const res = await fetch(
      `/api/catering/overview?workspaceId=${activeWorkspace.id}`
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
        <h1 className="text-2xl font-bold tracking-tight">Catering ops</h1>
        <p className="text-sm text-muted-foreground">
          Events, menus, kitchen prep, health licenses, and food-cost notes.
          Prep checklists are not a live recipe scaler. Two-way SMS, GPS
          routing, and receipt OCR are not live. Luna never collects cards.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Events</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.events.booked} booked · {data.events.upcoming} open
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Food cost %</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.food_cost_pct == null
              ? "Enter food cost and package price on booked events"
              : `${data.food_cost_pct}% average on booked events`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.money.overdue_invoices} overdue · {data.money.open_invoices}{" "}
            sent · {data.money.bills_pending} bills
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
