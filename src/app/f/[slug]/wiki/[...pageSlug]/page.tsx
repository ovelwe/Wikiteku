import {
  and,
  arrayOverlaps,
  desc,
  eq,
  ilike,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { changePage } from "@/app/wiki-actions";
import { ArticleHeader } from "@/components/builder/article-header";
import {
  CanvasTheme,
  DesignRenderer,
  WorldBackdrop,
} from "@/components/builder/config";
import { defaultTheme } from "@/lib/builder";
import { db } from "@/lib/db";
import { pageRevisions, pages, user } from "@/lib/db/schema";
import { MarkdownRenderer } from "@/lib/markdown";
import { canEditContent, canReadFandom } from "@/lib/permissions";
import { platformCopy } from "@/lib/platform-copy";
import { translationCopy } from "@/lib/translation";
import { getLocale } from "@/server/community";
import { getDesign, getPageDesign } from "@/server/designs";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { getPage } from "@/server/pages";
import { getSession } from "@/server/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string[] }>;
}): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const fandom = await getFandom(slug);
  const page =
    fandom && pageSlug.length === 1
      ? await getPage(fandom.id, pageSlug[0])
      : null;
  return {
    title:
      fandom?.visibility === "public" && page?.status === "published"
        ? page.title
        : platformCopy[await getLocale()].article,
    description:
      fandom?.visibility === "public" && page?.status === "published"
        ? page.summary
        : undefined,
    robots: {
      index: fandom?.visibility === "public" && page?.status === "published",
    },
    alternates:
      fandom?.visibility === "public" && page?.status === "published"
        ? { canonical: `/f/${fandom.slug}/wiki/${page.slug}` }
        : undefined,
  };
}

export default async function WikiPage({
  params,
}: {
  params: Promise<{ slug: string; pageSlug: string[] }>;
}) {
  const { slug, pageSlug } = await params;
  if (pageSlug.length !== 1) notFound();
  const fandom = await getFandom(slug);
  if (!fandom) notFound();
  const session = await getSession();
  const role = await getMemberRole(fandom.id, session?.user.id);
  if (!canReadFandom(fandom.visibility, role)) notFound();
  const page = await getPage(fandom.id, pageSlug[0]);
  if (!page || (page.status === "draft" && !canEditContent(role))) notFound();
  const locale = await getLocale();
  const labels = platformCopy[locale];
  const translationLabels = translationCopy[locale];
  const [design, appearance, author, editors, related, backlinks] =
    await Promise.all([
      getDesign(fandom.id),
      getPageDesign(page.id),
      db
        .select({ name: user.name, username: user.username })
        .from(user)
        .where(eq(user.id, page.authorId))
        .limit(1),
      db
        .select({ name: user.name })
        .from(pageRevisions)
        .innerJoin(user, eq(pageRevisions.editorId, user.id))
        .where(eq(pageRevisions.pageId, page.id))
        .orderBy(desc(pageRevisions.revision))
        .limit(1),
      db
        .select({ title: pages.title, slug: pages.slug })
        .from(pages)
        .where(
          and(
            eq(pages.fandomId, fandom.id),
            ne(pages.id, page.id),
            isNull(pages.deletedAt),
            isNull(pages.blockedAt),
            eq(pages.status, "published"),
            page.categories.length
              ? arrayOverlaps(pages.categories, page.categories)
              : sql`false`,
          ),
        )
        .limit(6),
      db
        .select({ title: pages.title, slug: pages.slug })
        .from(pages)
        .where(
          and(
            eq(pages.fandomId, fandom.id),
            ne(pages.id, page.id),
            isNull(pages.deletedAt),
            isNull(pages.blockedAt),
            eq(pages.status, "published"),
            or(
              ilike(pages.markdown, `%[[${page.slug}]]%`),
              ilike(pages.markdown, `%[[${page.slug}|%`),
            ),
          ),
        )
        .limit(20),
    ]);
  const theme =
    appearance?.published?.data.root.props ??
    design?.published?.data.root.props ??
    defaultTheme;
  return (
    <div className="published-world wiki-page">
      <WorldBackdrop theme={theme} />
      <nav
        className="wiki-toolbar"
        aria-label={locale === "en" ? "Article navigation" : "Навигация статьи"}
      >
        <div className="wiki-toolbar-inner">
          <div className="page-actions">
            <Link href={`/f/${slug}`}>← {fandom.title}</Link>
            {page.status === "published" && (
              <Link
                className="button small"
                href={`/f/${slug}/pages/${page.id}/translation`}
              >
                {translationLabels.title}
              </Link>
            )}
            {page.status === "published" && (
              <Link href={`/f/${slug}/pages/${page.id}/report`}>
                {locale === "en" ? "Report" : "Пожаловаться"}
              </Link>
            )}
          </div>
          {canEditContent(role) && (
            <details className="wiki-tools-menu">
              <summary>
                {locale === "en" ? "Manage article" : "Управление статьёй"}
              </summary>
              <div className="wiki-tools">
                <Link href={`/f/${slug}/pages/${page.id}/edit`}>
                  {labels.edit}
                </Link>
                <Link href={`/f/${slug}/pages/${page.id}/design`}>
                  ✦ {labels.articleDesign}
                </Link>
                <Link href={`/f/${slug}/pages/${page.id}/history`}>
                  {labels.historyRestore}
                </Link>
                <Link href={`/f/${slug}/media`}>{labels.media}</Link>
                {appearance?.published && (
                  <form action={changePage.bind(null, slug, page.id)}>
                    <input
                      type="hidden"
                      name="expected"
                      value={page.revision}
                    />
                    <input
                      type="hidden"
                      name="version"
                      value={appearance.revision}
                    />
                    <input type="hidden" name="action" value="inherit" />
                    <button type="submit">{labels.inheritTheme}</button>
                  </form>
                )}
              </div>
            </details>
          )}
        </div>
      </nav>
      <CanvasTheme theme={theme} showBackground={false} articlePage>
        <ArticleHeader
          page={page}
          theme={theme}
          fandomSlug={slug}
          locale={locale}
          eyebrow={
            <>
              {page.status === "draft" ? labels.draft : labels.article} ·{" "}
              {labels.version} {page.revision}
            </>
          }
          byline={
            <>
              {labels.author}:{" "}
              {author[0]?.username ? (
                <Link href={`/u/${author[0].username}`}>{author[0].name}</Link>
              ) : (
                author[0]?.name
              )}
              . {labels.lastEdit}: {editors[0]?.name ?? author[0]?.name} ·{" "}
              {page.updatedAt.toLocaleString(locale)}
            </>
          }
        />
        <article className="wiki-body">
          {!appearance?.published && (
            <MarkdownRenderer
              markdown={page.markdown}
              fandomSlug={slug}
              toc
              tocLabel={labels.contents}
            />
          )}
        </article>
        {appearance?.published && (
          <DesignRenderer
            document={appearance.published}
            articles={[]}
            article={{ markdown: page.markdown, fandomSlug: slug }}
            embedded
          />
        )}
        {(theme.article?.related ?? "show") === "show" && (
          <div className="wiki-relations">
            {[
              { title: labels.related, items: related },
              { title: labels.backlinks, items: backlinks },
            ].map(({ title, items }) => (
              <section className="wiki-relation-card" key={title}>
                <h2>{title}</h2>
                {items.map((item) => (
                  <Link key={item.slug} href={`/f/${slug}/wiki/${item.slug}`}>
                    {item.title} →
                  </Link>
                ))}
                {!items.length && <p>{labels.noMaterials}</p>}
              </section>
            ))}
          </div>
        )}
      </CanvasTheme>
    </div>
  );
}
