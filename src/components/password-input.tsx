"use client";

import { useId, useState } from "react";

export function PasswordInput({ label, name, autoComplete, disabled = false }: {
  label: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="password-field">
    <label htmlFor={id}>{label}</label>
    <div className="password-input">
      <input id={id} name={name} type={visible ? "text" : "password"} required minLength={8} autoComplete={autoComplete} disabled={disabled} />
      <button type="button" className="password-toggle" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-controls={id} aria-pressed={visible} disabled={disabled} onClick={() => setVisible(!visible)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  </div>;
}
