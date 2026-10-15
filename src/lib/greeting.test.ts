import { describe, expect, it } from "vitest";
import { dashboardGreeting, greetingName } from "./greeting";

describe("Overview greeting in Nigeria time", () => {
  it("uses the first name while handling extra whitespace", () => {
    expect(greetingName("Ada Okafor")).toBe("Ada");
    expect(greetingName("  Ada   Okafor  ")).toBe("Ada");
    expect(greetingName("Mary-Jane Smith")).toBe("Mary-Jane");
    expect(greetingName("Ada")).toBe("Ada");
    expect(greetingName(" ")).toBe("there");
  });
  it.each([
    ["2026-10-15T23:00:00Z", "Good morning"],
    ["2026-10-15T10:59:00Z", "Good morning"],
    ["2026-10-15T11:00:00Z", "Good afternoon"],
    ["2026-10-15T16:59:00Z", "Good afternoon"],
    ["2026-10-15T17:00:00Z", "Good evening"],
    ["2026-10-15T22:59:00Z", "Good evening"],
  ])("uses the right greeting at %s", (date, expected) => {
    expect(dashboardGreeting(new Date(date), 0.5)).toBe(expected);
  });
  it("occasionally substitutes Welcome", () => {
    const date = new Date("2026-10-15T11:00:00Z");
    expect(dashboardGreeting(date, 0)).toBe("Welcome");
    expect(dashboardGreeting(date, 0.199)).toBe("Welcome");
    expect(dashboardGreeting(date, 0.2)).toBe("Good afternoon");
  });
});
