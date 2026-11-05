import { describe, expect, it } from "vitest";
import { safeHref, safeMarkdownAst } from "../src/lib/markdown";

describe("Markdown safety", () => {
  it("keeps safe links and rejects scripts", () => {
    expect(safeHref("https://example.com")).toBe("https://example.com/");
    expect(safeHref("/wiki/article")).toBe("/wiki/article");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
  });
  it("removes dangerous link targets from z-md AST", () => {
    const ast = safeMarkdownAst("[click](javascript:alert(1))");
    expect(JSON.stringify(ast)).not.toContain("javascript:");
  });
  it("preserves a balanced URL containing parentheses without altering code", () => {
    const ast = safeMarkdownAst(
      "[guide](https://example.com/guide_(moon))\n\n`[guide](https://example.com/guide_(moon))`",
    );
    expect(JSON.stringify(ast)).toContain(
      "https://example.com/guide_%28moon%29",
    );
    expect(JSON.stringify(ast)).toContain(
      "[guide](https://example.com/guide_(moon))",
    );
  });
});
