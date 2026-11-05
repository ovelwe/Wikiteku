import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportForm } from "@/components/report-form";
import { db } from "@/lib/db";
import { moderationEvents, pages, reports, user } from "@/lib/db/schema";
import { moderationCopy } from "@/lib/moderation";
import { getLocale } from "@/server/community";
import { isPlatformModerator } from "@/server/moderation";
import { requireUser } from "@/server/session";

export async function generateMetadata() {
  return {
    title: moderationCopy[await getLocale()].heading,
    robots: { index: false, follow: false },
  };
}
export default async function ReportDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await requireUser();
  if (!isPlatformModerator(current.id)) notFound();
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  const t = moderationCopy[locale];
  const [item] = await db
    .select({ report: reports, page: pages })
    .from(reports)
    .innerJoin(pages, eq(pages.id, reports.pageId))
    .where(eq(reports.id, id))
    .limit(1);
  if (!item) notFound();
  const { report, page } = item;
  const events = await db
    .select({ event: moderationEvents, name: user.name })
    .from(moderationEvents)
    .innerJoin(user, eq(user.id, moderationEvents.actorId))
    .where(eq(moderationEvents.pageId, page.id))
    .orderBy(desc(moderationEvents.moderationRevision));
  const actions: ("dismiss" | "block" | "unblock")[] =
    report.status === "open"
      ? ["dismiss", "block"]
      : report.decision === "block" && page.blockedAt
        ? ["unblock"]
        : [];
  return (
    <div className="community-page stack">
      <Link href="/moderation">← {t.queue}</Link>
      <div className="moderation-row">
        <h1>{report.snapshot.title}</h1>
        <span className="moderation-status">{t[report.status]}</span>
      </div>
      <section className="panel stack">
        <h2>{t.reasons[report.reason]}</h2>
        <p className="moderation-text">{report.details}</p>
        <small className="muted">
          {report.createdAt.toLocaleString(locale)}
        </small>
      </section>
      <div className="moderation-columns">
        <section className="panel stack">
          <h2>{t.snapshot}</h2>
          <small>
            {t.revision} {report.snapshot.revision}
          </small>
          <h3>{report.snapshot.title}</h3>
          <p>{report.snapshot.summary}</p>
          <pre className="moderation-source">{report.snapshot.markdown}</pre>
        </section>
        <section className="panel stack">
          <h2>{t.current}</h2>
          <small>
            {t.revision} {page.revision} ·{" "}
            {page.blockedAt ? t.blocked : t.available}
          </small>
          <h3>{page.title}</h3>
          <p>{page.summary}</p>
          <pre className="moderation-source">{page.markdown}</pre>
        </section>
      </div>
      {actions.length > 0 && (
        <ReportForm
          key={`${page.moderationRevision}-${page.revision}`}
          mode="decision"
          locale={locale}
          reportId={report.id}
          revision={page.moderationRevision}
          pageRevision={page.revision}
          actions={actions}
        />
      )}
      <section className="stack">
        <h2>{t.audit}</h2>
        {events.map(({ event, name }) => (
          <article className="panel stack" key={event.id}>
            <div className="moderation-row">
              <strong>{t.decisions[event.action]}</strong>
              <small>
                {event.createdAt.toLocaleString(locale)} · {name}
              </small>
            </div>
            <p className="moderation-text">{event.note}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
