import { describe, expect, it } from "vitest";
import { registrationState, signupInput } from "../src/lib/registration";

describe("registration gate", () => {
  it("fails closed in production despite the local development flag", () => {
    expect(
      registrationState({
        NODE_ENV: "production",
        ALLOW_LOCAL_REGISTRATION: "true",
      }).open,
    ).toBe(false);
    expect(
      registrationState({
        NODE_ENV: "development",
        ALLOW_LOCAL_REGISTRATION: "true",
      }).open,
    ).toBe(true);
  });
  it("requires an explicit public flag and configured mail domain/key", () => {
    const env = {
      NODE_ENV: "production",
      PUBLIC_REGISTRATION_ENABLED: "true",
      RESEND_API_KEY: "test-only",
      RESEND_EMAIL_DOMAIN: "mail.example",
    };
    expect(registrationState(env).publicOpen).toBe(true);
    for (const change of [
      { RESEND_API_KEY: "" },
      { RESEND_EMAIL_DOMAIN: "" },
      { RESEND_EMAIL_DOMAIN: "bad\nfrom" },
      { PUBLIC_REGISTRATION_ENABLED: "false" },
    ])
      expect(registrationState({ ...env, ...change }).publicOpen).toBe(false);
  });
  it("bounds signup input and strips client claims of verified identity", () => {
    const input = {
      name: "Test User",
      username: "test_user",
      email: "TEST@example.invalid",
      password: "LocalTestOnly-012345",
    };
    expect(
      signupInput.parse({ ...input, emailVerified: true, role: "owner" }),
    ).toEqual({ ...input, email: "test@example.invalid" });
    for (const change of [
      { website: "https://bot.example" },
      { password: "short" },
      { name: "x".repeat(81) },
      { username: "../admin" },
    ])
      expect(signupInput.safeParse({ ...input, ...change }).success).toBe(
        false,
      );
  });
});
