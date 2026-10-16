import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionMissingError } from "@supabase/supabase-js";

const { getUser, maybeSingle, redirect } = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); })
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })
  })
}));

import { getAccount, requireProfile, requireRegisterAccess } from "./auth";

describe("account access during failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { status: "approved", role: "supervisor" }, error: null });
  });

  it("does not send an approved user to pending when the profile request fails", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "fetch failed" } });
    await expect(requireProfile()).rejects.toThrow("Unable to load your account");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not treat an authentication outage as a signed-out session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    await expect(getAccount()).rejects.toThrow("Unable to check your session");
    expect(redirect).not.toHaveBeenCalled();
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("sends a genuinely signed-out user to sign in", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
    await expect(requireProfile()).rejects.toThrow("redirect:/auth");
  });

  it("sends an expired refresh-token session to sign in", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 400, code: "refresh_token_not_found" } });
    await expect(requireProfile()).rejects.toThrow("redirect:/auth");
  });

  it.each([
    ["pending", "supervisor"], ["disabled", "supervisor"], ["disabled", "enumerator"],
  ])("keeps %s %s users out of protected pages", async (status, role) => {
    maybeSingle.mockResolvedValue({ data: { status, role }, error: null });
    await expect(requireProfile()).rejects.toThrow("redirect:/pending");
  });

  it.each(["enumerator", "supervisor"])("allows automatically approved %s accounts without Admin access", async (role) => {
    maybeSingle.mockResolvedValue({ data: { status: "approved", role, approved_by: null }, error: null });
    await expect(requireProfile()).resolves.toMatchObject({ profile: { role, status: "approved" } });
    expect(redirect).not.toHaveBeenCalled();
    await expect(requireProfile(true)).rejects.toThrow("redirect:/dashboard");
  });

  it("retains the admin check after an ordinary access check", async () => {
    await expect(requireProfile()).resolves.toMatchObject({ profile: { role: "supervisor" } });
    await expect(requireProfile(true)).rejects.toThrow("redirect:/dashboard");
  });

  it("allows approved admins", async () => {
    maybeSingle.mockResolvedValue({ data: { status: "approved", role: "admin" }, error: null });
    await expect(requireProfile(true)).resolves.toMatchObject({ profile: { role: "admin" } });
  });

  it("rejects enumerators from register and reporting access", async () => {
    maybeSingle.mockResolvedValue({ data: { status: "approved", role: "enumerator" }, error: null });
    await expect(requireRegisterAccess()).rejects.toThrow("redirect:/dashboard");
  });
  it.each(["admin", "supervisor"])("retains register access for %s", async (role) => {
    maybeSingle.mockResolvedValue({ data: { status: "approved", role }, error: null });
    await expect(requireRegisterAccess()).resolves.toMatchObject({ profile: { role } });
  });
  it.each(["pending", "disabled"])("rejects %s accounts from register access", async (status) => {
    maybeSingle.mockResolvedValue({ data: { status, role: "supervisor" }, error: null });
    await expect(requireRegisterAccess()).rejects.toThrow("redirect:/pending");
  });
});
