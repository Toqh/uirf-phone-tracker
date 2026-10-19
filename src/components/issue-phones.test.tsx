import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PhoneRow } from "@/lib/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { IssuePhonesActions, IssuePhonesDialog } from "./issue-phones";

const ready = { id: "one", serial_number: "AVAILABLE-001", status: "available", configured_at: "2026-10-15", active_checkout_id: null } as PhoneRow;
const props = { phones: [ready, { ...ready, id: "two", serial_number: "ISSUED-002", status: "issued" as const }], enumerators: [], supervisors: [] };

describe("dashboard issuing controls", () => {
  it("orders Overview actions as register, issue, then bulk issue", () => {
    const html = renderToStaticMarkup(createElement(IssuePhonesActions, { ...props, showRegistration: true }));
    expect(html).toContain("overview-actions");
    expect(html.indexOf("Register phone")).toBeLessThan(html.indexOf("Issue phones"));
    expect(html.indexOf("Issue phones")).toBeLessThan(html.indexOf("Bulk issue phones"));
    expect(html.indexOf("Bulk issue phones")).toBeLessThan(html.indexOf("Manage phones"));
    expect(html).toContain('href="/phones">Manage phones</a>');
    expect(html).not.toContain('href="/phones?new=1"');
  });
  it("offers separate single and bulk issuing buttons", () => {
    const html = renderToStaticMarkup(createElement(IssuePhonesActions, props));
    expect(html).toContain("Issue phones</button>");
    expect(html).toContain("Bulk issue phones</button>");
  });
  it("offers bulk returns on Overview only when there are active checkouts", () => {
    expect(renderToStaticMarkup(createElement(IssuePhonesActions, props))).toMatch(/<button[^>]*disabled=""[^>]*>Bulk return phones<\/button>/);
    const html = renderToStaticMarkup(createElement(IssuePhonesActions, { ...props, phones: [{ ...ready, status: "issued", active_checkout_id: "checkout" }] }));
    expect(html).toContain("Bulk return phones</button>");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Bulk return phones<\/button>/);
  });
  it("shows only eligible serials and requires a recipient and project", () => {
    const html = renderToStaticMarkup(createElement(IssuePhonesDialog, { ...props, bulk: true, onClose: () => {} }));
    expect(html).toContain("AVAILABLE-001");
    expect(html).not.toContain("ISSUED-002");
    expect(html).toContain("Add serial numbers");
    expect(html).toContain('value="supervisor"');
    expect(html).toContain('value="DASH"');
    expect(html).toContain('value="NUTRINT"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Review issue/);
  });
});
