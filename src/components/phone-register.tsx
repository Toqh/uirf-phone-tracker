"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatLagos, statusLabel } from "@/lib/format";
import { friendlyError, onlineError } from "@/components/online-action";
import type { Enumerator, PhoneRow, Supervisor } from "@/lib/types";

type Dialog = { type: "issue" | "return" | "configure" | "attention"; phone: PhoneRow } | null;

export function PhoneRegister({ phones, enumerators, supervisors, isAdmin, compact = false }: {
  phones: PhoneRow[];
  enumerators: Enumerator[];
  supervisors: Supervisor[];
  isAdmin: boolean;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [person, setPerson] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const filtered = useMemo(() => phones.filter((phone) => {
    const haystack = `${phone.serial_number} ${phone.enumerator_name || ""} ${phone.supervisor_name || ""}`.toLowerCase();
    const value = phone.collected_at || phone.configured_at;
    const dateMatches = (!from && !to) || Boolean(value && (!from || new Date(value) >= new Date(`${from}T00:00:00+01:00`)) && (!to || new Date(value) <= new Date(`${to}T23:59:59.999+01:00`)));
    return haystack.includes(query.toLowerCase()) && (status === "all" || phone.status === status) && `${phone.enumerator_name || ""} ${phone.supervisor_name || ""}`.toLowerCase().includes(person.toLowerCase()) && dateMatches;
  }).slice(0, compact ? 8 : undefined), [phones, query, status, person, from, to, compact]);

  return <>
    <section className="panel register-panel">
      <div className="panel-header"><div><h2>Phone register</h2><span className="section-note">{filtered.length} shown</span></div>{!compact && isAdmin && <Link className="button primary" href="/phones?new=1">Add phone</Link>}</div>
      <div className="toolbar no-print">
        <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search serial or holder" aria-label="Search phones" />
        <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Enumerator or supervisor" aria-label="Filter by person" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">Every status</option><option value="awaiting_configuration">Awaiting configuration</option><option value="available">Available</option><option value="issued">Issued</option><option value="needs_attention">Needs attention</option>
        </select>
        {!compact && <><label className="inline-label">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="inline-label">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></>}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Phone</th><th>Readiness</th><th>Current state</th><th>Holder</th><th>Supervisor</th><th>Collected</th><th>Recorded by</th><th className="no-print">Action</th></tr></thead>
          <tbody>{filtered.map((phone) => <tr key={phone.id} className={`phone-row state-${phone.status}`}>
            <td><Link className="serial" href={`/phones/${phone.id}`}>{phone.serial_number}</Link></td>
            <td>{phone.configured_at ? <span className="readiness ready">Ready</span> : <span className="readiness waiting">Checklist due</span>}</td>
            <td><span className={`badge ${phone.status}`}>{statusLabel(phone.status)}</span></td>
            <td>{phone.enumerator_name || "—"}</td><td>{phone.supervisor_name || "—"}</td><td>{formatLagos(phone.collected_at)}</td><td>{phone.issued_by_name || phone.configured_by_name || "—"}</td>
            <td className="no-print"><PhoneAction phone={phone} isAdmin={isAdmin} onAction={(type) => setDialog({ type, phone })} /></td>
          </tr>)}</tbody>
        </table>
        {!filtered.length && <div className="empty"><strong>No phones match</strong>Clear or change the current filters.</div>}
      </div>
      {compact && phones.length > 8 && <div className="panel-more"><Link href="/phones">Open the complete register</Link></div>}
    </section>
    {dialog && <ActionDialog dialog={dialog} enumerators={enumerators} supervisors={supervisors} onClose={() => setDialog(null)} />}
  </>;
}

function PhoneAction({ phone, isAdmin, onAction }: { phone: PhoneRow; isAdmin: boolean; onAction: (type: NonNullable<Dialog>["type"]) => void }) {
  if (!isAdmin) return <Link className="button" href={`/phones/${phone.id}`}>History</Link>;
  if (phone.status === "available") return <button className="button accent action-button" onClick={() => onAction("issue")}>Issue phone</button>;
  if (phone.status === "issued") return <button className="button primary action-button" onClick={() => onAction("return")}>Returned</button>;
  if (phone.status === "awaiting_configuration") return <button className="button action-button" onClick={() => onAction("configure")}>Complete checklist</button>;
  return <button className="button danger action-button" onClick={() => onAction("attention")}>Resolve fault</button>;
}

function ActionDialog({ dialog, enumerators, supervisors, onClose }: { dialog: NonNullable<Dialog>; enumerators: Enumerator[]; supervisors: Supervisor[]; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enumeratorId, setEnumeratorId] = useState("");
  const [enumeratorSearch, setEnumeratorSearch] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [faulty, setFaulty] = useState(false);
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState([false, false, false, false]);
  const selectedEnumerator = enumerators.find((item) => item.id === enumeratorId);

  function chooseEnumerator(id: string) {
    setEnumeratorId(id);
    const enumerator = enumerators.find((item) => item.id === id);
    setSupervisorId(enumerator?.usual_supervisor_id || "");
    const usual = supervisors.find((item) => item.id === enumerator?.usual_supervisor_id);
    setSupervisorSearch(usual ? `${usual.full_name} (${usual.supervisor_code})` : "");
  }

  function chooseEnumeratorText(value: string) {
    setEnumeratorSearch(value);
    const match = enumerators.find((item) => `${item.full_name} (${item.enumerator_code})` === value);
    chooseEnumerator(match?.id || "");
  }

  function chooseSupervisorText(value: string) {
    setSupervisorSearch(value);
    const match = supervisors.find((item) => `${item.full_name} (${item.supervisor_code})` === value);
    setSupervisorId(match?.id || "");
  }

  async function confirm() {
    const offline = onlineError(); if (offline) return setError(offline);
    setBusy(true); setError("");
    const supabase = createClient();
    let result;
    if (dialog.type === "issue") result = await supabase.rpc("issue_phone", { p_phone_id: dialog.phone.id, p_enumerator_id: enumeratorId, p_supervisor_id: supervisorId || null });
    else if (dialog.type === "return") result = await supabase.rpc("return_phone", { p_checkout_id: dialog.phone.active_checkout_id, p_faulty: faulty, p_fault_notes: notes || null });
    else result = await supabase.rpc("configure_phone", { p_phone_id: dialog.phone.id, p_survey_app_installed: checks[0], p_correct_form_loaded: checks[1], p_login_sync_tested: checks[2], p_device_checked: checks[3], p_resolution_notes: dialog.type === "attention" ? notes : null });
    setBusy(false);
    if (result.error) return setError(friendlyError(result.error));
    onClose(); router.refresh();
  }

  const allChecks = checks.every(Boolean);
  const canConfirm = dialog.type === "issue" ? Boolean(enumeratorId) : dialog.type === "return" ? (!faulty || Boolean(notes.trim())) : allChecks && (dialog.type !== "attention" || Boolean(notes.trim()));
  const title = dialog.type === "issue" ? `Issue phone ${dialog.phone.serial_number}` : dialog.type === "return" ? `Return phone ${dialog.phone.serial_number}` : dialog.type === "attention" ? `Resolve phone ${dialog.phone.serial_number}` : `Configure phone ${dialog.phone.serial_number}`;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="dialog-head"><h2 id="dialog-title">{title}</h2><button onClick={onClose} aria-label="Close">×</button></div>
      <div className="dialog-body stack">
        {dialog.type === "issue" && <>
          <label>Enumerator<input autoFocus list="enumerator-options" value={enumeratorSearch} onChange={(e) => chooseEnumeratorText(e.target.value)} placeholder="Type a name or code" /><datalist id="enumerator-options">{enumerators.filter((x) => x.active).map((x) => <option key={x.id} value={`${x.full_name} (${x.enumerator_code})`} />)}</datalist></label>
          <label>Supervisor<input list="supervisor-options" value={supervisorSearch} onChange={(e) => chooseSupervisorText(e.target.value)} placeholder="Type a name or code (optional)" /><datalist id="supervisor-options">{supervisors.filter((x) => x.active).map((x) => <option key={x.id} value={`${x.full_name} (${x.supervisor_code})`} />)}</datalist></label>
          {selectedEnumerator && <p className="muted compact-copy">The usual supervisor filled automatically. Change it here for this collection if needed.</p>}
        </>}
        {dialog.type === "return" && <>
          <div className="handover-summary"><span>Current holder</span><strong>{dialog.phone.enumerator_name}</strong><small>Collected {formatLagos(dialog.phone.collected_at)}</small></div>
          <label className="check-row"><input type="checkbox" checked={faulty} onChange={(e) => setFaulty(e.target.checked)} /><span>Phone has a fault or needs attention</span></label>
          {faulty && <label>Fault details<textarea autoFocus required value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe what needs attention" /></label>}
        </>}
        {(dialog.type === "configure" || dialog.type === "attention") && <>
          {dialog.type === "attention" && <label>Resolution notes<textarea required value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was checked or repaired?" /></label>}
          <div className="checklist">{["Survey application installed", "Correct survey, project, or form loaded", "Login and synchronisation tested", "Device checked and ready for use"].map((label, index) => <label className="check-row" key={label}><input type="checkbox" checked={checks[index]} onChange={(e) => setChecks(checks.map((value, i) => i === index ? e.target.checked : value))} /><span>{label}</span></label>)}</div>
          <p className="muted compact-copy">This records readiness in the tracker. It does not install or configure software on the phone.</p>
        </>}
        {error && <div className="notice error" role="alert">{error}</div>}
      </div>
      <div className="dialog-foot"><button className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || !canConfirm} onClick={confirm}>{busy ? "Saving…" : dialog.type === "issue" ? "Confirm issue" : dialog.type === "return" ? "Record return" : "Confirm readiness"}</button></div>
    </section>
  </div>;
}
