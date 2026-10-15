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

export const importHelp: Record<string, { instructions: string; example: string }> = {
  phone_serial: { instructions: "Required. Exactly three digits, from 000 to 999. Format this column as Text before entering values so leading zeros are retained.", example: "007" },
  full_name: { instructions: "Required. A person's full name, 2–150 characters.", example: "Amina Bello" },
  supervisor_code: { instructions: "For supervisors: optional unique code (generated if blank). For enumerators: optional code of an existing supervisor; import supervisors first.", example: "SUP-001" },
  enumerator_code: { instructions: "Optional unique code. Leave blank to generate a code. Supplied codes are compared without regard to letter case.", example: "ENU-001" },
  email: { instructions: "Optional directory contact email. This does not create or invite a login account.", example: "amina@example.org" }
};

export const importExamples: Record<ImportKind, string> = {
  phones: "phone_serial\r\n007\r\n008\r\n",
  supervisors: "supervisor_code,full_name,email\r\nSUP-001,Amina Bello,amina@example.org\r\n",
  enumerators: "enumerator_code,full_name,supervisor_code\r\nENU-001,Chinedu Okafor,SUP-001\r\n"
};

export function importGuide(kind: ImportKind) {
  return [
    `Survey Phone Tracker — ${kind} CSV instructions`, "",
    "1. Download the blank template and keep the first (header) row.",
    "2. Enter one record per row. In Excel, set serial/code columns to Text BEFORE typing (007 must stay 007).",
    "3. Save as CSV UTF-8 (comma-delimited). Put text containing commas inside double quotes.",
    "4. Do not add title rows, notes, formulas, or these instructions to the CSV. Sample files are examples; replace the sample data before importing.",
    "5. Choose the matching import type, upload, map columns, and review the preview before importing.",
    "6. Existing serials/codes are skipped, not updated. Valid rows can succeed even if other rows fail; review the results before retrying.",
    "7. Blank directory codes are generated. Retrying rows with blank codes can create duplicates; use stable codes when possible.",
    "8. Import supervisors before enumerators when linking by supervisor_code. New phones start with an incomplete checklist.", "",
    ...importFields[kind].map((field) => `${field.key} (${field.required ? "required" : "optional"}): ${importHelp[field.key].instructions} Example: ${importHelp[field.key].example}`),
    "", "Example only:", importExamples[kind]
  ].join("\r\n");
}

export function normaliseCell(value: unknown) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

export function validatePreview(kind: ImportKind, rows: Record<string, string>[]) {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const errors: string[] = [];
    const key = kind === "phones" ? row.phone_serial : kind === "supervisors" ? row.supervisor_code : row.enumerator_code;
    if (kind !== "phones" && (normaliseCell(row.full_name).length < 2 || normaliseCell(row.full_name).length > 150)) errors.push("Full name must be 2–150 characters");
    if (kind === "phones" && !/^\d{3}$/.test(normaliseCell(row.phone_serial))) errors.push("Serial must be exactly three digits");
    if (key && seen.has(key.toLowerCase())) errors.push("Duplicate in this file");
    if (key) seen.add(key.toLowerCase());
    return { rowNumber: index + 2, row, errors };
  });
}
