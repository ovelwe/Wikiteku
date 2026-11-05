import { describe, expect, it } from "vitest";
import { defaultTheme, designSchema, safeDesignUrl } from "../src/lib/builder";
import { extendedBlocks, safeHref, safeMarkdownAst } from "../src/lib/markdown";

describe("wiki content", () => {
  it("resolves internal links while preserving code and unsafe text", () => {
    const ast = safeMarkdownAst(
      "[[test-page|Статья]]\n\n```\n[[test-page]]\n```",
      "world",
    );
    expect(JSON.stringify(ast)).toContain("/f/world/wiki/test-page");
    expect(ast.at(-1)?.type).toBe("codeBlock");
    expect(safeHref("/\\evil.test")).toBeNull();
  });
  it("renders image and table extensions without interpreting fenced examples", () => {
    const blocks = extendedBlocks(
      "![Кот](https://example.com/cat.png)\n\n| Имя | Тип |\n| --- | --- |\n| Кот | Герой |\n\n```\n![Нет](https://example.com/cat.png)\n```",
    );
    expect(blocks.filter((b) => b.kind === "image")).toHaveLength(1);
    expect(blocks.find((b) => b.kind === "table")?.kind).toBe("table");
    expect(
      extendedBlocks("![x](javascript:alert(1))").every(
        (b) => b.kind !== "image",
      ),
    ).toBe(true);
  });
  it("allows only authenticated media paths and validates article layout slots", () => {
    expect(
      safeDesignUrl("/api/media/00000000-0000-4000-8000-000000000001", true),
    ).toBe(true);
    expect(safeDesignUrl("/api/media/../../evil", true)).toBe(false);
    expect(
      designSchema.safeParse({
        schemaVersion: 1,
        data: {
          root: { props: defaultTheme },
          content: [{ type: "ArticleBody", props: { id: "body" } }],
        },
      }).success,
    ).toBe(true);
  });
});
