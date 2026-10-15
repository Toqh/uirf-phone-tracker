import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { readFileSync } from "node:fs";
import { importExamples, importFields, importGuide, validatePreview, type ImportKind } from "./csv";

describe("CSV templates and instructions", () => {
  it.each(Object.keys(importFields) as ImportKind[])("keeps the %s blank template free of instruction and sample rows", (kind) => {
    const template = readFileSync(new URL(`../../public/templates/${kind}.csv`, import.meta.url), "utf8");
    const parsed = Papa.parse(template, { header: true, skipEmptyLines: true });
    expect(parsed.meta.fields).toEqual(importFields[kind].map((field) => field.key));
    expect(parsed.data).toEqual([]);
    const samples = Papa.parse<Record<string, string>>(importExamples[kind], { header: true, skipEmptyLines: true });
    expect(validatePreview(kind, samples.data).every((row) => row.errors.length === 0)).toBe(true);
    for (const field of importFields[kind]) expect(importGuide(kind)).toContain(field.key);
    expect(importGuide(kind)).toContain("007 must stay 007");
  });
  it("flags names outside the database length requirement", () => {
    expect(validatePreview("enumerators", [{ full_name: "A" }])[0].errors).toContain("Full name must be 2–150 characters");
  });
});
