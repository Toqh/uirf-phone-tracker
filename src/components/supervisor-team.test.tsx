import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Enumerator, PhoneRow } from "@/lib/types";
import { SupervisorTeam } from "./supervisor-team";
import { AssignedPhones } from "./assigned-phones";

describe("dashboard custody display", () => {
  const phone = { id: "phone-7", serial_number: "007", project: "DASH", collected_at: "2026-10-15T10:00:00Z" } as PhoneRow;
  it("lists enumerators with and without outstanding phones", () => {
    const html = renderToStaticMarkup(createElement(SupervisorTeam, { members: [
      { enumerator: { id: "e1", full_name: "Ada", enumerator_code: "E01", active: true } as Enumerator, phones: [phone] },
      { enumerator: { id: "e2", full_name: "Bola", enumerator_code: "E02", active: true } as Enumerator, phones: [] },
    ] }));
    expect(html).toContain("Ada");
    expect(html).toContain("Bola");
    expect(html).toContain("1 pending return");
    expect(html).toContain("No phones pending");
    expect(html).toContain('href="/phones/phone-7"');
    expect(html).toContain("007");
  });
  it("shows an enumerator their saved phone details and pending-return count", () => {
    const html = renderToStaticMarkup(createElement(AssignedPhones, { phones: [phone], team: false, linked: true }));
    expect(html).toContain("Phones with you");
    expect(html).toContain("1 phone pending return");
    expect(html).toContain("DASH");
    expect(html).toContain("007");
    expect(html).not.toContain('href="/phones/');
  });
  it("distinguishes a missing account link from no outstanding phones", () => {
    const html = renderToStaticMarkup(createElement(AssignedPhones, { phones: [], team: false, linked: false }));
    expect(html).toContain("Account link required");
    expect(html).not.toContain("0 phones pending return");
  });
});
