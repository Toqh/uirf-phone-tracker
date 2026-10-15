import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PhoneRow } from "@/lib/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { IssuePhonesActions, IssuePhonesDialog } from "./issue-phones";

const ready = { id: "one", serial_number: "AVAILABLE-001", status: "available", configured_at: "2026-10-15", active_checkout_id: null } as PhoneRow;
const props = { phones: [ready, { ...ready, id: "two", serial_number: "ISSUED-002", status: "issued" as const }], enumerators: [], supervisors: [] };

describe("dashboard issuing controls", () => {
  it("offers separate single and bulk issuing buttons", () => {
    const html = renderToStaticMarkup(createElement(IssuePhonesActions, props));
    expect(html).toContain("Issue phones</button>");
    expect(html).toContain("Bulk-issue phones</button>");
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
