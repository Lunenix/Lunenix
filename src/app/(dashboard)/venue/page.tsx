"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type Overview = {
  events: { upcoming: number; booked: number };
  utilization: { booked_days: number; horizon_days: number };
  money: { overdue_invoices: number; open_invoices: number; bills_pending: number };
  alerts: { kind: string; label: string; href: string }[];
};

export default function VenueOpsHubPage() {
  const { activeWorkspace, isLoading } = useWorkspace();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const res = await fetch(
      `/api/venue/overview?workspaceId=${activeWorkspace.id}`
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
        <h1 className="text-2xl font-bold tracking-tight">Venue ops</h1>
        <p className="text-sm text-muted-foreground">
          Bookings, date holds, insurance/COI, turnover, and damage deposits.
          Availability is the booking list by date and room — not a live
          multi-room calendar widget. Layouts store photo URLs and capacity
          notes, not a CAD builder. Two-way SMS and receipt OCR are not live.
          Luna never collects cards.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bookings</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.events.booked} booked · {data.events.upcoming} open
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Utilization (90 days)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {data.utilization.booked_days} dates held or booked of{" "}
            {data.utilization.horizon_days} days
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
