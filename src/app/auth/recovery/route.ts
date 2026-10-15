import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  let verified = false;
  try {
    const supabase = await createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      verified = !error;
    } else if (tokenHash && type === "recovery") {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      verified = !error;
    }
  } catch { /* A failed exchange must never redirect to the password form. */ }
  const target = request.nextUrl.clone();
  target.pathname = verified ? "/auth/reset-password" : "/auth/forgot-password";
  target.search = verified ? "" : "?error=invalid-link";
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
