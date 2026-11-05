import { describe, expect, it } from "vitest";
import {
  applyTranslationMarkdown,
  splitTranslationMarkdown,
  translationSkeleton,
} from "../src/lib/translation-markdown";

describe("translation preserves Markdown", () => {
  const source =
    "# Привет **мир**\r\n\r\n[[hero|Герой]] и [[secret]]\r\n[Ссылка](https://example.com/a_(b))\r\n![Картинка](/api/media/image)\r\n[Текст][ref]\r\n[ref]: https://example.com\r\n| Имя | Мир |\r\n| --- | :---: |\r\n| Герой | Луна |\r\n> 1. Текст `const x = 1`\r\n````ts\r\n```\r\nне переводить\r\n````\r\n~~~\r\nтоже код\r\n~~~\r\n    отступ кода\r\n";
  it("reassembles an exact roundtrip and translates labels without URLs or code", () => {
    const parts = splitTranslationMarkdown(source);
    const texts = parts.filter((p) => p.translate).map((p) => p.text);
    expect(applyTranslationMarkdown(source, texts)).toBe(source);
    expect(texts).toContain("Герой");
    expect(texts).toContain("Ссылка");
    expect(texts).not.toContain("secret");
    expect(texts.join(" ")).not.toMatch(
      /https|const|не переводить|тоже код|отступ кода/,
    );
    const translated = applyTranslationMarkdown(
      source,
      texts.map(() => "Translated"),
    );
    expect(translated).toContain("[[hero|Translated]]");
    expect(translated).toContain("(https://example.com/a_(b))");
    expect(translationSkeleton(translated)).toBe(translationSkeleton(source));
  });
  it("rejects extra structure, new links, missing fragments and multiline output", () => {
    for (const text of [
      "[click](https://evil.test)",
      "# heading",
      "line\nbreak",
      "",
    ])
      expect(() => applyTranslationMarkdown("Текст", [text])).toThrow();
    expect(() => applyTranslationMarkdown("Текст", [])).toThrow();
    expect(() =>
      applyTranslationMarkdown("Текст", ["Text", "extra"]),
    ).toThrow();
  });
  it("protects multi-backtick spans, escaped syntax and bare URLs", () => {
    const value = "Текст `` `код` `` \\* https://example.com/a_(b)";
    expect(
      splitTranslationMarkdown(value)
        .filter((p) => p.translate)
        .map((p) => p.text),
    ).toEqual(["Текст"]);
  });
  it("keeps fenced code inside blockquotes and unfinished fences local", () => {
    const source = "> ```js\n> const слово = 1\n> ```\nТекст\n~~~\nКод";
    const texts = splitTranslationMarkdown(source)
      .filter((part) => part.translate)
      .map((part) => part.text);
    expect(texts).toEqual(["Текст"]);
    expect(applyTranslationMarkdown(source, ["Text"])).toContain(
      "> const слово = 1",
    );
  });
});
