import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PhoneRow } from "../lib/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { PhoneRegister } from "./phone-register";

function render(status: PhoneRow["status"], configured: boolean, isAdmin = true) {
  const phone = { id: "test", serial_number: "007", status, configured_at: configured ? "2026-10-15T10:00:00Z" : null } as PhoneRow;
  return renderToStaticMarkup(createElement(PhoneRegister, { phones: [phone], enumerators: [], supervisors: [], isAdmin }));
}

describe("checklist reset control", () => {
  it("enables reset only for Available phones with a complete checklist", () => {
    const html = render("available", true);
    expect(html).toMatch(/<button[^>]*title="Reset is only available[^>]*>Reset checklist<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Reset checklist<\/button>/);
  });
  it.each(["issued", "awaiting_configuration", "needs_attention"] as const)("disables reset for %s phones", (status) => {
    expect(render(status, true)).toMatch(/<button[^>]*disabled=""[^>]*>Reset checklist<\/button>/);
  });
  it("disables reset if readiness is incomplete", () => {
    expect(render("available", false)).toMatch(/<button[^>]*disabled=""[^>]*>Reset checklist<\/button>/);
  });
  it("does not show modification or selection controls to a read-only user", () => {
    const html = render("available", true, false);
    expect(html).not.toContain("Reset checklist");
    expect(html).not.toContain("Select phone 007");
  });
});

describe("overview status filters", () => {
  const phones = ["awaiting_configuration", "available", "issued", "needs_attention"].map((status, index) => ({
    id: status, serial_number: `00${index}`, status, configured_at: null,
  })) as PhoneRow[];
  it.each(phones)("shows only $status phones for a scorecard link", (target) => {
    const html = renderToStaticMarkup(createElement(PhoneRegister, { phones, enumerators: [], supervisors: [], isAdmin: false, initialStatus: target.status }));
    expect(html).toContain("1 shown");
    for (const phone of phones) {
      expect(html.includes(`href="/phones/${phone.id}"`)).toBe(phone.id === target.id);
    }
  });
  it.each([null, "all", "invalid"])("shows all phones for status %s", (initialStatus) => {
    expect(renderToStaticMarkup(createElement(PhoneRegister, { phones, enumerators: [], supervisors: [], isAdmin: false, initialStatus }))).toContain("4 shown");
  });
});
