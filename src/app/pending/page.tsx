import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { PendingCard } from "@/components/pending-card";

export default async function PendingPage() {
  const { profile } = await getAccount();
  if (profile?.status === "approved") redirect("/dashboard");
  return <main className="center-page"><PendingCard name={profile?.full_name || "there"} disabled={profile?.status === "disabled"} /></main>;
}
