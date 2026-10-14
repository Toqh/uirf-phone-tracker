import type { Metadata } from "next";
import { ImportManager } from "@/components/import-manager";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Imports" };

export default async function ImportsPage() {
  const { supabase } = await requireProfile(true);
  const { data } = await supabase.from("import_batches").select("id,kind,file_name,total_rows,imported_rows,skipped_rows,failed_rows,imported_at,profiles!import_batches_imported_by_fkey(full_name)").order("imported_at", { ascending: false }).limit(20);
  return <ImportManager batches={(data || []).map((batch) => ({ ...batch, imported_by_name: (batch.profiles as unknown as { full_name: string } | null)?.full_name || "Unknown" }))} />;
}
