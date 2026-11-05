import Link from "next/link";
import { communityCopy } from "@/lib/community";
import { validPage } from "@/lib/validation";
import { getLocale, listActivity } from "@/server/community";
import { requireUser } from "@/server/session";

export async function generateMetadata() {
  return {
    title: communityCopy[await getLocale()].activity,
    robots: { index: false },
  };
}
export default async function Activity({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const current = await requireUser();
  const page = validPage((await searchParams).page);
  const [items, locale] = await Promise.all([
    listActivity(current.id, page),
    getLocale(),
  ]);
  const t = communityCopy[locale];
  return (
    <div className="community-page stack">
      <div>
        <h1>{t.activity}</h1>
        <p className="muted">{t.activityIntro}</p>
      </div>
      <nav className="community-tabs" aria-label={t.activity}>
        <Link href="/favorites">{t.favorites}</Link>
        <Link href="/activity" aria-current="page">
          {t.activity}
        </Link>
      </nav>
      {items.length ? (
        <div className="activity-list">
          {items.slice(0, 20).map((item) => (
            <article className="panel activity-item" key={item.id}>
              <div className="activity-meta">
                <Link href={`/f/${item.fandomSlug}`}>{item.fandomTitle}</Link>
                <time dateTime={item.updatedAt.toISOString()}>
                  {t.updated}{" "}
                  {item.updatedAt.toLocaleDateString(
                    locale === "ru" ? "ru-RU" : "en-GB",
                    { timeZone: "UTC" },
                  )}
                </time>
              </div>
              <h2>
                <Link href={`/f/${item.fandomSlug}/wiki/${item.slug}`}>
                  {item.title}
                </Link>
              </h2>
              <p>{item.summary}</p>
              <small className="muted">
                {t.revision} {item.revision}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel community-empty">
          <h2>{t.noUpdates}</h2>
          <p className="muted">{t.noUpdatesHint}</p>
          <Link className="button" href="/favorites">
            {t.favorites} →
          </Link>
        </section>
      )}
      <nav className="pagination" aria-label={t.activity}>
        {page > 1 && <Link href={`?page=${page - 1}`}>← {t.back}</Link>}
        {items.length > 20 && (
          <Link href={`?page=${page + 1}`}>{t.next} →</Link>
        )}
      </nav>
    </div>
  );
}
