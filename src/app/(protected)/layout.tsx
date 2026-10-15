import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import Loading from "./loading";

async function AuthorizedShell({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="content"><Loading /></main>}>
      <AuthorizedShell>{children}</AuthorizedShell>
    </Suspense>
  );
}
