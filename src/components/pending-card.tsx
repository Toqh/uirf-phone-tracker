"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PendingCard({ name, disabled }: { name: string; disabled: boolean }) {
  const router = useRouter();
  return <section className="pending-card"><div className="brand-mark">⌛</div><p className="eyebrow">Account access</p><h1>{disabled ? "Account disabled" : "Approval pending"}</h1><p>Hello {name}. {disabled ? "An administrator has disabled this account." : "An administrator needs to approve your viewing access. You cannot see survey records yet."}</p><div className="button-row"><button className="button" onClick={() => router.refresh()}>Check again</button><button className="button ghost" onClick={async () => { await createClient().auth.signOut(); router.replace("/auth"); }}>Sign out</button></div></section>;
}
