import type { Metadata } from "next";
import { AccountManager } from "@/components/account-manager";
import { requireProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const { supabase, profile } = await requireProfile(true);
  const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  return <AccountManager accounts={(data || []) as Profile[]} currentId={profile.id} />;
}
