import { expect, it } from "vitest";
import {
  authError,
  platformCopy,
  platformError,
  platformErrors,
} from "../src/lib/platform-copy";

it("keeps both dictionaries complete and never displays unknown error content", () => {
  expect(Object.keys(platformCopy.en).sort()).toEqual(
    Object.keys(platformCopy.ru).sort(),
  );
  for (const locale of ["ru", "en"] as const) {
    expect(
      Object.values(platformCopy[locale]).every((value) => value.length > 0),
    ).toBe(true);
    expect(platformError("__proto__", locale)).toBe(
      platformError("saveFailed", locale),
    );
    expect(platformError("private database error", locale)).toBe(
      platformError("saveFailed", locale),
    );
    for (const key of Object.keys(platformErrors))
      expect(platformError(key, locale)).not.toBe(key);
  }
});
it("localizes authentication failures by code, with a safe fallback", () => {
  expect(authError("INVALID_EMAIL_OR_PASSWORD", "ru")).toBe(
    "Неверный email или пароль",
  );
  expect(authError("INVALID_EMAIL_OR_PASSWORD", "en")).toBe(
    "Invalid email or password.",
  );
  expect(authError("NEW_PROVIDER_ERROR", "en")).toBe(
    platformError("authFailed", "en"),
  );
  expect(authError(undefined, "en", 429)).toBe(
    platformError("authLimit", "en"),
  );
});
