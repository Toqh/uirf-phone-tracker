"use client";

import { useId, useState } from "react";
import type { Enumerator } from "@/lib/types";

export function matchingEnumerators(enumerators: Enumerator[], query: string) {
  const search = query.trim().toLowerCase();
  return enumerators.filter((item) => item.active && `${item.full_name} ${item.enumerator_code}`.toLowerCase().includes(search))
    .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.enumerator_code.localeCompare(b.enumerator_code));
}

export function EnumeratorPicker({ enumerators, value, onChange, disabled }: {
  enumerators: Enumerator[]; value: string; onChange: (id: string) => void; disabled: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const selected = enumerators.find((item) => item.id === value);
  const options = matchingEnumerators(enumerators, query);
  function choose(item: Enumerator) {
    onChange(item.id); setQuery(""); setOpen(false); setHighlight(0);
  }
  return <div className="enumerator-picker" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label htmlFor={id}>Enumerator</label>
    <div className="button-row">
      <input id={id} autoFocus role="combobox" autoComplete="off" disabled={disabled}
        aria-expanded={open} aria-controls={`${id}-options`} aria-autocomplete="list"
        aria-activedescendant={open && options[highlight] ? `${id}-${options[highlight].id}` : undefined}
        value={selected ? `${selected.full_name} (${selected.enumerator_code})` : query}
        placeholder="Select or type a name or code"
        onFocus={() => setOpen(true)}
        onChange={(event) => { onChange(""); setQuery(event.target.value); setOpen(true); setHighlight(0); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            setHighlight((index) => open ? Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))) : 0);
          } else if (event.key === "Enter" && open) {
            event.preventDefault(); if (options[highlight]) choose(options[highlight]);
          } else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        }} />
      <button type="button" className="button" disabled={disabled} aria-label="Show enumerators" aria-expanded={open} aria-controls={`${id}-options`} onClick={() => { setQuery(""); setOpen(!open); setHighlight(0); }}>▾</button>
    </div>
    {open && <ul id={`${id}-options`} role="listbox" aria-label="Enumerators" className="enumerator-options">
      {options.map((item, index) => <li key={item.id} id={`${id}-${item.id}`} role="option" aria-selected={item.id === value}
        className={index === highlight ? "highlighted" : ""}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>
        {item.full_name} <span className="muted">({item.enumerator_code})</span>
      </li>)}
      {!options.length && <li role="presentation">No active enumerators match.</li>}
    </ul>}
  </div>;
}
