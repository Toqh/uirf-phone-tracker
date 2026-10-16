import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/types";
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => createElement("a", props, children), useLinkStatus: () => ({ pending: false }) }));
import { AppShell } from "./app-shell";

function render(role: Profile["role"]) {
  return renderToStaticMarkup(<AppShell profile={{ full_name: "Test Person", role } as Profile}>Page content</AppShell>);
}

describe("mobile hamburger navigation", () => {
  it("uses a closed native disclosure instead of bottom navigation", () => {
    const html = render("admin");
    expect(html).toContain('<details class="mobile-menu">');
    expect(html).toContain('<summary aria-label="Navigation menu">');
    expect(html).not.toContain('class="mobile-nav');
  });
  it("includes every admin destination, account access and sign out", () => {
    const mobile = render("admin").split('class="mobile-menu"')[1];
    for (const href of ["dashboard", "phones", "reports", "directory", "imports", "accounts", "install"]) expect(mobile).toContain(`href="/${href}"`);
    expect(mobile).toContain("Sign out");
    expect(mobile).toContain('aria-current="page"');
  });
  it("does not expose admin navigation to supervisors", () => {
    const html = render("supervisor");
    for (const href of ["accounts", "directory", "imports"]) expect(html).not.toContain(`href="/${href}"`);
  });
  it("limits enumerator navigation to My phones on desktop and mobile", () => {
    const html = render("enumerator");
    expect(html.match(/href="\/dashboard"/g)).toHaveLength(2);
    expect(html).toContain("My phones");
    for (const href of ["phones", "reports", "accounts", "directory", "imports"]) expect(html).not.toContain(`href="/${href}"`);
  });
  it("retains register and reports navigation for supervisors", () => {
    const html = render("supervisor");
    for (const href of ["phones", "reports"]) expect(html.match(new RegExp(`href="/${href}"`, "g"))).toHaveLength(2);
  });
});
