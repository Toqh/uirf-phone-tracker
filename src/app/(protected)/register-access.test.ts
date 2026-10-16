import { beforeEach, describe, expect, it, vi } from "vitest";
const { guard } = vi.hoisted(() => ({ guard: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRegisterAccess: guard }));
import PhonesPage from "./phones/page";
import ReportsPage from "./reports/page";
import PhoneDetailPage from "./phones/[id]/page";

describe("direct links to staff pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.mockRejectedValue(new Error("redirect:/dashboard"));
  });
  it.each([
    ["phone management", () => PhonesPage()],
    ["reports", () => ReportsPage()],
    ["phone history", () => PhoneDetailPage({ params: Promise.resolve({ id: "other-phone" }) })],
  ] as const)("checks register access before rendering %s", async (_name, page) => {
    await expect(page()).rejects.toThrow("redirect:/dashboard");
    expect(guard).toHaveBeenCalledOnce();
  });
});
