import Link from "next/link";
import type { ReactNode } from "react";
import { type DesignTheme, defaultTheme, safeDesignUrl } from "@/lib/builder";
import { platformCopy } from "@/lib/platform-copy";

export type ArticleHeaderData = {
  title: string;
  cover: string | null;
  summary: string;
  categories: string[];
  tags: string[];
};

export function ArticleHeader({
  page,
  theme,
  fandomSlug,
  locale = "ru",
  byline,
  eyebrow,
}: {
  page: ArticleHeaderData;
  theme: DesignTheme;
  fandomSlug: string;
  locale?: "ru" | "en";
  byline?: ReactNode;
  eyebrow?: ReactNode;
}) {
  const settings = { ...defaultTheme.article, ...theme.article };
  const labels = platformCopy[locale];
  return (
    <header className="canvas-block wiki-header">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 style={{ fontSize: `clamp(24px, 5cqw, ${settings.titleSize}px)` }}>
        {page.title}
      </h1>
      {settings.cover !== "hidden" &&
        page.cover &&
        safeDesignUrl(page.cover, true) && (
          // biome-ignore lint/performance/noImgElement: User media is rendered directly without a server proxy.
          <img
            className="wiki-cover"
            data-fit={settings.cover}
            style={{
              maxHeight: settings.coverHeight,
              ...(settings.cover === "cover"
                ? { height: settings.coverHeight, objectFit: "cover" }
                : {}),
            }}
            src={page.cover}
            alt={page.title}
            referrerPolicy="no-referrer"
          />
        )}
      {settings.byline === "show" && (
        <p className="wiki-byline">
          {byline ??
            (locale === "en"
              ? "Author and last edit (shown in the article)"
              : "Автор и дата правки (видны в статье)")}
        </p>
      )}
      {settings.categories === "show" && page.categories.length > 0 && (
        <div className="tag-list wiki-categories">
          {page.categories.map((category) => (
            <Link
              className="wiki-chip"
              key={category}
              href={`/f/${fandomSlug}/library?category=${encodeURIComponent(category)}`}
            >
              {category}
            </Link>
          ))}
        </div>
      )}
      {settings.tags === "show" && page.tags.length > 0 && (
        <div className="tag-list wiki-tags">
          {page.tags.map((tag) => (
            <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`}>
              #{tag}
            </Link>
          ))}
        </div>
      )}
      {settings.summary === "show" && page.summary && (
        <p className="wiki-summary">{page.summary}</p>
      )}
      {settings.divider === "show" && (
        <hr className="wiki-header-divider" aria-label={labels.article} />
      )}
    </header>
  );
}
