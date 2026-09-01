import { NextResponse } from "next/server";
import { verifyWorkspaceAccess } from "@/lib/auth/workspace-guard";
import {
  compareCalendarEvents,
  isYmd,
  ymdFromUnknown,
  type CalendarEvent,
} from "@/lib/calendar";

function parseBound(raw: string | null, fallback: string): string {
  if (raw && isYmd(raw)) return raw;
  return fallback;
}

/**
 * GET /api/calendar?workspaceId=&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Dated tasks, invoices, and projects in this workspace only.
 */
export async function GET(request: Request) {
  const auth = await verifyWorkspaceAccess(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const fallbackFrom = `${now.getFullYear()}-${month}-01`;
  const fallbackTo = `${now.getFullYear()}-${month}-${String(last).padStart(2, "0")}`;

  const from = parseBound(searchParams.get("from"), fallbackFrom);
  const to = parseBound(searchParams.get("to"), fallbackTo);
  if (from > to) {
    return NextResponse.json({ error: "from must be on or before to" }, { status: 400 });
  }

  const { supabase, workspaceId } = auth;

  const [tasksRes, invoicesRes, projectsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, due_date")
      .eq("workspace_id", workspaceId)
      .not("due_date", "is", null)
      .gte("due_date", from)
      .lte("due_date", to)
      .limit(500),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, due_date")
      .eq("workspace_id", workspaceId)
      .not("due_date", "is", null)
      .gte("due_date", from)
      .lte("due_date", to)
      .limit(500),
    supabase
      .from("projects")
      .select("id, name, status, due_date")
      .eq("workspace_id", workspaceId)
      .not("due_date", "is", null)
      .gte("due_date", from)
      .lte("due_date", to)
      .limit(500),
  ]);

  if (tasksRes.error || invoicesRes.error || projectsRes.error) {
    return NextResponse.json(
      {
        error:
          tasksRes.error?.message ||
          invoicesRes.error?.message ||
          projectsRes.error?.message ||
          "Calendar fetch failed",
      },
      { status: 500 }
    );
  }

  const events: CalendarEvent[] = [];

  for (const row of tasksRes.data ?? []) {
    const date = ymdFromUnknown(row.due_date);
    if (!date) continue;
    events.push({
      id: `task:${row.id}`,
      kind: "task",
      title: typeof row.title === "string" ? row.title : "Task",
      date,
      href: "/tasks",
      status: typeof row.status === "string" ? row.status : "",
    });
  }

  for (const row of invoicesRes.data ?? []) {
    const date = ymdFromUnknown(row.due_date);
    if (!date) continue;
    const number =
      typeof row.invoice_number === "string" ? row.invoice_number : "Invoice";
    events.push({
      id: `invoice:${row.id}`,
      kind: "invoice",
      title: `Invoice ${number}`,
      date,
      href: `/invoices/${row.id}`,
      status: typeof row.status === "string" ? row.status : "",
    });
  }

  for (const row of projectsRes.data ?? []) {
    const date = ymdFromUnknown(row.due_date);
    if (!date) continue;
    events.push({
      id: `project:${row.id}`,
      kind: "project",
      title: typeof row.name === "string" ? row.name : "Project",
      date,
      href: `/projects/${row.id}`,
      status: typeof row.status === "string" ? row.status : "",
    });
  }

  events.sort(compareCalendarEvents);

  return NextResponse.json({ from, to, events });
}
