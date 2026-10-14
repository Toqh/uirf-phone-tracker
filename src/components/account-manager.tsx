"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatLagos } from "@/lib/format";
import { friendlyError, onlineError } from "./online-action";
import type { Profile } from "@/lib/types";

export function AccountManager({ accounts, currentId }: { accounts: Profile[]; currentId: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(""); const [message, setMessage] = useState("");
  async function action(id: string, fn: "approve_account" | "promote_to_admin" | "set_account_enabled", enabled?: boolean) {
    const offline = onlineError(); if (offline) return setMessage(offline);
    setBusy(`${fn}-${id}`); setMessage(""); const args = fn === "set_account_enabled" ? { p_profile_id: id, p_enabled: enabled } : { p_profile_id: id };
    const { error } = await createClient().rpc(fn, args); setBusy(""); if (error) return setMessage(friendlyError(error)); router.refresh();
  }
  return <><header className="page-header"><div><h1>Account access</h1><p>Approval grants read access. Promotion separately grants management rights.</p></div></header>{message && <div className="notice error">{message}</div>}
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Person</th><th>Email</th><th>Requested</th><th>Access</th><th>Role</th><th>Actions</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td>{account.full_name}{account.id === currentId && <small className="you-label">You</small>}</td><td>{account.email}</td><td>{formatLagos(account.created_at)}</td><td><span className={`badge ${account.status}`}>{account.status}</span></td><td><span className="role-label">{account.role}</span></td><td><div className="button-row">{account.status === "pending" && <button className="button primary" disabled={Boolean(busy)} onClick={() => action(account.id, "approve_account")}>Approve viewing</button>}{account.status === "approved" && account.role === "supervisor" && account.id !== currentId && <button className="button accent" disabled={Boolean(busy)} onClick={() => action(account.id, "promote_to_admin")}>Promote to Admin</button>}{account.status !== "pending" && account.id !== currentId && <button className="button" disabled={Boolean(busy)} onClick={() => action(account.id, "set_account_enabled", account.status === "disabled")}>{account.status === "disabled" ? "Enable" : "Disable"}</button>}</div></td></tr>)}</tbody></table></div></section>
  </>;
}
