"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runBulk } from "@/lib/register";
import { friendlyError, onlineError } from "./online-action";

export function SortControls({ fields, field, direction, onField, onDirection }: {
  fields: [string, string][]; field: string; direction: string; onField: (value: string) => void; onDirection: (value: string) => void;
}) {
  return <><label>Sort by<select value={field} onChange={(e) => onField(e.target.value)}>{fields.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Order<select value={direction} onChange={(e) => onDirection(e.target.value)}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label></>;
}

export function SelectRow({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return <input className="row-select" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} disabled={disabled} />;
}

export type BulkAction<T> = {
  label: string; eligible: (row: T) => boolean; hint: string; reason?: boolean; checks?: string[];
  run: (row: T, reason: string) => Promise<{ error: unknown }>;
};

export function BulkActions<T extends { id: string }>({ rows, label, actions, onCompleted, onClear }: {
  rows: T[]; label: (row: T) => string; actions: BulkAction<T>[]; onCompleted: (ids: string[]) => void; onClear: () => void;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<{ action: BulkAction<T>; rows: T[] } | null>(null);
  const [reason, setReason] = useState(""); const [checks, setChecks] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false); const running = useRef(false); const [done, setDone] = useState(0);
  const [summary, setSummary] = useState(""); const [errors, setErrors] = useState<string[]>([]);

  async function confirm() {
    if (!confirmation || running.current) return;
    const offline = onlineError(); if (offline) { setErrors([offline]); return; }
    running.current = true; setBusy(true); setErrors([]); setDone(0);
    try {
      const results = await runBulk(confirmation.rows, (row) => confirmation.action.run(row, reason.trim()), setDone);
      const successes = results.filter((result) => !result.error).map((result) => result.id);
      setSummary(`${confirmation.action.label}: ${successes.length} succeeded; ${results.length - successes.length} failed.`);
      setErrors(results.filter((result) => result.error).map((result) => `${label(confirmation.rows.find((row) => row.id === result.id)!)}: ${friendlyError(result.error)}`));
      onCompleted(successes); setConfirmation(null); router.refresh();
    } finally { running.current = false; setBusy(false); }
  }

  return <>
    {rows.length > 0 && <div className="bulk-bar no-print"><strong>{rows.length} visible record(s) selected</strong><div className="button-row">{actions.map((action) => <button key={action.label} className="button" disabled={busy || !rows.every(action.eligible)} title={action.hint} onClick={() => { setReason(""); setChecks((action.checks || []).map(() => false)); setErrors([]); setConfirmation({ action, rows: [...rows] }); }}>{action.label}</button>)}<button className="button ghost" onClick={onClear} disabled={busy}>Clear selection</button></div><small>Only selected rows matching the current filters are affected. Disabled actions do not apply to every selected row.</small></div>}
    {summary && <div className="notice" role="status">{summary}</div>}
    {errors.length > 0 && <div className="notice error" role="alert">{errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
    {confirmation && <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true" aria-label="Confirm bulk action"><div className="dialog-head"><h2>{confirmation.action.label}</h2></div><div className="dialog-body stack"><p>{confirmation.action.hint}</p>{errors.length > 0 && <div className="notice error" role="alert">{errors.join(" ")}</div>}<p>{confirmation.rows.length} record(s): {confirmation.rows.map(label).join(", ")}</p>{confirmation.action.reason && <label>Reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} minLength={5} /></label>}{confirmation.action.checks?.map((check, index) => <label className="check-row" key={check}><input type="checkbox" checked={checks[index]} disabled={busy} onChange={(e) => setChecks(checks.map((value, i) => i === index ? e.target.checked : value))} /><span>{check}</span></label>)}<p className="muted">Each record is saved separately. Failed records will be listed so you can review them.</p></div><div className="dialog-foot"><button className="button ghost" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button><button className="button primary" disabled={busy || (confirmation.action.reason && reason.trim().length < 5) || checks.some((value) => !value)} onClick={confirm}>{busy ? `Saving ${done}/${confirmation.rows.length}…` : `Confirm ${confirmation.rows.length} records`}</button></div></section></div>}
  </>;
}
