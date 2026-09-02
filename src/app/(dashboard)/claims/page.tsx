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
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
  CLAIM_PRICING_MODES,
  CLAIM_PRICING_LABELS,
  type ClaimStatus,
  type ClaimPricingMode,
} from "@/lib/fieldService";
import { contactDisplayName, type InsuranceClaim, type Project } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function ClaimsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<InsuranceClaim[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [company, setCompany] = useState("");
  const [claimNumber, setClaimNumber] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [status, setStatus] = useState<ClaimStatus>("filed");
  const [pricing, setPricing] = useState<ClaimPricingMode>("insurance");
  const [adjuster, setAdjuster] = useState("");
  const [adjusterAt, setAdjusterAt] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [c, j] = await Promise.all([
      fetch(`/api/insurance-claims?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const cj = await c.json();
    const jj = await j.json();
    if (c.ok) setRows(cj.claims ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace) return;
    setSaving(true);
    await fetch("/api/insurance-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        insurance_company: company.trim() || null,
        claim_number: claimNumber.trim() || null,
        policy_number: policyNumber.trim() || null,
        status,
        pricing_mode: pricing,
        adjuster_name: adjuster.trim() || null,
        adjuster_at: adjusterAt || null,
        project_id: projectId || null,
        contact_id: jobs.find((j) => j.id === projectId)?.contact_id || null,
      }),
    });
    setSaving(false);
    setCompany("");
    setClaimNumber("");
    setPolicyNumber("");
    setAdjuster("");
    setAdjusterAt("");
    setStatus("filed");
    setProjectId("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/insurance-claims/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Insurance claims</h1>
        <p className="text-muted-foreground">
          Track filed → adjuster → approved/denied → supplement → paid. Store
          company, policy/claim numbers, adjuster, Xactimate notes, and ACV vs
          depreciation on the record. Two-way SMS is not live. Do not paste
          policy numbers into Luna chat.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Insurance company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <Input
          placeholder="Claim number"
          value={claimNumber}
          onChange={(e) => setClaimNumber(e.target.value)}
        />
        <Input
          placeholder="Policy number"
          value={policyNumber}
          onChange={(e) => setPolicyNumber(e.target.value)}
        />
        <Input
          placeholder="Adjuster name"
          value={adjuster}
          onChange={(e) => setAdjuster(e.target.value)}
        />
        <Input
          type="datetime-local"
          value={adjusterAt}
          onChange={(e) => setAdjusterAt(e.target.value)}
          title="Meet the adjuster"
        />
        <Select
          value={pricing}
          onValueChange={(v) => setPricing(v as ClaimPricingMode)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLAIM_PRICING_MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {CLAIM_PRICING_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as ClaimStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLAIM_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {CLAIM_STATUS_LABELS[s]}
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
        <Button onClick={add} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add claim"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job / company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Adjuster</TableHead>
            <TableHead>Payments</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">
                  {r.project?.name ?? "—"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {r.insurance_company || "No company"} · {CLAIM_PRICING_LABELS[r.pricing_mode]}
                  {r.contact ? ` · ${contactDisplayName(r.contact)}` : ""}
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={r.status}
                  onValueChange={(v) => patch(r.id, { status: v })}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLAIM_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CLAIM_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-sm">
                {r.adjuster_name || "—"}
                {r.adjuster_at
                  ? ` · ${new Date(r.adjuster_at).toLocaleString()}`
                  : ""}
              </TableCell>
              <TableCell className="space-y-1 text-sm">
                <div className="flex items-center gap-1">
                  <span>ACV</span>
                  <Input
                    className="h-8 w-24"
                    defaultValue={r.acv_amount ?? ""}
                    key={`${r.id}-acv-${r.acv_amount}`}
                    onBlur={(e) =>
                      patch(r.id, {
                        acv_amount: e.target.value.trim() === "" ? null : e.target.value,
                      })
                    }
                  />
                </div>
                <label className="flex items-center gap-1 text-xs">
                  Paid
                  <Input
                    type="date"
                    className="h-8 w-36"
                    defaultValue={r.acv_paid_on ?? ""}
                    key={`${r.id}-acvp-${r.acv_paid_on}`}
                    onBlur={(e) => patch(r.id, { acv_paid_on: e.target.value || null })}
                  />
                </label>
                <div className="flex items-center gap-1">
                  <span>Dep</span>
                  <Input
                    className="h-8 w-24"
                    defaultValue={r.depreciation_amount ?? ""}
                    key={`${r.id}-dep-${r.depreciation_amount}`}
                    onBlur={(e) =>
                      patch(r.id, {
                        depreciation_amount:
                          e.target.value.trim() === "" ? null : e.target.value,
                      })
                    }
                  />
                </div>
                <label className="flex items-center gap-1 text-xs">
                  Paid
                  <Input
                    type="date"
                    className="h-8 w-36"
                    defaultValue={r.depreciation_paid_on ?? ""}
                    key={`${r.id}-depp-${r.depreciation_paid_on}`}
                    onBlur={(e) =>
                      patch(r.id, { depreciation_paid_on: e.target.value || null })
                    }
                  />
                </label>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
