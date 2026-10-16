import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
import { GET } from "./route";

describe("signup confirmation", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("sends a confirmed code session directly to the dashboard", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const result = await GET(new NextRequest("https://app.test/auth/confirm?code=secret&next=https://other.test"));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("secret");
    expect(result.headers.get("location")).toBe("https://app.test/dashboard");
  });
  it("sends a confirmed email token directly to the dashboard", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const result = await GET(new NextRequest("https://app.test/auth/confirm?token_hash=secret&type=email"));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "secret", type: "email" });
    expect(result.headers.get("location")).toBe("https://app.test/dashboard");
  });
  it("rejects expired confirmation codes", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("Expired") });
    const result = await GET(new NextRequest("https://app.test/auth/confirm?code=expired"));
    expect(result.headers.get("location")).toBe("https://app.test/auth?confirmation=failed");
  });
});
