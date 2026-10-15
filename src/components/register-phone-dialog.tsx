"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { callRpc } from "@/lib/supabase/rpc";
import { friendlyError, onlineError } from "./online-action";

export function RegisterPhoneDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [serial, setSerial] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const serialInput = useRef<HTMLInputElement>(null);
  const addedPhones = useRef(false);

  useEffect(() => {
    if (!busy) serialInput.current?.focus();
  }, [busy]);

  function closeRegistration() {
    if (addedPhones.current) router.refresh();
    onClose();
  }

  async function addPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const offline = onlineError(); if (offline) return setError(offline);
    if (!/^\d{3}$/.test(serial)) return setError("Enter exactly three digits, including leading zeros.");
    submitting.current = true; setBusy(true); setError(""); setSuccess("");
    try {
      const { error: rpcError } = await callRpc("add_phone", { p_serial_number: serial });
      if (rpcError) return setError(friendlyError(rpcError));
      addedPhones.current = true;
      setSuccess(`Phone ${serial} registered. Enter the next serial number.`);
      setSerial("");
    } finally { submitting.current = false; setBusy(false); }
  }
  return (
    <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="register-phone-title">
      <form onSubmit={addPhone}>
        <div className="dialog-head"><h2 id="register-phone-title">Register phones</h2><button type="button" disabled={busy} onClick={closeRegistration} aria-label="Exit registration">×</button></div>
        <div className="dialog-body stack">
          <label>Three-digit serial number<input ref={serialInput} autoFocus required name="serial" inputMode="numeric" maxLength={3} pattern="[0-9]{3}" disabled={busy} value={serial} onChange={(e) => setSerial(e.target.value.replace(/\D/g, "").slice(0,3))} placeholder="007" /></label>
          <p className="muted compact-copy">Enter three digits and press Enter to save each phone. Keep entering serial numbers, then click Exit when finished. New phones start with a checklist due.</p>
          {success && <div className="notice success" role="status">{success}</div>}
          {error && <div className="notice error" role="alert">{error}</div>}
        </div>
        <div className="dialog-foot"><button type="button" className="button ghost" disabled={busy} onClick={closeRegistration}>Exit</button><button type="submit" className="button primary" disabled={busy || serial.length !== 3}>{busy ? "Registering…" : "Register phone"}</button></div>
      </form>
    </section></div>
  );
}
