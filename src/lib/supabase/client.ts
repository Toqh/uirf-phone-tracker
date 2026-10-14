"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  const { url, key } = publicEnv();
  browserClient ??= createBrowserClient(url, key);
  return browserClient;
}
