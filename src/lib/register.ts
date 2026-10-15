export function sortRows<T>(rows: T[], value: (row: T) => string | number | null | undefined, direction = "asc") {
  return [...rows].sort((a, b) => {
    const left = value(a); const right = value(b);
    // Missing values stay last in either direction.
    if (left == null || left === "") return right == null || right === "" ? 0 : 1;
    if (right == null || right === "") return -1;
    const comparison = typeof left === "number" && typeof right === "number"
      ? left - right : String(left).localeCompare(String(right), "en", { numeric: true, sensitivity: "base" });
    return direction === "desc" ? -comparison : comparison;
  });
}

export function matchesFilter(value: string, filter: string, exclude: boolean) {
  return filter === "all" || (exclude ? value !== filter : value === filter);
}

export function visibleSelection<T extends { id: string }>(rows: T[], ids: string[]) {
  const selected = new Set(ids);
  return rows.filter((row) => selected.has(row.id));
}

export async function runBulk<T extends { id: string }>(rows: T[], run: (row: T) => Promise<{ error: unknown }>, progress: (done: number) => void) {
  const results: { id: string; error: unknown }[] = [];
  for (const row of rows) {
    try { results.push({ id: row.id, error: (await run(row)).error }); }
    catch { results.push({ id: row.id, error: new Error("Request interrupted. Check the record before retrying.") }); }
    progress(results.length);
  }
  return results;
}
