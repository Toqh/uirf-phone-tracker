"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { formatLagos } from "@/lib/format";
import { callRpc } from "@/lib/supabase/rpc";
import { friendlyError, onlineError } from "./online-action";

export function PendingApprovals({ accounts, total, loadError = false }: { accounts: Profile[]; total: number; loadError?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(""); const running = useRef(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [approved, setApproved] = useState<string[]>([]);
  const [refreshing, startTransition] = useTransition();
  const pending = accounts.filter((account) => account.status === "pending" && !approved.includes(account.id));
  const remaining = Math.max(0, total - accounts.filter((account) => account.status === "pending" && approved.includes(account.id)).length);
  function refresh() { startTransition(() => router.refresh()); }
  async function approve(account: Profile) {
    if (running.current) return;
    const offline = onlineError(); if (offline) { setError(offline); return; }
    running.current = true; setBusy(account.id); setError(""); setMessage("");
    try {
      const result = await callRpc("approve_account", { p_profile_id: account.id });
      if (result.error) { setError(friendlyError(result.error)); return; }
      setApproved((ids) => [...ids, account.id]);
      setMessage(`${account.full_name} has been approved for viewing access.`);
      refresh();
    } finally { running.current = false; setBusy(""); }
  }
  if (!loadError && remaining === 0) return null;
  return <section className="panel no-print" aria-labelledby="pending-approvals-title">
    <div className="panel-header"><div><h2 id="pending-approvals-title">Signup approvals{!loadError && ` (${remaining})`}</h2><span className="section-note">Approve viewing access here. Admin promotion is managed separately in Accounts.</span></div><div className="button-row"><button className="button" disabled={Boolean(busy) || refreshing} onClick={refresh}>{refreshing ? "Refreshing…" : "Refresh signups"}</button><Link className="button ghost" href="/accounts">All accounts</Link></div></div>
    <div className="panel-body stack">
      {loadError ? <div className="notice error" role="alert">Signup requests could not be loaded. Refresh to try again.</div> : <>
        {pending.map((account) => <div className="approval-card" key={account.id}><div><strong>{account.full_name}</strong><p>{account.email}</p><span className="section-note role-label">{account.role}</span><small>Requested {formatLagos(account.created_at)}</small></div><button className="button primary" disabled={Boolean(busy) || refreshing} onClick={() => approve(account)} aria-label={`Approve viewing for ${account.full_name}`}>{busy === account.id ? "Approving…" : "Approve signup"}</button></div>)}
        {!pending.length && <p>{remaining ? "Refresh to load more signup requests, or open All accounts." : "No signups awaiting approval."}</p>}
        {remaining > pending.length && <p>Showing {pending.length} of {remaining} requests. <Link href="/accounts">View all pending accounts</Link>.</p>}
      </>}
      {error && <div className="notice error" role="alert">{error}</div>}
      {message && <div className="notice" role="status">{message}</div>}
    </div>
  </section>;
}
