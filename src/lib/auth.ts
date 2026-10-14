import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function requireProfile(requireAdmin = false) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = data as Profile | null;
  if (!profile || profile.status !== "approved") redirect("/pending");
  if (requireAdmin && profile.role !== "admin") redirect("/dashboard");
  return { supabase, profile, user };
}
