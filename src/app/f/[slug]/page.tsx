import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DesignRenderer } from "@/components/builder/config";
import { FavoriteForm } from "@/components/favorite-form";
import { communityCopy } from "@/lib/community";
import { categoryLabels } from "@/lib/i18n";
import {
  canEditContent,
  canManageFandom,
  canReadFandom,
} from "@/lib/permissions";
import { platformCopy } from "@/lib/platform-copy";
import { getLocale, isFavorite } from "@/server/community";
import { getDesign } from "@/server/designs";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { listPages } from "@/server/pages";
import { getSession } from "@/server/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const fandom = await getFandom((await params).slug);
  if (fandom?.visibility !== "public")
    return {
      title: platformCopy[await getLocale()].fandom,
      robots: { index: false },
    };
  return {
    title: fandom.title,
    description: fandom.description,
    alternates: { canonical: `/f/${fandom.slug}` },
  };
}

export default async function Fandom({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fandom = await getFandom(slug);
  if (!fandom) notFound();
  const session = await getSession();
  const role = await getMemberRole(fandom.id, session?.user.id);
  if (!canReadFandom(fandom.visibility, role)) notFound();
  const articles = await listPages(fandom.id, canEditContent(role));
  const design = await getDesign(fandom.id);
  const locale = await getLocale();
  const labels = platformCopy[locale];
  const t = communityCopy[locale];
  const saved = session ? await isFavorite(session.user.id, fandom.id) : false;
  return (
    <div className="stack">
      <div>
        {!design?.published && (
          <div className="fandom-banner">
            <span className="eyebrow">
              {categoryLabels[locale][fandom.category] ?? fandom.category} ·{" "}
              {fandom.language.toUpperCase()}
            </span>
            <h1>{fandom.title}</h1>
            <p>{fandom.description}</p>
          </div>
        )}
        <div className="fandom-tabs">
          <Link href={`/f/${slug}`}>{labels.overview}</Link>
          <Link href={`/f/${slug}/library`}>{labels.articleLibrary}</Link>
          <Link href={`/f/${slug}/members`}>{t.members}</Link>
          {session && <FavoriteForm fandomId={fandom.id} saved={saved} />}
          {canEditContent(role) && (
            <Link href={`/f/${slug}/pages/new`}>{labels.newArticle}</Link>
          )}
          {canManageFandom(role) && (
            <>
              <Link href={`/f/${slug}/design`}>✦ {labels.design}</Link>
              <Link href={`/f/${slug}/settings`}>{labels.manage}</Link>
            </>
          )}
        </div>
      </div>
      {design?.published ? (
        <DesignRenderer
          document={design.published}
          articles={articles
            .filter((p) => p.status === "published")
            .map((p) => ({
              title: p.title,
              summary: p.summary,
              href: `/f/${slug}/wiki/${p.slug}`,
            }))}
        />
      ) : (
        <div className="content-grid">
          <section id="articles" className="panel panel-tight">
            <div className="panel-heading">
              <h2>{labels.articles}</h2>
              {canEditContent(role) && (
                <Link href={`/f/${slug}/pages/new`}>
                  ＋ {labels.writeArticle}
                </Link>
              )}
            </div>
            {articles.length ? (
              articles.map((page) => (
                <Link
                  className="article-row"
                  href={`/f/${slug}/wiki/${page.slug}`}
                  key={page.id}
                >
                  <span className="article-meta">
                    {page.status === "draft" ? `${labels.draft} · ` : ""}
                    {page.updatedAt.toLocaleDateString(locale)}
                  </span>
                  <strong>{page.title}</strong>
                  <p>{page.summary || labels.readArticle}</p>
                </Link>
              ))
            ) : (
              <div className="empty">{labels.noArticles}</div>
            )}
          </section>
          <aside className="stack right-column">
            <section className="panel">
              <h2>{labels.aboutFandom}</h2>
              <p className="muted">{fandom.description}</p>
              <div className="eyebrow">
                {labels.articles}: {articles.length} ·{" "}
                {fandom.visibility === "public"
                  ? labels.public
                  : fandom.visibility === "private"
                    ? labels.private
                    : labels.unlisted}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
