import { cache } from "react";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Share the account lookup within one server render, never across requests/users.
export const getAccount = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const expiredSession = authError && ["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired", "bad_jwt"].includes(authError.code || "");
  if (authError && !expiredSession && !isAuthSessionMissingError(authError) && authError.status !== 401 && authError.status !== 403) {
    console.warn("Session validation failed", { name: authError.name, code: authError.code, status: authError.status });
    throw new Error("Unable to check your session. Please try again.");
  }
  if (!user) redirect("/auth");
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Unable to load your account. Please try again.");
  const profile = data as Profile | null;
  return { supabase, profile, user };
});

export async function requireProfile(requireAdmin = false) {
  const account = await getAccount();
  const { profile } = account;
  if (!profile || profile.status !== "approved") redirect("/pending");
  if (requireAdmin && profile.role !== "admin") redirect("/dashboard");
  return { ...account, profile };
}
