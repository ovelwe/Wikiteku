import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { changePage } from "@/app/wiki-actions";
import { db } from "@/lib/db";
import { pageRevisions, pages, user } from "@/lib/db/schema";
import { canEditContent, canManageFandom } from "@/lib/permissions";
import { platformCopy, platformError } from "@/lib/platform-copy";
import { validPage } from "@/lib/validation";
import { getLocale } from "@/server/community";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { requireUser } from "@/server/session";
export async function generateMetadata() {
  return {
    title: platformCopy[await getLocale()].historyTitle,
    robots: { index: false },
  };
}
export default async function History({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ error?: string; page?: string }>;
}) {
  const { slug, id } = await params;
  const query = await searchParams;
  const current = await requireUser();
  const locale = await getLocale();
  const t = platformCopy[locale];
  const fandom = await getFandom(slug);
  if (!fandom) notFound();
  const role = await getMemberRole(fandom.id, current.id);
  if (!canEditContent(role)) notFound();
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, id), eq(pages.fandomId, fandom.id)))
    .limit(1);
  if (!page) notFound();
  const offset = (validPage(query.page) - 1) * 20;
  const revisions = await db
    .select({
      version: pageRevisions,
      name: user.name,
      username: user.username,
    })
    .from(pageRevisions)
    .innerJoin(user, eq(pageRevisions.editorId, user.id))
    .where(eq(pageRevisions.pageId, id))
    .orderBy(desc(pageRevisions.revision))
    .limit(20)
    .offset(offset);
  return (
    <div className="stack">
      <Link href={`/f/${slug}/library`}>← {t.allArticles}</Link>
      <h1>
        {t.history}: {page.title}
      </h1>
      <p>{t.historyHelp}</p>
      {query.error && (
        <p role="alert" className="error">
          {platformError(query.error, locale)}
        </p>
      )}
      {canManageFandom(role) && (
        <form action={changePage.bind(null, slug, id)}>
          <input type="hidden" name="expected" value={page.revision} />
          <input
            type="hidden"
            name="action"
            value={page.deletedAt ? "unarchive" : "archive"}
          />
          <input type="hidden" name="version" value="0" />
          <button className="button" type="submit">
            {page.deletedAt ? t.unarchive : t.archive}
          </button>
        </form>
      )}
      {revisions.map(({ version: v, name, username }) => (
        <section className="panel stack" key={v.id}>
          <div className="section-head">
            <h2>
              {t.version} {v.revision}
            </h2>
            <span>
              {v.createdAt.toLocaleString(locale)} ·{" "}
              {username ? <Link href={`/u/${username}`}>{name}</Link> : name}
            </span>
          </div>
          <strong>{v.title}</strong>
          <details>
            <summary>{t.viewSource}</summary>
            <pre className="revision-source">{v.markdown}</pre>
          </details>
          {!page.deletedAt && v.revision !== page.revision && (
            <form action={changePage.bind(null, slug, id)}>
              <input type="hidden" name="expected" value={page.revision} />
              <input type="hidden" name="action" value="restore" />
              <input type="hidden" name="version" value={v.revision} />
              <button className="button" type="submit">
                {t.restoreVersion}
              </button>
            </form>
          )}
        </section>
      ))}
      <nav className="pagination">
        {offset > 0 && <Link href={`?page=${offset / 20}`}>{t.newer}</Link>}
        {revisions.length === 20 && (
          <Link href={`?page=${offset / 20 + 2}`}>{t.older}</Link>
        )}
      </nav>
    </div>
  );
}
