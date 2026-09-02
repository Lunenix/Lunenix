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
  PAINT_SHEENS,
  PAINT_SHEEN_LABELS,
  HOA_COLOR_STATUSES,
  HOA_COLOR_STATUS_LABELS,
  type PaintSheen,
  type HoaColorStatus,
} from "@/lib/fieldService";
import {
  contactDisplayName,
  type HoaColorApproval,
  type JobFinishSpec,
  type Project,
} from "@/types/database";
import { Loader2 } from "lucide-react";

export default function ColorsPage() {
  const { activeWorkspace } = useWorkspace();
  const [specs, setSpecs] = useState<JobFinishSpec[]>([]);
  const [hoas, setHoas] = useState<HoaColorApproval[]>([]);
  const [jobs, setJobs] = useState<Project[]>([]);
  const [room, setRoom] = useState("");
  const [brand, setBrand] = useState("");
  const [colorName, setColorName] = useState("");
  const [code, setCode] = useState("");
  const [sheen, setSheen] = useState<PaintSheen>("eggshell");
  const [qty, setQty] = useState("");
  const [supplier, setSupplier] = useState("");
  const [match, setMatch] = useState("");
  const [projectId, setProjectId] = useState("");
  const [hoaNotes, setHoaNotes] = useState("");
  const [hoaProject, setHoaProject] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const id = activeWorkspace.id;
    const [s, h, j] = await Promise.all([
      fetch(`/api/finish-specs?workspaceId=${id}`),
      fetch(`/api/hoa-approvals?workspaceId=${id}`),
      fetch(`/api/projects?workspaceId=${id}`),
    ]);
    const sj = await s.json();
    const hj = await h.json();
    const jj = await j.json();
    if (s.ok) setSpecs(sj.specs ?? []);
    if (h.ok) setHoas(hj.approvals ?? []);
    if (j.ok) setJobs(jj.projects ?? []);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) load();
  }, [activeWorkspace, load]);

  async function addSpec() {
    if (!activeWorkspace || !room.trim()) return;
    setSaving(true);
    await fetch("/api/finish-specs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        room_or_surface: room.trim(),
        brand: brand.trim() || null,
        color_name: colorName.trim() || null,
        color_code: code.trim() || null,
        sheen,
        quantity: qty.trim() || null,
        supplier: supplier.trim() || null,
        match_notes: match.trim() || null,
        project_id: projectId || null,
        contact_id: jobs.find((j) => j.id === projectId)?.contact_id || null,
      }),
    });
    setSaving(false);
    setRoom("");
    setBrand("");
    setColorName("");
    setCode("");
    setQty("");
    setSupplier("");
    setMatch("");
    load();
  }

  async function addHoa() {
    if (!activeWorkspace) return;
    setSaving(true);
    await fetch("/api/hoa-approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: activeWorkspace.id,
        scheme_notes: hoaNotes.trim() || null,
        status: "needed",
        project_id: hoaProject || null,
      }),
    });
    setSaving(false);
    setHoaNotes("");
    setHoaProject("");
    load();
  }

  async function patchSpec(id: string, body: Record<string, unknown>) {
    await fetch(`/api/finish-specs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function patchHoa(id: string, body: Record<string, unknown>) {
    await fetch(`/api/hoa-approvals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Colors &amp; finishes</h1>
        <p className="text-muted-foreground">
          Store brand, code, sheen, and quantity per room. Get client sign-off
          before paint. Exterior jobs: track HOA color approval. Color history
          stays on the job and contact for repeats. Two-way SMS is not live.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Room or surface (living room walls)"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        />
        <Input
          placeholder="Brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <Input
          placeholder="Color name"
          value={colorName}
          onChange={(e) => setColorName(e.target.value)}
        />
        <Input
          placeholder="Color code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Select value={sheen} onValueChange={(v) => setSheen(v as PaintSheen)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAINT_SHEENS.map((s) => (
              <SelectItem key={s} value={s}>
                {PAINT_SHEEN_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Quantity (2 gal)"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <Input
          placeholder="Supplier"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
        <Input
          placeholder="Match notes / swatch"
          value={match}
          onChange={(e) => setMatch(e.target.value)}
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
        <Button onClick={addSpec} disabled={saving || !room.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add color"}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Room / color</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Sign-off</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {specs.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="font-medium">{r.room_or_surface}</div>
                <div className="text-sm text-muted-foreground">
                  {[r.brand, r.color_name, r.color_code, r.sheen ? PAINT_SHEEN_LABELS[r.sheen as PaintSheen] : null, r.quantity, r.supplier]
                    .filter(Boolean)
                    .join(" · ")}
                  {r.match_notes ? ` · ${r.match_notes}` : ""}
                  {r.contact ? ` · ${contactDisplayName(r.contact)}` : ""}
                </div>
              </TableCell>
              <TableCell>{r.project?.name ?? "—"}</TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant={r.client_signed_off_at ? "secondary" : "outline"}
                  onClick={() =>
                    patchSpec(r.id, {
                      client_signed_off_at: r.client_signed_off_at
                        ? null
                        : new Date().toISOString(),
                    })
                  }
                >
                  {r.client_signed_off_at ? "Signed off" : "Mark signed off"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div>
        <h2 className="mb-2 text-xl font-semibold">HOA exterior color approval</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Exterior only. Interior jobs: log not required so Field ops stays clean.
        </p>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Approved scheme / color notes"
            value={hoaNotes}
            onChange={(e) => setHoaNotes(e.target.value)}
          />
          <Select
            value={hoaProject || "none"}
            onValueChange={(v) => setHoaProject(v === "none" ? "" : v)}
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
          <Button onClick={addHoa} disabled={saving} variant="outline">
            Add HOA record
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scheme</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hoas.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">
                  {r.scheme_notes || "—"}
                </TableCell>
                <TableCell>{r.project?.name ?? "—"}</TableCell>
                <TableCell>
                  <Select
                    value={r.status}
                    onValueChange={(v) => patchHoa(r.id, { status: v })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOA_COLOR_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {HOA_COLOR_STATUS_LABELS[s]}
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
    </div>
  );
}
