"use client";

import { useTransition } from "react";

export function PageError({ retry }: { retry: () => void }) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="panel" role="alert">
      <div className="panel-body">
        <h2>This page could not be loaded</h2>
        <p>Check your connection and try again. If you were saving a record, check its status before submitting it again.</p>
        <div className="button-row">
          <button className="button primary" disabled={pending} onClick={() => startTransition(retry)}>
            {pending ? "Trying again…" : "Try again"}
          </button>
          <a className="button" href="/auth">Go to sign in</a>
        </div>
      </div>
    </section>
  );
}
