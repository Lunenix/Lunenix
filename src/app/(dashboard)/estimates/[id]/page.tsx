"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ESTIMATE_STATUS_LABELS } from "@/lib/fieldService";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { Estimate, EstimateLineItem } from "@/types/database";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function EstimateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [est, setEst] = useState<Estimate | null>(null);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/estimates/${id}`);
    const json = await res.json();
    if (res.ok) setEst(json.estimate);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/estimates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Update failed");
    setEst(json.estimate);
  }

  async function addLine() {
    if (!est || !desc.trim() || !amount) return;
    const items: EstimateLineItem[] = [
      ...(est.line_items ?? []),
      { description: desc.trim(), amount: Number(amount) },
    ];
    await patch({ line_items: items });
    setDesc("");
    setAmount("");
  }

  async function act(action: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/estimates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      if (json.estimate) setEst(json.estimate);
      if (action === "approve" && json.project_id) {
        toast("Job created from estimate", "success");
        router.push(`/projects/${json.project_id}`);
      }
      if (action === "invoice" && json.invoice?.id) {
        router.push(`/invoices/${json.invoice.id}`);
      }
      if (action === "send") toast("Estimate emailed", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/estimates/${id}/photos`, {
      method: "POST",
      body,
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast(json.error || "Upload failed", "error");
      return;
    }
    load();
  }

  if (!est) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/estimates">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{est.title}</h1>
          <p className="text-sm text-muted-foreground">
            {ESTIMATE_STATUS_LABELS[est.status]} · {formatCurrency(Number(est.total))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => act("send")} disabled={busy}>
          Email estimate
        </Button>
        <Button variant="outline" onClick={() => act("approve")} disabled={busy}>
          Customer approved — create job
        </Button>
        <Button variant="outline" onClick={() => act("invoice")} disabled={busy}>
          Draft invoice from job
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items / pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(est.line_items ?? []).map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.description}</span>
              <span>{formatCurrency(Number(item.amount))}</span>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="Labor / part"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <Input
              className="w-32"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={addLine}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visit photos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPhoto(f);
            }}
          />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {(est.photos ?? []).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.file_url}
                alt={p.caption ?? ""}
                className="h-28 w-full rounded object-cover"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
