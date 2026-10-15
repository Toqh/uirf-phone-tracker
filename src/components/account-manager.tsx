"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/supabase/rpc";
import { formatLagos } from "@/lib/format";
import { friendlyError, onlineError } from "./online-action";
import type { Profile } from "@/lib/types";
import { matchesFilter, sortRows, visibleSelection } from "@/lib/register";
import { BulkActions, SelectRow, SortControls } from "./register-tools";

export function AccountManager({ accounts, currentId }: { accounts: Profile[]; currentId: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(""); const [message, setMessage] = useState("");
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("all"); const [role, setRole] = useState("all");
  const [exclude, setExclude] = useState(false); const [sort, setSort] = useState("full_name"); const [direction, setDirection] = useState("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const rows = sortRows(accounts.filter((account) => `${account.full_name} ${account.email}`.toLowerCase().includes(query.toLowerCase()) && matchesFilter(account.status, status, exclude) && matchesFilter(account.role, role, false)), (account) => account[sort as "full_name" | "email" | "created_at" | "status" | "role"], direction);
  const selectable = rows.filter((account) => account.id !== currentId);
  const selectedRows = visibleSelection(selectable, selected);
  async function action(id: string, fn: "approve_account" | "promote_to_admin" | "set_account_enabled", enabled?: boolean) {
    const offline = onlineError(); if (offline) return setMessage(offline);
    setBusy(`${fn}-${id}`); setMessage(""); const args = fn === "set_account_enabled" ? { p_profile_id: id, p_enabled: enabled } : { p_profile_id: id };
    const { error } = await callRpc(fn, args); setBusy(""); if (error) return setMessage(friendlyError(error)); router.refresh();
  }
  return <><header className="page-header"><div><h1>Account access</h1><p>Approval grants read access. Promotion separately grants management rights.</p></div></header>{message && <div className="notice error">{message}</div>}
    <section className="panel"><div className="toolbar"><input className="search" aria-label="Search accounts" placeholder="Name or email" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Filter account access" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Every access state</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="disabled">Disabled</option></select><label className="check-row"><input type="checkbox" checked={exclude} onChange={(e) => setExclude(e.target.checked)} />Exclude selected access state</label><select aria-label="Filter account role" value={role} onChange={(e) => setRole(e.target.value)}><option value="all">Every role</option><option value="admin">Admin</option><option value="supervisor">Supervisor</option></select><SortControls fields={[["full_name","Name"],["email","Email"],["created_at","Requested"],["status","Access"],["role","Role"]]} field={sort} direction={direction} onField={setSort} onDirection={setDirection} /><button className="button ghost" onClick={() => { setQuery(""); setStatus("all"); setRole("all"); setExclude(false); setSelected([]); }}>Clear filters</button></div>
    <BulkActions rows={selectedRows} label={(account) => account.email} onClear={() => setSelected([])} onCompleted={(ids) => setSelected((current) => current.filter((id) => !ids.includes(id)))} actions={[
      { label: "Approve viewing", eligible: (account) => account.status === "pending", hint: "Approve viewing access for these pending accounts. This does not promote them to Admin.", run: (account) => callRpc("approve_account", { p_profile_id: account.id }) },
      { label: "Enable accounts", eligible: (account) => account.status === "disabled", hint: "Restore access for these disabled accounts.", run: (account) => callRpc("set_account_enabled", { p_profile_id: account.id, p_enabled: true }) },
      { label: "Disable accounts", eligible: (account) => account.status === "approved", hint: "Remove access for these accounts. You cannot disable your own account.", run: (account) => callRpc("set_account_enabled", { p_profile_id: account.id, p_enabled: false }) }
    ]} /></section>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th><SelectRow label="Select all visible accounts except your own" checked={selectable.length > 0 && selectedRows.length === selectable.length} onChange={(checked) => setSelected(checked ? selectable.map((account) => account.id) : [])} /></th><th>Person</th><th>Email</th><th>Requested</th><th>Access</th><th>Role</th><th>Actions</th></tr></thead><tbody>{rows.map((account) => <tr key={account.id}><td><SelectRow label={`Select ${account.full_name}`} disabled={account.id === currentId || Boolean(busy)} checked={selected.includes(account.id)} onChange={(checked) => setSelected((ids) => checked ? [...new Set([...ids, account.id])] : ids.filter((id) => id !== account.id))} /></td><td>{account.full_name}{account.id === currentId && <small className="you-label">You</small>}</td><td>{account.email}</td><td>{formatLagos(account.created_at)}</td><td><span className={`badge ${account.status}`}>{account.status}</span></td><td><span className="role-label">{account.role}</span></td><td><div className="button-row">{account.status === "pending" && <button className="button primary" disabled={Boolean(busy)} onClick={() => action(account.id, "approve_account")}>Approve viewing</button>}{account.status === "approved" && account.role === "supervisor" && account.id !== currentId && <button className="button accent" disabled={Boolean(busy)} onClick={() => action(account.id, "promote_to_admin")}>Promote to Admin</button>}{account.status !== "pending" && account.id !== currentId && <button className="button" disabled={Boolean(busy)} onClick={() => action(account.id, "set_account_enabled", account.status === "disabled")}>{account.status === "disabled" ? "Enable" : "Disable"}</button>}</div></td></tr>)}</tbody></table></div></section>
  </>;
}
