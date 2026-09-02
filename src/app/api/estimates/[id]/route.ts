import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceRecord } from "@/lib/supabase/workspaceAccess";
import { ESTIMATE_STATUSES, estimateTotals } from "@/lib/fieldService";
import { sendServerEmail } from "@/lib/email/sendServerEmail";
import { contactDisplayName, type Contact } from "@/types/database";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("estimates", params.id);
  if ("error" in authed) return authed.error;

  const { data, error } = await authed.supabase
    .from("estimates")
    .select("*, contact:contacts(*), photos:estimate_photos(*)")
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ estimate: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("estimates", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json();
  const update: Record<string, unknown> = {};
  const keys = [
    "title",
    "job_type",
    "notes",
    "address",
    "visit_at",
    "valid_until",
    "lead_id",
    "visit_task_id",
    "contact_id",
    "tax_rate",
    "line_items",
  ];
  for (const key of keys) {
    if (key in body) update[key] = body[key];
  }
  if (typeof body.status === "string" && ESTIMATE_STATUSES.includes(body.status)) {
    update.status = body.status;
    if (body.status === "sent") update.sent_at = new Date().toISOString();
    if (body.status === "viewed") update.viewed_at = new Date().toISOString();
  }
  if ("line_items" in update || "tax_rate" in update) {
    const { data: current } = await authed.supabase
      .from("estimates")
      .select("line_items, tax_rate")
      .eq("id", authed.recordId)
      .eq("workspace_id", authed.workspaceId)
      .single();
    const items = Array.isArray(update.line_items)
      ? update.line_items
      : current?.line_items ?? [];
    const taxRate =
      typeof update.tax_rate === "number"
        ? update.tax_rate
        : Number(current?.tax_rate) || 0;
    Object.assign(update, estimateTotals(items as { amount?: number }[], taxRate));
  }

  const { data, error } = await authed.supabase
    .from("estimates")
    .update(update)
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .select("*, contact:contacts(*), photos:estimate_photos(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ estimate: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("estimates", params.id);
  if ("error" in authed) return authed.error;
  const { error } = await authed.supabase
    .from("estimates")
    .delete()
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** POST { action: send | approve | invoice } */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authed = await requireWorkspaceRecord("estimates", params.id);
  if ("error" in authed) return authed.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  const { data: estimate, error: loadErr } = await authed.supabase
    .from("estimates")
    .select("*, contact:contacts(*)")
    .eq("id", authed.recordId)
    .eq("workspace_id", authed.workspaceId)
    .maybeSingle();
  if (loadErr || !estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  if (action === "send") {
    const contact = estimate.contact as Contact | null;
    const email = contact?.email;
    if (!email) {
      return NextResponse.json(
        { error: "Contact needs an email to send the estimate." },
        { status: 400 }
      );
    }
    const name = contact ? contactDisplayName(contact) : "there";
    const sent = await sendServerEmail({
      workspaceId: authed.workspaceId,
      to: email,
      toName: name,
      contactId: estimate.contact_id,
      subject: `Estimate: ${estimate.title}`,
      html: `<p>Hi ${name},</p><p>Your estimate for <strong>${estimate.title}</strong> totals <strong>$${Number(estimate.total).toFixed(2)}</strong>.</p><p>Reply to this email to approve, or tell us if you have questions.</p>`,
    });
    if (!sent.success) {
      return NextResponse.json(
        { error: sent.error || "Could not send estimate." },
        { status: 500 }
      );
    }
    const { data } = await authed.supabase
      .from("estimates")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", authed.recordId)
      .eq("workspace_id", authed.workspaceId)
      .select("*, contact:contacts(*)")
      .single();
    return NextResponse.json({ estimate: data });
  }

  if (action === "approve") {
    if (estimate.project_id) {
      return NextResponse.json({ estimate }, { status: 200 });
    }
    const { data: project, error: pErr } = await authed.supabase
      .from("projects")
      .insert({
        workspace_id: authed.workspaceId,
        name: estimate.title,
        description: estimate.notes,
        status: "active",
        contact_id: estimate.contact_id,
        lead_id: estimate.lead_id,
        address: estimate.address,
        budget: estimate.total,
        currency: estimate.currency,
        estimate_id: estimate.id,
        due_date: estimate.visit_at
          ? String(estimate.visit_at).slice(0, 10)
          : null,
      })
      .select("id")
      .single();
    if (pErr || !project) {
      return NextResponse.json(
        { error: pErr?.message ?? "Could not create job from estimate." },
        { status: 500 }
      );
    }
    const { data } = await authed.supabase
      .from("estimates")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        project_id: project.id,
      })
      .eq("id", authed.recordId)
      .eq("workspace_id", authed.workspaceId)
      .select("*, contact:contacts(*)")
      .single();

    const { data: workspace } = await authed.supabase
      .from("workspaces")
      .select("industry_preset")
      .eq("id", authed.workspaceId)
      .maybeSingle();
    if (workspace?.industry_preset === "rental_company") {
      const start = estimate.visit_at
        ? String(estimate.visit_at).slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const rawEnd = estimate.valid_until
        ? String(estimate.valid_until).slice(0, 10)
        : start;
      const end = rawEnd >= start ? rawEnd : start;
      await authed.supabase.from("rental_reservations").insert({
        workspace_id: authed.workspaceId,
        contact_id: estimate.contact_id,
        estimate_id: estimate.id,
        starts_on: start,
        ends_on: end,
        pickup_method: "pickup",
        job_site_address: estimate.address || null,
        status: "reserved",
        rate_type: "daily",
        rate_amount: Number(estimate.total) || 0,
        notes: "Created from approved estimate",
      });
    }

    return NextResponse.json({ estimate: data, project_id: project.id });
  }

  if (action === "invoice") {
    if (!estimate.project_id) {
      return NextResponse.json(
        { error: "Approve the estimate into a job before invoicing." },
        { status: 400 }
      );
    }
    const suffix = estimate.id.slice(0, 6).toUpperCase();
    const issue = new Date();
    const due = new Date(issue);
    due.setDate(due.getDate() + 14);
    const { data: invoice, error: iErr } = await authed.supabase
      .from("invoices")
      .insert({
        workspace_id: authed.workspaceId,
        contact_id: estimate.contact_id,
        project_id: estimate.project_id,
        invoice_number: `INV-${suffix}`,
        status: "draft",
        issue_date: issue.toISOString().slice(0, 10),
        due_date: due.toISOString().slice(0, 10),
        line_items: estimate.line_items ?? [],
        subtotal: estimate.subtotal,
        tax_rate: estimate.tax_rate,
        tax_amount: estimate.tax_amount,
        total: estimate.total,
        currency: estimate.currency,
        notes: estimate.title,
      })
      .select("*")
      .single();
    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 500 });
    }
    return NextResponse.json({ invoice }, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
