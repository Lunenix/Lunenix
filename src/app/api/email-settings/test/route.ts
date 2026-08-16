import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendServerEmail } from "@/lib/email/sendServerEmail";

/**
 * POST /api/email-settings/test
 * Sends a test email using the workspace's currently-saved email configuration.
 * Body: { workspaceId, to? }  (defaults to the logged-in user's email)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const workspaceId = body.workspaceId;
  const to = (body.to || user.email || "").trim();

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }
  if (!to) {
    return NextResponse.json({ error: "A recipient address is required" }, { status: 400 });
  }

  const result = await sendServerEmail({
    workspaceId,
    to,
    toName: null,
    subject: "Lunenix email test ✅",
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
        <h2 style="color:#2d2d6e">Your email is working 🎉</h2>
        <p>This is a test message sent from your Lunenix workspace using your current
        email configuration.</p>
        <p style="font-size:13px;color:#666">If you received this, outgoing email is set up correctly.</p>
      </div>`,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || "Failed to send test email" },
      { status: 502 }
    );
  }
  return NextResponse.json({ success: true, to });
}
