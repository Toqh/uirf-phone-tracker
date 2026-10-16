"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useRef } from "react";
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

function MobileNavigation({ links, pathname, profile, signOut }: { links: string[][]; pathname: string; profile: Profile; signOut: () => Promise<void> }) {
  const menu = useRef<HTMLDetailsElement>(null);
  function close() { if (menu.current) menu.current.open = false; }
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) close();
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <details className="mobile-menu" ref={menu} onKeyDown={(event) => {
    if (event.key === "Escape") { close(); menu.current?.querySelector("summary")?.focus(); }
  }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <summary aria-label="Navigation menu"><span aria-hidden="true">☰</span><span>Menu</span></summary>
    <div className="mobile-menu-panel">
      <div className="mobile-menu-account"><strong>{profile.full_name}</strong><small>{profile.role}</small></div>
      <nav aria-label="Mobile navigation">{links.map(([href, label]) => <Link key={href} href={href} onClick={close} className={pathname === href || pathname.startsWith(`${href}/`) ? "active" : ""} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}><NavigationLabel label={label} /></Link>)}</nav>
      <Link href="/install" onClick={close}>Install on this device</Link>
      <button onClick={() => { close(); void signOut(); }}>Sign out</button>
    </div>
  </details>;
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = profile.role === "enumerator" ? [["/dashboard", "My phones"]]
    : profile.role === "admin" ? [...baseLinks, ...adminLinks] : baseLinks;

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
        <header className="mobile-header no-print"><div className="logo"><span>✓</span><div>Phone Tracker</div></div><MobileNavigation key={pathname} links={links} pathname={pathname} profile={profile} signOut={signOut} /></header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
