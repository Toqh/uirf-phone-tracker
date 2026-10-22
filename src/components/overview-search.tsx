"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { searchOverview, type OverviewSearchRecord } from "@/lib/overview-search";

export function OverviewSearch({ records, canViewRegister, loadError = false, accountsError = false }: {
  records: OverviewSearchRecord[]; canViewRegister: boolean; loadError?: boolean; accountsError?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const matches = searchOverview(records, query);
  const searching = Boolean(query.trim());
  function clear() { setQuery(""); setLimit(12); input.current?.focus(); }

  return <section className="overview-search no-print" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Find a phone or person</h2>
    <p id={`${id}-hint`} className="muted">Search by serial number, name, code, email, project, or status.</p>
    <div role="search" className="overview-search-field">
      <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
      <label className="sr-only" htmlFor={`${id}-input`}>Search phones and people</label>
      <input ref={input} id={`${id}-input`} type="search" autoComplete="off" placeholder="Search phones, people, projects…"
        aria-describedby={`${id}-hint`} aria-controls={`${id}-results`} value={query} disabled={loadError}
        onChange={(event) => { setQuery(event.target.value); setLimit(12); }}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); clear(); } }} />
      {query && <button className="button ghost" type="button" onClick={clear}>Clear</button>}
    </div>
    {loadError && <p className="notice error" role="alert">Search records could not be loaded. Refresh the page to try again.</p>}
    {accountsError && <p className="notice error" role="alert">Login accounts could not be loaded. You can still search phones and directory members. Refresh to retry accounts.</p>}
    <p className="overview-search-summary" role="status" aria-live="polite" aria-atomic="true">
      {searching && !loadError ? `${matches.length} ${matches.length === 1 ? "result" : "results"} for “${query.trim()}”` : ""}
    </p>
    <div id={`${id}-results`}>
      {searching && !loadError && (!matches.length ? <div className="overview-search-empty"><strong>No matches found</strong><p>Try part of a name, a phone serial number, or a directory code.</p></div>
        : <><div className="overview-search-results">
          {matches.slice(0, limit).map((record) => <article key={record.id} className="overview-result">
            <div className="overview-result-heading"><span className="overview-result-kind">{record.kind}</span><span className={`badge ${record.statusClass}`}>{record.status}</span></div>
            <h3 className={record.kind === "Phone" ? "serial" : undefined}>{record.title}</h3>
            <p className="overview-result-subtitle">{record.subtitle}</p>
            <dl>{record.details.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
            {record.phones.length > 0 && <div className="overview-result-phones"><span>Phones pending return</span><div>{record.phones.map((phone) => canViewRegister
              ? <Link key={phone.id} href={`/phones/${phone.id}`} className="overview-phone-link">{phone.serial}</Link>
              : <span key={phone.id} className="overview-phone-link">{phone.serial}</span>)}</div></div>}
            {record.href && <Link href={record.href} className="overview-result-link">{record.kind === "Phone" ? "View phone details" : "View accounts"}</Link>}
          </article>)}
        </div>{matches.length > limit && <button type="button" className="button overview-search-more" onClick={() => setLimit((value) => value + 12)}>Show more results ({matches.length - limit} remaining)</button>}</>)}
    </div>
  </section>;
}
