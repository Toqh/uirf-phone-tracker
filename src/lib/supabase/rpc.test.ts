import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, createClient } = vi.hoisted(() => ({ rpc: vi.fn(), createClient: vi.fn() }));
vi.mock("./client", () => ({ createClient }));
import { callRpc } from "./rpc";
import { friendlyError } from "../../components/online-action";

describe("form request failures", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createClient.mockReturnValue({ rpc });
  });

  it("returns a rejected network write as feedback without retrying it", async () => {
    rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await callRpc("add_phone", { p_serial_number: "007" });
    expect(result.error).toBeInstanceOf(Error);
    expect(result.data).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("catches client initialization failures so busy buttons can recover", async () => {
    createClient.mockImplementation(() => { throw new Error("Missing config"); });
    await expect(callRpc("add_phone", {})).resolves.toMatchObject({ data: null, error: expect.any(Error) });
  });

  it("preserves database errors as readable messages", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Phone is already issued" } });
    const result = await callRpc("issue_phone", {});
    expect(friendlyError(result.error)).toBe("already issued");
  });

  it("preserves a successful result", async () => {
    rpc.mockResolvedValue({ data: "record-id", error: null });
    await expect(callRpc("add_phone", {})).resolves.toEqual({ data: "record-id", error: null });
  });
});
