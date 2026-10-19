"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PhoneRow } from "@/lib/types";
import { canReturn, resolveReturnSerials, returnPhoneBatch } from "@/lib/returning";
import { friendlyError, onlineError } from "./online-action";

export function BulkReturnPhonesDialog({ phones, onClose }: { phones: PhoneRow[]; onClose: () => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState(""); const [serials, setSerials] = useState("");
  const [review, setReview] = useState(false); const [received, setReceived] = useState(false);
  const [busy, setBusy] = useState(false); const running = useRef(false);
  const [done, setDone] = useState(0); const [errors, setErrors] = useState<string[]>([]);
  const [results, setResults] = useState<{ serial: string; error: string | null }[] | null>(null);
  const issued = phones.filter(canReturn);
  const visible = issued.filter((phone) => `${phone.serial_number} ${phone.enumerator_name || ""} ${phone.supervisor_name || ""} ${phone.project || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const chosen = phones.filter((phone) => selected.includes(phone.id));
  const valid = chosen.length > 0 && chosen.every(canReturn) && !serials.trim();

  function addSerials() {
    const resolved = resolveReturnSerials(phones, serials);
    setErrors(resolved.errors);
    if (resolved.errors.length) return;
    setSelected((ids) => [...new Set([...ids, ...resolved.ids])]);
    setSerials("");
  }

  async function confirmReturn() {
    if (running.current || !valid || !review || !received || results) return;
    const offline = onlineError(); if (offline) { setErrors([offline]); return; }
    running.current = true; setBusy(true); setErrors([]); setDone(0);
    try {
      const outcomes = await returnPhoneBatch(chosen, setDone);
      setResults(outcomes.map((outcome) => ({
        serial: chosen.find((phone) => phone.id === outcome.id)!.serial_number,
        error: outcome.error ? friendlyError(outcome.error) : null,
      })));
      router.refresh();
    } catch (error) {
      setErrors([friendlyError(error)]);
    } finally { running.current = false; setBusy(false); }
  }

  return <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-return-title">
    <div className="dialog-head"><h2 id="bulk-return-title">Bulk return phones</h2><button disabled={busy} aria-label="Close" onClick={onClose}>×</button></div>
    <div className="dialog-body stack">
      {results ? <>
        <p role="status">{results.filter((item) => !item.error).length} returned; {results.filter((item) => item.error).length} failed.</p>
        {results.map((item) => <div key={item.serial} className={`notice${item.error ? " error" : ""}`}>{item.serial}: {item.error || "Returned successfully"}</div>)}
        <p>Review failed phones in Phone management before trying again. Successful returns will not be submitted again here.</p>
      </> : review ? <>
        <p>Return <strong>{chosen.length} phone(s)</strong> in good condition? Their active checkouts will close and they will become available to issue.</p>
        <div className="table-wrap"><table><thead><tr><th>Phone</th><th>Current holder</th><th>Project</th></tr></thead>
          <tbody>{chosen.map((phone) => <tr key={phone.id}><td className="serial">{phone.serial_number}</td><td>{phone.enumerator_name || phone.supervisor_name || "—"}</td><td>{phone.project || "—"}</td></tr>)}</tbody>
        </table></div>
        <label className="check-row"><input type="checkbox" checked={received} disabled={busy} onChange={(event) => setReceived(event.target.checked)} /><span>I have received and checked every selected phone; all are in good condition.</span></label>
        <p className="muted">Each return is saved separately. Keep this window open while saving; any failures will be listed.</p>
      </> : <>
        <p>Select phones you have received in good condition. For faulty phones, use the individual return action in <Link style={{ textDecoration: "underline", color: "var(--green-2)" }} href="/phones?status=issued">Phone management</Link>.</p>
        <label>Find issued phones<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search serial, holder, or project" /></label>
        <label>Type or paste serial numbers<textarea value={serials} onChange={(event) => setSerials(event.target.value)} placeholder="Separate serial numbers with spaces, commas, or new lines" /></label>
        <button className="button" disabled={!serials.trim()} onClick={addSerials}>Add serial numbers</button>
        <div className="button-row"><button className="button" disabled={!visible.length} onClick={() => setSelected((ids) => [...new Set([...ids, ...visible.map((phone) => phone.id)])])}>Select all matching</button><button className="button ghost" onClick={() => setSelected([])}>Clear selection</button></div>
        <div className="issue-phone-options">{visible.map((phone) => <label className="check-row" key={phone.id}>
          <input type="checkbox" checked={selected.includes(phone.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...new Set([...ids, phone.id])] : ids.filter((id) => id !== phone.id))} />
          <span><strong>{phone.serial_number}</strong> · {phone.enumerator_name || phone.supervisor_name || "Unknown holder"}{phone.project && ` · ${phone.project}`}</span>
        </label>)}{!visible.length && <p>{issued.length ? "No issued phones match." : "No phones are currently pending return."}</p>}</div>
        <p>{chosen.length} selected{chosen.length ? `: ${chosen.map((phone) => phone.serial_number).join(", ")}` : ""}</p>
      </>}
      {errors.length > 0 && <div className="notice error" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
    </div>
    <div className="dialog-foot"><button className="button ghost" disabled={busy} onClick={onClose}>{results ? "Done" : "Cancel"}</button>
      {!results && (review ? <><button className="button" disabled={busy} onClick={() => setReview(false)}>Back</button><button className="button primary" disabled={busy || !valid || !received} onClick={confirmReturn}>{busy ? `Returning ${done}/${chosen.length}…` : `Confirm return (${chosen.length})`}</button></> : <button className="button primary" disabled={!valid} onClick={() => { setErrors([]); setReceived(false); setReview(true); }}>Review return</button>)}
    </div>
  </section></div>;
}
