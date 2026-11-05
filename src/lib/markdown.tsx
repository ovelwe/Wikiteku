/* biome-ignore-all lint/suspicious/noArrayIndexKey: Markdown output is stateless and ordered by source. */
/* biome-ignore-all lint/performance/noImgElement: User media must not use the server image proxy. */
import {
  type InlineNode,
  type MarkdownAst,
  parseMarkdown,
  renderReact,
} from "@ovelwe/z-md";
import { safeDesignUrl } from "./builder";
import { normalizeMarkdownLinkDestinations } from "./translation-markdown";

const safeProtocols = new Set(["http:", "https:", "mailto:"]);
export function safeHref(value: string): string | null {
  const href = value.trim();
  if (
    (/^\/(?!\/)/.test(href) && !href.includes("\\")) ||
    /^#[-\w]+$/.test(href)
  )
    return href;
  try {
    const url = new URL(href);
    return safeProtocols.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
function flattenText(node: InlineNode): string {
  return "value" in node ? node.value : node.children.map(flattenText).join("");
}
function safeInline(nodes: InlineNode[], fandomSlug?: string): InlineNode[] {
  const merged: InlineNode[] = [];
  for (const node of nodes) {
    const previous = merged.at(-1);
    if (node.type === "text" && previous?.type === "text")
      previous.value += node.value;
    else merged.push({ ...node });
  }
  return merged.flatMap((node): InlineNode | InlineNode[] => {
    if (node.type === "text" && fandomSlug)
      return node.value
        .split(/(\[\[[^\]\n]+\]\])/g)
        .filter(Boolean)
        .map((part) => {
          const match =
            /^\[\[([a-z0-9][a-z0-9-]{1,46}[a-z0-9])(?:\|([^\]]+))?\]\]$/.exec(
              part,
            );
          return match
            ? {
                type: "link",
                href: `/f/${encodeURIComponent(fandomSlug)}/wiki/${match[1]}`,
                children: [{ type: "text", value: match[2] ?? match[1] }],
              }
            : { type: "text", value: part };
        });
    if (node.type === "link") {
      const href = safeHref(node.href);
      return href
        ? { ...node, href, children: safeInline(node.children) }
        : { type: "text", value: node.children.map(flattenText).join("") };
    }
    if (node.type === "bold" || node.type === "italic")
      return { ...node, children: safeInline(node.children, fandomSlug) };
    return node;
  });
}
export function safeMarkdownAst(
  markdown: string,
  fandomSlug?: string,
): MarkdownAst {
  return parseMarkdown(normalizeMarkdownLinkDestinations(markdown)).map(
    (block) => {
      if (block.type === "unorderedList" || block.type === "orderedList")
        return {
          ...block,
          items: block.items.map((items) => safeInline(items, fandomSlug)),
        };
      if ("children" in block)
        return { ...block, children: safeInline(block.children, fandomSlug) };
      return block;
    },
  );
}
type RichBlock =
  | { kind: "markdown"; value: string }
  | { kind: "image"; src: string; alt: string }
  | { kind: "table"; rows: string[][] };
export function extendedBlocks(markdown: string): RichBlock[] {
  const lines = markdown.split(/\r?\n/);
  const result: RichBlock[] = [];
  let buffer: string[] = [];
  let fenced = false;
  const flush = () => {
    if (buffer.length)
      result.push({ kind: "markdown", value: buffer.join("\n") });
    buffer = [];
  };
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((v) => v.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) fenced = !fenced;
    const img = !fenced && /^!\[([^\]]*)\]\(([^\s)]+)\)\s*$/.exec(line.trim());
    if (img && safeDesignUrl(img[2], true) && img[2]) {
      flush();
      result.push({ kind: "image", alt: img[1], src: img[2] });
      continue;
    }
    if (
      !fenced &&
      line.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])
    ) {
      flush();
      const rows = [cells(line)];
      i++;
      while (
        i + 1 < lines.length &&
        lines[i + 1].includes("|") &&
        lines[i + 1].trim()
      )
        rows.push(cells(lines[++i]));
      result.push({ kind: "table", rows });
      continue;
    }
    buffer.push(line);
  }
  flush();
  return result;
}
export function MarkdownRenderer({
  markdown,
  fandomSlug,
  toc = false,
  idPrefix = "wiki-heading",
  tocLabel = "Содержание",
}: {
  markdown: string;
  fandomSlug?: string;
  toc?: boolean;
  idPrefix?: string;
  tocLabel?: string;
}) {
  let heading = 0;
  const sections = extendedBlocks(markdown).map((b) =>
    b.kind === "markdown"
      ? { ...b, ast: safeMarkdownAst(b.value, fandomSlug) }
      : b,
  );
  const headings = sections.flatMap((b) =>
    "ast" in b
      ? b.ast
          .filter((x) => x.type === "heading")
          .map((x) => x.children.map(flattenText).join(""))
      : [],
  );
  return (
    <div className="zmd article-markdown">
      {toc && headings.length > 0 && (
        <nav className="wiki-toc" aria-label={tocLabel}>
          <strong>{tocLabel}</strong>
          {headings.map((title, i) => (
            <a key={`heading-${i}`} href={`#${idPrefix}-${i + 1}`}>
              {title}
            </a>
          ))}
        </nav>
      )}
      {sections.map((block, index) => {
        if (block.kind === "image")
          return (
            <figure key={`block-${index}`}>
              <img
                src={block.src}
                alt={block.alt}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <figcaption>{block.alt}</figcaption>
            </figure>
          );
        if (block.kind === "table")
          return (
            <div className="wiki-table" key={`block-${index}`}>
              <table>
                <thead>
                  <tr>
                    {block.rows[0].map((cell, i) => (
                      <th key={`cell-${i}`}>{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.slice(1).map((row, i) => (
                    <tr key={`row-${i}`}>
                      {block.rows[0].map((_, j) => (
                        <td key={`cell-${j}`}>{row[j] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        return (
          <div key={`block-${index}`}>
            {block.ast.map((node, i) => (
              <div
                key={`node-${i}`}
                id={
                  node.type === "heading"
                    ? `${idPrefix}-${++heading}`
                    : undefined
                }
              >
                {renderReact([node])}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
