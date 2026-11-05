// Adapted from loxa-rpg-site's segment/reassemble approach. Syntax stays local.
export type TranslationSegment = {
  text: string;
  translate: boolean;
  destination?: boolean;
};

export function splitTranslationMarkdown(source: string): TranslationSegment[] {
  const parts: TranslationSegment[] = [];
  const add = (text: string, translate = false) => {
    if (!text) return;
    if (translate) {
      const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
      if (!match) return;
      add(match[1]);
      if (match[2])
        parts.push({ text: match[2], translate: /\p{L}/u.test(match[2]) });
      add(match[3]);
    } else {
      const previous = parts.at(-1);
      if (previous && !previous.translate && !previous.destination)
        previous.text += text;
      else parts.push({ text, translate: false });
    }
  };
  // Balanced delimiters prevent URLs containing parentheses from being split.
  function closing(text: string, start: number, open: string, close: string) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "\\") {
        i++;
        continue;
      }
      if (text[i] === open) depth++;
      if (text[i] === close && --depth === 0) return i;
    }
    return -1;
  }
  function inline(text: string) {
    let cursor = 0;
    let plain = "";
    const flush = () => {
      add(plain, true);
      plain = "";
    };
    while (cursor < text.length) {
      const rest = text.slice(cursor);
      const escaped = /^\\./.exec(rest);
      const url = /^(?:https?:\/\/|mailto:)[^\s<>]+/i.exec(rest);
      const tag = /^<[^>]*>/.exec(rest);
      if (escaped || url || tag) {
        flush();
        const value = (escaped ?? url ?? tag)?.[0] ?? "";
        add(value);
        cursor += value.length;
        continue;
      }
      if (rest.startsWith("[[")) {
        const end = text.indexOf("]]", cursor + 2);
        if (end >= 0) {
          flush();
          const token = text.slice(cursor, end + 2);
          const divider = token.indexOf("|");
          if (divider >= 0) {
            add(token.slice(0, divider + 1));
            inline(token.slice(divider + 1, -2));
            add("]]");
          } else add(token);
          cursor = end + 2;
          continue;
        }
      }
      const ticks = /^`+/.exec(rest)?.[0];
      if (ticks) {
        flush();
        let end = cursor + ticks.length;
        while (end < text.length) {
          const found = text.indexOf(ticks, end);
          if (found < 0) {
            end = -1;
            break;
          }
          if (text[found - 1] !== "`" && text[found + ticks.length] !== "`") {
            end = found;
            break;
          }
          end = found + ticks.length;
        }
        const stop =
          end >= cursor + ticks.length && end < text.length
            ? end + ticks.length
            : text.length;
        add(text.slice(cursor, stop));
        cursor = stop;
        continue;
      }
      const image = rest.startsWith("![");
      if (image || rest.startsWith("[")) {
        const start = cursor + (image ? 1 : 0);
        const end = closing(text, start, "[", "]");
        if (end >= 0) {
          const next = text[end + 1];
          const destinationEnd =
            next === "("
              ? closing(text, end + 1, "(", ")")
              : next === "["
                ? closing(text, end + 1, "[", "]")
                : -1;
          if (destinationEnd >= 0) {
            flush();
            add(image ? "![" : "[");
            inline(text.slice(start + 1, end));
            parts.push({
              text: text.slice(end, destinationEnd + 1),
              translate: false,
              destination: next === "(",
            });
            cursor = destinationEnd + 1;
            continue;
          }
          // Shortcut reference labels are identifiers; keep them verbatim.
          flush();
          add(text.slice(cursor, end + 1));
          cursor = end + 1;
          continue;
        }
      }
      if (/[*_~|#[\]()<>]/.test(text[cursor])) {
        flush();
        add(text[cursor]);
      } else plain += text[cursor];
      cursor++;
    }
    flush();
  }
  let fence: { char: string; length: number } | null = null;
  for (const line of source.split(/(\r?\n)/)) {
    if (/^\r?\n$/.test(line)) {
      add(line);
      continue;
    }
    const fenceLine = line.replace(/^(?: {0,3}> ?)+/, "");
    if (fence) {
      add(line);
      const marker = /^ {0,3}(`+|~+)\s*$/.exec(fenceLine)?.[1];
      if (marker?.[0] === fence.char && marker.length >= fence.length)
        fence = null;
      continue;
    }
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(fenceLine)?.[1];
    if (marker) {
      fence = { char: marker[0], length: marker.length };
      add(line);
      continue;
    }
    if (
      /^(?: {4}|\t)/.test(line) ||
      /^\s*\[[^\]]+\]:/.test(line) ||
      /^\s*(?:[-*_]\s*){3,}$/.test(line) ||
      /^\s*\|?[\s:|-]+\|?\s*$/.test(line)
    ) {
      add(line);
      continue;
    }
    const prefix =
      /^(\s*(?:(?:>\s*)+)?(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)?)/.exec(
        line,
      )?.[0] ?? "";
    add(prefix);
    inline(line.slice(prefix.length));
  }
  return parts;
}

export function translationSkeleton(source: string) {
  return JSON.stringify(
    splitTranslationMarkdown(source).map((part) =>
      part.translate ? { text: null } : { text: part.text },
    ),
  );
}

// z-md stops a URL at the first closing parenthesis. Encode parentheses in
// balanced link destinations before parsing, without changing code or labels.
export function normalizeMarkdownLinkDestinations(source: string) {
  return splitTranslationMarkdown(source)
    .map((part) =>
      part.destination
        ? `](${part.text.slice(2, -1).replaceAll("(", "%28").replaceAll(")", "%29")})`
        : part.text,
    )
    .join("");
}

export function applyTranslationMarkdown(
  source: string,
  translations: readonly string[],
) {
  let cursor = 0;
  const result = splitTranslationMarkdown(source)
    .map((part) => (part.translate ? translations[cursor++] : part.text))
    .join("");
  if (
    cursor !== translations.length ||
    translations.some(
      (text) =>
        !text.trim() || [...text].some((char) => char.charCodeAt(0) < 32),
    ) ||
    translationSkeleton(result) !== translationSkeleton(source)
  )
    throw new Error("structure");
  return result;
}
