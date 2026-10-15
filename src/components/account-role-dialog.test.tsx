import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { AccountRoleDialog } from "./account-role-dialog";
import { AccountManager } from "./account-manager";

const account = { id: "other", full_name: "Test Person", email: "person@example.test", role: "enumerator", status: "approved", created_at: "2026-10-15T10:00:00Z" } as Profile;
describe("account roles", () => {
  it("offers all three roles and requires an actual change", () => {
    const html = renderToStaticMarkup(createElement(AccountRoleDialog, { account, onClose: () => {} }));
    for (const role of ["admin", "supervisor", "enumerator"]) expect(html).toContain(`value="${role}"`);
    expect(html).toContain("viewing access");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Confirm role change/);
  });
  it("offers assignment to approved accounts but not your own", () => {
    expect(renderToStaticMarkup(createElement(AccountManager, { accounts: [account], currentId: "me" }))).toContain("Assign role");
    expect(renderToStaticMarkup(createElement(AccountManager, { accounts: [account], currentId: account.id }))).not.toContain("Assign role");
  });
  it.each(["pending", "disabled"] as const)("disables assignment for %s accounts", (status) => {
    const html = renderToStaticMarkup(createElement(AccountManager, { accounts: [{ ...account, status }], currentId: "me" }));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Assign role/);
  });
});
