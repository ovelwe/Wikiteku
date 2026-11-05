import { describe, expect, it } from "vitest";
import { decisionInput, reportInput } from "../src/lib/moderation";

describe("moderation validation", () => {
  const pageId = "96cb6fd7-d915-4047-9a67-b16ef51d4aed";
  it("validates category, revision and bounded plain text without accepting client authority", () => {
    const input = {
      pageId,
      revision: 1,
      reason: "spam",
      details: "  Пример жалобы со ссылкой <script>  ",
    };
    expect(reportInput.parse(input).details).toBe(
      "Пример жалобы со ссылкой <script>",
    );
    for (const change of [
      { reason: "fake" },
      { revision: 1.2 },
      { details: "short" },
      { details: "x".repeat(3001) },
      { reporterId: "other" },
    ])
      expect(reportInput.safeParse({ ...input, ...change }).success).toBe(
        false,
      );
  });
  it("requires both moderation and article versions plus an explanation", () => {
    const input = {
      reportId: pageId,
      revision: 0,
      pageRevision: 1,
      action: "block",
      note: "Проверено модератором",
    };
    expect(decisionInput.safeParse(input).success).toBe(true);
    for (const change of [
      { note: " " },
      { revision: -1 },
      { pageRevision: 0 },
      { actorId: "admin" },
      { action: "delete" },
    ])
      expect(decisionInput.safeParse({ ...input, ...change }).success).toBe(
        false,
      );
  });
});
