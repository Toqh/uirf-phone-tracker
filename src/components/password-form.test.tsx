import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
import { PasswordForm } from "./password-form";
import { AuthForm } from "./auth-form";

describe("password recovery forms", () => {
  it("links to recovery from sign-in", () => {
    expect(renderToStaticMarkup(createElement(AuthForm))).toContain('href="/auth/forgot-password"');
  });
  it("requests an email without asking for the forgotten password", () => {
    const html = renderToStaticMarkup(createElement(PasswordForm));
    expect(html).toContain('type="email"');
    expect(html).not.toContain('type="password"');
    expect(html).toContain("Send reset link");
  });
  it("requires a new password and confirmation", () => {
    const html = renderToStaticMarkup(createElement(PasswordForm, { reset: true }));
    expect(html).toContain('name="confirmPassword"');
    expect(html).toContain('minLength="8"');
    expect(html).toContain("Save new password");
  });
});
