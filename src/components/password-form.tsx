"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, onlineError } from "./online-action";

export function PasswordForm({ reset = false, initialError = "" }: { reset?: boolean; initialError?: string }) {
  const [busy, setBusy] = useState(false); const running = useRef(false);
  const [error, setError] = useState(initialError); const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || sent) return;
    const offline = onlineError(); if (offline) { setError(offline); return; }
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") || "");
    if (reset && (password.length < 8 || password !== values.get("confirmPassword"))) {
      setError("Use at least eight characters and enter the same password in both fields."); return;
    }
    running.current = true; setBusy(true); setError("");
    try {
      const supabase = createClient();
      const result = reset
        ? await supabase.auth.updateUser({ password })
        : await supabase.auth.resetPasswordForEmail(String(values.get("email") || "").trim(), { redirectTo: `${window.location.origin}/auth/recovery` });
      if (result.error) { setError(friendlyError(result.error)); return; }
      setSent(true);
    } catch (error) { setError(friendlyError(error)); }
    finally { running.current = false; setBusy(false); }
  }
  return <div className="auth-card"><p className="eyebrow">Survey Phone Tracker</p><h1>{reset ? "Choose a new password" : "Forgot password?"}</h1>
    {sent ? <><div className="notice success" role="status">{reset ? "Your password has been updated." : "If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder."}</div>{reset && <Link className="button primary" href="/dashboard">Continue to the app</Link>}</> : <form className="stack" onSubmit={submit}>
      {reset ? <><label>New password<input autoFocus type="password" name="password" required minLength={8} autoComplete="new-password" disabled={busy} /></label><label>Confirm new password<input type="password" name="confirmPassword" required minLength={8} autoComplete="new-password" disabled={busy} /></label></> : <><p className="muted">Enter the email address you use to sign in. Open the reset link in this browser, or request a new link if it has expired.</p><label>Email address<input autoFocus type="email" name="email" required autoComplete="email" disabled={busy} /></label></>}
      <button className="button primary" disabled={busy}>{busy ? "Please wait…" : reset ? "Save new password" : "Send reset link"}</button>
    </form>}
    {error && <div className="notice error" role="alert">{error}</div>}
    <Link className="install-auth-link" href="/auth">Back to sign in</Link>
  </div>;
}
