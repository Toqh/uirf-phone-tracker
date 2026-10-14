"use client";

import { useMemo, useState } from "react";
import { downloadText, formatLagos, rowsToCsv, statusLabel } from "@/lib/format";
import type { MovementRow, PhoneRow } from "@/lib/types";

type ReportType = "not_configured" | "configured" | "pending_return" | "available" | "attention" | "completed" | "movement";
const labels: Record<ReportType, string> = {
  not_configured: "Phones not yet configured", configured: "Configured phones", pending_return: "Phones pending return", available: "Available phones", attention: "Phones needing attention", completed: "Completed checkouts and returns", movement: "Full movement history"
};

export function Reports({ phones, movements, generatedBy }: { phones: PhoneRow[]; movements: MovementRow[]; generatedBy: string }) {
  const [type, setType] = useState<ReportType>("pending_return"); const [search, setSearch] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [busy, setBusy] = useState(false);
  const isMovement = type === "completed" || type === "movement";
  const phoneRows = useMemo(() => phones.filter((phone) => {
    const typeMatch = type === "not_configured" ? !phone.configured_at : type === "configured" ? Boolean(phone.configured_at) : type === "pending_return" ? phone.status === "issued" : type === "available" ? phone.status === "available" : type === "attention" ? phone.status === "needs_attention" : true;
    const searchMatch = `${phone.serial_number} ${phone.enumerator_name || ""} ${phone.supervisor_name || ""}`.toLowerCase().includes(search.toLowerCase());
    const date = phone.collected_at || phone.configured_at; return typeMatch && searchMatch && inRange(date, from, to);
  }), [phones, type, search, from, to]);
  const movementRows = useMemo(() => movements.filter((row) => {
    const completeMatch = type !== "completed" || Boolean(row.returned_at); const searchMatch = `${row.serial_number} ${row.enumerator_name} ${row.supervisor_name || ""}`.toLowerCase().includes(search.toLowerCase()); return completeMatch && searchMatch && inRange(row.collected_at, from, to);
  }), [movements, type, search, from, to]);
  const total = isMovement ? movementRows.length : phoneRows.length;
  const filterDescription = `${from || "Any date"} to ${to || "Any date"}${search ? `; search: ${search}` : ""}`;

  function exportCsv() {
    const csv = isMovement
      ? rowsToCsv(["phone_serial","enumerator","supervisor","collection_date_lagos","return_date_lagos","issued_by","received_by","condition","fault_notes"], movementRows.map((row) => [row.serial_number,row.enumerator_name,row.supervisor_name,formatLagos(row.collected_at),formatLagos(row.returned_at),row.issued_by_name,row.returned_by_name,row.return_condition,row.fault_notes]))
      : rowsToCsv(["phone_serial","configuration_date_lagos","status","enumerator","supervisor","collection_date_lagos","recorded_by"], phoneRows.map((phone) => [phone.serial_number,formatLagos(phone.configured_at),statusLabel(phone.status),phone.enumerator_name,phone.supervisor_name,formatLagos(phone.collected_at),phone.issued_by_name || phone.configured_by_name]));
    downloadText(`${type}-${new Date().toISOString().slice(0,10)}.csv`, csv);
  }
  async function savePdf() {
    setBusy(true);
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }); const autoTable = autoTableModule.default;
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(labels[type], 12, 14); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`Filters: ${filterDescription}`, 12, 20); doc.text(`Total: ${total}  |  Generated ${formatLagos(new Date().toISOString())}  |  By ${generatedBy}`, 12, 25);
    const head = isMovement ? [["Serial","Enumerator","Supervisor","Collected","Returned","Issued by","Received by","Condition"]] : [["Serial","Configured","Status","Enumerator","Supervisor","Collected","Recorded by"]];
    const body = isMovement ? movementRows.map((r) => [r.serial_number,r.enumerator_name,r.supervisor_name || "—",formatLagos(r.collected_at),formatLagos(r.returned_at),r.issued_by_name,r.returned_by_name || "—",r.return_condition || "Open"]) : phoneRows.map((p) => [p.serial_number,formatLagos(p.configured_at),statusLabel(p.status),p.enumerator_name || "—",p.supervisor_name || "—",formatLagos(p.collected_at),p.issued_by_name || p.configured_by_name || "—"]);
    autoTable(doc, { head, body, startY: 30, margin: { left: 12, right: 12, bottom: 14 }, styles: { fontSize: 7.5, cellPadding: 2 }, headStyles: { fillColor: [18,55,42] }, didDrawPage(data) { doc.setFontSize(8); doc.setTextColor(90); doc.text(`Page ${data.pageNumber}`, 270, 202); } });
    doc.save(`${type}-${new Date().toISOString().slice(0,10)}.pdf`); setBusy(false);
  }
  return <><header className="page-header no-print"><div><h1>Reports and exports</h1><p>Current custody and movement records in Nigeria time.</p></div><div className="button-row"><button className="button" onClick={exportCsv}>Export CSV</button><button className="button" onClick={() => window.print()}>Print report</button><button className="button primary" disabled={busy} onClick={savePdf}>{busy ? "Preparing PDF…" : "Save as PDF"}</button></div></header>
    <h1 className="print-title">{labels[type]}</h1><p className="report-meta">Filters: {filterDescription}<br />Total matching records: {total}<br />Generated: {formatLagos(new Date().toISOString())} · By: {generatedBy}</p>
    <section className="panel"><div className="toolbar no-print"><select value={type} onChange={(e) => setType(e.target.value as ReportType)}>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Serial, enumerator, or supervisor" /><label className="inline-label">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="inline-label">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
      <div className="panel-header"><div><h2>{labels[type]}</h2><span className="section-note">{total} matching records</span></div></div>
      <div className="table-wrap"><table><thead>{isMovement ? <tr><th>Phone</th><th>Enumerator</th><th>Supervisor</th><th>Collected</th><th>Returned</th><th>Issued by</th><th>Received by</th><th>Condition</th></tr> : <tr><th>Phone</th><th>Configured</th><th>Status</th><th>Enumerator</th><th>Supervisor</th><th>Collected</th><th>Recorded by</th></tr>}</thead><tbody>{isMovement ? movementRows.map((row) => <tr key={row.id}><td className="serial">{row.serial_number}</td><td>{row.enumerator_name}</td><td>{row.supervisor_name || "—"}</td><td>{formatLagos(row.collected_at)}</td><td>{formatLagos(row.returned_at)}</td><td>{row.issued_by_name}</td><td>{row.returned_by_name || "—"}</td><td>{row.return_condition ? statusLabel(row.return_condition) : "Open"}</td></tr>) : phoneRows.map((phone) => <tr key={phone.id}><td className="serial">{phone.serial_number}</td><td>{formatLagos(phone.configured_at)}</td><td><span className={`badge ${phone.status}`}>{statusLabel(phone.status)}</span></td><td>{phone.enumerator_name || "—"}</td><td>{phone.supervisor_name || "—"}</td><td>{formatLagos(phone.collected_at)}</td><td>{phone.issued_by_name || phone.configured_by_name || "—"}</td></tr>)}</tbody></table>{!total && <div className="empty"><strong>No records match</strong>Change the report or selected filters.</div>}</div>
    </section>
  </>;
}

function inRange(value: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true; if (!value) return false; const date = new Date(value).getTime(); if (from && date < new Date(`${from}T00:00:00+01:00`).getTime()) return false; if (to && date > new Date(`${to}T23:59:59.999+01:00`).getTime()) return false; return true;
}
