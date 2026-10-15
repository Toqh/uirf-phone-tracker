import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
import { GET } from "./route";

describe("password recovery callback", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("exchanges a code and strips credentials and untrusted redirects", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const result = await GET(new NextRequest("https://app.test/auth/recovery?code=secret&next=https://evil.test"));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("secret");
    expect(result.headers.get("location")).toBe("https://app.test/auth/reset-password");
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
  it("verifies recovery token hashes", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const result = await GET(new NextRequest("https://app.test/auth/recovery?token_hash=secret&type=recovery"));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "secret", type: "recovery" });
    expect(result.headers.get("location")).toContain("/auth/reset-password");
  });
  it.each(["", "?token_hash=secret&type=signup", "?error=access_denied"])("rejects missing or incorrect recovery credentials: %s", async (query) => {
    const result = await GET(new NextRequest(`https://app.test/auth/recovery${query}`));
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(result.headers.get("location")).toBe("https://app.test/auth/forgot-password?error=invalid-link");
  });
  it("handles expired codes and network failures", async () => {
    auth.exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("Expired") }).mockRejectedValueOnce(new Error("Network"));
    for (let i = 0; i < 2; i++) {
      const result = await GET(new NextRequest("https://app.test/auth/recovery?code=old"));
      expect(result.headers.get("location")).toContain("error=invalid-link");
    }
  });
});
