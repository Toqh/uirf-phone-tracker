import type { Metadata } from "next";
import { PhoneRegisterPage } from "@/components/phone-register-page";
import { requireProfile } from "@/lib/auth";
import type { Enumerator, PhoneRow, Supervisor } from "@/lib/types";

export const metadata: Metadata = { title: "Phones" };

export default async function PhonesPage() {
  const { supabase, profile } = await requireProfile();
  const [phones, enumerators, supervisors] = await Promise.all([
    supabase.from("phone_register").select("*").order("serial_number"),
    supabase.from("enumerators").select("*").order("full_name"),
    supabase.from("supervisors").select("*").order("full_name")
  ]);
  return <PhoneRegisterPage phones={(phones.data || []) as PhoneRow[]} enumerators={(enumerators.data || []) as Enumerator[]} supervisors={(supervisors.data || []) as Supervisor[]} isAdmin={profile.role === "admin"} />;
}
