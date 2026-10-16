"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "./password-input";

export function AuthForm({ initialMessage = "" }: { initialMessage?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "");
    const role = String(values.get("role") || "");
    if (mode === "signup") {
      if (password.length < 8 || password !== values.get("confirmPassword")) {
        return setMessage("Use at least eight characters and enter the same password in both fields.");
      }
      if (role !== "enumerator" && role !== "supervisor") return setMessage("Select Enumerator or Supervisor.");
    }
    if (!navigator.onLine) return setMessage("You appear to be offline. Connect to the internet and try again.");
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("example.supabase.co")) {
      return setMessage("Supabase is not connected yet. Add the project URL and publishable key to .env.local, then restart the local server.");
    }
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const fullName = String(values.get("fullName") || "").trim();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role },
            emailRedirectTo: `${window.location.origin}/auth/confirm`
          }
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }
        setMessage("Check your email and follow the confirmation link to access your account. No administrator approval is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <p className="eyebrow">Survey Phone Tracker</p>
      <h2>{mode === "signin" ? "Welcome back" : "Create an account"}</h2>
      <p className="muted">{mode === "signin" ? "Sign in to continue to the shared register." : "Enumerators and supervisors can sign up without administrator approval."}</p>
      <form key={mode} onSubmit={submit} className="stack">
        {mode === "signup" && <label>Full name<input name="fullName" required autoComplete="name" /></label>}
        {mode === "signup" && <label>Your role<select name="role" required defaultValue="" disabled={busy}><option value="" disabled>Select your role</option><option value="enumerator">Enumerator</option><option value="supervisor">Supervisor</option></select></label>}
        <label>Email address<input name="email" type="email" required autoComplete="email" /></label>
        <PasswordInput label="Password" name="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} disabled={busy} />
        {mode === "signup" && <PasswordInput label="Confirm password" name="confirmPassword" autoComplete="new-password" disabled={busy} />}
        {message && <div className="notice" role="status">{message}</div>}
        <button className="button primary wide" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
      </form>
      {mode === "signin" && <Link className="install-auth-link" href="/auth/forgot-password">Forgot password?</Link>}
      <button className="text-button" disabled={busy} onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>
        {mode === "signin" ? "Need an account? Sign up" : "Already registered? Sign in"}
      </button>
      <Link className="install-auth-link" href="/install">How to install the app</Link>
    </div>
  );
}
