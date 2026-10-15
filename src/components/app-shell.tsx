"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const baseLinks = [
  ["/dashboard", "Overview"],
  ["/phones", "Phones"],
  ["/reports", "Reports"]
];
const adminLinks = [
  ["/directory", "Directory"],
  ["/imports", "Imports"],
  ["/accounts", "Accounts"]
];

function NavigationLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <span aria-busy={pending}>{label}<span className={`navigation-hint${pending ? " pending" : ""}`} aria-hidden="true" /></span>;
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = profile.role === "admin" ? [...baseLinks, ...adminLinks] : baseLinks;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    sessionStorage.clear();
    navigator.serviceWorker?.controller?.postMessage("CLEAR_PRIVATE_STATE");
    router.replace("/auth");
    router.refresh();
  }

  return (
    <div className="app-frame">
      <aside className="sidebar no-print">
        <div className="logo"><span>✓</span><div>Survey Phone<small>Tracker</small></div></div>
        <nav aria-label="Primary navigation">
          {links.map(([href, label]) => <Link key={href} href={href} className={pathname === href ? "active" : ""}><NavigationLabel label={label} /></Link>)}
        </nav>
        <Link className="install-link" href="/install">Install on this device</Link>
        <div className="account-card">
          <span className="avatar">{profile.full_name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{profile.full_name}</strong><small>{profile.role}</small></div>
          <button onClick={signOut} aria-label="Sign out" title="Sign out">↗</button>
        </div>
      </aside>
      <div className="main-column">
        <header className="mobile-header no-print"><div className="logo"><span>✓</span><div>Phone Tracker</div></div><button onClick={signOut}>Sign out</button></header>
        <main className="content">{children}</main>
        <nav className="mobile-nav no-print" aria-label="Mobile navigation">
          {links.slice(0, 5).map(([href, label]) => <Link key={href} href={href} className={pathname === href ? "active" : ""}><NavigationLabel label={label} /></Link>)}
        </nav>
      </div>
    </div>
  );
}
