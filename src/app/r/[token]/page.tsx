"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FINDING_SEVERITY_LABELS,
  FINDING_SYSTEM_LABELS,
  type FindingSeverity,
  type FindingSystem,
} from "@/lib/fieldService";

type PublicFinding = {
  system: string;
  title: string;
  severity: string;
  notes: string | null;
  moisture_reading: string | null;
  thermal_notes: string | null;
};

type PublicReport = {
  title: string;
  summary: string | null;
  agent_name: string | null;
  seller_agent_name: string | null;
  property_type: string | null;
  property_size: string | null;
  closing_on: string | null;
  property: string | null;
  address: string | null;
};

export default function PublicInspectionReportPage({
  params,
}: {
  params: { token: string };
}) {
  const [report, setReport] = useState<PublicReport | null>(null);
  const [findings, setFindings] = useState<PublicFinding[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/inspection-reports/share/${params.token}`);
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError("This report link is not available.");
        return;
      }
      setReport(json.report);
      setFindings(json.findings ?? []);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  async function markDownloaded() {
    await fetch(`/api/inspection-reports/share/${params.token}`, {
      method: "POST",
    });
    window.print();
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <p>{error}</p>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-muted-foreground">
        Loading report…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8 print:p-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{report.title}</h1>
          <p className="text-muted-foreground">
            {[
              report.property,
              report.address,
              report.property_type,
              report.property_size,
              report.closing_on ? `closing ${report.closing_on}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-sm text-muted-foreground">
            {[
              report.agent_name ? `Agent: ${report.agent_name}` : null,
              report.seller_agent_name
                ? `Seller's agent: ${report.seller_agent_name}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button className="print:hidden" onClick={markDownloaded}>
          Print / PDF
        </Button>
      </div>
      {report.summary ? (
        <section>
          <h2 className="mb-2 text-xl font-semibold">Summary</h2>
          <p className="whitespace-pre-wrap text-sm">{report.summary}</p>
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-xl font-semibold">Findings</h2>
        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No findings listed.</p>
        ) : (
          <ul className="space-y-3">
            {findings.map((f, i) => (
              <li key={`${f.title}-${i}`} className="rounded border p-3">
                <div className="font-medium">
                  {FINDING_SEVERITY_LABELS[f.severity as FindingSeverity] ??
                    f.severity}{" "}
                  ·{" "}
                  {FINDING_SYSTEM_LABELS[f.system as FindingSystem] ?? f.system}{" "}
                  · {f.title}
                </div>
                {f.notes ? (
                  <p className="text-sm text-muted-foreground">{f.notes}</p>
                ) : null}
                {f.moisture_reading || f.thermal_notes ? (
                  <p className="text-sm text-muted-foreground">
                    {[f.moisture_reading, f.thermal_notes]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
