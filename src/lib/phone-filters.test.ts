import { describe, expect, it } from "vitest";
import { phoneFiltersHref, readPhoneFilters } from "./phone-filters";

describe("phone filter URLs", () => {
  it("round-trips all filters without losing spaces or special characters", () => {
    const filters = { query: "007 & 008", status: "issued" as const, person: "Ada + Bola", from: "2026-10-01", to: "2026-10-16", exclude: true, readiness: "complete" as const };
    const url = new URL(phoneFiltersHref(filters), "https://app.test");
    expect(readPhoneFilters(url.searchParams)).toEqual(filters);
  });
  it("clears every filter while preserving an open registration request", () => {
    expect(phoneFiltersHref(readPhoneFilters(new URLSearchParams()), "status=issued&q=007&person=Ada&exclude=1&readiness=complete&from=2026-10-01&to=2026-10-16&new=1")).toBe("/phones?new=1");
  });
  it("uses all phones for unknown status and readiness values", () => {
    expect(readPhoneFilters(new URLSearchParams("status=toString&readiness=unknown"))).toMatchObject({ status: "all", readiness: "all" });
  });
  it("a fresh scorecard URL contains only its own status filter", () => {
    expect(readPhoneFilters(new URLSearchParams("status=available"))).toEqual({ query: "", status: "available", person: "", from: "", to: "", exclude: false, readiness: "all" });
  });
});
