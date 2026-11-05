import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { moderationCopy } from "@/lib/moderation";
import { validPage } from "@/lib/validation";
import { getLocale } from "@/server/community";
import { isPlatformModerator } from "@/server/moderation";
import { requireUser } from "@/server/session";

export async function generateMetadata() {
  return {
    title: moderationCopy[await getLocale()].mine,
    robots: { index: false, follow: false },
  };
}
export default async function MyReports({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [current, locale, query] = await Promise.all([
    requireUser(),
    getLocale(),
    searchParams,
  ]);
  const page = validPage(query.page);
  const t = moderationCopy[locale];
  const items = await db
    .select({
      id: reports.id,
      snapshot: reports.snapshot,
      details: reports.details,
      status: reports.status,
      decision: reports.decision,
      reason: reports.reason,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.reporterId, current.id))
    .orderBy(desc(reports.createdAt), desc(reports.id))
    .limit(21)
    .offset((page - 1) * 20);
  return (
    <div className="community-page stack">
      <h1>{t.mine}</h1>
      {isPlatformModerator(current.id) && (
        <Link href="/moderation">{t.queue} →</Link>
      )}
      {items.slice(0, 20).map((item) => (
        <article className="panel stack" key={item.id}>
          <div className="moderation-row">
            <h2>{item.snapshot.title}</h2>
            <span className="moderation-status">{t[item.status]}</span>
          </div>
          <small className="muted">
            {t.reasons[item.reason]} ·{" "}
            {item.createdAt.toLocaleDateString(locale)}
          </small>
          <p className="moderation-text">{item.details}</p>
          {item.decision && (
            <p>
              {t.result}: {t.decisions[item.decision]}
            </p>
          )}
        </article>
      ))}
      {!items.length && <p className="panel">{t.empty}</p>}
      <nav className="pagination" aria-label={t.mine}>
        {page > 1 && <Link href={`?page=${page - 1}`}>{t.back}</Link>}
        {items.length > 20 && <Link href={`?page=${page + 1}`}>{t.next}</Link>}
      </nav>
    </div>
  );
}
