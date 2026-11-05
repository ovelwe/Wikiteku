import { describe, expect, it } from "vitest";
import { slugSchema, tagsSchema } from "../src/lib/validation";

describe("resource slugs", () => {
  it("normalizes custom tags and rejects oversized or executable markup", () => {
    expect(tagsSchema.parse("Космос, #лор, космос")).toEqual(["космос", "лор"]);
    expect(tagsSchema.safeParse("<script>").success).toBe(false);
    expect(tagsSchema.safeParse("a".repeat(41)).success).toBe(false);
  });
  it("rejects short, long, and path-like values", () => {
    for (const slug of ["a", "ab", "a".repeat(49), "../other", "with space"])
      expect(slugSchema.safeParse(slug).success).toBe(false);
    expect(slugSchema.parse("Valid-Slug")).toBe("valid-slug");
  });
});
