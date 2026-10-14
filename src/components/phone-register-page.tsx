"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PhoneRegister } from "./phone-register";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, onlineError } from "./online-action";
import type { Enumerator, PhoneRow, Supervisor } from "@/lib/types";

export function PhoneRegisterPage(props: { phones: PhoneRow[]; enumerators: Enumerator[]; supervisors: Supervisor[]; isAdmin: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [serial, setSerial] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function addPhone() {
    const offline = onlineError(); if (offline) return setError(offline);
    if (!/^\d{3}$/.test(serial)) return setError("Enter exactly three digits, including leading zeros.");
    setBusy(true); const { error: rpcError } = await createClient().rpc("add_phone", { p_serial_number: serial }); setBusy(false);
    if (rpcError) return setError(friendlyError(rpcError));
    setOpen(false); setSerial(""); router.replace("/phones"); router.refresh();
  }
  return <>
    <header className="page-header"><div><h1>Phone register</h1><p>Readiness, current custody, and complete movement history.</p></div>{props.isAdmin && <button className="button primary" onClick={() => setOpen(true)}>Add phone</button>}</header>
    <PhoneRegister {...props} />
    {open && <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true"><div className="dialog-head"><h2>Register one phone</h2><button onClick={() => setOpen(false)}>×</button></div><div className="dialog-body stack"><label>Three-digit serial number<input autoFocus inputMode="numeric" maxLength={3} pattern="[0-9]{3}" value={serial} onChange={(e) => setSerial(e.target.value.replace(/\D/g, "").slice(0,3))} placeholder="007" /></label><p className="muted compact-copy">New phones start with a checklist due and cannot be issued yet.</p>{error && <div className="notice error">{error}</div>}</div><div className="dialog-foot"><button className="button ghost" onClick={() => setOpen(false)}>Cancel</button><button className="button primary" disabled={busy || serial.length !== 3} onClick={addPhone}>{busy ? "Registering…" : "Register phone"}</button></div></section></div>}
  </>;
}
