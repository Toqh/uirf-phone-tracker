"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ initialMessage = "" }: { initialMessage?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!navigator.onLine) return setMessage("You appear to be offline. Connect to the internet and try again.");
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("example.supabase.co")) {
      return setMessage("Supabase is not connected yet. Add the project URL and publishable key to .env.local, then restart the local server.");
    }
    setBusy(true);
    setMessage("");
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "");
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const fullName = String(values.get("fullName") || "").trim();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/confirm`
          }
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/pending");
          router.refresh();
          return;
        }
        setMessage("Check your email and follow the confirmation link. After that, an administrator must approve your access.");
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
      <h2>{mode === "signin" ? "Welcome back" : "Request an account"}</h2>
      <p className="muted">{mode === "signin" ? "Sign in to continue to the shared register." : "New accounts start with no record access until approved."}</p>
      <form onSubmit={submit} className="stack">
        {mode === "signup" && <label>Full name<input name="fullName" required autoComplete="name" /></label>}
        <label>Email address<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>
        {message && <div className="notice" role="status">{message}</div>}
        <button className="button primary wide" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create pending account"}</button>
      </form>
      {mode === "signin" && <Link className="install-auth-link" href="/auth/forgot-password">Forgot password?</Link>}
      <button className="text-button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>
        {mode === "signin" ? "Need an account? Sign up" : "Already registered? Sign in"}
      </button>
      <Link className="install-auth-link" href="/install">How to install the app</Link>
    </div>
  );
}
