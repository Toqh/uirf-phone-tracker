import type { Metadata } from "next";
import { Reports } from "@/components/reports";
import { requireProfile } from "@/lib/auth";
import type { MovementRow, PhoneRow } from "@/lib/types";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { supabase, profile } = await requireProfile();
  const [phones, movements] = await Promise.all([
    supabase.from("phone_register").select("*").order("serial_number"),
    supabase.from("movement_history").select("*").order("collected_at", { ascending: false })
  ]);
  return <Reports phones={(phones.data || []) as PhoneRow[]} movements={(movements.data || []) as MovementRow[]} generatedBy={profile.full_name} />;
}
