"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/supabase/rpc";
import { friendlyError, onlineError } from "./online-action";
import type { Enumerator, Profile, Supervisor } from "@/lib/types";
import { matchesFilter, sortRows, visibleSelection } from "@/lib/register";
import { BulkActions, SelectRow, SortControls } from "./register-tools";

type EditItem = { type: "enumerator"; item?: Enumerator } | { type: "supervisor"; item?: Supervisor } | null;

export function DirectoryManager({ enumerators, supervisors, profiles }: { enumerators: Enumerator[]; supervisors: Supervisor[]; profiles: Profile[] }) {
  const [tab, setTab] = useState<"enumerators" | "supervisors">("enumerators");
  const [edit, setEdit] = useState<EditItem>(null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all"); const [exclude, setExclude] = useState(false);
  const [sort, setSort] = useState("full_name"); const [direction, setDirection] = useState("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const list = sortRows<Enumerator | Supervisor>((tab === "enumerators" ? enumerators : supervisors).filter((item) => `${"enumerator_code" in item ? item.enumerator_code : item.supervisor_code} ${item.full_name} ${"email" in item ? item.email || "" : ""}`.toLowerCase().includes(query.toLowerCase()) && matchesFilter(item.active ? "active" : "inactive", state, exclude)), (item) => sort === "code" ? ("enumerator_code" in item ? item.enumerator_code : item.supervisor_code) : sort === "active" ? Number(item.active) : item.full_name, direction);
  const selectedRows = visibleSelection(list, selected);
  function toggle(id: string, checked: boolean) { setSelected((ids) => checked ? [...new Set([...ids, id])] : ids.filter((value) => value !== id)); }
  const selection = (item: Enumerator | Supervisor) => <td><SelectRow label={`Select ${item.full_name}`} checked={selected.includes(item.id)} onChange={(checked) => toggle(item.id, checked)} /></td>;
  return <>
    <header className="page-header"><div><h1>Field team directory</h1><p>Operational people records remain separate from login accounts.</p></div><button className="button primary" onClick={() => setEdit({ type: tab === "enumerators" ? "enumerator" : "supervisor" })}>Add {tab === "enumerators" ? "enumerator" : "supervisor"}</button></header>
    <section className="panel">
      <div className="tabs"><button className={tab === "enumerators" ? "active" : ""} onClick={() => { setTab("enumerators"); setSelected([]); }}>Enumerators · {enumerators.length}</button><button className={tab === "supervisors" ? "active" : ""} onClick={() => { setTab("supervisors"); setSelected([]); }}>Supervisors · {supervisors.length}</button></div>
      <div className="toolbar"><input className="search" aria-label="Search directory" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, code, or email" /><select aria-label="Filter directory state" value={state} onChange={(e) => setState(e.target.value)}><option value="all">Every state</option><option value="active">Active</option><option value="inactive">Inactive</option></select><label className="check-row"><input type="checkbox" checked={exclude} onChange={(e) => setExclude(e.target.checked)} />Exclude selected state</label><SortControls fields={[["full_name", "Name"], ["code", "Code"], ["active", "State"]]} field={sort} direction={direction} onField={setSort} onDirection={setDirection} /><button className="button ghost" onClick={() => { setQuery(""); setState("all"); setExclude(false); setSelected([]); }}>Clear filters</button></div>
      <BulkActions<Enumerator | Supervisor> rows={selectedRows} label={(item) => item.full_name} onClear={() => setSelected([])} onCompleted={(ids) => setSelected((current) => current.filter((id) => !ids.includes(id)))} actions={[true, false].map((active) => ({ label: active ? "Activate entries" : "Deactivate entries", eligible: (item) => item.active !== active, hint: active ? "Make these directory entries available for selection." : "Remove these entries from new issue selections. Existing phone assignments and history remain unchanged.", run: (item) => callRpc("set_directory_active", { p_kind: tab === "enumerators" ? "enumerator" : "supervisor", p_id: item.id, p_active: active }) }))} />
      <div className="table-wrap"><table><thead><tr><th><SelectRow label="Select all visible directory entries" checked={list.length > 0 && selectedRows.length === list.length} onChange={(checked) => setSelected(checked ? list.map((item) => item.id) : [])} /></th><th>Code</th><th>Full name</th>{tab === "enumerators" ? <th>Usual supervisor</th> : <><th>Email</th><th>Linked account</th></>}<th>State</th><th>Action</th></tr></thead><tbody>
        {list.map((item) => tab === "enumerators" ? <tr key={item.id}>{selection(item)}<td className="code">{(item as Enumerator).enumerator_code}</td><td>{item.full_name}</td><td>{supervisors.find((s) => s.id === (item as Enumerator).usual_supervisor_id)?.full_name || "—"}</td><td><span className={`badge ${item.active ? "available" : "disabled"}`}>{item.active ? "Active" : "Inactive"}</span></td><td><button className="button" onClick={() => setEdit({ type: "enumerator", item: item as Enumerator })}>Edit</button></td></tr> : <tr key={item.id}>{selection(item)}<td className="code">{(item as Supervisor).supervisor_code}</td><td>{item.full_name}</td><td>{(item as Supervisor).email || "—"}</td><td>{profiles.find((p) => p.id === (item as Supervisor).linked_profile_id)?.full_name || "Not linked"}</td><td><span className={`badge ${item.active ? "available" : "disabled"}`}>{item.active ? "Active" : "Inactive"}</span></td><td><button className="button" onClick={() => setEdit({ type: "supervisor", item: item as Supervisor })}>Edit</button></td></tr>)}
      </tbody></table>{!list.length && <div className="empty"><strong>No directory entries match</strong>Try a different name or code.</div>}</div>
    </section>
    {edit && <DirectoryDialog edit={edit} supervisors={supervisors} profiles={profiles} onClose={() => setEdit(null)} />}
  </>;
}

function DirectoryDialog({ edit, supervisors, profiles, onClose }: { edit: NonNullable<EditItem>; supervisors: Supervisor[]; profiles: Profile[]; onClose: () => void }) {
  const router = useRouter();
  const item = edit.item;
  const [name, setName] = useState(item?.full_name || "");
  const [code, setCode] = useState(item && "enumerator_code" in item ? item.enumerator_code : item && "supervisor_code" in item ? item.supervisor_code : "");
  const [email, setEmail] = useState(item && "email" in item ? item.email || "" : "");
  const [supervisorId, setSupervisorId] = useState(item && "usual_supervisor_id" in item ? item.usual_supervisor_id || "" : "");
  const [profileId, setProfileId] = useState(item && "linked_profile_id" in item ? item.linked_profile_id || "" : "");
  const [active, setActive] = useState(item?.active ?? true);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    const offline = onlineError(); if (offline) return setError(offline);
    setBusy(true);
    const result = edit.type === "enumerator"
      ? await callRpc("save_enumerator", { p_id: item?.id || null, p_code: code, p_full_name: name, p_supervisor_id: supervisorId || null, p_active: active })
      : await callRpc("save_supervisor", { p_id: item?.id || null, p_code: code, p_full_name: name, p_email: email || null, p_active: active });
    if (!result.error && edit.type === "supervisor" && item && profileId !== (item as Supervisor).linked_profile_id) {
      const link = await callRpc("link_supervisor_account", { p_supervisor_id: item.id, p_profile_id: profileId || null }); if (link.error) { setBusy(false); return setError(friendlyError(link.error)); }
    }
    setBusy(false); if (result.error) return setError(friendlyError(result.error)); onClose(); router.refresh();
  }
  return <div className="dialog-backdrop"><section className="dialog"><div className="dialog-head"><h2>{item ? "Edit" : "Add"} {edit.type}</h2><button onClick={onClose}>×</button></div><div className="dialog-body stack">
    <label>Full name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label><label>Code <small>Optional for new records</small><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Generated when blank" /></label>
    {edit.type === "enumerator" ? <label>Usual supervisor<select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}><option value="">None</option>{supervisors.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.supervisor_code})</option>)}</select></label> : <><label>Email <small>Optional directory contact</small><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>{item && <label>Linked login account<select value={profileId} onChange={(e) => setProfileId(e.target.value)}><option value="">Not linked</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.email}</option>)}</select></label>}</>}
    <label className="check-row"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /><span>Active directory entry</span></label>{error && <div className="notice error">{error}</div>}
  </div><div className="dialog-foot"><button className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || name.trim().length < 2} onClick={save}>{busy ? "Saving…" : "Save changes"}</button></div></section></div>;
}
