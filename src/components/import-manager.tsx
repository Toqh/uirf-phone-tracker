"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { callRpc } from "@/lib/supabase/rpc";
import { importExamples, importFields, importGuide, importHelp, type ImportKind, normaliseCell, validatePreview } from "@/lib/csv";
import { downloadText, formatLagos } from "@/lib/format";
import { sortRows } from "@/lib/register";
import { SortControls } from "./register-tools";
import { friendlyError, onlineError } from "./online-action";

type Result = { batch_id: string; imported: number; skipped: number; failed: number; errors: { row: number; status: string; message: string }[] };
type Batch = { id: string; kind: string; file_name: string; total_rows: number; imported_rows: number; skipped_rows: number; failed_rows: number; imported_at: string; imported_by_name: string };

export function ImportManager({ batches }: { batches: Batch[] }) {
  const [kind, setKind] = useState<ImportKind>("phones"); const [fileName, setFileName] = useState(""); const [headers, setHeaders] = useState<string[]>([]); const [sourceRows, setSourceRows] = useState<Record<string,string>[]>([]); const [mapping, setMapping] = useState<Record<string,string>>({}); const [error, setError] = useState(""); const [result, setResult] = useState<Result | null>(null); const [busy, setBusy] = useState(false); const router = useRouter();
  const mappedRows = useMemo(() => sourceRows.map((row) => Object.fromEntries(importFields[kind].map((field) => [field.key, normaliseCell(row[mapping[field.key] || ""])]))), [sourceRows, mapping, kind]);
  const preview = useMemo(() => validatePreview(kind, mappedRows), [kind, mappedRows]);
  const [batchQuery, setBatchQuery] = useState(""); const [batchKind, setBatchKind] = useState("all");
  const [batchSort, setBatchSort] = useState("imported_at"); const [batchDirection, setBatchDirection] = useState("desc");
  const visibleBatches = sortRows(batches.filter((batch) => `${batch.file_name} ${batch.imported_by_name}`.toLowerCase().includes(batchQuery.toLowerCase()) && (batchKind === "all" || batch.kind === batchKind)), (batch) => batch[batchSort as "file_name" | "imported_at" | "imported_rows" | "failed_rows"], batchDirection);
  function selectFile(file?: File) {
    if (!file) return; setError(""); setResult(null); setFileName(file.name);
    Papa.parse<Record<string,string>>(file, { header: true, skipEmptyLines: "greedy", transformHeader: normaliseCell, transform: normaliseCell, encoding: "UTF-8", complete(parsed) {
      if (parsed.errors.length) setError(`CSV row ${parsed.errors[0].row ? parsed.errors[0].row + 1 : ""}: ${parsed.errors[0].message}`);
      const fields = parsed.meta.fields || []; setHeaders(fields); setSourceRows(parsed.data);
      const next: Record<string,string> = {}; importFields[kind].forEach((field) => { const exact = fields.find((h) => h.toLowerCase() === field.key); if (exact) next[field.key] = exact; }); setMapping(next);
    }});
  }
  function changeKind(next: ImportKind) { setKind(next); setFileName(""); setHeaders([]); setSourceRows([]); setMapping({}); setResult(null); setError(""); }
  async function save() {
    const offline = onlineError(); if (offline) return setError(offline);
    const missing = importFields[kind].find((field) => field.required && !mapping[field.key]); if (missing) return setError(`Map a CSV column to ${missing.label}.`);
    setBusy(true); const { data, error: rpcError } = await callRpc("process_import", { p_kind: kind, p_file_name: fileName, p_rows: mappedRows }); setBusy(false);
    if (rpcError) return setError(friendlyError(rpcError)); setResult(data as Result); router.refresh();
  }
  return <><header className="page-header"><div><h1>Import records</h1><p>Map, review, then add new records without overwriting existing ones.</p></div><div className="button-row"><a className="button" href={`/templates/${kind}.csv`} download>Blank {kind} template</a><button className="button" onClick={() => downloadText(`${kind}-example.csv`, importExamples[kind])}>Sample CSV</button><button className="button" onClick={() => downloadText(`${kind}-instructions.txt`, importGuide(kind), "text/plain;charset=utf-8")}>Template instructions</button></div></header>
    <details className="panel import-guide" open><summary>How to prepare the {kind} CSV</summary><div className="panel-body"><p>Keep the header row; add one record per row and save as <strong>CSV UTF-8 (comma-delimited)</strong>. Format phone serials as <strong>Text</strong> before entering them so <code>007</code> stays <code>007</code>. Do not include instruction rows in your CSV.</p><div className="table-wrap"><table><thead><tr><th>Column</th><th>Required</th><th>Instructions</th><th>Example</th></tr></thead><tbody>{importFields[kind].map((field) => <tr key={field.key}><td><code>{field.key}</code></td><td>{field.required ? "Yes" : "No"}</td><td>{importHelp[field.key].instructions}</td><td>{importHelp[field.key].example}</td></tr>)}</tbody></table></div><p>Import supervisors before enumerators when linking supervisor codes. Existing serials/codes are skipped, not overwritten. Blank codes are generated; retrying those rows can create duplicates. New phones need a readiness checklist before issue.</p><p>Remove sample data before importing. Quote names containing commas, for example <code>&quot;Bello, Amina&quot;</code>. Review the column mapping and preview before saving; valid rows may be imported even if others fail.</p></div></details>
    <section className="panel"><div className="tabs">{(["phones","supervisors","enumerators"] as ImportKind[]).map((value) => <button key={value} className={kind === value ? "active" : ""} onClick={() => changeKind(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
      {!sourceRows.length ? <div className="import-step"><div className="dropzone"><strong>Choose a UTF-8 CSV file</strong><p className="muted">Quoted fields and extra whitespace are handled automatically.</p><input type="file" accept=".csv,text/csv" onChange={(e) => selectFile(e.target.files?.[0])} /></div></div> : <>
        <div className="import-step"><h2>Map columns</h2><div className="mapping-grid">{importFields[kind].map((field) => <label key={field.key}>{field.label}{field.required && " (required)"}<select value={mapping[field.key] || ""} onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}><option value="">Do not import</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div></div>
        <div className="table-wrap"><table><thead><tr><th>CSV row</th>{importFields[kind].map((field) => <th key={field.key}>{field.label}</th>)}<th>Pre-check</th></tr></thead><tbody>{preview.slice(0,100).map((item) => <tr key={item.rowNumber}><td>{item.rowNumber}</td>{importFields[kind].map((field) => <td key={field.key}>{item.row[field.key] || "—"}</td>)}<td>{item.errors.length ? <span className="row-error">{item.errors.join("; ")}</span> : <span className="row-valid">Ready</span>}</td></tr>)}</tbody></table>{preview.length > 100 && <div className="panel-more">Showing the first 100 of {preview.length} rows.</div>}</div>
        <div className="import-actions"><span>{preview.filter((x) => x.errors.length).length} row(s) need attention before or during import.</span><button className="button primary" disabled={busy || !sourceRows.length} onClick={save}>{busy ? "Importing…" : `Import ${sourceRows.length} rows`}</button></div>
      </>}
      {error && <div className="notice error import-notice">{error}</div>}
      {result && <div className="import-step"><h2>Import complete</h2><div className="result-grid"><div className="result-card"><strong>{result.imported}</strong>Imported</div><div className="result-card"><strong>{result.skipped}</strong>Skipped</div><div className="result-card"><strong>{result.failed}</strong>Failed</div></div>{result.errors.length > 0 && <div className="error-list">{result.errors.map((item) => <p key={`${item.row}-${item.status}`}>Row {item.row}: {item.message}</p>)}</div>}</div>}
    </section>
    <section className="panel"><div className="panel-header"><div><h2>Recent imports</h2><span className="section-note">Actor and server time are retained with every batch</span></div></div><div className="toolbar"><input aria-label="Search import history" placeholder="File or imported by" value={batchQuery} onChange={(e) => setBatchQuery(e.target.value)} /><select aria-label="Filter import history type" value={batchKind} onChange={(e) => setBatchKind(e.target.value)}><option value="all">Every import type</option>{Object.keys(importFields).map((value) => <option key={value} value={value}>{value}</option>)}</select><SortControls fields={[["imported_at","When"],["file_name","File"],["imported_rows","Imported"],["failed_rows","Failed"]]} field={batchSort} direction={batchDirection} onField={setBatchSort} onDirection={setBatchDirection} /><button className="button ghost" onClick={() => { setBatchQuery(""); setBatchKind("all"); }}>Clear filters</button></div><div className="table-wrap"><table><thead><tr><th>File</th><th>Type</th><th>When</th><th>Imported by</th><th>Imported</th><th>Skipped</th><th>Failed</th></tr></thead><tbody>{visibleBatches.map((batch) => <tr key={batch.id}><td>{batch.file_name}</td><td>{batch.kind}</td><td>{formatLagos(batch.imported_at)}</td><td>{batch.imported_by_name}</td><td>{batch.imported_rows}</td><td>{batch.skipped_rows}</td><td>{batch.failed_rows}</td></tr>)}</tbody></table>{!visibleBatches.length && <div className="empty">No recent imports match these filters.</div>}</div></section>
  </>;
}
