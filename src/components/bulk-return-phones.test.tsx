import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PhoneRow } from "@/lib/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { BulkReturnPhonesDialog } from "./bulk-return-phones";

const issued = { id: "issued", serial_number: "007", status: "issued", active_checkout_id: "checkout", enumerator_name: "Ada", project: "DASH" } as PhoneRow;

describe("bulk return picker", () => {
  it("shows current holders for issued phones and excludes unavailable checkouts", () => {
    const phones = [issued,
      { ...issued, id: "available", serial_number: "008", status: "available" as const, active_checkout_id: null },
      { ...issued, id: "broken", serial_number: "009", active_checkout_id: null },
    ];
    const html = renderToStaticMarkup(createElement(BulkReturnPhonesDialog, { phones, onClose: vi.fn() }));
    expect(html).toContain("007");
    expect(html).toContain("Ada");
    expect(html).toContain("DASH");
    expect(html).not.toContain("008");
    expect(html).not.toContain("009");
    expect(html).toContain("Select all matching");
    expect(html).toContain("Add serial numbers");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Review return<\/button>/);
  });
  it("handles an empty pending-return list and links to individual fault returns", () => {
    const html = renderToStaticMarkup(createElement(BulkReturnPhonesDialog, { phones: [], onClose: vi.fn() }));
    expect(html).toContain("No phones are currently pending return.");
    expect(html).toContain('href="/phones?status=issued"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Select all matching<\/button>/);
  });
});
