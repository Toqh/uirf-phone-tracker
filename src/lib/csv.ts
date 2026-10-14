export const importFields = {
  phones: [{ key: "phone_serial", label: "Phone serial", required: true }],
  supervisors: [
    { key: "supervisor_code", label: "Supervisor code", required: false },
    { key: "full_name", label: "Full name", required: true },
    { key: "email", label: "Email", required: false }
  ],
  enumerators: [
    { key: "enumerator_code", label: "Enumerator code", required: false },
    { key: "full_name", label: "Full name", required: true },
    { key: "supervisor_code", label: "Supervisor code", required: false }
  ]
} as const;

export type ImportKind = keyof typeof importFields;

export function normaliseCell(value: unknown) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

export function validatePreview(kind: ImportKind, rows: Record<string, string>[]) {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const errors: string[] = [];
    const key = kind === "phones" ? row.phone_serial : kind === "supervisors" ? row.supervisor_code : row.enumerator_code;
    if (!normaliseCell(row.full_name) && kind !== "phones") errors.push("Full name is required");
    if (kind === "phones" && !/^\d{3}$/.test(normaliseCell(row.phone_serial))) errors.push("Serial must be exactly three digits");
    if (key && seen.has(key.toLowerCase())) errors.push("Duplicate in this file");
    if (key) seen.add(key.toLowerCase());
    return { rowNumber: index + 2, row, errors };
  });
}
