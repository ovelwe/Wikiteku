import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import {
  canEditContent,
  canManageFandom,
  canReadFandom,
} from "@/lib/permissions";
import { platformCopy } from "@/lib/platform-copy";
import { validPage } from "@/lib/validation";
import { getLocale } from "@/server/community";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { getSession } from "@/server/session";
export default async function Library({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    category?: string;
    page?: string;
    trash?: string;
    archived?: string;
  }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await getSession();
  const locale = await getLocale();
  const t = platformCopy[locale];
  const fandom = await getFandom(slug);
  if (!fandom) notFound();
  const role = await getMemberRole(fandom.id, session?.user.id);
  if (!canReadFandom(fandom.visibility, role)) notFound();
  const trash = query.trash === "1" && canManageFandom(role);
  const category = (query.category ?? "").slice(0, 40);
  const page = validPage(query.page);
  const where = and(
    eq(pages.fandomId, fandom.id),
    trash ? isNotNull(pages.deletedAt) : isNull(pages.deletedAt),
    canEditContent(role) ? undefined : isNull(pages.blockedAt),
    canEditContent(role) ? undefined : eq(pages.status, "published"),
  );
  const [items, categories] = await Promise.all([
    db
      .select()
      .from(pages)
      .where(
        and(
          where,
          category ? sql`${category} = any(${pages.categories})` : undefined,
        ),
      )
      .orderBy(desc(pages.updatedAt))
      .limit(30)
      .offset((page - 1) * 30),
    db
      .select({ name: sql<string>`unnest(${pages.categories})` })
      .from(pages)
      .where(where)
      .groupBy(sql`unnest(${pages.categories})`)
      .orderBy(sql`unnest(${pages.categories})`)
      .limit(100),
  ]);
  const href = (next: number) =>
    `?${new URLSearchParams({ category, page: String(next), trash: trash ? "1" : "0" })}`;
  return (
    <div className="stack">
      <Link href={`/f/${slug}`}>← {fandom.title}</Link>
      <h1>{trash ? t.trash : t.library}</h1>
      {query.archived === "1" && (
        <p className="notice" role="status">
          {t.archivedNotice}
        </p>
      )}
      {trash && <p className="muted">{t.trashHelp}</p>}
      <nav className="wiki-tools" aria-label={t.wikiNavigation}>
        <Link href={`/f/${slug}/library`}>{t.allArticles}</Link>
        {canManageFandom(role) && <Link href="?trash=1">{t.trash}</Link>}
        {canEditContent(role) && (
          <Link href={`/f/${slug}/pages/new`}>＋ {t.newArticle}</Link>
        )}
      </nav>
      <div className="tag-list">
        {categories.map((c) => (
          <Link
            className="button small"
            key={c.name}
            href={`?${new URLSearchParams({ category: c.name, trash: trash ? "1" : "0" })}`}
            aria-current={category === c.name ? "page" : undefined}
          >
            {c.name}
          </Link>
        ))}
      </div>
      {category && (
        <div className="wiki-tools">
          <h2>
            {t.category}: {category}
          </h2>
          <Link href={trash ? "?trash=1" : "?"}>{t.clearFilter}</Link>
        </div>
      )}
      {items.map((p) => (
        <Link
          className="panel"
          key={p.id}
          href={
            trash
              ? `/f/${slug}/pages/${p.id}/history`
              : p.blockedAt
                ? `/f/${slug}/pages/${p.id}/edit`
                : `/f/${slug}/wiki/${p.slug}`
          }
        >
          <h2>{p.title}</h2>
          <p>{p.summary}</p>
          <small>
            {p.blockedAt ? `${t.blocked} · ` : ""}
            {p.status === "draft" ? `${t.draft} · ` : ""}
            {t.version} {p.revision} · {p.updatedAt.toLocaleDateString(locale)}
          </small>
        </Link>
      ))}
      {!items.length && (
        <p>
          {category
            ? t.noCategoryArticles
            : trash
              ? t.emptyTrash
              : t.noArticles}
        </p>
      )}
      <nav className="pagination">
        {page > 1 && <Link href={href(page - 1)}>{t.back}</Link>}
        {items.length === 30 && <Link href={href(page + 1)}>{t.next}</Link>}
      </nav>
    </div>
  );
}
