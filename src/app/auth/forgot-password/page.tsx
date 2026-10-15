import type { Metadata } from "next";
import { PasswordForm } from "@/components/password-form";

export const metadata: Metadata = { title: "Forgot password" };
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="auth-panel"><PasswordForm initialError={error === "invalid-link" ? "That reset link is invalid or has expired. Request a new link below." : ""} /></main>;
}
