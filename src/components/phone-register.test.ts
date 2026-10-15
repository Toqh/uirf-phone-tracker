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
