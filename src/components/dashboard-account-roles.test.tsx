import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { DashboardAccountRoles } from "./dashboard-account-roles";

describe("dashboard role assignment", () => {
  it("lists approved accounts but excludes your own and pending accounts", () => {
    const accounts = [
      { id: "me", full_name: "Own Admin", status: "approved", role: "admin" },
      { id: "other", full_name: "Approved Person", email: "approved@example.test", status: "approved", role: "enumerator" },
      { id: "pending", full_name: "Pending Person", status: "pending", role: "supervisor" },
    ] as Profile[];
    const html = renderToStaticMarkup(createElement(DashboardAccountRoles, { accounts, currentId: "me" }));
    expect(html).toContain("Assign account roles");
    expect(html).toContain("Approved Person");
    expect(html).not.toContain("Own Admin");
    expect(html).not.toContain("Pending Person");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Assign role/);
  });
  it("reports account-loading failures", () => {
    const html = renderToStaticMarkup(createElement(DashboardAccountRoles, { accounts: [], currentId: "me", loadError: true }));
    expect(html).toContain("Accounts could not be loaded");
  });
});
