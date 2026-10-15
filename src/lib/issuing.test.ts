import { describe, expect, it } from "vitest";
import type { PhoneRow } from "./types";
import { canIssue, resolveSerials } from "./issuing";

const ready = { id: "one", serial_number: "001", status: "available", configured_at: "2026-10-15", active_checkout_id: null } as PhoneRow;
const phones = [ready, { ...ready, id: "two", serial_number: "AB-02" }, { ...ready, id: "three", serial_number: "003", status: "issued" as const }];

describe("issuing selection", () => {
  it("requires an available configured phone without an active checkout", () => {
    expect(canIssue(ready)).toBe(true);
    expect(canIssue({ ...ready, configured_at: null })).toBe(false);
    expect(canIssue({ ...ready, active_checkout_id: "open" })).toBe(false);
    for (const status of ["issued", "needs_attention", "awaiting_configuration"] as const) expect(canIssue({ ...ready, status })).toBe(false);
  });
  it("handles pasted serials, leading zeroes, case, and duplicates", () => {
    expect(resolveSerials(phones, "001, ab-02\n001;AB-02")).toEqual({ ids: ["one", "two"], errors: [] });
  });
  it("reports every missing or unavailable serial instead of silently skipping it", () => {
    expect(resolveSerials(phones, "001 003 missing")).toEqual({ ids: ["one"], errors: ["003: not available and ready to issue", "MISSING: not found"] });
  });
  it("does not match partial serials or empty input", () => {
    expect(resolveSerials(phones, "AB").ids).toEqual([]);
    expect(resolveSerials(phones, " \n,;")).toEqual({ ids: [], errors: [] });
  });
});
