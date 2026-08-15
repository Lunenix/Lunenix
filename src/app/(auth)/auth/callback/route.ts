import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the Supabase email confirmation / OAuth callback.
 *
 * Exchanges the `code` query param for a session, upserts the user's profile
 * row, then redirects to the intended destination (defaults to /dashboard).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure a profile row exists for this user.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            full_name:
              (user.user_metadata?.full_name as string | undefined) ?? null,
            avatar_url:
              (user.user_metadata?.avatar_url as string | undefined) ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // On error, send the user back to login with a flag.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
