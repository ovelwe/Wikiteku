import { describe, expect, it } from "vitest";
import {
  defaultTheme,
  describeDesignErrors,
  designSchema,
  makeTemplate,
  safeDesignUrl,
  themeSchema,
} from "../src/lib/builder";

describe("builder documents", () => {
  it("keeps legacy themes compatible and validates article controls without allowing CSS", () => {
    const {
      article: _article,
      backgroundFit: _backgroundFit,
      ...legacy
    } = defaultTheme;
    expect(themeSchema.parse(legacy).article).toEqual(defaultTheme.article);
    expect(themeSchema.parse(legacy).backgroundFit).toBe("cover");
    const doc = makeTemplate("aurora", "Статья", "Описание");
    doc.data.root.props.article = {
      ...defaultTheme.article,
      cover: "natural",
      tags: "hide",
      byline: "hide",
      titleSize: 36,
    };
    expect(designSchema.parse(doc).data.root.props.article.tags).toBe("hide");
    for (const article of [
      { ...defaultTheme.article, titleSize: 900 },
      { ...defaultTheme.article, cover: "url(javascript:alert(1))" },
      { ...defaultTheme.article, style: "position:fixed" },
    ]) {
      const result = themeSchema.safeParse({ ...defaultTheme, article });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(describeDesignErrors(result.error)).toContain("Шапка статьи");
    }
  });
  it("accepts Puck insertion metadata and reports the exact invalid field", () => {
    const doc = makeTemplate("aurora", "Тест", "Описание");
    doc.data.zones = {};
    doc.data.root.readOnly = {};
    doc.data.content.push({
      type: "Divider",
      props: { id: "new-divider", space: 40 },
    });
    expect(designSchema.safeParse(doc).success).toBe(true);
    doc.data.content[0].props.href = "javascript:alert(1)";
    const result = designSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(describeDesignErrors(result.error)).toContain("Блок → 1 → Ссылка");
  });
  it("validates every starter template and preserves custom fonts and palette", () => {
    for (const preset of ["aurora", "archive", "terminal", "gothic"] as const)
      expect(
        designSchema.safeParse(makeTemplate(preset, "Фандом", "Описание"))
          .success,
      ).toBe(true);
    expect(
      themeSchema.parse({
        ...defaultTheme,
        headingFont: "glitch",
        background: "#123456",
      }).headingFont,
    ).toBe("glitch");
  });
  it("rejects executable URLs, arbitrary style injection and unknown blocks", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "//evil.test",
      "/\\evil.test",
    ])
      expect(safeDesignUrl(value)).toBe(false);
    const doc = makeTemplate("aurora", "Фандом", "Описание");
    doc.data.content[0].props.href = "javascript:alert(1)";
    expect(designSchema.safeParse(doc).success).toBe(false);
    doc.data.content = [{ type: "__proto__", props: { id: "bad" } }];
    expect(designSchema.safeParse(doc).success).toBe(false);
    expect(
      themeSchema.safeParse({
        ...defaultTheme,
        background: "url(https://evil.test)",
      }).success,
    ).toBe(false);
    doc.data.content = [
      { type: "Script", props: { id: "script", code: "alert(1)" } },
    ];
    expect(designSchema.safeParse(doc).success).toBe(false);
  });
  it("rejects duplicate ids and excessive nesting, including nested unsafe links", () => {
    const doc = makeTemplate("aurora", "Фандом", "Описание");
    doc.data.content.push(doc.data.content[0]);
    expect(designSchema.safeParse(doc).success).toBe(false);
    const nested = makeTemplate("aurora", "Фандом", "Описание");
    for (let i = 0; i < 8; i++)
      nested.data.content = [
        {
          type: "Grid",
          props: {
            id: `grid-${i}`,
            columns: "2",
            gap: 20,
            padding: 0,
            content: nested.data.content,
          },
        },
      ];
    expect(designSchema.safeParse(nested).success).toBe(false);
    const unsafe = makeTemplate("aurora", "Фандом", "Описание");
    unsafe.data.content = [
      {
        type: "Grid",
        props: {
          id: "grid",
          columns: "2",
          gap: 20,
          padding: 0,
          content: [
            {
              type: "Button",
              props: {
                id: "button",
                label: "Bad",
                href: "data:text/html,hi",
                align: "left",
              },
            },
          ],
        },
      },
    ];
    expect(designSchema.safeParse(unsafe).success).toBe(false);
  });
});
