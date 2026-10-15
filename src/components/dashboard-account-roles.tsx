"use client";

import Link from "next/link";
import { useState } from "react";
import type { Profile } from "@/lib/types";
import { AccountRoleDialog } from "./account-role-dialog";

export function DashboardAccountRoles({ accounts, currentId, loadError = false }: { accounts: Profile[]; currentId: string; loadError?: boolean }) {
  const [search, setSearch] = useState(""); const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);
  const eligible = accounts.filter((account) => account.id !== currentId && account.status === "approved");
  const matches = eligible.filter((account) => account.id === selected || `${account.full_name} ${account.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  const account = eligible.find((item) => item.id === selected);
  return <section className="panel no-print" aria-labelledby="dashboard-roles-title">
    <div className="panel-header"><div><h2 id="dashboard-roles-title">Assign account roles</h2><span className="section-note">Choose an approved account and assign Supervisor, Admin, or Enumerator.</span></div><Link href="/accounts" className="button ghost">All accounts</Link></div>
    <div className="panel-body stack">{loadError ? <div className="notice error" role="alert">Accounts could not be loaded. Refresh the page to try again.</div> : <>
      <label>Find account<input value={search} onChange={(event) => { setSearch(event.target.value); setSelected(""); }} placeholder="Type a name or email" /></label>
      <label>Account<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select an account</option>{matches.map((item) => <option key={item.id} value={item.id}>{item.full_name} — {item.email} ({item.role})</option>)}</select></label>
      {!matches.length && <p>No approved accounts match. Pending accounts must be approved first.</p>}
      <div className="button-row"><button className="button primary" disabled={!account} onClick={() => account && setEditing(account)}>Assign role</button></div>
      <p className="muted compact-copy">Admins manage records and accounts. Supervisors and Enumerators have viewing access. You cannot change your own role.</p>
    </>}</div>
    {editing && <AccountRoleDialog account={editing} onClose={() => setEditing(null)} />}
  </section>;
}
