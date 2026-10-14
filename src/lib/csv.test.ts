import { describe, expect, it } from "vitest";
import { protectCsvCell, rowsToCsv } from "./format";
import { validatePreview } from "./csv";

describe("CSV safety and phone serials", () => {
  it("preserves 007 and flags invalid and duplicate serials", () => {
    const result = validatePreview("phones", [
      { phone_serial: "007" },
      { phone_serial: "7" },
      { phone_serial: "007" }
    ]);
    expect(result[0].errors).toEqual([]);
    expect(result[1].errors).toContain("Serial must be exactly three digits");
    expect(result[2].errors).toContain("Duplicate in this file");
    expect(rowsToCsv(["phone_serial"], [["007"]])).toContain('"007"');
  });

  it("protects spreadsheet formula cells", () => {
    expect(protectCsvCell("=HYPERLINK('x')")).toBe('"\'=HYPERLINK(\'x\')"');
  });
});
