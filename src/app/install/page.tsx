import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Install the app" };

export default function InstallPage() {
  return <main className="install-page"><section className="install-sheet"><Image src="/icon-192.png" width="72" height="72" alt="Survey Phone Tracker icon" priority /><h1>Keep the tracker close</h1><p className="install-lead">Install Survey Phone Tracker from its HTTPS deployment for a standalone window and quick access from your desktop or home screen.</p><div className="install-grid"><article><h2>Chrome or Edge</h2><p>Open the browser menu and choose <strong>Install Survey Phone Tracker</strong>. On desktop, the install icon may also appear at the right of the address bar.</p></article><article><h2>iPhone or iPad</h2><p>Open the site in Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</p></article><article><h2>Mac Safari</h2><p>On a supported macOS version, open the <strong>File</strong> menu and choose <strong>Add to Dock</strong>.</p></article></div><div className="notice">A live internet connection is required to issue, return, configure, or change records. The app never caches protected phone records for offline use.</div><Link className="button primary" href="/dashboard">Open the tracker</Link></section></main>;
}
