import Link from "next/link";
import { FavoriteForm } from "@/components/favorite-form";
import { communityCopy } from "@/lib/community";
import { categoryLabels } from "@/lib/i18n";
import { getLocale, listFavorites } from "@/server/community";
import { requireUser } from "@/server/session";

export async function generateMetadata() {
  return {
    title: communityCopy[await getLocale()].favorites,
    robots: { index: false },
  };
}
export default async function Favorites({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const current = await requireUser();
  const [items, locale, query] = await Promise.all([
    listFavorites(current.id),
    getLocale(),
    searchParams,
  ]);
  const t = communityCopy[locale];
  return (
    <div className="community-page stack">
      <div className="section-head">
        <div>
          <h1>{t.favorites}</h1>
          <p className="muted">{t.favoritesIntro}</p>
        </div>
        <Link className="button" href="/explore">
          {t.explore} →
        </Link>
      </div>
      <nav className="community-tabs" aria-label={t.favorites}>
        <Link href="/favorites" aria-current="page">
          {t.favorites} · {items.length}
        </Link>
        <Link href="/activity">{t.activity}</Link>
      </nav>
      {query.error && (
        <p className="error" role="alert">
          {query.error === "limit" ? t.limit : t.denied}
        </p>
      )}
      {items.length ? (
        <div className="saved-grid">
          {items.map(({ id, fandom }) => (
            <section className="panel saved-card" key={id}>
              {fandom ? (
                <>
                  <span className="muted">
                    {categoryLabels[locale][fandom.category] ?? fandom.category}
                  </span>
                  <h2>
                    <Link href={`/f/${fandom.slug}`}>{fandom.title}</Link>
                  </h2>
                  <p>{fandom.description}</p>
                </>
              ) : (
                <>
                  <h2>{t.unavailable}</h2>
                  <p>{t.unavailableHint}</p>
                </>
              )}
              <FavoriteForm fandomId={id} saved />
            </section>
          ))}
        </div>
      ) : (
        <section className="panel community-empty">
          <h2>{t.empty}</h2>
          <p className="muted">{t.emptyHint}</p>
          <Link className="button primary" href="/explore">
            {t.explore} →
          </Link>
        </section>
      )}
    </div>
  );
}
