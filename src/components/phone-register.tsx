"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/supabase/rpc";
import { formatLagos, statusLabel } from "@/lib/format";
import { friendlyError, onlineError } from "@/components/online-action";
import type { Enumerator, PhoneRow, Supervisor } from "@/lib/types";
import { matchesFilter, sortRows, visibleSelection } from "@/lib/register";
import { BulkActions, SelectRow, SortControls } from "./register-tools";
import { IssuePhonesDialog } from "./issue-phones";
import { phoneCategories, readPhoneFilters, type PhoneFilters } from "@/lib/phone-filters";

type Dialog = { type: "issue" | "return" | "configure" | "attention" | "reset"; phone: PhoneRow } | null;
const readinessChecks = ["Survey application installed", "Correct survey, project, or form loaded", "Login and synchronisation tested", "Device checked and ready for use"];

export function PhoneRegister({ phones, enumerators, supervisors, isAdmin, compact = false, initialStatus = null, filters: controlledFilters, onFiltersChange }: {
  phones: PhoneRow[];
  enumerators: Enumerator[];
  supervisors: Supervisor[];
  isAdmin: boolean;
  compact?: boolean;
  initialStatus?: string | null;
  filters?: PhoneFilters;
  onFiltersChange?: (filters: PhoneFilters) => void;
}) {
  const [localFilters, setLocalFilters] = useState(() => readPhoneFilters(new URLSearchParams({ status: initialStatus || "all" })));
  const filters = controlledFilters || localFilters;
  const { query, status, person, from, to, exclude, readiness } = filters;
  function updateFilters(change: Partial<PhoneFilters>) {
    const next = { ...filters, ...change };
    if (onFiltersChange) onFiltersChange(next); else setLocalFilters(next);
    setSelected([]);
  }
  const [dialog, setDialog] = useState<Dialog>(null);
  const [sort, setSort] = useState("serial_number"); const [direction, setDirection] = useState("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const filtered = useMemo(() => sortRows(phones.filter((phone) => {
    const haystack = `${phone.serial_number} ${phone.enumerator_name || ""} ${phone.supervisor_name || ""} ${phone.project || ""}`.toLowerCase();
    const value = phone.collected_at || phone.configured_at;
    const dateMatches = (!from && !to) || Boolean(value && (!from || new Date(value) >= new Date(`${from}T00:00:00+01:00`)) && (!to || new Date(value) <= new Date(`${to}T23:59:59.999+01:00`)));
    return haystack.includes(query.toLowerCase()) && matchesFilter(phone.status, status, exclude) && (readiness === "all" || Boolean(phone.configured_at) === (readiness === "complete")) && `${phone.enumerator_name || ""} ${phone.supervisor_name || ""} ${phone.project || ""}`.toLowerCase().includes(person.toLowerCase()) && dateMatches;
  }), (phone) => phone[sort as "serial_number" | "status" | "enumerator_name" | "supervisor_name" | "collected_at" | "configured_at"], direction).slice(0, compact ? 8 : undefined), [phones, query, status, person, from, to, compact, exclude, readiness, sort, direction]);
  const selectedRows = visibleSelection(filtered, selected);
  function toggle(id: string, checked: boolean) { setSelected((ids) => checked ? [...new Set([...ids, id])] : ids.filter((value) => value !== id)); }

  return <>
    <section className="panel register-panel">
      <div className="panel-header"><div><h2>{exclude && status !== "all" ? `Excluding ${phoneCategories[status].toLowerCase()}` : phoneCategories[status]}</h2><span className="section-note" role="status">{filtered.length} shown</span></div></div>
      <div className="toolbar no-print">
        <input className="search" value={query} onChange={(e) => updateFilters({ query: e.target.value })} placeholder="Search serial, holder, or project" aria-label="Search phones" />
        <input value={person} onChange={(e) => updateFilters({ person: e.target.value })} placeholder="Enumerator or supervisor" aria-label="Filter by person" />
        <select value={status} onChange={(e) => updateFilters({ status: e.target.value as PhoneFilters["status"] })} aria-label="Filter by status">
          <option value="all">Every status</option><option value="awaiting_configuration">Awaiting configuration</option><option value="available">Available</option><option value="issued">Issued</option><option value="needs_attention">Needs attention</option>
        </select>
        <label className="check-row"><input type="checkbox" checked={exclude} onChange={(e) => updateFilters({ exclude: e.target.checked })} />Exclude selected status</label>
        <select aria-label="Filter checklist readiness" value={readiness} onChange={(e) => updateFilters({ readiness: e.target.value as PhoneFilters["readiness"] })}><option value="all">Every checklist</option><option value="complete">Checklist complete</option><option value="incomplete">Checklist incomplete</option></select>
        <SortControls fields={[["serial_number", "Phone"], ["status", "Status"], ["enumerator_name", "Holder"], ["supervisor_name", "Supervisor"], ["collected_at", "Collected"], ["configured_at", "Configured"]]} field={sort} direction={direction} onField={setSort} onDirection={setDirection} />
        <button className="button ghost" onClick={() => updateFilters(readPhoneFilters(new URLSearchParams()))}>Clear filters</button>
        {!compact && <><label className="inline-label">From<input type="date" value={from} onChange={(e) => updateFilters({ from: e.target.value })} /></label><label className="inline-label">To<input type="date" value={to} onChange={(e) => updateFilters({ to: e.target.value })} /></label></>}
      </div>
      {isAdmin && !compact && <BulkActions rows={selectedRows} label={(phone) => phone.serial_number} onClear={() => setSelected([])} onCompleted={(ids) => setSelected((current) => current.filter((id) => !ids.includes(id)))} actions={[
        { label: "Complete checklists", eligible: (phone) => phone.status === "awaiting_configuration", hint: "Every selected phone must be awaiting configuration. Confirm each check for ALL selected phones.", checks: readinessChecks, run: (phone) => callRpc("configure_phone", { p_phone_id: phone.id, p_survey_app_installed: true, p_correct_form_loaded: true, p_login_sync_tested: true, p_device_checked: true }) },
        { label: "Reset checklists", eligible: (phone) => phone.status === "available" && Boolean(phone.configured_at), hint: "Only Available phones with completed checklists can be reset. They will become Awaiting configuration. Previous checklist history is retained.", reason: true, run: (phone, reason) => callRpc("reset_phone_checklist", { p_phone_id: phone.id, p_reason: reason }) },
        { label: "Return in good condition", eligible: (phone) => phone.status === "issued" && Boolean(phone.active_checkout_id), hint: "Close the active checkout for each selected phone. Use the individual return action for faulty phones.", checks: ["I have received and checked every selected phone; all are in good condition."], run: (phone) => callRpc("return_phone", { p_checkout_id: phone.active_checkout_id, p_faulty: false }) }
      ]} />}
      <div className="table-wrap">
        <table>
          <thead><tr>{isAdmin && !compact && <th className="no-print"><SelectRow label="Select all visible phones" checked={filtered.length > 0 && selectedRows.length === filtered.length} onChange={(checked) => setSelected(checked ? filtered.map((phone) => phone.id) : [])} /></th>}<th>Phone</th><th>Readiness</th><th>Current state</th><th>Holder</th><th>Supervisor</th><th>Project</th><th>Collected</th><th>Recorded by</th><th className="no-print">Action</th></tr></thead>
          <tbody>{filtered.map((phone) => <tr key={phone.id} className={`phone-row state-${phone.status}`}>
            {isAdmin && !compact && <td className="no-print"><SelectRow label={`Select phone ${phone.serial_number}`} checked={selected.includes(phone.id)} onChange={(checked) => toggle(phone.id, checked)} /></td>}
            <td><Link className="serial" href={`/phones/${phone.id}`}>{phone.serial_number}</Link></td>
            <td>{phone.configured_at ? <span className="readiness ready">Ready</span> : <span className="readiness waiting">Checklist due</span>}</td>
            <td><span className={`badge ${phone.status}`}>{statusLabel(phone.status)}</span></td>
            <td>{phone.enumerator_name || phone.supervisor_name || "—"}{!phone.enumerator_name && phone.supervisor_name && <small> (Supervisor)</small>}</td><td>{phone.supervisor_name || "—"}</td><td>{phone.project || "—"}</td><td>{formatLagos(phone.collected_at)}</td><td>{phone.issued_by_name || phone.configured_by_name || "—"}</td>
            <td className="no-print"><div className="button-row"><PhoneAction phone={phone} isAdmin={isAdmin} onAction={(type) => setDialog({ type, phone })} />{isAdmin && <button className="button ghost" disabled={phone.status !== "available" || !phone.configured_at} title="Reset is only available for Available phones with a completed checklist" onClick={() => setDialog({ type: "reset", phone })}>Reset checklist</button>}</div></td>
          </tr>)}</tbody>
        </table>
        {!filtered.length && <div className="empty"><strong>No phones match</strong>Clear or change the current filters.</div>}
      </div>
      {compact && phones.length > 8 && <div className="panel-more"><Link href="/phones">Open the complete register</Link></div>}
    </section>
    {dialog?.type === "issue" ? <IssuePhonesDialog phones={phones} initialPhone={dialog.phone.id} enumerators={enumerators} supervisors={supervisors} onClose={() => setDialog(null)} /> : dialog && <ActionDialog dialog={dialog} onClose={() => setDialog(null)} />}
  </>;
}

function PhoneAction({ phone, isAdmin, onAction }: { phone: PhoneRow; isAdmin: boolean; onAction: (type: NonNullable<Dialog>["type"]) => void }) {
  if (!isAdmin) return <Link className="button" href={`/phones/${phone.id}`}>History</Link>;
  if (phone.status === "available") return <button className="button accent action-button" onClick={() => onAction("issue")}>Issue phone</button>;
  if (phone.status === "issued") return <button className="button primary action-button" onClick={() => onAction("return")}>Returned</button>;
  if (phone.status === "awaiting_configuration") return <button className="button action-button" onClick={() => onAction("configure")}>Complete checklist</button>;
  return <button className="button danger action-button" onClick={() => onAction("attention")}>Resolve fault</button>;
}

function ActionDialog({ dialog, onClose }: { dialog: NonNullable<Dialog>; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [faulty, setFaulty] = useState(false);
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState([false, false, false, false]);

  async function confirm() {
    const offline = onlineError(); if (offline) return setError(offline);
    setBusy(true); setError("");
    let result;
    if (dialog.type === "reset") result = await callRpc("reset_phone_checklist", { p_phone_id: dialog.phone.id, p_reason: notes.trim() });
    else if (dialog.type === "return") result = await callRpc("return_phone", { p_checkout_id: dialog.phone.active_checkout_id, p_faulty: faulty, p_fault_notes: notes || null });
    else result = await callRpc("configure_phone", { p_phone_id: dialog.phone.id, p_survey_app_installed: checks[0], p_correct_form_loaded: checks[1], p_login_sync_tested: checks[2], p_device_checked: checks[3], p_resolution_notes: dialog.type === "attention" ? notes : null });
    setBusy(false);
    if (result.error) return setError(friendlyError(result.error));
    onClose(); router.refresh();
  }

  const allChecks = checks.every(Boolean);
  const canConfirm = dialog.type === "reset" ? notes.trim().length >= 5 : dialog.type === "return" ? (!faulty || Boolean(notes.trim())) : allChecks && (dialog.type !== "attention" || Boolean(notes.trim()));
  const title = dialog.type === "reset" ? `Reset checklist for ${dialog.phone.serial_number}` : dialog.type === "return" ? `Return phone ${dialog.phone.serial_number}` : dialog.type === "attention" ? `Resolve phone ${dialog.phone.serial_number}` : `Configure phone ${dialog.phone.serial_number}`;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="dialog-head"><h2 id="dialog-title">{title}</h2><button onClick={onClose} aria-label="Close">×</button></div>
      <div className="dialog-body stack">
        {dialog.type === "reset" && <><p>This Available phone will return to Awaiting configuration. Its completed checklist remains in the audit history.</p><label>Reason for resetting<textarea autoFocus required minLength={5} value={notes} onChange={(e) => setNotes(e.target.value)} /></label></>}
        {dialog.type === "return" && <>
          <div className="handover-summary"><span>Current holder</span><strong>{dialog.phone.enumerator_name || dialog.phone.supervisor_name}</strong><small>Collected {formatLagos(dialog.phone.collected_at)}</small></div>
          <label className="check-row"><input type="checkbox" checked={faulty} onChange={(e) => setFaulty(e.target.checked)} /><span>Phone has a fault or needs attention</span></label>
          {faulty && <label>Fault details<textarea autoFocus required value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe what needs attention" /></label>}
        </>}
        {(dialog.type === "configure" || dialog.type === "attention") && <>
          {dialog.type === "attention" && <label>Resolution notes<textarea required value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was checked or repaired?" /></label>}
          <label className="check-row"><input type="checkbox" checked={allChecks} disabled={busy} onChange={(e) => setChecks(readinessChecks.map(() => e.target.checked))} /><strong>Mark all</strong></label>
          <div className="checklist">{readinessChecks.map((label, index) => <label className="check-row" key={label}><input type="checkbox" checked={checks[index]} disabled={busy} onChange={(e) => setChecks(checks.map((value, i) => i === index ? e.target.checked : value))} /><span>{label}</span></label>)}</div>
          <p className="muted compact-copy">This records readiness in the tracker. It does not install or configure software on the phone.</p>
        </>}
        {error && <div className="notice error" role="alert">{error}</div>}
      </div>
      <div className="dialog-foot"><button className="button ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || !canConfirm} onClick={confirm}>{busy ? "Saving…" : dialog.type === "reset" ? "Reset checklist" : dialog.type === "return" ? "Record return" : "Confirm readiness"}</button></div>
    </section>
  </div>;
}
