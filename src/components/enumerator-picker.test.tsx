import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Enumerator } from "@/lib/types";
import { EnumeratorPicker, matchingEnumerators } from "./enumerator-picker";

const enumerators: Enumerator[] = [
  { id: "2", full_name: "Zainab Musa", enumerator_code: "ENU-02", active: true, usual_supervisor_id: null },
  { id: "1", full_name: "Ada Okafor", enumerator_code: "ENU-01", active: true, usual_supervisor_id: null },
  { id: "3", full_name: "Inactive Person", enumerator_code: "ENU-03", active: false, usual_supervisor_id: null },
];

describe("enumerator picker", () => {
  it("lists active names alphabetically with no search", () => {
    expect(matchingEnumerators(enumerators, "").map((item) => item.id)).toEqual(["1", "2"]);
  });
  it("suggests partial names without case sensitivity", () => {
    expect(matchingEnumerators(enumerators, " MUSA ").map((item) => item.id)).toEqual(["2"]);
  });
  it("searches codes and excludes inactive names", () => {
    expect(matchingEnumerators(enumerators, "enu-01").map((item) => item.id)).toEqual(["1"]);
    expect(matchingEnumerators(enumerators, "Inactive")).toEqual([]);
    expect(matchingEnumerators(enumerators, "unknown")).toEqual([]);
  });
  it("provides a searchable combobox and explicit dropdown control", () => {
    const html = renderToStaticMarkup(createElement(EnumeratorPicker, { enumerators, value: "1", onChange: () => {}, disabled: false }));
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Show enumerators"');
    expect(html).toContain("Ada Okafor (ENU-01)");
  });
});
