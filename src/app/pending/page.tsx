import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PendingCard } from "@/components/pending-card";

export default async function PendingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const { data: profile } = await supabase.from("profiles").select("status, full_name").eq("id", user.id).maybeSingle();
  if (profile?.status === "approved") redirect("/dashboard");
  return <main className="center-page"><PendingCard name={profile?.full_name || "there"} disabled={profile?.status === "disabled"} /></main>;
}
