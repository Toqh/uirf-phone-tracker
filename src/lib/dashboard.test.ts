import { describe, expect, it } from "vitest";
import { dashboardPhones, supervisorRoster } from "./dashboard";
import type { Enumerator, PhoneRow, Profile, Supervisor } from "./types";

const enumerators = [
  { id: "e1", linked_profile_id: "login-e1", usual_supervisor_id: "s1" },
  { id: "e2", linked_profile_id: "login-e2", usual_supervisor_id: "s2" },
] as Enumerator[];
const supervisors = [{ id: "s1", linked_profile_id: "login-s1" }, { id: "s2", linked_profile_id: "login-s2" }] as Supervisor[];
const phones = [
  { id: "personal", enumerator_id: "e1", supervisor_id: null, status: "issued", active_checkout_id: "c1" },
  { id: "direct", enumerator_id: null, supervisor_id: "s1", status: "issued", active_checkout_id: "c2" },
  { id: "checkout-team", enumerator_id: "e2", supervisor_id: "s1", status: "issued", active_checkout_id: "c3" },
  { id: "other", enumerator_id: "e2", supervisor_id: "s2", status: "issued", active_checkout_id: "c4" },
  { id: "returned", enumerator_id: "e1", supervisor_id: "s1", status: "available", active_checkout_id: null },
] as PhoneRow[];
function scope(id: string, role: Profile["role"]) { return dashboardPhones({ id, role } as Profile, phones, enumerators, supervisors); }

describe("personalised dashboard phones", () => {
  it("shows only an enumerator's currently held phones", () => {
    expect(scope("login-e1", "enumerator").phones.map((phone) => phone.id)).toEqual(["personal"]);
  });
  it("includes a supervisor's directory team, checkout assignments, and direct custody", () => {
    expect(scope("login-s1", "supervisor").phones.map((phone) => phone.id)).toEqual(["personal", "direct", "checkout-team"]);
  });
  it("does not infer a link or expose other phones when an account is unlinked", () => {
    expect(scope("unknown", "enumerator")).toEqual({ linked: false, phones: [] });
    expect(scope("unknown", "supervisor")).toEqual({ linked: false, phones: [] });
  });
  it("retains full totals for admins", () => {
    expect(scope("admin", "admin").phones).toEqual(phones);
  });
});

describe("supervisor enumerator roster", () => {
  const team = [...enumerators, { id: "e3", usual_supervisor_id: "s1", active: false }, { id: "e4", usual_supervisor_id: "s2" }] as Enumerator[];
  it("includes members without phones and enumerators assigned through current checkouts", () => {
    const roster = supervisorRoster({ id: "login-s1", role: "supervisor" } as Profile, phones, team, supervisors);
    expect(roster.map(({ enumerator, phones }) => [enumerator.id, phones.map((phone) => phone.id)])).toEqual([
      ["e1", ["personal"]], ["e2", ["checkout-team"]], ["e3", []],
    ]);
  });
  it("does not include returned checkouts or unrelated enumerators", () => {
    const roster = supervisorRoster({ id: "login-s1", role: "supervisor" } as Profile, phones.filter((phone) => phone.id !== "checkout-team"), team, supervisors);
    expect(roster.map(({ enumerator }) => enumerator.id)).toEqual(["e1", "e3"]);
  });
  it("does not expose a team to an unlinked account or an enumerator", () => {
    expect(supervisorRoster({ id: "unknown", role: "supervisor" } as Profile, phones, team, supervisors)).toEqual([]);
    expect(supervisorRoster({ id: "login-s1", role: "enumerator" } as Profile, phones, team, supervisors)).toEqual([]);
  });
});
