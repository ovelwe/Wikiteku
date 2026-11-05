import { and, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportForm } from "@/components/report-form";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { moderationCopy } from "@/lib/moderation";
import { canReadFandom } from "@/lib/permissions";
import { getLocale } from "@/server/community";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { requireUser } from "@/server/session";

export async function generateMetadata() {
  return {
    title: moderationCopy[await getLocale()].heading,
    robots: { index: false, follow: false },
  };
}
export default async function ReportArticle({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const [{ slug, id }, current, locale] = await Promise.all([
    params,
    requireUser(),
    getLocale(),
  ]);
  const fandom = await getFandom(slug);
  if (
    !fandom ||
    !canReadFandom(
      fandom.visibility,
      await getMemberRole(fandom.id, current.id),
    )
  )
    notFound();
  const [page] = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.id, id),
        eq(pages.fandomId, fandom.id),
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        isNull(pages.blockedAt),
      ),
    )
    .limit(1);
  if (!page) notFound();
  const t = moderationCopy[locale];
  return (
    <div className="narrow stack">
      <Link href={`/f/${slug}/wiki/${page.slug}`}>← {page.title}</Link>
      <h1>{t.heading}</h1>
      <ReportForm
        locale={locale}
        mode="report"
        pageId={page.id}
        revision={page.revision}
      />
    </div>
  );
}
