import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { PendingApprovals } from "./pending-approvals";

const account = { id: "pending-user", full_name: "New Person", email: "new@example.com", status: "pending", role: "supervisor", created_at: "2026-10-15T10:00:00Z" } as Profile;

describe("dashboard signup approvals", () => {
  it("shows pending names, emails and approval actions", () => {
    const html = renderToStaticMarkup(createElement(PendingApprovals, { accounts: [account], total: 1 }));
    expect(html).toContain("Signup approvals (1)");
    expect(html).toContain("new@example.com");
    expect(html).toContain('aria-label="Approve viewing for New Person"');
    expect(html).toContain('href="/accounts"');
    expect(html).toContain("Refresh signups");
  });
  it("does not offer approval for approved accounts", () => {
    const html = renderToStaticMarkup(createElement(PendingApprovals, { accounts: [{ ...account, status: "approved" }], total: 0 }));
    expect(html).toBe("");
  });
  it("hides the entire panel when there are no pending signups", () => {
    const html = renderToStaticMarkup(createElement(PendingApprovals, { accounts: [], total: 0 }));
    expect(html).toBe("");
  });
  it("shows load errors rather than falsely claiming no pending signups", () => {
    const html = renderToStaticMarkup(createElement(PendingApprovals, { accounts: [], total: 0, loadError: true }));
    expect(html).toContain("Signup requests could not be loaded");
    expect(html).not.toContain("No signups awaiting approval.");
  });
  it("links to additional pending accounts beyond the dashboard limit", () => {
    const html = renderToStaticMarkup(createElement(PendingApprovals, { accounts: [account], total: 25 }));
    expect(html).toContain("Showing 1 of 25 requests");
  });
});
