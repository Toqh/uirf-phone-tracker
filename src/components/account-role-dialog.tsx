"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Role } from "@/lib/types";
import { callRpc } from "@/lib/supabase/rpc";
import { friendlyError, onlineError } from "./online-action";

export function AccountRoleDialog({ account, onClose }: { account: Profile; onClose: () => void }) {
  const [role, setRole] = useState<Role>(account.role);
  const [busy, setBusy] = useState(false); const running = useRef(false);
  const [error, setError] = useState(""); const router = useRouter();
  async function save() {
    if (running.current || role === account.role) return;
    const offline = onlineError(); if (offline) { setError(offline); return; }
    running.current = true; setBusy(true); setError("");
    try {
      const result = await callRpc("set_account_role", { p_profile_id: account.id, p_role: role });
      if (result.error) { setError(friendlyError(result.error)); return; }
      router.refresh(); onClose();
    } finally { running.current = false; setBusy(false); }
  }
  return <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="account-role-title">
    <div className="dialog-head"><h2 id="account-role-title">Assign account role</h2><button disabled={busy} onClick={onClose} aria-label="Close">×</button></div>
    <div className="dialog-body stack"><p><strong>{account.full_name}</strong><br />{account.email}</p>
      <p>Current role: {account.role}</p>
      <label>New role<select autoFocus value={role} disabled={busy} onChange={(event) => setRole(event.target.value as Role)}><option value="supervisor">Supervisor</option><option value="admin">Admin</option><option value="enumerator">Enumerator</option></select></label>
      <p>{role === "admin" ? "Admin grants full management access, including issuing phones, approving accounts, and assigning roles. Only grant this to a trusted manager." : "Supervisor and Enumerator have viewing access to the register, history, and reports. They cannot modify records or manage accounts."}</p>
      <p className="muted">Account roles do not create or change entries in the phone-holder directory. This role change will be recorded in the audit trail.</p>
      {error && <div className="notice error" role="alert">{error}</div>}
    </div><div className="dialog-foot"><button className="button ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || role === account.role} onClick={save}>{busy ? "Saving…" : "Confirm role change"}</button></div>
  </section></div>;
}
