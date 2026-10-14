import type { Metadata } from "next";
import { DirectoryManager } from "@/components/directory-manager";
import { requireProfile } from "@/lib/auth";
import type { Enumerator, Profile, Supervisor } from "@/lib/types";

export const metadata: Metadata = { title: "Directory" };

export default async function DirectoryPage() {
  const { supabase } = await requireProfile(true);
  const [enumerators, supervisors, profiles] = await Promise.all([
    supabase.from("enumerators").select("*").order("full_name"),
    supabase.from("supervisors").select("*").order("full_name"),
    supabase.from("profiles").select("*").eq("status", "approved").order("full_name")
  ]);
  return <DirectoryManager enumerators={(enumerators.data || []) as Enumerator[]} supervisors={(supervisors.data || []) as Supervisor[]} profiles={(profiles.data || []) as Profile[]} />;
}
