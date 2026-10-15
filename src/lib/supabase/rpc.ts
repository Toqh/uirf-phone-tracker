"use client";

import { createClient } from "./client";

// Event-handler errors are not caught by React's page error boundaries.
// Return failures to each form so it can show feedback and release its busy state.
// Never retry writes automatically: a dropped response can still mean a saved record.
export async function callRpc(name: string, args: Record<string, unknown>) {
  try {
    return await createClient().rpc(name, args);
  } catch {
    return {
      data: null,
      error: new Error("The request could not be completed. Check your connection and the record's status before trying again.")
    };
  }
}
