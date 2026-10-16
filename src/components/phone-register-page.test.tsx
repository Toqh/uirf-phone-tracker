import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PhoneRow } from "@/lib/types";
import { phoneCategories } from "@/lib/phone-filters";

const navigation = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ refresh: vi.fn() }),
}));
import { PhoneRegisterPage } from "./phone-register-page";

const phones = ["awaiting_configuration", "available", "issued", "needs_attention"].map((status, index) => ({
  id: status, serial_number: `00${index}`, status, configured_at: null,
})) as PhoneRow[];
function render(search: string) {
  navigation.search = search;
  return renderToStaticMarkup(createElement(PhoneRegisterPage, { phones, enumerators: [], supervisors: [], isAdmin: false }));
}

describe("scorecard destinations", () => {
  it.each(phones)("opens only $status rows from the overview URL", (target) => {
    const html = render(`status=${target.status}`);
    expect(html).toContain(`<h2>${phoneCategories[target.status]}</h2>`);
    expect(html).toContain("1 shown");
    for (const phone of phones) expect(html.includes(`href="/phones/${phone.id}"`)).toBe(phone.id === target.id);
  });
  it("opens the full register from the total scorecard", () => {
    expect(render("")).toContain("4 shown");
  });
  it("reads a different card's filters without retaining the previous query", () => {
    expect(render("status=issued&q=missing&exclude=1")).toContain("0 shown");
    const html = render("status=available");
    expect(html).toContain("1 shown");
    expect(html).toContain('href="/phones/available"');
    expect(html).not.toContain('value="missing"');
  });
});
