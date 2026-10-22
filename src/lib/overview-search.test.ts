import { describe, expect, it } from "vitest";
import { buildOverviewSearchRecords, searchOverview, type SearchAccount } from "./overview-search";
import type { Enumerator, PhoneRow, Supervisor } from "./types";

const enumerators = [
  { id: "e1", full_name: "Adá Okoro", enumerator_code: "EN-01", active: true, usual_supervisor_id: "s1" },
  { id: "e2", full_name: "Bola Musa", enumerator_code: "EN-02", active: false, usual_supervisor_id: "s2" },
] as Enumerator[];
const supervisors = [
  { id: "s1", full_name: "Tunde Bello", supervisor_code: "SUP-01", active: true, email: "tunde@example.com" },
  { id: "s2", full_name: "Mary James", supervisor_code: "SUP-02", active: true },
] as Supervisor[];
const phones = [
  { id: "p1", serial_number: "000123", status: "issued", project: "DASH", active_checkout_id: "c1", enumerator_id: "e1", enumerator_name: "Adá Okoro", supervisor_id: "s1", supervisor_name: "Tunde Bello", collected_at: "2026-10-20T10:00:00Z", configured_at: "2026-10-19T10:00:00Z" },
  { id: "p2", serial_number: "000124", status: "available", enumerator_id: "e1", supervisor_id: "s1", active_checkout_id: null },
  { id: "p3", serial_number: "000125", status: "issued", project: "NUTRINT", enumerator_id: null, supervisor_id: "s1", supervisor_name: "Tunde Bello", active_checkout_id: "c3" },
  { id: "p4", serial_number: "000126", status: "issued", enumerator_id: "e2", supervisor_id: "s1", active_checkout_id: "c4" },
  { id: "p5", serial_number: "000127", status: "issued", enumerator_id: "e2", supervisor_id: "s2", active_checkout_id: "c5" },
] as PhoneRow[];
const accounts: SearchAccount[] = [{ id: "a1", full_name: "Admin User", email: "admin@example.com", role: "admin", status: "disabled" }];
const records = buildOverviewSearchRecords({ phones, enumerators, supervisors, accounts, canViewRegister: true });

describe("overview search", () => {
  it("finds serials with leading zeroes and ranks the phone ahead of its holder", () => {
    expect(searchOverview(records, "000123").map((item) => item.id)).toEqual(["phone-p1", "enumerator-e1", "supervisor-s1"]);
    expect(searchOverview(records, "0123")[0].id).toBe("phone-p1");
  });
  it("matches names without accents, arbitrary word order, case, and extra spaces", () => {
    expect(searchOverview(records, "  OKORO   ada  ").map((item) => item.id)).toEqual(["phone-p1", "enumerator-e1"]);
    expect(searchOverview(records, "DASH okoro").map((item) => item.id)).toEqual(["phone-p1"]);
  });
  it("searches directory codes, email, projects, and both register and stored status names", () => {
    expect(searchOverview(records, "EN-01").map((item) => item.id)).toContain("phone-p1");
    expect(searchOverview(records, "SUP-01").map((item) => item.id)).toContain("supervisor-s1");
    expect(searchOverview(records, "tunde@example.com").map((item) => item.id)).toEqual(["supervisor-s1"]);
    expect(searchOverview(records, "nutrint").map((item) => item.id)).toEqual(["phone-p3"]);
    expect(searchOverview(records, "ready to issue").map((item) => item.id)).toEqual(["phone-p2"]);
    expect(searchOverview(records, "available").map((item) => item.id)).toEqual(["phone-p2"]);
    expect(searchOverview(records, "issued").map((item) => item.id)).not.toContain("phone-p2");
    expect(searchOverview(records, "admin@example.com")[0]).toMatchObject({ kind: "Account", status: "Disabled" });
  });
  it("shows only current custody and separates direct custody from team totals", () => {
    const enumerator = records.find((item) => item.id === "enumerator-e1")!;
    expect(enumerator.phones.map((phone) => phone.id)).toEqual(["p1"]);
    const supervisor = records.find((item) => item.id === "supervisor-s1")!;
    expect(supervisor.details).toEqual(expect.arrayContaining([
      { label: "Personally held", value: "1 phone" },
      { label: "Team pending return", value: "3 phones" },
    ]));
    expect(supervisor.phones.map((phone) => phone.id)).toEqual(["p1", "p3", "p4"]);
    expect(records.find((item) => item.id === "enumerator-e2")?.status).toBe("Inactive");
  });
  it("returns no results for empty or unmatched queries", () => {
    expect(searchOverview(records, "  ")).toEqual([]);
    expect(searchOverview(records, "not-a-real-phone")).toEqual([]);
  });
  it("builds enumerator search only from supplied private records without register links", () => {
    const personal = buildOverviewSearchRecords({ phones: [phones[0]], enumerators: [enumerators[0]], supervisors: [], canViewRegister: false });
    expect(personal.map((item) => item.id)).toEqual(["phone-p1", "enumerator-e1"]);
    expect(personal.every((item) => !item.href)).toBe(true);
    expect(personal[0].details.some((detail) => detail.label === "Checklist")).toBe(false);
    expect(searchOverview(personal, "Bola")).toEqual([]);
    expect(searchOverview(personal, "admin@example.com")).toEqual([]);
  });
});
