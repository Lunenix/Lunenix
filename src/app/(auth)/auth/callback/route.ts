import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the Supabase email confirmation / OAuth / magic-link callback.
 *
 * Supports two flows:
 *  - OAuth / PKCE: exchanges the `code` query param for a session.
 *  - Magic link / email OTP: verifies the `token_hash` + `type` query params.
 * Then upserts the user's profile row and redirects to the intended
 * destination (defaults to /dashboard).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (code || (tokenHash && type)) {
    const supabase = createClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });

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
