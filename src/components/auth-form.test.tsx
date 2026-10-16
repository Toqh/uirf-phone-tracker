import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
// Render the signup state without changing the production form's default sign-in mode.
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => react.useState(initial === "signin" ? "signup" : initial) };
});
import { AuthForm } from "./auth-form";

describe("signup form", () => {
  it("explains that neither viewing role needs approval", () => {
    const html = renderToStaticMarkup(createElement(AuthForm));
    expect(html).toContain("Enumerators and supervisors can sign up without administrator approval.");
    expect(html).toContain("Create account</button>");
    expect(html).not.toContain("Create pending account");
  });
  it("requires an explicit Enumerator or Supervisor choice", () => {
    const html = renderToStaticMarkup(createElement(AuthForm));
    expect(html).toContain('<select name="role" required=""');
    expect(html).toContain('value="enumerator"');
    expect(html).toContain('value="supervisor"');
    expect(html).not.toContain('value="admin"');
    expect(html).toContain("Select your role");
  });
  it("requires password confirmation and provides independent accessible visibility controls", () => {
    const html = renderToStaticMarkup(createElement(AuthForm));
    for (const name of ["password", "confirmPassword"]) {
      const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0];
      expect(input).toContain('type="password"');
      expect(input).toContain('required=""');
      expect(input).toContain('minLength="8"');
      expect(input).toContain('autoComplete="new-password"');
    }
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('aria-label="Show confirm password"');
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html.match(/type="button" class="password-toggle"/g)).toHaveLength(2);
  });
});
