import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import Link from "next/link";
import { FandomCard } from "@/components/fandom-card";
import { db } from "@/lib/db";
import { fandoms, pages } from "@/lib/db/schema";
import { platformCopy } from "@/lib/platform-copy";
import { getLocale } from "@/server/community";
import { listFandoms } from "@/server/fandoms";

export async function generateMetadata() {
  return { title: platformCopy[await getLocale()].search };
}
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q?.trim().slice(0, 100) ?? "";
  const locale = await getLocale();
  const t = platformCopy[locale];
  const [fandomResult, articles] = q
    ? await Promise.all([
        listFandoms({ query: q }),
        db
          .select({
            id: pages.id,
            slug: pages.slug,
            title: pages.title,
            summary: pages.summary,
            fandomSlug: fandoms.slug,
            fandomTitle: fandoms.title,
          })
          .from(pages)
          .innerJoin(fandoms, eq(pages.fandomId, fandoms.id))
          .where(
            and(
              eq(fandoms.visibility, "public"),
              and(
                eq(pages.status, "published"),
                isNull(pages.deletedAt),
                isNull(pages.blockedAt),
              ),
              or(
                ilike(pages.title, `%${q}%`),
                ilike(pages.markdown, `%${q}%`),
                sql`array_to_string(${pages.tags}, ' ') ilike ${`%${q}%`}`,
              ),
            ),
          )
          .orderBy(desc(pages.updatedAt))
          .limit(20),
      ])
    : [{ items: [] }, []];
  return (
    <div className="stack">
      <h1>{t.search}</h1>
      <form action="/search" className="panel filter-form">
        <input
          name="q"
          defaultValue={q}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchQuery}
          required
        />
        <button className="button primary" type="submit">
          {t.find}
        </button>
      </form>
      {q && (
        <>
          <h2>{t.fandoms}</h2>
          <div className="fandom-grid">
            {fandomResult.items.map((fandom) => (
              <FandomCard fandom={fandom} key={fandom.id} />
            ))}
          </div>
          {!fandomResult.items.length && <p className="muted">{t.noFandoms}</p>}
          <section className="panel panel-tight">
            <div className="panel-heading">
              <h2>{t.articles}</h2>
            </div>
            {articles.map((article) => (
              <Link
                className="article-row"
                href={`/f/${article.fandomSlug}/wiki/${article.slug}`}
                key={article.id}
              >
                <span className="article-meta">{article.fandomTitle}</span>
                <strong>{article.title}</strong>
                <p>{article.summary}</p>
              </Link>
            ))}
            {!articles.length && (
              <div className="empty">{t.articlesNotFound}</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
