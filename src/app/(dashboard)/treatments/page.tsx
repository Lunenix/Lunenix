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
  TREATMENT_METHODS,
  TREATMENT_METHOD_LABELS,
  TREATMENT_STATUSES,
  TREATMENT_STATUS_LABELS,
  type TreatmentMethod,
  type TreatmentStatus,
} from "@/lib/fieldService";
import { contactDisplayName, type PestTreatment, type Project } from "@/types/database";
import { Loader2 } from "lucide-react";

export default function TreatmentsPage() {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<PestTreatment[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [product, setProduct] = useState("");
  const [epa, setEpa] = useState("");
  const [method, setMethod] = useState<TreatmentMethod>("spray");
  const [qty, setQty] = useState("");
  const [pest, setPest] = useState("");
  const [area, setArea] = useState("");
  const [treatedOn, setTreatedOn] = useState("");
  const [guarantee, setGuarantee] = useState("30");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [t, j] = await Promise.all([
      fetch(`/api/pest-treatments?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const tj = await t.json();
    const jj = await j.json();
    if (t.ok) setRows(tj.treatments ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace || !product.trim()) return;
    setSaving(true);
    await fetch("/api/pest-treatments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        product_name: product.trim(),
        epa_number: epa.trim() || null,
        method,
        quantity: qty.trim() || null,
        target_pest: pest.trim() || null,
        treatment_area: area.trim() || null,
        treated_on: treatedOn || null,
        guarantee_days: guarantee,
        project_id: projectId || null,
        contact_id: jobs.find((j) => j.id === projectId)?.contact_id || null,
      }),
    });
    setSaving(false);
    setProduct("");
    setEpa("");
    setQty("");
    setPest("");
    setArea("");
    load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/pest-treatments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Treatments</h1>
        <p className="text-muted-foreground">
          Log product, EPA number, method, quantity, target pest, and area per
          visit for state recordkeeping. Set a guarantee window for free
          re-treatment. Two-way SMS is not live.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Product name"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        />
        <Input
          placeholder="EPA registration #"
          value={epa}
          onChange={(e) => setEpa(e.target.value)}
        />
        <Select
          value={method}
          onValueChange={(v) => setMethod(v as TreatmentMethod)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TREATMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {TREATMENT_METHOD_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Quantity"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <Input
          placeholder="Target pest"
          value={pest}
          onChange={(e) => setPest(e.target.value)}
        />
        <Input
          placeholder="Treatment area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
        <Input
          type="date"
          value={treatedOn}
          onChange={(e) => setTreatedOn(e.target.value)}
        />
        <Input
          placeholder="Guarantee days"
          value={guarantee}
          onChange={(e) => setGuarantee(e.target.value)}
        />
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
        <Button onClick={add} disabled={saving || !product.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log treatment"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product / pest</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Guarantee</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.product_name}</div>
                <div className="text-sm text-muted-foreground">
                  {[
                    r.epa_number ? `EPA ${r.epa_number}` : null,
                    TREATMENT_METHOD_LABELS[r.method as TreatmentMethod],
                    r.quantity,
                    r.target_pest,
                    r.treatment_area,
                    r.treated_on,
                    r.contact ? contactDisplayName(r.contact) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </TableCell>
              <TableCell>{r.project?.name ?? "—"}</TableCell>
              <TableCell className="text-sm">
                {r.guarantee_days ? `${r.guarantee_days}d` : "—"}
                {r.retreatment_until ? ` until ${r.retreatment_until}` : ""}
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
                    {TREATMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {TREATMENT_STATUS_LABELS[s]}
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
