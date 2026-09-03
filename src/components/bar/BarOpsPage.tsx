"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2 } from "lucide-react";

export type BarField = {
  key: string;
  label: string;
  kind: "text" | "number" | "date" | "datetime-local" | "select" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
  list?: boolean;
};

export function BarOpsPage({
  title,
  description,
  kind,
  wrap,
  fields,
  apiBase = "/api/bar",
}: {
  title: string;
  description: string;
  kind: string;
  wrap: string;
  fields: BarField[];
  apiBase?: string;
}) {
  const { activeWorkspace } = useWorkspace();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    const res = await fetch(
      `${apiBase}/${kind}?workspaceId=${activeWorkspace.id}`
    );
    const json = await res.json();
    if (res.ok) setRows(Array.isArray(json[wrap]) ? json[wrap] : []);
  }, [activeWorkspace, kind, wrap, apiBase]);

  useEffect(() => {
    if (activeWorkspace) void load();
  }, [activeWorkspace, load]);

  async function add() {
    if (!activeWorkspace) return;
    const required = fields.filter((f) => f.required);
    for (const f of required) {
      if (!String(form[f.key] ?? "").trim()) return;
    }
    setSaving(true);
    const body: Record<string, unknown> = { workspace_id: activeWorkspace.id };
    for (const f of fields) {
      body[f.key] = form[f.key] || null;
    }
    await fetch(`${apiBase}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setForm({});
    void load();
  }

  const listFields = fields.filter((f) => f.list !== false).slice(0, 6);

  function labelFor(field: BarField, value: unknown) {
    if (value == null || value === "") return "—";
    const opt = field.options?.find((o) => o.value === String(value));
    return opt?.label ?? String(value);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key} className={f.kind === "textarea" ? "md:col-span-2" : ""}>
            <p className="mb-1 text-xs text-muted-foreground">{f.label}</p>
            {f.kind === "select" ? (
              <Select
                value={form[f.key] ?? f.options?.[0]?.value ?? ""}
                onValueChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(f.options ?? []).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : f.kind === "textarea" ? (
              <Textarea
                value={form[f.key] ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, [f.key]: e.target.value }))
                }
                rows={3}
              />
            ) : (
              <Input
                type={f.kind === "text" ? "text" : f.kind}
                value={form[f.key] ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, [f.key]: e.target.value }))
                }
              />
            )}
          </div>
        ))}
      </div>
      <Button onClick={() => void add()} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save
      </Button>
      <Table>
        <TableHeader>
          <TableRow>
            {listFields.map((f) => (
              <TableHead key={f.key}>{f.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={String(row.id)}>
              {listFields.map((f) => (
                <TableCell key={f.key}>{labelFor(f, row[f.key])}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
