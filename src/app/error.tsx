"use client";

import { PageError } from "@/components/page-error";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main className="content"><PageError retry={retry} /></main>;
}
