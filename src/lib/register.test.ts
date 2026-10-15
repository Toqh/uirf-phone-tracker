import { describe, expect, it, vi } from "vitest";
import { matchesFilter, runBulk, sortRows, visibleSelection } from "./register";

describe("register controls", () => {
  it("sorts numbers naturally without mutating source rows", () => {
    const rows = [{ id: "1", name: "Phone 10" }, { id: "2", name: "Phone 2" }];
    expect(sortRows(rows, (row) => row.name).map((row) => row.id)).toEqual(["2", "1"]);
    expect(rows[0].id).toBe("1");
  });
  it("keeps absent dates last for ascending and descending order", () => {
    const rows = [{ date: null }, { date: "2026-10-15" }, { date: "2026-10-14" }];
    expect(sortRows(rows, (row) => row.date).map((row) => row.date)).toEqual(["2026-10-14", "2026-10-15", null]);
    expect(sortRows(rows, (row) => row.date, "desc").map((row) => row.date)).toEqual(["2026-10-15", "2026-10-14", null]);
  });
  it("includes or excludes a state without excluding everything for All", () => {
    expect(matchesFilter("issued", "issued", true)).toBe(false);
    expect(matchesFilter("available", "issued", true)).toBe(true);
    expect(matchesFilter("issued", "all", true)).toBe(true);
    expect(matchesFilter("available", "issued", false)).toBe(false);
  });
  it("never includes selected rows hidden by the current filters", () => {
    expect(visibleSelection([{ id: "visible" }], ["hidden", "visible"])).toEqual([{ id: "visible" }]);
  });
  it("reports partial success and does not retry failed writes", async () => {
    const run = vi.fn().mockResolvedValueOnce({ error: null }).mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ error: { message: "State changed" } });
    const progress = vi.fn();
    const results = await runBulk([{ id: "a" }, { id: "b" }, { id: "c" }], run, progress);
    expect(results[0]).toEqual({ id: "a", error: null });
    expect(results[1].error).toBeInstanceOf(Error);
    expect(results[2].error).toEqual({ message: "State changed" });
    expect(run).toHaveBeenCalledTimes(3);
    expect(progress.mock.calls).toEqual([[1], [2], [3]]);
  });
});
