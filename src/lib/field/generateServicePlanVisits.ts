import type { SupabaseClient } from "@supabase/supabase-js";
import { advanceServiceVisitDate } from "@/lib/fieldService";

type PlanRow = {
  id: string;
  workspace_id: string;
  contact_id: string;
  project_id: string | null;
  name: string;
  frequency: string;
  amount: number | string;
  auto_invoice: boolean;
  next_visit_on: string;
};

export async function generateDueServicePlanVisits(
  admin: SupabaseClient,
  today = new Date().toISOString().slice(0, 10)
): Promise<{ generated: number; invoiced: number }> {
  const { data: plans, error } = await admin
    .from("service_plans")
    .select(
      "id, workspace_id, contact_id, project_id, name, frequency, amount, auto_invoice, next_visit_on, seasonal_on, is_active"
    )
    .eq("is_active", true)
    .lte("next_visit_on", today)
    .limit(100);

  if (error) throw new Error(error.message);

  let generated = 0;
  let invoiced = 0;
  for (const raw of plans ?? []) {
    const plan = raw as PlanRow & { seasonal_on?: boolean };
    if (plan.frequency === "seasonal" && plan.seasonal_on === false) continue;

    const visitOn = String(plan.next_visit_on).slice(0, 10);
    const { error: taskErr } = await admin.from("tasks").insert({
      workspace_id: plan.workspace_id,
      contact_id: plan.contact_id,
      project_id: plan.project_id,
      title: `Recurring visit: ${plan.name}`,
      description:
        "Auto-generated from Recurring plans. Confirm crew, route order, and weather before dispatch.",
      status: "todo",
      priority: "medium",
      due_date: visitOn,
    });
    if (taskErr) continue;
    generated += 1;

    const amt = Number(plan.amount) || 0;
    if (plan.auto_invoice && amt > 0) {
      const issue = today;
      const due = advanceServiceVisitDate(today, "biweekly");
      const number = `SP-${plan.id.slice(0, 8)}-${visitOn.replace(/-/g, "")}`;
      const { error: invErr } = await admin.from("invoices").insert({
        workspace_id: plan.workspace_id,
        contact_id: plan.contact_id,
        project_id: plan.project_id,
        invoice_number: number,
        status: "draft",
        issue_date: issue,
        due_date: due,
        line_items: [{ description: plan.name, amount: amt }],
        subtotal: amt,
        tax_rate: 0,
        tax_amount: 0,
        total: amt,
        currency: "USD",
        notes: "Draft from recurring service plan",
      });
      if (!invErr) invoiced += 1;
    }

    await admin
      .from("service_plans")
      .update({
        last_generated_on: visitOn,
        next_visit_on: advanceServiceVisitDate(visitOn, plan.frequency),
      })
      .eq("id", plan.id)
      .eq("workspace_id", plan.workspace_id);
  }

  return { generated, invoiced };
}
