import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PhoneRow } from "./types";
const { callRpc } = vi.hoisted(() => ({ callRpc: vi.fn() }));
vi.mock("./supabase/rpc", () => ({ callRpc }));
import { canReturn, resolveReturnSerials, returnPhoneBatch } from "./returning";

const first = { id: "p1", serial_number: "007", status: "issued", active_checkout_id: "checkout-7" } as PhoneRow;
const second = { ...first, id: "p2", serial_number: "008", active_checkout_id: "checkout-8" };
const available = { ...first, id: "p3", serial_number: "009", status: "available", active_checkout_id: null } as PhoneRow;
const phones = [first, second, available];

describe("bulk return selection", () => {
  it("requires issued status and an active checkout", () => {
    expect(canReturn(first)).toBe(true);
    expect(canReturn({ ...first, active_checkout_id: null })).toBe(false);
    for (const status of ["available", "needs_attention", "awaiting_configuration"] as const) expect(canReturn({ ...first, status })).toBe(false);
  });
  it("preserves leading zeroes and deduplicates pasted serials", () => {
    expect(resolveReturnSerials(phones, "007,008\n007; 008")).toEqual({ ids: ["p1", "p2"], errors: [] });
  });
  it("identifies available and unknown phones without matching partial serials", () => {
    expect(resolveReturnSerials(phones, "007 009 7")).toEqual({ ids: ["p1"], errors: ["009: no issued phone with an active checkout", "7: not found"] });
  });
});

describe("saving bulk returns", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it.each([
    { label: "empty selection", phones: [] },
    { label: "mixed available and issued phones", phones: [first, available] },
    { label: "missing checkout", phones: [{ ...first, active_checkout_id: null }] },
  ])("rejects $label before saving any returns", async ({ phones }) => {
    await expect(returnPhoneBatch(phones, vi.fn())).rejects.toThrow("Select issued phones with active checkouts");
    expect(callRpc).not.toHaveBeenCalled();
  });
  it("closes each selected active checkout in good condition", async () => {
    callRpc.mockResolvedValue({ error: null });
    const progress = vi.fn();
    await expect(returnPhoneBatch([first, second], progress)).resolves.toEqual([{ id: "p1", error: null }, { id: "p2", error: null }]);
    expect(callRpc.mock.calls).toEqual([
      ["return_phone", { p_checkout_id: "checkout-7", p_faulty: false }],
      ["return_phone", { p_checkout_id: "checkout-8", p_faulty: false }],
    ]);
    expect(progress.mock.calls).toEqual([[1], [2]]);
  });
  it("keeps a stale-checkout failure separate and still attempts other returns once", async () => {
    const error = { message: "Phone was already returned" };
    callRpc.mockResolvedValueOnce({ error }).mockResolvedValueOnce({ error: null });
    expect(await returnPhoneBatch([first, second], vi.fn())).toEqual([{ id: "p1", error }, { id: "p2", error: null }]);
    expect(callRpc).toHaveBeenCalledTimes(2);
  });
  it("reports a lost response without retrying a possibly saved return", async () => {
    callRpc.mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce({ error: null });
    const outcomes = await returnPhoneBatch([first, second], vi.fn());
    expect(outcomes[0].error).toBeInstanceOf(Error);
    expect(outcomes[1]).toEqual({ id: "p2", error: null });
    expect(callRpc).toHaveBeenCalledTimes(2);
  });
});
