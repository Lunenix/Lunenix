"use client";

import { BarOpsPage, type BarField } from "@/components/bar/BarOpsPage";

export function PlannerOpsPage(props: {
  title: string;
  description: string;
  kind: string;
  wrap: string;
  fields: BarField[];
}) {
  return <BarOpsPage {...props} apiBase="/api/planner" />;
}
