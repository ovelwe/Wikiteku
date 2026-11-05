import { describe, expect, it } from "vitest";
import {
  canEditContent,
  canManageFandom,
  canReadFandom,
} from "../src/lib/permissions";

describe("fandom permissions", () => {
  it("keeps private fandoms and edits restricted", () => {
    expect(canReadFandom("private", null)).toBe(false);
    expect(canReadFandom("private", "reader")).toBe(true);
    expect(canEditContent("reader")).toBe(false);
    expect(canEditContent("editor")).toBe(true);
    expect(canManageFandom("editor")).toBe(false);
    expect(canManageFandom("admin")).toBe(true);
  });
});
