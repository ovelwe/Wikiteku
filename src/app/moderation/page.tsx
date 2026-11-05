import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { moderationCopy } from "@/lib/moderation";
import { validPage } from "@/lib/validation";
import { getLocale } from "@/server/community";
import { isPlatformModerator } from "@/server/moderation";
import { requireUser } from "@/server/session";

export async function generateMetadata() {
  return {
    title: moderationCopy[await getLocale()].queue,
    robots: { index: false, follow: false },
  };
}
export default async function Moderation({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const current = await requireUser();
  if (!isPlatformModerator(current.id)) notFound();
  const [locale, query] = await Promise.all([getLocale(), searchParams]);
  const status = query.status === "resolved" ? "resolved" : "open";
  const page = validPage(query.page);
  const t = moderationCopy[locale];
  const items = await db
    .select({
      id: reports.id,
      snapshot: reports.snapshot,
      reason: reports.reason,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt), desc(reports.id))
    .limit(21)
    .offset((page - 1) * 20);
  return (
    <div className="community-page stack">
      <h1>{t.queue}</h1>
      <nav className="wiki-tools" aria-label={t.queue}>
        <Link
          href="?status=open"
          aria-current={status === "open" ? "page" : undefined}
        >
          {t.open}
        </Link>
        <Link
          href="?status=resolved"
          aria-current={status === "resolved" ? "page" : undefined}
        >
          {t.resolved}
        </Link>
      </nav>
      {items.slice(0, 20).map((item) => (
        <Link
          className="panel moderation-row"
          key={item.id}
          href={`/moderation/${item.id}`}
        >
          <div>
            <h2>{item.snapshot.title}</h2>
            <p className="muted">
              {t.reasons[item.reason]} ·{" "}
              {item.createdAt.toLocaleDateString(locale)}
            </p>
          </div>
          <span aria-hidden="true">→</span>
        </Link>
      ))}
      {!items.length && <p className="panel">{t.empty}</p>}
      <nav className="pagination" aria-label={t.queue}>
        {page > 1 && (
          <Link href={`?status=${status}&page=${page - 1}`}>{t.back}</Link>
        )}
        {items.length > 20 && (
          <Link href={`?status=${status}&page=${page + 1}`}>{t.next}</Link>
        )}
      </nav>
    </div>
  );
}
