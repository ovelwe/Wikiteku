import { and, desc, eq, isNull, or } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fandoms, pages, profiles, user } from "@/lib/db/schema";
import { platformCopy } from "@/lib/platform-copy";
import { getLocale } from "@/server/community";
import { getSession } from "@/server/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  return {
    title: `${platformCopy[await getLocale()].profile} ${decodeURIComponent((await params).username)}`,
  };
}

export default async function Profile({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const locale = await getLocale();
  const labels = platformCopy[locale];
  const [person] = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      createdAt: user.createdAt,
      bio: profiles.bio,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(or(eq(user.username, username), eq(user.id, username)))
    .limit(1);
  if (!person) notFound();
  const session = await getSession();
  const isOwner = session?.user.id === person.id;
  const [owned, authored] = await Promise.all([
    db
      .select()
      .from(fandoms)
      .where(
        and(
          eq(fandoms.ownerId, person.id),
          isOwner ? undefined : eq(fandoms.visibility, "public"),
        ),
      )
      .orderBy(desc(fandoms.createdAt))
      .limit(30),
    db
      .select({
        id: pages.id,
        title: pages.title,
        slug: pages.slug,
        fandomSlug: fandoms.slug,
        updatedAt: pages.updatedAt,
      })
      .from(pages)
      .innerJoin(fandoms, eq(pages.fandomId, fandoms.id))
      .where(
        and(
          eq(pages.authorId, person.id),
          isNull(pages.deletedAt),
          isNull(pages.blockedAt),
          isOwner ? undefined : eq(pages.status, "published"),
          isOwner ? undefined : eq(fandoms.visibility, "public"),
        ),
      )
      .orderBy(desc(pages.updatedAt))
      .limit(30),
  ]);
  return (
    <div className="stack">
      <section className="panel">
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            className="fandom-card-art"
            style={{ width: 76, height: 76, flexBasis: 76, borderRadius: 4 }}
            aria-hidden="true"
          >
            <span>{person.name.slice(0, 1).toUpperCase()}</span>
          </div>
          <div>
            <span className="eyebrow">{labels.profile}</span>
            <h1 style={{ margin: "4px 0" }}>{person.name}</h1>
            <span className="muted">@{person.username ?? person.id}</span>
          </div>
        </div>
        <p style={{ margin: "16px 0 0" }}>{person.bio || labels.noBio}</p>
        {isOwner && (
          <Link
            className="button small"
            href="/settings"
            style={{ marginTop: 14 }}
          >
            {labels.editProfile}
          </Link>
        )}
      </section>
      <div className="content-grid">
        <section className="panel panel-tight">
          <div className="panel-heading">
            <h2>{labels.articles}</h2>
          </div>
          {authored.map((page) => (
            <Link
              className="article-row"
              href={`/f/${page.fandomSlug}/wiki/${page.slug}`}
              key={page.id}
            >
              <strong>{page.title}</strong>
              <span className="article-meta">
                {page.updatedAt.toLocaleDateString(locale)}
              </span>
            </Link>
          ))}
          {!authored.length && <div className="empty">{labels.noArticles}</div>}
        </section>
        <aside className="stack right-column">
          <section className="panel">
            <h2>{labels.fandoms}</h2>
            {owned.map((fandom) => (
              <p key={fandom.id}>
                <Link href={`/f/${fandom.slug}`}>{fandom.title}</Link>
              </p>
            ))}
            {!owned.length && <p className="muted">{labels.noOwnedFandoms}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
