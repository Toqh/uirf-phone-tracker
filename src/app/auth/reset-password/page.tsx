import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "@/components/password-form";

export const metadata: Metadata = { title: "Reset password" };
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/auth/forgot-password?error=invalid-link");
  return <main className="auth-panel"><PasswordForm reset /></main>;
}
