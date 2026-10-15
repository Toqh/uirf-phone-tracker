import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function AuthPage({ searchParams }: PageProps<"/auth">) {
  const confirmation = (await searchParams).confirmation;
  const initialMessage = confirmation === "failed"
    ? "That confirmation link is invalid or has expired. Request a new account email or try signing in if you already confirmed."
    : "";

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <div className="brand-mark" aria-hidden="true">✓</div>
        <p className="eyebrow">Field operations</p>
        <h1>Every phone.<br />Every handover.<br />Accounted for.</h1>
        <p>One shared record for device readiness, collections, returns, and faults.</p>
      </section>
      <section className="auth-panel">
        <AuthForm initialMessage={initialMessage} />
      </section>
    </main>
  );
}
