"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  isConstructionWorkspace,
  isSteelworkingWorkspace,
  isWoodworkingWorkspace,
} from "@/lib/fieldService";
import { verticalNavFor } from "@/lib/verticals/registry";

type Overview = {
  estimates: { draft: number; sent: number; approved: number };
  jobs: {
    scheduled: number;
    in_progress: number;
    completed: number;
    urgent: number;
    unassigned: number;
  };
  money: {
    revenue: number;
    expenses: number;
    bills_pending: number;
    profit: number;
    tax_set_aside?: number;
    recurring?: number;
    mileage?: number;
    miles?: number;
    aging: { current: number; d30: number; d60: number; d90: number };
  };
  fleet?: {
    available: number;
    reserved: number;
    out: number;
    maintenance: number;
  };
  alerts: { kind: string; label: string; href: string }[];
};

export default function FieldOpsPage() {
  const { activeWorkspace, isLoading } = useWorkspace();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const res = await fetch(
      `/api/field/overview?workspaceId=${activeWorkspace.id}`
    );
    const json = await res.json();
    if (res.ok) setData(json);
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  if (isLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!activeWorkspace || !data) {
    return (
      <p className="text-muted-foreground">Select a workspace first.</p>
    );
  }

  const preset = activeWorkspace.industry_preset;
  const fieldShortcuts = verticalNavFor(preset).filter(
    (item) => item.href !== "/field"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Field operations</h1>
        <p className="text-muted-foreground">
          {isSteelworkingWorkspace(preset)
            ? "Lead → consult/photos → drawings and PE stamp → metal specs with quote-valid dates → quote → mill order, permits, fab queue → weld/NDT logs → erection → punch → invoice. Approval still creates a job."
            : isWoodworkingWorkspace(preset)
            ? "Lead → consult/photos → designs and wood/finish/hardware sign-off → quote → materials and shop queue → fab photos → delivery/install → punch → invoice. Approval still creates a job."
            : isConstructionWorkspace(preset)
            ? "Lead → site visit → photos → bid → contract → permits/phases/subs → daily logs and draws → punch → close. Change orders need approval before extra work."
            : "Lead → visit → photos → estimate → job / recurring plan → invoice. Use the links below for this trade only."}{" "}
          Email customers from Estimates. Two-way SMS needs a text provider
          later. Receipt OCR is not auto-filled. Ask Luna for weather before
          dispatch; toggle weather hold on Jobs.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Estimates</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            Draft {data.estimates.draft} · Sent {data.estimates.sent} · Approved{" "}
            {data.estimates.approved}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Jobs</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            Active {data.jobs.in_progress} · Urgent {data.jobs.urgent} ·
            Unassigned {data.jobs.unassigned}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">P&amp;L (paid vs expenses)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {formatCurrency(data.money.profit)} profit ·{" "}
            {formatCurrency(data.money.revenue)} in ·{" "}
            {formatCurrency(data.money.expenses)} out
            {data.money.miles
              ? ` · ${Number(data.money.miles).toFixed(0)} mi`
              : ""}
            {typeof data.money.tax_set_aside === "number"
              ? ` · tax set-aside ~${formatCurrency(data.money.tax_set_aside)}`
              : ""}
            {typeof data.money.recurring === "number"
              ? ` · recurring ~${formatCurrency(data.money.recurring)}/mo`
              : ""}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AR aging</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            Now {formatCurrency(data.money.aging.current)} · 30d{" "}
            {formatCurrency(data.money.aging.d30)} · 60d{" "}
            {formatCurrency(data.money.aging.d60)} · 90+{" "}
            {formatCurrency(data.money.aging.d90)}
          </CardContent>
        </Card>
      </div>

      {data.fleet ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fleet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            Available {data.fleet.available} · Reserved {data.fleet.reserved} ·
            Out {data.fleet.out} · Maintenance {data.fleet.maintenance}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {data.alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exceptions right now.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.alerts.map((a, i) => (
                <li key={`${a.href}-${i}`}>
                  <Link className="text-primary underline" href={a.href}>
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {fieldShortcuts.map((item) => (
          <Button key={item.href} asChild variant={item.href === "/estimates" ? "default" : "outline"}>
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
        <Button asChild variant="outline">
          <Link href="/pipeline">Pipeline</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/invoices">Invoices</Link>
        </Button>
      </div>
    </div>
  );
}
