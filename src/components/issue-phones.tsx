"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Enumerator, PhoneRow, Supervisor } from "@/lib/types";
import { canIssue, resolveSerials } from "@/lib/issuing";
import { runBulk } from "@/lib/register";
import { callRpc } from "@/lib/supabase/rpc";
import { EnumeratorPicker } from "./enumerator-picker";
import { RegisterPhoneDialog } from "./register-phone-dialog";
import { friendlyError, onlineError } from "./online-action";

type IssueData = { phones: PhoneRow[]; enumerators: Enumerator[]; supervisors: Supervisor[] };

export function IssuePhonesActions({ showRegistration = false, ...props }: IssueData & { showRegistration?: boolean }) {
  const [mode, setMode] = useState<"single" | "bulk" | null>(null);
  const [registering, setRegistering] = useState(false);
  return <div className="button-row overview-actions no-print">
    {showRegistration && <button className="button primary" onClick={() => setRegistering(true)}>Register phone</button>}
    <button className="button primary" onClick={() => setMode("single")}>Issue phones</button>
    <button className="button primary" onClick={() => setMode("bulk")}>Bulk issue phones</button>
    {showRegistration && <Link className="button primary" href="/phones">Manage phones</Link>}
    {registering && <RegisterPhoneDialog onClose={() => setRegistering(false)} />}
    {mode && <IssuePhonesDialog {...props} bulk={mode === "bulk"} onClose={() => setMode(null)} />}
  </div>;
}

export function IssuePhonesDialog({ phones, enumerators, supervisors, bulk = false, initialPhone, onClose }: IssueData & {
  bulk?: boolean; initialPhone?: string; onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initialPhone ? [initialPhone] : []);
  const [search, setSearch] = useState(""); const [serials, setSerials] = useState("");
  const [recipientType, setRecipientType] = useState("enumerator");
  const [enumerator, setEnumerator] = useState(""); const [supervisor, setSupervisor] = useState("");
  const [supervisorSearch, setSupervisorSearch] = useState(""); const [project, setProject] = useState("");
  const [busy, setBusy] = useState(false); const running = useRef(false);
  const [done, setDone] = useState(0); const [review, setReview] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [results, setResults] = useState<{ serial: string; error: string | null }[] | null>(null);
  const available = phones.filter(canIssue);
  const visible = available.filter((phone) => phone.serial_number.toLowerCase().includes(search.trim().toLowerCase()));
  const chosen = phones.filter((phone) => selected.includes(phone.id));
  const recipient = recipientType === "enumerator" ? enumerators.find((item) => item.id === enumerator) : supervisors.find((item) => item.id === supervisor);
  const valid = chosen.length > 0 && chosen.every(canIssue) && Boolean(recipient?.active) && (project === "DASH" || project === "NUTRINT") && !serials.trim();

  function addSerials() {
    const resolved = resolveSerials(phones, serials);
    setErrors(resolved.errors);
    if (resolved.errors.length) return;
    setSelected((ids) => [...new Set([...ids, ...resolved.ids])]); setSerials("");
  }
  async function issue() {
    if (running.current || !valid || !review || results) return;
    const offline = onlineError(); if (offline) { setErrors([offline]); return; }
    running.current = true; setBusy(true); setErrors([]);
    try {
      const outcomes = await runBulk(chosen, (phone) => callRpc("issue_phone", {
        p_phone_id: phone.id, p_enumerator_id: recipientType === "enumerator" ? enumerator : null,
        p_supervisor_id: supervisor || null, p_project: project,
      }), setDone);
      setResults(outcomes.map((outcome) => ({ serial: chosen.find((phone) => phone.id === outcome.id)!.serial_number, error: outcome.error ? friendlyError(outcome.error) : null })));
      router.refresh();
    } finally { setBusy(false); running.current = false; }
  }

  return <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="issue-phones-title">
    <div className="dialog-head"><h2 id="issue-phones-title">{bulk ? "Bulk-issue phones" : "Issue phone"}</h2><button disabled={busy} aria-label="Close" onClick={onClose}>×</button></div>
    <div className="dialog-body stack">
      {results ? <>
        <p role="status">{results.filter((item) => !item.error).length} issued; {results.filter((item) => item.error).length} failed.</p>
        {results.map((item) => <div key={item.serial} className={`notice${item.error ? " error" : ""}`}>{item.serial}: {item.error || "Issued successfully"}</div>)}
        <p>Review any failed phones in the register before trying again. Successful phones will not be resubmitted here.</p>
      </> : review ? <>
        <p>Issue <strong>{chosen.length} phone(s)</strong> to {recipientType} <strong>{recipient?.full_name}</strong> for <strong>{project}</strong>?</p>
        {recipientType === "enumerator" && supervisor && <p>Supervisor: {supervisors.find((item) => item.id === supervisor)?.full_name}</p>}
        <p>{chosen.map((phone) => phone.serial_number).join(", ")}</p>
        <p className="muted">Each phone is saved separately. Any failures will be listed. Please keep this window open while saving.</p>
      </> : <>
        <p>Only available phones with completed checklists can be issued. {bulk && "All selected phones go to the same recipient and project."}</p>
        {!initialPhone && <>
          <label>Find a phone by serial number<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a serial number" /></label>
          {bulk ? <>
            <label>Type or paste serial numbers<textarea value={serials} onChange={(e) => setSerials(e.target.value)} placeholder="Separate serial numbers with spaces, commas, or new lines" /></label>
            <button className="button" disabled={!serials.trim()} onClick={addSerials}>Add serial numbers</button>
            <div className="button-row"><button className="button" disabled={!visible.length} onClick={() => setSelected((ids) => [...new Set([...ids, ...visible.map((phone) => phone.id)])])}>Select all matching</button><button className="button ghost" onClick={() => setSelected([])}>Clear selection</button></div>
            <div className="issue-phone-options">{visible.map((phone) => <label className="check-row" key={phone.id}><input type="checkbox" checked={selected.includes(phone.id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, phone.id] : ids.filter((id) => id !== phone.id))} />{phone.serial_number}</label>)}{!visible.length && <p>No available phones match.</p>}</div>
          </> : <label>Phone<select value={selected[0] || ""} onChange={(e) => setSelected(e.target.value ? [e.target.value] : [])}><option value="">Select a phone</option>{available.filter((phone) => visible.includes(phone) || selected.includes(phone.id)).map((phone) => <option key={phone.id} value={phone.id}>{phone.serial_number}</option>)}</select></label>}
        </>}
        <p>{chosen.length} selected{chosen.length > 0 ? `: ${chosen.map((phone) => phone.serial_number).join(", ")}` : ""}</p>
        <label>Issue to<select value={recipientType} onChange={(e) => { setRecipientType(e.target.value); setEnumerator(""); setSupervisor(""); setSupervisorSearch(""); }}><option value="enumerator">Enumerator</option><option value="supervisor">Supervisor</option></select></label>
        {recipientType === "enumerator" && <EnumeratorPicker enumerators={enumerators} value={enumerator} onChange={setEnumerator} disabled={busy} />}
        <label>Find supervisor<input value={supervisorSearch} onChange={(e) => setSupervisorSearch(e.target.value)} placeholder="Search by name or code" /></label>
        <label>{recipientType === "supervisor" ? "Supervisor" : "Supervisor (optional)"}<select value={supervisor} onChange={(e) => setSupervisor(e.target.value)}><option value="">{recipientType === "supervisor" ? "Select supervisor" : "No supervisor"}</option>{supervisors.filter((item) => item.active && (item.id === supervisor || `${item.full_name} ${item.supervisor_code}`.toLowerCase().includes(supervisorSearch.trim().toLowerCase()))).map((item) => <option key={item.id} value={item.id}>{item.full_name} ({item.supervisor_code})</option>)}</select></label>
        <label>Project<select value={project} onChange={(e) => setProject(e.target.value)}><option value="">Choose project</option><option value="DASH">DASH</option><option value="NUTRINT">NUTRINT</option></select></label>
      </>}
      {errors.length > 0 && <div className="notice error" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
    </div>
    <div className="dialog-foot"><button className="button ghost" disabled={busy} onClick={onClose}>{results ? "Done" : "Cancel"}</button>
      {!results && (review ? <><button className="button" disabled={busy} onClick={() => setReview(false)}>Back</button><button className="button primary" disabled={busy || !valid} onClick={issue}>{busy ? `Issuing ${done}/${chosen.length}…` : `Confirm issue (${chosen.length})`}</button></> : <button className="button primary" disabled={!valid} onClick={() => { setErrors([]); setReview(true); }}>Review issue</button>)}
    </div>
  </section></div>;
}
